export function resolveBackendUrl(
  env: ImportMetaEnv = import.meta.env
): string {
  const branch = env.VITE_WORKERS_CI_BRANCH;
  const backend = env.VITE_BACKEND_URL || "http://localhost:8787";

  let url = backend;

  if (branch) {
    url = `${branch}.${backend}`;
  }

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }

  return url;
}
