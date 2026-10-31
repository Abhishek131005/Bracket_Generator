import { z } from "zod";

/**
 * Public registration never accepts a role: everybody starts as a VIEWER and an admin
 * promotes them. (z.object strips unknown keys, so a `role` sent by a client is dropped.)
 */
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  name: z.string().min(1).max(80),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const setRoleSchema = z.object({
  role: z.enum(["ADMIN", "ORGANIZER", "REFEREE", "VIEWER"]),
});
