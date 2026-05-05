import { describe, expect, it } from "vitest";
import { resolveBackendUrl } from "@/services/resolveBackendUrl";

function makeEnv(overrides: Partial<ImportMetaEnv>): ImportMetaEnv {
  return { ...import.meta.env, ...overrides };
}

describe("resolveBackendUrl", () => {
  it("returns backend URL as-is when already fully qualified", () => {
    const url = resolveBackendUrl(
      makeEnv({
        VITE_BACKEND_URL: "http://127.0.0.1:8787",
      })
    );

    expect(url).toBe("http://127.0.0.1:8787");
  });

  it("adds https:// when backend URL has no scheme", () => {
    const url = resolveBackendUrl(
      makeEnv({
        VITE_BACKEND_URL: "api.example.com",
      })
    );

    expect(url).toBe("https://api.example.com");
  });

  it("does not alter hostname when backend URL has no scheme", () => {
    const url = resolveBackendUrl(
      makeEnv({
        VITE_BACKEND_URL: "workers.dev",
      })
    );

    expect(url).toBe("https://workers.dev");
  });

  it("falls back to localhost when backend URL is missing", () => {
    const url = resolveBackendUrl(
      makeEnv({
        VITE_BACKEND_URL: "",
      })
    );

    expect(url).toBe("http://localhost:8787");
  });
});
