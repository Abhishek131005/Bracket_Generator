import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { socket } from "../socket";

/**
 * Joins a stage room on the Socket.IO server and invalidates the relevant
 * TanStack Query caches when live events arrive.
 *
 * Rooms live on the server per connection, so the join is re-sent on every
 * (re)connect — otherwise a client that drops and reconnects silently stops
 * receiving updates. After a reconnect the stage data is refetched once to
 * catch anything missed while offline.
 *
 * Mount this inside any component that displays live stage data.
 */
export function useSocketSync(stageId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!stageId) return;

    const refreshStage = (sid: string) => {
      queryClient.invalidateQueries({ queryKey: ["fixtures", sid] });
      queryClient.invalidateQueries({ queryKey: ["standings", sid] });
      queryClient.invalidateQueries({ queryKey: ["performances", sid] });
    };

    // The first join for this mount (immediate, or on the first "connect") happens
    // right after the data was loaded; every later "connect" is a reconnect and
    // needs a refetch.
    let isReconnect = false;

    function onConnect() {
      socket.emit("join:stage", stageId);
      if (isReconnect) refreshStage(stageId!);
      isReconnect = true;
    }

    function onFixtureUpdated({ stageId: sid }: { stageId: string }) {
      queryClient.invalidateQueries({ queryKey: ["fixtures", sid] });
      // Scores change the points table too, for everyone watching — not just the scorer.
      queryClient.invalidateQueries({ queryKey: ["standings", sid] });
    }

    function onPerformanceUpdated({ stageId: sid }: { stageId: string }) {
      queryClient.invalidateQueries({ queryKey: ["performances", sid] });
    }

    // A stage (and so possibly its tournament) changed status, e.g. DRAFT -> IN_PROGRESS -> COMPLETED.
    function onStageUpdated() {
      queryClient.invalidateQueries({ queryKey: ["stages"] });
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
    }

    socket.on("connect", onConnect);
    socket.on("fixture:updated", onFixtureUpdated);
    socket.on("performance:updated", onPerformanceUpdated);
    socket.on("stage:updated", onStageUpdated);

    if (socket.connected) onConnect();
    else socket.connect();

    return () => {
      socket.emit("leave:stage", stageId);
      socket.off("connect", onConnect);
      socket.off("fixture:updated", onFixtureUpdated);
      socket.off("performance:updated", onPerformanceUpdated);
      socket.off("stage:updated", onStageUpdated);
    };
  }, [stageId, queryClient]);
}
