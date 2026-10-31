import bcrypt from "bcryptjs";
import { PrismaClient, type Role } from "@prisma/client";

const prisma = new PrismaClient();

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

function mapUser(record: { id: string; email: string; name: string; role: Role; createdAt: Date }): PublicUser {
  return {
    id: record.id,
    email: record.email,
    name: record.name,
    role: record.role,
    createdAt: record.createdAt.toISOString(),
  };
}

/** Public sign-up. The role is not an input: new accounts are always VIEWERs. */
export async function registerUser(input: {
  email: string;
  password: string;
  name: string;
}): Promise<PublicUser> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new Error("EMAIL_TAKEN");

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name,
      role: "VIEWER",
    },
  });
  return mapUser(user);
}

export async function verifyCredentials(input: {
  email: string;
  password: string;
}): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw new Error("INVALID_CREDENTIALS");

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw new Error("INVALID_CREDENTIALS");

  return mapUser(user);
}

export async function listUsers(): Promise<PublicUser[]> {
  const users = await prisma.user.findMany({ orderBy: [{ role: "asc" }, { createdAt: "asc" }] });
  return users.map(mapUser);
}

export async function setUserRole(userId: string, role: Role): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("USER_NOT_FOUND");

  // never leave the system without an administrator
  if (user.role === "ADMIN" && role !== "ADMIN") {
    const admins = await prisma.user.count({ where: { role: "ADMIN" } });
    if (admins <= 1) throw new Error("LAST_ADMIN");
  }

  const updated = await prisma.user.update({ where: { id: userId }, data: { role } });
  return mapUser(updated);
}

export async function getUserById(id: string): Promise<PublicUser | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return null;
  return mapUser(user);
}
