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
        WORKERS_CI_BRANCH: "",
      }),
    ).toBe("https://example.org");
  });

  it("prefixes branch for non-master branches", () => {
    expect(
      resolveFrontendUrl({
        GOOGLE_CLIENT_ID: "",
        GOOGLE_CLIENT_SECRET: "",
        JWT_SECRET: "",
        FRONTEND_URL: "fantasywiki.pages.dev",
        WORKERS_CI_BRANCH: "feat-login",
      }),
    ).toBe("https://feat-login.fantasywiki.pages.dev");
  });

  it("uses http for localhost hostnames", () => {
    expect(
      resolveFrontendUrl({
        GOOGLE_CLIENT_ID: "",
        GOOGLE_CLIENT_SECRET: "",
        JWT_SECRET: "",
        FRONTEND_URL: "localhost:5173",
        WORKERS_CI_BRANCH: "",
      }),
    ).toBe("http://localhost:5173");
  });
});
