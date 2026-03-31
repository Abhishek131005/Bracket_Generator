import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __zemoPrismaClient: PrismaClient | undefined;
}

export const prisma = globalThis.__zemoPrismaClient ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__zemoPrismaClient = prisma;
}
