interface Env {
  BACKEND: { fetch(request: Request): Promise<Response> };
}

type Ctx = { request: Request; env: Env };

export async function onRequest({ request, env }: Ctx): Promise<Response> {
  return env.BACKEND.fetch(request);
}
