import { Temporal } from "@js-temporal/polyfill";
import { describe, it, expect } from "vitest";
import {
  articleAvailability,
  earlySellPayout,
  isActive,
  isExpired,
  isRenewalWindowOpen,
  remainingDays,
  remainingFraction,
  renewalIncrementalCost,
  renewalPremium,
  renewalPrice,
  settlementDelta,
  termDays,
} from "../../../model/contract";

/** A 14-day (LONG tier) term running 1–15 June 2026. */
const term = {
  purchaseDate: Temporal.PlainDate.from("2026-06-01"),
  expireDate: Temporal.PlainDate.from("2026-06-15"),
};
const on = (iso: string) => Temporal.PlainDate.from(iso);

describe("Article Availability (CONTEXT.md)", () => {
  it("names all three ownership states", () => {
    expect(articleAvailability(null, "team-1")).toBe("free-agent");
    expect(articleAvailability("team-1", "team-1")).toBe("owned-by-viewer");
    expect(articleAvailability("team-2", "team-1")).toBe("owned-by-other");
  });

  it("treats an owned article as owned-by-other for a viewer with no team", () => {
    // A player browsing a league they haven't joined must not see someone
    // else's contract as their own.
    expect(articleAvailability("team-2", undefined)).toBe("owned-by-other");
  });

  it("is free-agent when there is no owner, whoever is viewing", () => {
    expect(articleAvailability(undefined, undefined)).toBe("free-agent");
  });
});

describe("ContractTerm", () => {
  it("derives the held tier from the contract's own dates", () => {
    expect(termDays(term)).toBe(14);
  });

  it("does not clamp remainingDays past expiry", () => {
    // electRenewal relies on the negative value to report EXPIRED rather than
    // RENEWAL_WINDOW_CLOSED — clamping here would silently break that.
    expect(remainingDays(term, on("2026-06-11"))).toBe(4);
    expect(remainingDays(term, on("2026-06-15"))).toBe(0);
    expect(remainingDays(term, on("2026-06-20"))).toBe(-5);
  });

  it("reports active until the expiry date", () => {
    expect(isActive(term, on("2026-06-14"))).toBe(true);
    expect(isActive(term, on("2026-06-15"))).toBe(false);
    expect(isExpired(term, on("2026-06-15"))).toBe(false);
    expect(isExpired(term, on("2026-06-16"))).toBe(true);
  });

  it("floors remainingFraction at 0 and never divides by zero", () => {
    expect(remainingFraction(term, on("2026-06-08"))).toBeCloseTo(0.5);
    expect(remainingFraction(term, on("2026-06-20"))).toBe(0);
    expect(
      remainingFraction(
        { purchaseDate: on("2026-06-01"), expireDate: on("2026-06-01") },
        on("2026-06-01"),
      ),
    ).toBe(0);
  });
});

describe("Early Sell (ADR 0003)", () => {
  it("pays only for the unused part of the term", () => {
    // Half the 14-day term left, at a live price of 700.
    expect(earlySellPayout(term, 700, on("2026-06-08"))).toBe(350);
  });

  it("pays the full price when sold the day it was bought", () => {
    expect(earlySellPayout(term, 700, on("2026-06-01"))).toBe(700);
  });

  it("cannot exceed the price — the partial-hold exploit it guards", () => {
    // Holding 3 of 14 days must recover well under the full price, or a short
    // hold would return the stake plus free days of points.
    expect(earlySellPayout(term, 700, on("2026-06-04"))).toBe(550);
    expect(earlySellPayout(term, 700, on("2026-06-04"))).toBeLessThan(700);
  });

  it("floors at 0 past expiry", () => {
    expect(earlySellPayout(term, 700, on("2026-06-20"))).toBe(0);
  });
});

describe("Expiry Settlement (ADR 0003)", () => {
  it("reports the mark-to-market P&L, gain and loss alike", () => {
    expect(settlementDelta(300, 450)).toBe(150);
    expect(settlementDelta(300, 210)).toBe(-90);
    expect(settlementDelta(300, 300)).toBe(0);
  });
});

describe("Renewal Premium (ADR 0003)", () => {
  it("charges +10% from the very first renewal, escalating each time", () => {
    // The argument is renewals *already* completed, so 0 prior renewals is the
    // first renewal and must cost +10% — not 0. A free first renewal would let
    // a player hold an article two full terms with no anti-hoard cost.
    expect(renewalPremium(500, 0)).toBe(50);
    expect(renewalPremium(500, 1)).toBe(100);
    expect(renewalPremium(500, 2)).toBe(150);
  });

  it("locks in current price plus premium as the new purchase price", () => {
    expect(renewalPrice(500, 0)).toBe(550);
    expect(renewalPrice(500, 2)).toBe(650);
  });

  it("charges only the difference, since the old stake is already sunk", () => {
    expect(renewalIncrementalCost(600, 500)).toBe(100);
  });

  it("makes renewal free when the article has fallen in value", () => {
    expect(renewalIncrementalCost(400, 500)).toBe(-100);
  });
});

describe("Renewal window (ADR 0003)", () => {
  it("opens only in the final 24 hours", () => {
    expect(isRenewalWindowOpen(term, on("2026-06-13"))).toBe(false);
    expect(isRenewalWindowOpen(term, on("2026-06-14"))).toBe(true);
    expect(isRenewalWindowOpen(term, on("2026-06-15"))).toBe(true);
  });

  it("is closed once the term has expired", () => {
    expect(isRenewalWindowOpen(term, on("2026-06-16"))).toBe(false);
  });
});
