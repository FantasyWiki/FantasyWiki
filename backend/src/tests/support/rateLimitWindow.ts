/**
 * The rate limiter's windows are aligned to absolute wall-clock time, not to a
 * key's first request. Measured against the `test` bindings: a key first seen
 * 23.5s into a minute had its budget refilled 36.5s later — at the top of the
 * next minute, never 60s after it was minted. A key minted at :59.9 therefore
 * holds its budget for 100ms.
 *
 * So a test that spends a whole budget and then asserts the refusal is racing
 * that boundary, and loses whenever one falls inside the burst: the reset hands
 * back the very attempt the test expects to be denied. The burst is ~30ms here
 * and a few hundred milliseconds on a contended runner, which is a fraction of
 * a percent per test — rare enough to read as an unrelated CI failure, frequent
 * enough to arrive. It is not peculiar to `--coverage`; instrumentation only
 * lengthens the burst by about a quarter.
 */
const WINDOW_MS = 60_000;

/**
 * Room to spend a budget in. Two orders of magnitude over the burst it has to
 * cover, because the only cost of overshooting is a wait this rarely takes.
 */
const HEADROOM_MS = 10_000;

/**
 * Wait, if the current window is too short to finish a burst in, for the next
 * one to open. Call it before spending a budget deliberately. It sleeps in
 * `HEADROOM_MS / WINDOW_MS` of runs and returns immediately in the rest.
 */
export async function aWindowWithRoomToSpendIt(): Promise<void> {
  const remaining = WINDOW_MS - (Date.now() % WINDOW_MS);
  if (remaining < HEADROOM_MS) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}
