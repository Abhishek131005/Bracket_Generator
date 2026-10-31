import { useAppStore } from "../store";

/**
 * What the signed-in user may do. This only controls which buttons are shown —
 * the API enforces the same rules (see requireRole in apps/api/src/index.ts).
 */
export function usePermissions() {
  const role = useAppStore((s) => s.user?.role);
  const canManage = role === "ORGANIZER" || role === "ADMIN";               // create / generate / manage
  const canScore = canManage || role === "REFEREE";                          // enter scores & results
  return { role, canManage, canScore };
}
