export function resolveBackendUrl(
  env: ImportMetaEnv = import.meta.env
): string {
  const branch = env.VITE_WORKERS_CI_BRANCH;
  const backend = env.VITE_BACKEND_URL || "http://localhost:8787";
  const hasScheme =
    backend.startsWith("http://") || backend.startsWith("https://");
  const normalizedUrl = hasScheme ? backend : `https://${backend}`;
  const parsed = new URL(normalizedUrl);

  if (branch) {
    const isLocalHost =
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname.endsWith(".localhost");

    if (!isLocalHost) {
      parsed.hostname = `${branch}.${parsed.hostname}`;
    }
  }

  return parsed.toString().replace(/\/$/, "");
}
