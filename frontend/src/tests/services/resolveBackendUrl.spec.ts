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
        VITE_WORKERS_CI_BRANCH: "",
      })
    );

    expect(url).toBe("http://127.0.0.1:8787");
  });

  it("adds https:// when backend URL has no scheme", () => {
    const url = resolveBackendUrl(
      makeEnv({
        VITE_BACKEND_URL: "api.example.com",
        VITE_WORKERS_CI_BRANCH: "",
      })
    );

    expect(url).toBe("https://api.example.com");
  });

  it("adds workers branch prefix when present", () => {
    const url = resolveBackendUrl(
      makeEnv({
        VITE_BACKEND_URL: "workers.dev",
        VITE_WORKERS_CI_BRANCH: "preview-123",
      })
    );

    expect(url).toBe("https://preview-123.workers.dev");
  });

  it("does not prefix local URLs when branch is present", () => {
    const url = resolveBackendUrl(
      makeEnv({
        VITE_BACKEND_URL: "http://127.0.0.1:8787",
        VITE_WORKERS_CI_BRANCH: "preview-123",
      })
    );

    expect(url).toBe("http://127.0.0.1:8787");
  });

  it("falls back to localhost when backend URL is missing", () => {
    const url = resolveBackendUrl(
      makeEnv({
        VITE_BACKEND_URL: "",
        VITE_WORKERS_CI_BRANCH: "",
      })
    );

    expect(url).toBe("http://localhost:8787");
  });
});
