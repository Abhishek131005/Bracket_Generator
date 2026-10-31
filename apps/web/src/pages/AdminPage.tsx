import { motion } from "framer-motion";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchUsers, updateUserRole } from "../api";
import { useAppStore, type UserRole } from "../store";

const ROLES: { id: UserRole; label: string; hint: string }[] = [
  { id: "VIEWER", label: "Viewer", hint: "read only" },
  { id: "REFEREE", label: "Referee", hint: "enters scores & results" },
  { id: "ORGANIZER", label: "Organizer", hint: "creates tournaments & stages" },
  { id: "ADMIN", label: "Admin", hint: "everything, incl. users" },
];

export function AdminPage() {
  const me = useAppStore((s) => s.user);
  const qc = useQueryClient();
  const [error, setError] = useState("");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: fetchUsers,
    enabled: me?.role === "ADMIN",
  });

  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) => updateUserRole(userId, role),
    onSuccess: () => {
      setError("");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Could not change role."),
  });

  if (me?.role !== "ADMIN") {
    return (
      <motion.div className="page-admin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="empty-state large"><span className="empty-icon">🔒</span><p>Only admins can manage users.</p></div>
      </motion.div>
    );
  }

  return (
    <motion.div className="page-admin" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <h1 className="page-title">Users &amp; Roles</h1>
      <p className="page-sub">
        New sign-ups start as Viewers. Upgrade people here. A user picks up a new role the next time they open or refresh the app.
      </p>
      {error && <p className="form-error">{error}</p>}

      {isLoading ? (
        <div className="empty-state"><span className="empty-icon">⏳</span><p>Loading users...</p></div>
      ) : (
        <div className="admin-user-list">
          <div className="admin-user-row admin-user-head">
            <span>Name</span><span>Email</span><span>Role</span>
          </div>
          {users.map((u) => (
            <div key={u.id} className="admin-user-row">
              <span className="admin-user-name">{u.name}{u.id === me.id && <em> (you)</em>}</span>
              <span className="admin-user-email">{u.email}</span>
              <span>
                <select
                  className="field-select"
                  value={u.role}
                  disabled={u.id === me.id || changeRole.isPending}
                  title={u.id === me.id ? "You can't change your own role" : undefined}
                  onChange={(e) => changeRole.mutate({ userId: u.id, role: e.target.value as UserRole })}
                >
                  {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label} — {r.hint}</option>)}
                </select>
              </span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
