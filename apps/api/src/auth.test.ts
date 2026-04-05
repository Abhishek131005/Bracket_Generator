import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createServer } from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import {
  JWT_SECRET,
  signToken,
  verifyToken,
  requireAuth,
  requireRole,
  type JwtPayload,
} from "./middleware/auth.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePayload(role: JwtPayload["role"] = "ORGANIZER"): JwtPayload {
  return { sub: "user-1", email: "test@zemo.io", name: "Test User", role };
}

function makeApp() {
  const app = express();
  app.use(express.json());
  return app;
}

async function request(
  app: express.Express,
  method: string,
  path: string,
  headers?: Record<string, string>
): Promise<{ status: number; body: Record<string, unknown> }> {
  const server = createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as { port: number }).port;

  const res = await fetch(`http://localhost:${port}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
  });
  const body = await res.json() as Record<string, unknown>;
  await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
  return { status: res.status, body };
}

// ── signToken / verifyToken ───────────────────────────────────────────────────

describe("signToken / verifyToken", () => {
  it("round-trips a payload", () => {
    const payload = makePayload("REFEREE");
    const token = signToken(payload);
    const decoded = verifyToken(token);
    assert.equal(decoded.sub, "user-1");
    assert.equal(decoded.role, "REFEREE");
    assert.equal(decoded.email, "test@zemo.io");
  });

  it("verifyToken throws on a tampered token", () => {
    const token = signToken(makePayload()) + "tampered";
    assert.throws(() => verifyToken(token));
  });

  it("verifyToken throws on a token signed with a different secret", () => {
    const bad = jwt.sign(makePayload(), "wrong-secret");
    assert.throws(() => verifyToken(bad));
  });

  it("verifyToken throws on an expired token", () => {
    const expired = jwt.sign(makePayload(), JWT_SECRET, { expiresIn: -1 });
    assert.throws(() => verifyToken(expired));
  });
});

// ── requireAuth middleware ────────────────────────────────────────────────────

describe("requireAuth middleware", () => {
  it("passes with a valid token and sets req.user", async () => {
    const app = makeApp();
    app.get("/test", requireAuth, (req, res) => {
      res.json({ role: req.user?.role });
    });

    const token = signToken(makePayload("ADMIN"));
    const { status, body } = await request(app, "GET", "/test", {
      Authorization: `Bearer ${token}`,
    });
    assert.equal(status, 200);
    assert.equal(body.role, "ADMIN");
  });

  it("returns 401 when Authorization header is missing", async () => {
    const app = makeApp();
    app.get("/test", requireAuth, (_req, res) => res.json({ ok: true }));

    const { status } = await request(app, "GET", "/test");
    assert.equal(status, 401);
  });

  it("returns 401 when token is malformed", async () => {
    const app = makeApp();
    app.get("/test", requireAuth, (_req, res) => res.json({ ok: true }));

    const { status } = await request(app, "GET", "/test", {
      Authorization: "Bearer not.a.real.token",
    });
    assert.equal(status, 401);
  });

  it("returns 401 when token is expired", async () => {
    const app = makeApp();
    app.get("/test", requireAuth, (_req, res) => res.json({ ok: true }));

    const expired = jwt.sign(makePayload(), JWT_SECRET, { expiresIn: -1 });
    const { status } = await request(app, "GET", "/test", {
      Authorization: `Bearer ${expired}`,
    });
    assert.equal(status, 401);
  });

  it("returns 401 when Authorization is not Bearer scheme", async () => {
    const app = makeApp();
    app.get("/test", requireAuth, (_req, res) => res.json({ ok: true }));

    const { status } = await request(app, "GET", "/test", {
      Authorization: "Basic dXNlcjpwYXNz",
    });
    assert.equal(status, 401);
  });
});

// ── requireRole middleware ────────────────────────────────────────────────────

describe("requireRole middleware", () => {
  it("allows access when role matches", async () => {
    const app = makeApp();
    app.get("/test", requireRole("ORGANIZER", "ADMIN"), (_req, res) => res.json({ ok: true }));

    const token = signToken(makePayload("ORGANIZER"));
    const { status } = await request(app, "GET", "/test", {
      Authorization: `Bearer ${token}`,
    });
    assert.equal(status, 200);
  });

  it("returns 403 when role is insufficient", async () => {
    const app = makeApp();
    app.get("/test", requireRole("ORGANIZER", "ADMIN"), (_req, res) => res.json({ ok: true }));

    const token = signToken(makePayload("VIEWER"));
    const { status, body } = await request(app, "GET", "/test", {
      Authorization: `Bearer ${token}`,
    });
    assert.equal(status, 403);
    assert.ok((body.error as string).toLowerCase().includes("permission"));
  });

  it("returns 403 for REFEREE when only ORGANIZER/ADMIN are allowed", async () => {
    const app = makeApp();
    app.post("/admin-only", requireRole("ORGANIZER", "ADMIN"), (_req, res) => res.json({ ok: true }));

    const token = signToken(makePayload("REFEREE"));
    const { status } = await request(app, "POST", "/admin-only", {
      Authorization: `Bearer ${token}`,
    });
    assert.equal(status, 403);
  });

  it("returns 401 when no token is provided even if role would match", async () => {
    const app = makeApp();
    app.get("/test", requireRole("VIEWER"), (_req, res) => res.json({ ok: true }));

    const { status } = await request(app, "GET", "/test");
    assert.equal(status, 401);
  });

  it("REFEREE can access REFEREE|ORGANIZER|ADMIN routes", async () => {
    const app = makeApp();
    app.patch("/score", requireRole("REFEREE", "ORGANIZER", "ADMIN"), (_req, res) => res.json({ ok: true }));

    const token = signToken(makePayload("REFEREE"));
    const { status } = await request(app, "PATCH", "/score", {
      Authorization: `Bearer ${token}`,
    });
    assert.equal(status, 200);
  });

  it("ADMIN can access any role-protected route", async () => {
    const app = makeApp();
    app.delete("/entry", requireRole("REFEREE", "ORGANIZER", "ADMIN"), (_req, res) => res.json({ ok: true }));

    const token = signToken(makePayload("ADMIN"));
    const { status } = await request(app, "DELETE", "/entry", {
      Authorization: `Bearer ${token}`,
    });
    assert.equal(status, 200);
  });
});
