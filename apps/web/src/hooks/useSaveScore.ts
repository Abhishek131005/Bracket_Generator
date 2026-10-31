import { ApiError } from "../api";
import { useUpdateFixture } from "./useMutations";

/**
 * Saves a match result. If the correction would reset matches that were already played
 * (the server answers 409 DOWNSTREAM_PLAYED), the user is asked to confirm and the save
 * is repeated with confirmReset — nothing is changed until they agree.
 */
export function useSaveScore(stageId: string) {
  const updateFixture = useUpdateFixture(stageId);

  function save(
    fixtureId: string,
    homeScore: number,
    awayScore: number,
    callbacks: { onSuccess?: () => void; onError?: (message: string) => void }
  ) {
    const vars = { fixtureId, homeScore, awayScore };
    updateFixture.mutate(vars, {
      onSuccess: () => callbacks.onSuccess?.(),
      onError: (err) => {
        if (err instanceof ApiError && err.code === "DOWNSTREAM_PLAYED") {
          if (window.confirm(`${err.message}\n\nReset those results and save this change?`)) {
            updateFixture.mutate(
              { ...vars, confirmReset: true },
              {
                onSuccess: () => callbacks.onSuccess?.(),
                onError: (e) => callbacks.onError?.(e instanceof Error ? e.message : "Could not save."),
              }
            );
          }
          return;
        }
        callbacks.onError?.(err instanceof Error ? err.message : "Could not save.");
      },
    });
  }

  return { save, isPending: updateFixture.isPending };
}
