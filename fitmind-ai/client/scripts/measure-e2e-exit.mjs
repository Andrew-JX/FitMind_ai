/**
 * Measure the two things a green suite cannot tell apart (fitmind-yi7).
 *
 * @remarks
 * "35 passed" is compatible with a healthy run, a slow run, and a run that
 * finished and then refused to exit. Those need different fixes, so this
 * reports them separately:
 *
 * - `testMs`    — up to the last *test result* Playwright printed
 * - `silenceMs` — from that result to process exit; the hang lives here
 * - `selfExited`— whether the process ended on its own, or the watchdog ended
 *   it. A run that was killed is never evidence of exiting.
 *
 * Two earlier versions of this file got the measurement itself wrong, which is
 * worth stating: one timed from the last byte written (the summary line, which
 * prints *after* the silence, so the number was always small), and one proved
 * "it exited by itself" with `code !== null`, which is equally true of a
 * process someone killed.
 *
 * Nothing here waits without a limit, including the kill the watchdog runs.
 *
 * ```bash
 * node scripts/measure-e2e-exit.mjs [runs]
 * ```
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CLIENT_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REPO_DIR = path.dirname(CLIENT_DIR);
/** Absolute ceiling per run. Exceeding it is a failure, never a slow pass. */
const RUN_CEILING_MS = Number(
  process.env["FITMIND_E2E_MEASURE_CEILING_MS"] ?? 300_000,
);
/**
 * Makes every kill a no-op, so the watchdog's give-up path can be exercised.
 *
 * @remarks
 * Exists because that path is otherwise unreachable on demand: it needs a
 * process that survives both `taskkill /T` and `SIGKILL`, which cannot be
 * staged honestly. Without it, "the harness reports instead of hanging" would
 * be a claim with no test behind it. The run it leaves behind is the caller's
 * to clean up, and it says so.
 */
const simulateUnkillable =
  process.env["FITMIND_E2E_SIMULATE_UNKILLABLE"] === "1";
/** Hard limit on the `taskkill` the watchdog runs, which is itself slow here. */
const KILL_COMMAND_TIMEOUT_MS = 10_000;

/**
 * Kill a Windows process tree and confirm it is gone.
 *
 * @param pid - Root process id
 * @returns True once nothing in the tree is alive
 */
async function killTree(pid) {
  if (simulateUnkillable) {
    return false;
  }

  await new Promise((resolve) => {
    if (process.platform !== "win32") {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // Already gone.
      }
      resolve();
      return;
    }

    const killer = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
      stdio: "ignore",
    });
    // Awaited, but not indefinitely. The first version did not wait at all and
    // believed a kill that may have failed; waiting without a limit swapped
    // that for a different unbounded path, since `taskkill /T` has been
    // measured at 96s on this machine.
    const limit = setTimeout(() => {
      killer.kill("SIGKILL");
      resolve();
    }, KILL_COMMAND_TIMEOUT_MS);
    const finish = () => {
      clearTimeout(limit);
      resolve();
    };

    killer.on("exit", finish);
    killer.on("error", finish);
  });

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      process.kill(pid, 0);
    } catch {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return false;
}

/**
 * Run the repository's own E2E command once and time both phases.
 *
 * @returns Timings, exit code, and whether it ended without help
 *
 * @remarks
 * Runs `pnpm test:e2e` from the repository root on purpose. That is the command
 * humans and CI actually type, wrappers included; measuring Playwright directly
 * would skip the very processes suspected of holding the run open.
 */
function measureOnce() {
  return new Promise((resolve) => {
    const started = Date.now();
    let lastOutputAt = started;
    let summary = null;
    let watchdogFired = false;

    const child = spawn("pnpm", ["test:e2e"], {
      cwd: REPO_DIR,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    });

    // Line by line, and the last *test result* — not the last byte written.
    // Measuring from the last byte was the mistake that made this look fixed:
    // the summary line is itself printed after the silence, so the gap between
    // it and exit is always tiny no matter how long the run sat there. The
    // defect lives between the final test result and the summary.
    let buffered = "";
    const note = (chunk) => {
      buffered += chunk;

      let index = buffered.indexOf("\n");

      while (index >= 0) {
        const line = buffered.slice(0, index);
        buffered = buffered.slice(index + 1);

        if (/^\s*(ok|not ok|\d+\))\s/u.test(line)) {
          lastOutputAt = Date.now();
        }

        const match = /(\d+) (passed|failed)/u.exec(line);

        if (match !== null) {
          summary = match[0];
        }

        index = buffered.indexOf("\n");
      }
    };

    child.stdout.on("data", note);
    child.stderr.on("data", note);

    // One exit for every path, taken once. Without this the watchdog had no way
    // to end the wait: it fired `killTree` and discarded the answer, so a kill
    // that failed left `measureOnce` with nothing to resolve it but the very
    // `exit` event that was never going to arrive — a bounded ceiling guarding
    // an unbounded wait.
    let settled = false;
    const finish = (extra) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(watchdog);

      const ended = Date.now();

      resolve({
        summary,
        selfExited: !watchdogFired,
        testMs: lastOutputAt - started,
        silenceMs: ended - lastOutputAt,
        totalMs: ended - started,
        unkillable: false,
        ...extra,
      });
    };

    const watchdog = setTimeout(() => {
      watchdogFired = true;
      void (async () => {
        const killed = await killTree(child.pid);

        if (!killed) {
          try {
            if (!simulateUnkillable) {
              child.kill("SIGKILL");
            }
          } catch {
            // Raced with its own exit.
          }
        }

        for (let attempt = 0; attempt < 20; attempt += 1) {
          if (settled) {
            return;
          }

          try {
            process.kill(child.pid, 0);
          } catch {
            // Dead after all; the `exit` handler will finish the run.
            return;
          }

          await new Promise((wait) => setTimeout(wait, 250));
        }

        // Still alive. Let go of its streams and its handle so this harness can
        // exit and report, instead of being held open by the thing it failed to
        // kill — which is the same shape as the defect it measures.
        for (const stream of [child.stdout, child.stderr]) {
          stream?.removeAllListeners();
          stream?.destroy();
        }

        child.removeAllListeners("exit");
        child.unref();

        finish({ code: null, unkillable: true });
      })();
    }, RUN_CEILING_MS);

    child.on("exit", (code) => {
      finish({ code });
    });
  });
}

const runs = Number(process.argv[2] ?? 3);
const results = [];

for (let index = 1; index <= runs; index += 1) {
  const result = await measureOnce();
  results.push(result);
  console.log(
    `run ${index}: code=${result.code} selfExited=${result.selfExited} ` +
      `summary="${result.summary}" test=${(result.testMs / 1000).toFixed(1)}s ` +
      `silence=${(result.silenceMs / 1000).toFixed(1)}s ` +
      `total=${(result.totalMs / 1000).toFixed(1)}s` +
      (result.unkillable ? " UNKILLABLE" : ""),
  );
}

const worstSilence = Math.max(...results.map((r) => r.silenceMs));
const allSelfExited = results.every(
  (r) => r.selfExited && r.code === 0 && !r.unkillable,
);
const leaked = results.filter((r) => r.unkillable);
/** Comfortably above a healthy teardown (~0.5s), far below a hang (90s+). */
const SILENCE_BUDGET_MS = 20_000;

console.log(
  `\nworst silence after the last test: ${(worstSilence / 1000).toFixed(1)}s ` +
    `over ${runs} run(s); all self-exited and green: ${allSelfExited}`,
);

if (leaked.length > 0) {
  console.log(
    `FAIL: ${leaked.length} run(s) survived the watchdog's kill and are still ` +
      "running. Stop them by hand before the next run.",
  );
  process.exitCode = 1;
} else if (!allSelfExited || worstSilence >= SILENCE_BUDGET_MS) {
  console.log(
    allSelfExited
      ? `FAIL: the suite finished but took over ${SILENCE_BUDGET_MS}ms to say so.`
      : "FAIL: a run did not exit on its own, or did not pass.",
  );
  process.exitCode = 1;
}
