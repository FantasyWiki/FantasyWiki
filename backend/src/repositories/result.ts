export type Result<T, E = string> =
  { ok: true; value: T } | { ok: false; error: E };

export const success = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const failure = <E>(error: E): Result<never, E> => ({
  ok: false,
  error,
});

export function unwrap<T>(result: Result<T>, what: string): T {
  if (!result.ok) {
    throw new Error(`Could not resolve ${what}: ${result.error}`);
  }
  return result.value;
}
