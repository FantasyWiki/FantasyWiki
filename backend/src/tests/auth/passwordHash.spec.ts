import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../../auth/password/hash";

/**
 * A `.spec.ts`, so it runs in both target passes: the hashing is pure
 * WebCrypto, with no persistence and nothing to seed, and it is the one part of
 * password auth that both builds can compile.
 */
describe("password hashing", () => {
  it("accepts the password it was made from", async () => {
    const record = await hashPassword("correct horse battery staple");

    await expect(
      verifyPassword("correct horse battery staple", record),
    ).resolves.toBe(true);
  });

  it("rejects any other password", async () => {
    const record = await hashPassword("correct horse battery staple");

    await expect(
      verifyPassword("correct horse battery stapl", record),
    ).resolves.toBe(false);
    await expect(verifyPassword("", record)).resolves.toBe(false);
  });

  it("salts, so the same password twice is stored twice differently", async () => {
    const first = await hashPassword("same password");
    const second = await hashPassword("same password");

    expect(first).not.toEqual(second);
    await expect(verifyPassword("same password", second)).resolves.toBe(true);
  });

  it("never stores the password itself", async () => {
    const record = await hashPassword("plaintext-canary");

    expect(record).not.toContain("plaintext-canary");
  });

  /**
   * What makes raising the cost possible without invalidating what is stored:
   * verification reads the parameters off the record rather than off the
   * module. A record written under a weaker setting still verifies.
   */
  it("verifies against the record's own parameters, not today's", async () => {
    const record = await hashPassword("stable password");
    const [algorithm, hash, iterations, salt, key] = record.split("$");

    expect(algorithm).toBe("pbkdf2");
    expect(hash).toBe("sha256");
    expect(Number(iterations)).toBeGreaterThan(0);

    const weaker = [algorithm, hash, "1000", salt, key].join("$");
    // Same salt, fewer rounds: a different derivation, so this must not match —
    // which is the proof the count is being read rather than assumed.
    await expect(verifyPassword("stable password", weaker)).resolves.toBe(
      false,
    );
  });

  it("treats a malformed record as a failed match rather than throwing", async () => {
    for (const record of [
      "",
      "not-a-record",
      "bcrypt$sha256$1000$c2FsdA==$aGFzaA==",
      "pbkdf2$sha512$1000$c2FsdA==$aGFzaA==",
      "pbkdf2$sha256$zero$c2FsdA==$aGFzaA==",
      "pbkdf2$sha256$1000$$",
      // Not base64: `atob` throws on these, and a record is stored data rather
      // than something this module produced.
      "pbkdf2$sha256$1000$not!base64$aGFzaA==",
      "pbkdf2$sha256$1000$a$aGFzaA==",
    ]) {
      await expect(verifyPassword("anything", record)).resolves.toBe(false);
    }
  });
});
