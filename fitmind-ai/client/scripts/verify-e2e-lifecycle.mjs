/**
 * Lifecycle regression for fitmind-yi7: does an E2E run clean up after itself?
 *
 * @remarks
 * The bug was never in a test. Tearing down the Vite dev server was the whole
 * cost: with Playwright's `webServer`, the suite finished in ~13s and then sat
 * silent for 90–148s before printing its summary, and a leaked server could
 * still be adopted by the next run and produce 30 `page.goto` timeouts that
 * read as application failures.
 *
 * Neither symptom is visible from test results — every test passed in both
 * failure modes. So this harness asserts on the things that were actually
 * broken: the exit code, the port afterwards, and the wall clock. The silence
 * itself is measured separately by `verify:e2e-exit`, which times the gap
 * between the last test result and process exit.
 *
 * Every case is bounded. A lifecycle check that hangs when the leak returns
 * would reproduce the defect instead of reporting it.
 *
 * ```bash
 * pnpm --filter @fitmind/client run verify:e2e-lifecycle
 * ```
 */
import { spawn } from "node:child_process";
import net from "node:net";
import { fileURLToPath } from "node:url";
import path from "node:path";

const CLIENT_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 5173;
/** Generous next to a ~30s suite; short enough that a hang is not mistaken for slowness. */
const CASE_TIMEOUT_MS = 240_000;
/**
 * A refusal must be fast.
 *
 * @remarks
 * Set below the 120s `webServer` timeout on purpose. The first value was 130s,
 * which let the old behaviour pass this check by waiting out that timeout —
 * "refused quickly" was true of nothing. Refusing now takes a few seconds.
 */
const FAIL_FAST_MS = 30_000;
/** Hard limit on the `taskkill` the watchdog runs, which is itself slow here. */
const KILL_COMMAND_TIMEOUT_MS = 10_000;

let failures = 0;

function check(label, condition, detail) {
  if (condition) {
    console.log(`  PASS  ${label}`);
    return;
  }

  failures += 1;
  console.log(
    `  FAIL  ${label}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`,
  );
}

/**
 * Whether anything is accepting connections on the port.
 *
 * @returns True when a connection succeeds on either loopback family
 *
 * @remarks
 * Both families are probed because Vite binds `localhost`, which resolved to
 * `[::1]` on the machine where this was diagnosed while the tests reached it
 * over IPv4. Probing one would have reported a leaked server as a clean port.
 */
async function isPortOccupied() {
  const probe = (host) =>
    new Promise((resolve) => {
      const socket = net.connect({ host, port: PORT });
      const done = (result) => {
        socket.destroy();
        resolve(result);
      };

      socket.setTimeout(1_000);
      socket.once("connect", () => done(true));
      socket.once("timeout", () => done(false));
      socket.once("error", () => done(false));
    });

  const [v6, v4] = await Promise.all([probe("::1"), probe("127.0.0.1")]);

  return v6 || v4;
}

async function waitForPortToClear(timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (!(await isPortOccupied())) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return false;
}

/**
 * Run Playwright and report how it ended, without ever waiting forever.
 *
 * @param args - Extra CLI arguments
 * @returns Exit code (null when killed), duration, and combined output
 */
function runPlaywright(args) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(
      process.execPath,
      [
        path.join(CLIENT_DIR, "node_modules", "@playwright", "test", "cli.js"),
        "test",
        ...args,
      ],
      { cwd: CLIENT_DIR, stdio: ["ignore", "pipe", "pipe"] },
    );

    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));

    // The ceiling only means something if the kill it performs is awaited and
    // verified. The first version fired a `taskkill` it never waited on and had
    // no fallback, so a failed kill left this harness waiting exactly as long
    // as the defect it was meant to catch — it had to be killed by hand.
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      void (async () => {
        if (process.platform === "win32") {
          // Bounded. `taskkill /T` has been measured at 96s here, so awaiting
          // it freely put the only real deadline inside the thing being waited
          // on — the watchdog could not fire until the kill chose to return.
          await new Promise((done) => {
            const killer = spawn(
              "taskkill",
              ["/PID", String(child.pid), "/T", "/F"],
              { stdio: "ignore" },
            );
            const limit = setTimeout(() => {
              killer.kill("SIGKILL");
              done();
            }, KILL_COMMAND_TIMEOUT_MS);
            const finish = () => {
              clearTimeout(limit);
              done();
            };

            killer.on("exit", finish);
            killer.on("error", finish);
          });
        }

        // Fallback, and then a hard stop: if the process is still alive after
        // the tree kill, say so rather than waiting on it.
        for (let attempt = 0; attempt < 20; attempt += 1) {
          try {
            process.kill(child.pid, 0);
          } catch {
            return;
          }

          try {
            child.kill("SIGKILL");
          } catch {
            return;
          }

          await new Promise((done) => setTimeout(done, 250));
        }

        resolve({
          code: null,
          selfExited: false,
          ms: Date.now() - started,
          output,
          unkillable: true,
        });
      })();
    }, CASE_TIMEOUT_MS);

    // `exit`, not `close`. `close` additionally waits for the stdio pipes to
    // drain, which is a second thing that can keep this harness waiting; the
    // question here is only whether the command ended.
    child.on("exit", (code) => {
      clearTimeout(timer);
      // `code !== null` proves nothing: a process ended by `taskkill` reports a
      // code too. Whether the watchdog fired is the only thing that separates
      // "it exited" from "I ended it".
      resolve({
        code,
        selfExited: !killed,
        ms: Date.now() - started,
        output,
        unkillable: false,
      });
    });
  });
}

async function main() {
  console.log("\n[0] the port is free before anything starts");
  if (await isPortOccupied()) {
    console.log(
      `  FAIL  something is already listening on ${PORT}. This harness cannot ` +
        `judge cleanup it did not cause; stop that process and rerun.`,
    );
    process.exitCode = 1;
    return;
  }
  check("nothing is listening", true);

  console.log("\n[1] a passing run exits on its own and releases the port");
  const pass = await runPlaywright(["injury-withdrawal"]);
  check("exited by itself", pass.selfExited, {
    code: pass.code,
    unkillable: pass.unkillable,
  });
  check("exit code 0", pass.code === 0, { code: pass.code });
  check("finished inside the bound", pass.ms < CASE_TIMEOUT_MS, {
    ms: pass.ms,
  });
  check("no server left listening", await waitForPortToClear(), { port: PORT });

  console.log("\n[2] a failing run cleans up exactly the same way");
  // Failure is forced through the test timeout rather than a temporary spec
  // file: nothing is written to the repo, and the server still starts, which is
  // what this case is about. Cleanup on the error path was never observed
  // working — every recorded run of this bug had all tests passing.
  const fail = await runPlaywright(["injury-withdrawal", "--timeout=1"]);
  check("exited by itself", fail.selfExited, {
    code: fail.code,
    unkillable: fail.unkillable,
  });
  check("reported failure", fail.code !== 0, { code: fail.code });
  check("finished inside the bound", fail.ms < CASE_TIMEOUT_MS, {
    ms: fail.ms,
  });
  check("no server left listening", await waitForPortToClear(), { port: PORT });

  console.log(
    "\n[3] an occupied port fails fast instead of failing every test",
  );
  // The regression this pins: with `reuseExistingServer` on, a leaked server
  // was silently adopted and produced 30 `page.goto` timeouts that read as
  // application bugs. The run must now refuse to start, and say why.
  // Both loopback families, deliberately. The first version bound the wildcard
  // address and the run passed 9 tests: Vite still bound `127.0.0.1` next to it
  // on Windows, so the case proved nothing. A leaked Vite holds one specific
  // family (`[::1]` in every observed instance), and the squatter has to occupy
  // whichever one this machine's Vite would have taken.
  const squatters = [];
  const squattedSockets = [];
  for (const host of ["::1", "127.0.0.1"]) {
    // Answers 200, deliberately. A socket that just hung up was not the thing
    // that caused the outage: a leaked Vite responds perfectly well, which is
    // precisely why `reuseExistingServer` adopted it and why the 30 failures
    // looked like application bugs rather than a stale process. A squatter that
    // refuses connections would be caught by any health check and would let a
    // regression through here.
    const server = net.createServer((socket) => {
      squattedSockets.push(socket);
      socket.on("error", () => {});
      socket.on("data", () => {
        const body = "<!doctype html><title>stale</title>";
        socket.end(
          `HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n` +
            `Content-Length: ${body.length}\r\nConnection: close\r\n\r\n${body}`,
        );
      });
    });

    await new Promise((resolve) => {
      server.once("error", resolve);
      server.listen(PORT, host, resolve);
    });
    squatters.push(server);
  }

  try {
    const blocked = await runPlaywright(["injury-withdrawal"]);
    check("refused to run", blocked.code !== 0, { code: blocked.code });
    check("refused by itself", blocked.selfExited, {
      unkillable: blocked.unkillable,
    });
    check("refused quickly", blocked.ms < FAIL_FAST_MS, { ms: blocked.ms });
    check(
      "no tests were reported as failing",
      !/\d+ failed/u.test(blocked.output),
      blocked.output.slice(-400),
    );
    check(
      "the diagnostic names the port",
      blocked.output.includes(String(PORT)),
      blocked.output.slice(-400),
    );
  } finally {
    // `close()` waits for open connections, and Playwright's URL poller leaves
    // some behind: an earlier version printed all sixteen results and then sat
    // here until it was killed by hand. Sockets are destroyed explicitly, and
    // the wait is raced against a ceiling — cleanup is the last place that may
    // hang, since a check nobody can wait for is a check nobody will run.
    for (const socket of squattedSockets) {
      socket.destroy();
    }

    for (const server of squatters) {
      server.closeAllConnections?.();
      await Promise.race([
        new Promise((resolve) => server.close(resolve)),
        new Promise((resolve) => setTimeout(resolve, 5_000)),
      ]);
      server.unref();
    }
  }

  console.log(
    `\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}\n`,
  );

  if (failures > 0) {
    process.exitCode = 1;
  }
}

await main();
