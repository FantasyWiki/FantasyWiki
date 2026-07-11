import { describe, expect, it } from "vitest";
import { resolveFrontendUrl } from "../routes/auth";

describe("resolveFrontendUrl", () => {
  it("keeps explicit https URLs", () => {
    expect(
      resolveFrontendUrl({
        GOOGLE_CLIENT_ID: "",
        GOOGLE_CLIENT_SECRET: "",
        JWT_SECRET: "",
        FRONTEND_URL: "https://example.org",
      }),
    ).toBe("https://example.org");
  });

  it("adds https scheme for non-local hostnames without scheme", () => {
    expect(
      resolveFrontendUrl({
        GOOGLE_CLIENT_ID: "",
        GOOGLE_CLIENT_SECRET: "",
        JWT_SECRET: "",
        FRONTEND_URL: "fantasywiki.pages.dev",
      }),
    ).toBe("https://fantasywiki.pages.dev");
  });

  it("uses http for localhost hostnames", () => {
    expect(
      resolveFrontendUrl({
        GOOGLE_CLIENT_ID: "",
        GOOGLE_CLIENT_SECRET: "",
        JWT_SECRET: "",
        FRONTEND_URL: "localhost:5173",
      }),
    ).toBe("http://localhost:5173");
  });
});
