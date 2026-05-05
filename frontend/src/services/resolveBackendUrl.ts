export function resolveBackendUrl(
  env: ImportMetaEnv = import.meta.env
): string {
  const backend = env.VITE_BACKEND_URL || "http://localhost:8787";
  const hasScheme =
    backend.startsWith("http://") || backend.startsWith("https://");
  const normalizedUrl = hasScheme ? backend : `https://${backend}`;
  return new URL(normalizedUrl).toString().replace(/\/$/, "");
}
