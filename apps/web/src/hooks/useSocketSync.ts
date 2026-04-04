import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { socket } from "../socket";

/**
 * Joins a stage room on the Socket.IO server and invalidates the relevant
 * TanStack Query caches when live events arrive.
 *
 * Mount this inside any component that displays live stage data.
 */
export function useSocketSync(stageId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!stageId) return;

    if (!socket.connected) socket.connect();

    socket.emit("join:stage", stageId);

    function onFixtureUpdated({ stageId: sid }: { stageId: string }) {
      queryClient.invalidateQueries({ queryKey: ["fixtures", sid] });
    }

    function onPerformanceUpdated({ stageId: sid }: { stageId: string }) {
      queryClient.invalidateQueries({ queryKey: ["performances", sid] });
    }

    socket.on("fixture:updated", onFixtureUpdated);
    socket.on("performance:updated", onPerformanceUpdated);

    return () => {
      socket.emit("leave:stage", stageId);
      socket.off("fixture:updated", onFixtureUpdated);
      socket.off("performance:updated", onPerformanceUpdated);
    };
  }, [stageId, queryClient]);
}
