/**
 * Promote (or demote) an account from the command line. This is how the very first admin is
 * created, because public registration only ever produces VIEWER accounts.
 *
 *   npm run set-role -w apps/api -- someone@example.com ADMIN
 */
import { prisma } from "../src/db.js";

const ROLES = ["ADMIN", "ORGANIZER", "REFEREE", "VIEWER"] as const;
type RoleName = (typeof ROLES)[number];

const [email, role] = process.argv.slice(2);

async function main() {
  if (!email || !ROLES.includes(role as RoleName)) {
    console.error(`Usage: npm run set-role -w apps/api -- <email> <${ROLES.join("|")}>`);
    process.exitCode = 1;
    return;
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No account found for ${email}. Register it first, then run this again.`);
    process.exitCode = 1;
    return;
  }
  await prisma.user.update({ where: { id: user.id }, data: { role: role as RoleName } });
  console.log(`${email}: ${user.role} -> ${role}`);
}

main().finally(() => prisma.$disconnect());
