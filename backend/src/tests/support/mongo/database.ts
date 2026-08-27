import { expect } from "vitest";

/**
 * A database of this test file's own.
 *
 * The suite is written as if each file owned the store: `reset()` empties
 * everything before every test, and ids only have to be unique within a file.
 * D1 makes that true for free — the Workers pool hands every file its own
 * database — while one MongoDB server does not, so the files had to be run one
 * at a time, and 45 files' worth of isolate startup stopped overlapping.
 *
 * Naming the database after the file restores the assumption, and with it the
 * parallelism. The name is a hash of the path rather than the path itself
 * because MongoDB database names may not contain `/` and stop at 63 bytes;
 * hashing also keeps it stable across runs, so a suite leaves the same handful
 * of databases behind rather than a fresh set every time.
 *
 * Falls back to whatever the bindings said when there is no test in progress —
 * nothing calls it there today, but "no path" should not mean "no database".
 */
export function perFileDatabase(): string | undefined {
  const path = expect.getState().testPath;
  return path === undefined ? undefined : `fantasywiki_test_${digest(path)}`;
}

/** djb2, base36. Short, stable, and no dependency — it names a database. */
function digest(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}
