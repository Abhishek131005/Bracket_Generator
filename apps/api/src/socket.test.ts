import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, describe, it } from "node:test";
import { Server as SocketIOServer } from "socket.io";
import { io as Client, type Socket as ClientSocket } from "socket.io-client";

// ── Helpers ───────────────────────────────────────────────────────────────────

function waitForEvent<T = unknown>(emitter: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve) => emitter.once(event, resolve));
}

function waitForConnect(client: ClientSocket): Promise<void> {
  return new Promise((resolve) => {
    if (client.connected) { resolve(); return; }
    client.once("connect", resolve);
  });
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe("Socket.IO server", () => {
  let io: SocketIOServer;
  let port: number;

  before(async () => {
    const httpServer = createServer();
    io = new SocketIOServer(httpServer, { cors: { origin: "*" } });

    io.on("connection", (socket) => {
      socket.on("join:stage", (stageId: string) => {
        socket.join(`stage:${stageId}`);
      });
      socket.on("leave:stage", (stageId: string) => {
        socket.leave(`stage:${stageId}`);
      });
    });

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        port = typeof addr === "object" && addr ? addr.port : 0;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve, reject) =>
      io.close((err) => (err ? reject(err) : resolve()))
    );
  });

  it("client can connect", async () => {
    const client = Client(`http://localhost:${port}`, { transports: ["websocket"] });
    await waitForConnect(client);
    assert.ok(client.connected, "client should be connected");
    client.disconnect();
  });

  it("server broadcasts fixture:updated to joined room", async () => {
    const client = Client(`http://localhost:${port}`, { transports: ["websocket"] });
    await waitForConnect(client);

    client.emit("join:stage", "stage-abc");
    // Give the server a tick to process the join before emitting
    await new Promise((r) => setTimeout(r, 30));

    const received = waitForEvent<{ stageId: string }>(client, "fixture:updated");
    io.to("stage:stage-abc").emit("fixture:updated", { stageId: "stage-abc" });

    const payload = await received;
    assert.equal(payload.stageId, "stage-abc");
    client.disconnect();
  });

  it("server broadcasts performance:updated to joined room", async () => {
    const client = Client(`http://localhost:${port}`, { transports: ["websocket"] });
    await waitForConnect(client);

    client.emit("join:stage", "stage-xyz");
    await new Promise((r) => setTimeout(r, 30));

    const received = waitForEvent<{ stageId: string }>(client, "performance:updated");
    io.to("stage:xyz").emit("performance:updated", { stageId: "stage-xyz" });

    // Confirm wrong room → no message (short race: should still be pending)
    const raceResult = await Promise.race([
      received,
      new Promise<"timeout">((r) => setTimeout(() => r("timeout"), 100)),
    ]);
    // Client joined "stage:stage-xyz" but server emitted to "stage:xyz" — should timeout
    assert.equal(raceResult, "timeout", "should not receive event from a different room");
    client.disconnect();
  });

  it("room isolation: event does not reach clients in other rooms", async () => {
    const clientA = Client(`http://localhost:${port}`, { transports: ["websocket"] });
    const clientB = Client(`http://localhost:${port}`, { transports: ["websocket"] });

    await Promise.all([waitForConnect(clientA), waitForConnect(clientB)]);

    clientA.emit("join:stage", "room-A");
    clientB.emit("join:stage", "room-B");
    await new Promise((r) => setTimeout(r, 30));

    const receivedByA = waitForEvent(clientA, "fixture:updated");
    // Emit only to room-A
    io.to("stage:room-A").emit("fixture:updated", { stageId: "room-A" });

    // A should receive it
    await receivedByA;

    // B should not receive it within 100 ms
    const raceB = await Promise.race([
      waitForEvent(clientB, "fixture:updated"),
      new Promise<"timeout">((r) => setTimeout(() => r("timeout"), 100)),
    ]);
    assert.equal(raceB, "timeout", "client B should not receive room-A event");

    clientA.disconnect();
    clientB.disconnect();
  });

  it("client can leave a room and stops receiving events", async () => {
    const client = Client(`http://localhost:${port}`, { transports: ["websocket"] });
    await waitForConnect(client);

    client.emit("join:stage", "leavable");
    await new Promise((r) => setTimeout(r, 30));

    client.emit("leave:stage", "leavable");
    await new Promise((r) => setTimeout(r, 30));

    const raceResult = await Promise.race([
      waitForEvent(client, "fixture:updated"),
      new Promise<"timeout">((r) => setTimeout(() => r("timeout"), 100)),
    ]);
    io.to("stage:leavable").emit("fixture:updated", { stageId: "leavable" });
    assert.equal(raceResult, "timeout", "should not receive after leaving room");

    client.disconnect();
  });
});
