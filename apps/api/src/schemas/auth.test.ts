import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loginSchema, registerSchema, setRoleSchema } from "./auth.js";

describe("registerSchema", () => {
  const valid = { email: "a@b.io", password: "longenough", name: "Ann" };

  it("accepts a normal registration", () => {
    assert.equal(registerSchema.safeParse(valid).success, true);
  });

  it("drops a role supplied by the client, so self-promotion is impossible", () => {
    const parsed = registerSchema.parse({ ...valid, role: "ADMIN" });
    assert.equal("role" in parsed, false);
  });

  it("rejects short passwords and bad emails", () => {
    assert.equal(registerSchema.safeParse({ ...valid, password: "short" }).success, false);
    assert.equal(registerSchema.safeParse({ ...valid, email: "nope" }).success, false);
  });
});

describe("loginSchema", () => {
  it("requires an email and a password", () => {
    assert.equal(loginSchema.safeParse({ email: "a@b.io", password: "x" }).success, true);
    assert.equal(loginSchema.safeParse({ email: "a@b.io", password: "" }).success, false);
  });
});

describe("setRoleSchema", () => {
  it("accepts only known roles", () => {
    assert.equal(setRoleSchema.safeParse({ role: "REFEREE" }).success, true);
    assert.equal(setRoleSchema.safeParse({ role: "SUPERUSER" }).success, false);
  });
});
