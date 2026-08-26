/**
 * Vite serves any file as a string with `?raw`. Used by the OpenAPI drift test,
 * which has to read `openapi.yaml` from inside the Workers pool, where there is
 * no filesystem to read it from.
 */
declare module "*.yaml?raw" {
  const content: string;
  export default content;
}
