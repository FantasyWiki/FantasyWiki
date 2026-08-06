import { describe, it, expect } from "vitest";
import {
  INVITATION_CODE_ALPHABET,
  INVITATION_CODE_LENGTH,
  isInvitationCode,
  normalizeInvitationCode,
} from "../../../model/league";
import {
  INVITATION_CODE_ATTEMPTS,
  generateInvitationCode,
  withUniqueInvitationCode,
} from "../services/invitationCode";
import { LEAGUE_ERRORS } from "../repositories/leagueRepository";
import { failure, success } from "../repositories/result";

describe("invitation code alphabet", () => {
  it("holds 30 characters, which is where 24.3 million codes comes from", () => {
    expect(INVITATION_CODE_ALPHABET.length).toBe(30);
    expect(INVITATION_CODE_ALPHABET.length ** INVITATION_CODE_LENGTH).toBe(
      24_300_000,
    );
  });

  it("excludes the characters people read wrong out loud", () => {
    // 0/O and 1/I/L are the pairs a code gets misheard as; U is dropped so a
    // random draw cannot spell something unfortunate.
    for (const c of ["0", "O", "1", "I", "L", "U"]) {
      expect(INVITATION_CODE_ALPHABET).not.toContain(c);
    }
  });

  it("holds no duplicates, which would skew the draw", () => {
    expect(new Set(INVITATION_CODE_ALPHABET).size).toBe(
      INVITATION_CODE_ALPHABET.length,
    );
  });
});

describe("isInvitationCode", () => {
  it("accepts a well-formed code", () => {
    expect(isInvitationCode("EARTH")).toBe(true);
  });

  it("rejects the wrong length", () => {
    expect(isInvitationCode("EART")).toBe(false);
    expect(isInvitationCode("EARTHS")).toBe(false);
    expect(isInvitationCode("")).toBe(false);
  });

  it("rejects characters outside the alphabet", () => {
    expect(isInvitationCode("earth")).toBe(false);
    expect(isInvitationCode("EAR0H")).toBe(false);
    expect(isInvitationCode("EAR-H")).toBe(false);
    expect(isInvitationCode("EA TH")).toBe(false);
  });

  it("rejects anything that is not a string", () => {
    expect(isInvitationCode(null)).toBe(false);
    expect(isInvitationCode(12345)).toBe(false);
    expect(isInvitationCode(undefined)).toBe(false);
  });
});

describe("normalizeInvitationCode", () => {
  it("makes a pasted code usable", () => {
    // How a code actually arrives: out of a chat message, or read back with
    // hyphens that were never in it.
    expect(normalizeInvitationCode(" ear-th ")).toBe("EARTH");
    expect(normalizeInvitationCode("EA RTH")).toBe("EARTH");
    expect(isInvitationCode(normalizeInvitationCode("e a-r-t-h"))).toBe(true);
  });

  it("leaves an already-clean code alone", () => {
    expect(normalizeInvitationCode("EARTH")).toBe("EARTH");
  });
});

describe("generateInvitationCode", () => {
  it("only ever draws well-formed codes", () => {
    for (let i = 0; i < 500; i++) {
      expect(isInvitationCode(generateInvitationCode())).toBe(true);
    }
  });

  it("can draw every character in the alphabet", () => {
    // Rejection sampling throws bytes away; a bug in the ceiling would quietly
    // make the tail of the alphabet unreachable rather than fail outright.
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) {
      for (const c of generateInvitationCode()) seen.add(c);
    }
    expect(seen.size).toBe(INVITATION_CODE_ALPHABET.length);
  });

  it("does not keep drawing the same code", () => {
    const codes = new Set(
      Array.from({ length: 200 }, () => generateInvitationCode()),
    );
    expect(codes.size).toBeGreaterThan(190);
  });
});

describe("withUniqueInvitationCode", () => {
  it("passes a fresh code to the write and returns its result", async () => {
    const seen: string[] = [];
    const result = await withUniqueInvitationCode(async (code) => {
      seen.push(code);
      return success("written");
    });

    expect(result).toEqual(success("written"));
    expect(seen).toHaveLength(1);
    expect(isInvitationCode(seen[0])).toBe(true);
  });

  it("redraws a different code when the index rejects one", async () => {
    const seen: string[] = [];
    const result = await withUniqueInvitationCode(async (code) => {
      seen.push(code);
      return seen.length === 1
        ? failure(LEAGUE_ERRORS.INVITATION_CODE_TAKEN)
        : success("written");
    });

    expect(result).toEqual(success("written"));
    expect(seen).toHaveLength(2);
    expect(seen[0]).not.toBe(seen[1]);
  });

  it("gives up rather than looping when every code collides", async () => {
    let attempts = 0;
    const result = await withUniqueInvitationCode(async () => {
      attempts++;
      return failure(LEAGUE_ERRORS.INVITATION_CODE_TAKEN);
    });

    // Bounded: with 24.3 million codes, endless collisions mean something is
    // broken, and a hung request is a worse answer than an error.
    expect(attempts).toBe(INVITATION_CODE_ATTEMPTS);
    expect(result).toEqual(failure(LEAGUE_ERRORS.INVITATION_CODE_UNAVAILABLE));
  });

  it("does not retry a failure that is not a collision", async () => {
    let attempts = 0;
    const result = await withUniqueInvitationCode(async () => {
      attempts++;
      return failure("D1 is down");
    });

    // Retrying a real persistence failure only repeats it, more slowly.
    expect(attempts).toBe(1);
    expect(result).toEqual(failure("D1 is down"));
  });
});
