import { execFile, spawn } from "node:child_process";
import net from "node:net";

/**
 * Owns the dev server for the whole E2E run (fitmind-yi7).
 *
 * @remarks
 * The symptom was "35 tests passed, then the command sat there". Timing each
 * phase put it in one place: the last test result landed at 12.9s, the summary
 * at 161.1s, and the process exited 0.0s after that. Nothing was wrong with the
 * tests or with exiting — the cost was *stopping the dev server*. Handing the
 * server to an externally managed process dropped the silence from 148.2s to
 * 0.4s in a single-variable check.
 *
 * The expensive step is Windows `taskkill /T`, the tree-walking terminate,
 * measured on this machine at anywhere from 3.8s to 96s. That variance is what
 * made whole runs swing between 15s and 166s and let a 120s outer timeout land
 * just before the summary.
 *
 * (An earlier reading of this bug blamed an orphaned esbuild holding
 * Playwright's stdio pipe. The measurements above did not support it; it is
 * recorded here only so the theory is not re-derived.)
 *
 * So teardown does the cheap thing first and never waits without a bound:
 *
 * 1. Terminate the server process directly — an immediate TerminateProcess.
 * 2. Escalate to `taskkill /T` only if the process or the port survives, and
 *    give that command its own hard time limit rather than awaiting it freely.
 * 3. Verify both facts separately: the process is gone, and the port is free.
 *
 * The server's stdio is inherited rather than piped, so no handle here can be
 * held open by anything the server spawned.
 */
const PORT = 5173;
const HOST = "127.0.0.1";
const READY_TIMEOUT_MS = 120_000;
const KILL_TIMEOUT_MS = 20_000;
/** How long the cheap direct kill gets before paying for a tree walk. */
const DIRECT_KILL_GRACE_MS = 3_000;
/** Hard limit on any external command this file runs. See {@link run}. */
const COMMAND_TIMEOUT_MS = 10_000;

/**
 * Whether the server is gone and the port released, within a bound.
 *
 * @param pid - The server process
 * @param timeoutMs - How long to keep checking
 * @returns True once both are true, false when the bound is reached
 */
async function settled(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (!isAlive(pid) && !(await isPortOccupied())) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return false;
}

interface Spawned {
  pid: number;
}

async function isPortOccupied(): Promise<boolean> {
  const probe = (host: string) =>
    new Promise<boolean>((resolve) => {
      const socket = net.connect({ host, port: PORT });
      const done = (result: boolean) => {
        socket.destroy();
        resolve(result);
      };

      socket.setTimeout(1_000);
      socket.once("connect", () => done(true));
      socket.once("timeout", () => done(false));
      socket.once("error", () => done(false));
    });

  const [v6, v4] = await Promise.all([probe("::1"), probe(HOST)]);

  return v6 || v4;
}

/**
 * Run an external command with a hard time limit.
 *
 * @param command - Executable name
 * @param args - Arguments
 * @param timeoutMs - Limit after which the command itself is killed
 * @returns Its stdout, or an empty string when it was killed or failed
 *
 * @remarks
 * The limit is not decoration. `taskkill /T` was measured at 96s on this
 * machine, and every deadline in this file used to sit *outside* an unbounded
 * `await` on it — so the JavaScript loop could not enforce anything until the
 * command chose to return. Node's own `timeout` kills the process, which is the
 * only bound that holds.
 */
function run(
  command: string,
  args: string[],
  timeoutMs = COMMAND_TIMEOUT_MS,
): Promise<string> {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      { windowsHide: true, timeout: timeoutMs, killSignal: "SIGKILL" },
      (_error, stdout) => {
        resolve(stdout ?? "");
      },
    );
  });
}

/**
 * The process currently listening on the port, if any.
 *
 * @returns Owning process id, or null
 *
 * @remarks
 * Deliberately narrow. An earlier version of this file walked the whole process
 * table to build a parent/child map and killed everything it reached from the
 * server's pid. The `wmic /format:csv` columns come back alphabetised
 * (`Node,ParentProcessId,ProcessId`), the positional parse had them the wrong
 * way round, and the resulting map pointed child -> parent — so the walk
 * climbed the *ancestor* chain and started killing the run's own processes.
 * That is far too much power for a teardown. Nothing here kills a process this
 * file did not start or that is not holding the port it must release.
 */
async function findPortOwner(): Promise<number | null> {
  if (process.platform !== "win32") {
    return null;
  }

  const table = await run("netstat", ["-ano"]);

  for (const line of table.split("\n")) {
    if (!line.includes("LISTENING") || !line.includes(`:${PORT} `)) {
      continue;
    }

    const pid = Number(line.trim().split(/\s+/u).pop());

    if (Number.isFinite(pid) && pid > 0) {
      return pid;
    }
  }

  return null;
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Stop the server and everything it started, then confirm it.
 *
 * @param rootPid - The dev server process this file spawned
 * @throws When the process or the port outlives the bounded wait
 *
 * @remarks
 * The direct kill comes first because it returns immediately; `taskkill /T` is
 * the escalation, not the default, and runs under its own time limit. The port
 * is then checked rather than assumed, because "the process I spawned is gone"
 * and "the port is free" turned out to be different facts.
 */
async function stopServer(rootPid: number): Promise<void> {
  // Terminate the server directly first. `taskkill /T` walks and terminates the
  // whole tree, and on this machine that walk was measured at 3.8s on a good
  // run and 96s on a bad one — the single largest contributor to a suite that
  // looked hung. Node's own kill is a direct TerminateProcess and returns at
  // once.
  try {
    process.kill(rootPid);
  } catch {
    // Already gone.
  }

  if (await settled(rootPid, DIRECT_KILL_GRACE_MS)) {
    return;
  }

  // Escalation, not the default: something outlived the direct kill or is still
  // holding the port, so pay for the tree walk.
  if (process.platform === "win32") {
    await run("taskkill", ["/PID", String(rootPid), "/T", "/F"]);
  }

  const deadline = Date.now() + KILL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (!isAlive(rootPid) && !(await isPortOccupied())) {
      return;
    }

    // A stranger on this port is reported, never killed. The server we started
    // is already dead by this point, so whatever is holding 5173 now is
    // something else — possibly a colleague's dev server, possibly an unrelated
    // program that grabbed the port in the gap. Terminating it would be the
    // same class of mistake as the process-table walk deleted from this file
    // one round ago: reaching outside what this run owns.
    const owner = await findPortOwner();

    if (owner !== null && owner !== rootPid) {
      throw new Error(
        `The dev server (pid ${rootPid}) is gone, but port ${PORT} is now held ` +
          `by pid ${owner}, which this run did not start. Refusing to kill it. ` +
          `Stop it yourself before the next run, or the next run will refuse ` +
          `to start.`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(
    `The dev server (pid ${rootPid}) or port ${PORT} outlived teardown by ` +
      `${KILL_TIMEOUT_MS}ms. Do not trust the next run's results until it is gone.`,
  );
}

async function waitForReady(child: Spawned): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (!isAlive(child.pid)) {
      throw new Error(
        "The dev server exited before it started serving. Run it by hand to " +
          "see why: `pnpm --filter @fitmind/client dev`.",
      );
    }

    if (await isPortOccupied()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  await stopServer(child.pid);
  throw new Error(
    `The dev server did not answer on ${PORT} within ${READY_TIMEOUT_MS}ms.`,
  );
}

/**
 * Start the dev server and hand back the teardown that stops it.
 *
 * @returns Playwright's global teardown callback
 * @throws When the port is already taken, rather than reusing a stranger
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  if (await isPortOccupied()) {
    throw new Error(
      `Port ${PORT} is already in use. This run will not adopt a server it ` +
        `did not start — that is how a leaked dev server once turned into 30 ` +
        `page.goto timeouts that looked like application failures. Stop the ` +
        `process on ${PORT} (a stray \`pnpm dev\`, or a previous run) and try again.`,
    );
  }

  const child = spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--port", String(PORT), "--strictPort"],
    {
      cwd: process.cwd(),
      // Inherited rather than piped, so nothing here owns a handle that must be
      // drained or closed before this process can finish. Vite's errors still
      // reach the terminal.
      stdio: ["ignore", "ignore", "inherit"],
    },
  );

  if (child.pid === undefined) {
    throw new Error("Could not start the dev server process.");
  }

  const spawned: Spawned = { pid: child.pid };
  // Nothing awaits this process, so an unhandled 'error' would crash the run.
  child.on("error", () => {});

  await waitForReady(spawned);

  return async () => {
    await stopServer(spawned.pid);

    const deadline = Date.now() + KILL_TIMEOUT_MS;

    while (Date.now() < deadline) {
      if (!(await isPortOccupied())) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    throw new Error(
      `The dev server tree was killed but ${PORT} is still listening. ` +
        `Something outlived it; do not trust the next run's results.`,
    );
  };
}
