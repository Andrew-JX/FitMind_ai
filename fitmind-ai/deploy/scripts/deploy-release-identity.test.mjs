import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { clearTimeout, setTimeout } from "node:timers";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const deployScript = resolve(projectRoot, "deploy/scripts/deploy.sh");
const releaseSha = "0123456789abcdef0123456789abcdef01234567";

function toBashPath(path, useWsl) {
  const normalized = path.replaceAll("\\", "/");
  const drive = /^([A-Za-z]):\/(.*)$/u.exec(normalized);

  return drive === null
    ? normalized
    : useWsl
      ? `/mnt/${drive[1].toLowerCase()}/${drive[2]}`
      : `/${drive[1].toLowerCase()}/${drive[2]}`;
}

async function writeExecutable(path, source) {
  await writeFile(path, source, "utf8");
  await chmod(path, 0o755);
}

async function runDeploy(healthBody) {
  const root = await mkdtemp(join(tmpdir(), "fitmind-release-identity-"));
  const scriptsDirectory = join(root, "deploy", "scripts");
  const binDirectory = join(root, "bin");
  const copiedDeployScript = join(scriptsDirectory, "deploy.sh");
  const probeLog = join(root, "health-probes.log");

  try {
    await mkdir(scriptsDirectory, { recursive: true });
    await mkdir(binDirectory, { recursive: true });
    await copyFile(deployScript, copiedDeployScript);
    await chmod(copiedDeployScript, 0o755);
    await writeFile(join(root, ".env"), "", "utf8");

    await writeExecutable(
      join(binDirectory, "git"),
      `#!/usr/bin/env bash
set -eu
if [[ "\${1:-}" == "status" && "\${2:-}" == "--porcelain" ]]; then
  exit 0
fi
if [[ "\${1:-}" == "rev-parse" && "\${2:-}" == "--short=12" && "\${3:-}" == "HEAD" ]]; then
  printf '%s\\n' '${releaseSha.slice(0, 12)}'
  exit 0
fi
if [[ "\${1:-}" == "rev-parse" && "\${2:-}" == "HEAD" ]]; then
  printf '%s\\n' '${releaseSha}'
  exit 0
fi
printf 'unexpected git invocation: %s\\n' "$*" >&2
exit 90
`,
    );
    await writeExecutable(
      join(binDirectory, "docker"),
      `#!/usr/bin/env bash
set -eu
exit 0
`,
    );
    await writeExecutable(
      join(binDirectory, "curl"),
      `#!/usr/bin/env bash
set -eu
case "$*" in
  *127.0.0.1:3000/api/health*)
    printf 'api\\n' >> "$FITMIND_TEST_PROBE_LOG"
    printf '%s' "$FITMIND_TEST_HEALTH_BODY"
    ;;
  *127.0.0.1:8081/healthz*)
    ;;
  *)
    printf 'unexpected curl invocation: %s\\n' "$*" >&2
    exit 91
    ;;
esac
`,
    );
    await writeExecutable(
      join(binDirectory, "sleep"),
      `#!/usr/bin/env bash
set -eu
exit 0
`,
    );

    const bashOverride = process.env.FITMIND_TEST_BASH?.trim();
    const useWsl = process.platform === "win32" && !bashOverride;
    const bashArguments = [
      "-c",
      'export FITMIND_TEST_PROBE_LOG="$3" FITMIND_TEST_HEALTH_BODY="$4"; PATH="$1:$PATH" exec bash "$2"',
      "fitmind-release-test",
      toBashPath(binDirectory, useWsl),
      toBashPath(copiedDeployScript, useWsl),
      toBashPath(probeLog, useWsl),
      healthBody,
    ];
    const child = spawn(
      useWsl ? "wsl.exe" : (bashOverride ?? "bash"),
      useWsl ? ["-e", "bash", ...bashArguments] : bashArguments,
      {
        cwd: root,
        env: process.env,
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    let timedOut = false;
    const timeout = setTimeout(
      () => {
        timedOut = true;
        child.kill("SIGKILL");
      },
      bashOverride ? 30_000 : 10_000,
    );
    const code = await new Promise((resolveExit, reject) => {
      child.once("error", reject);
      child.once("close", resolveExit);
    });
    clearTimeout(timeout);
    const probeSource = await readFile(probeLog, "utf8").catch(() => "");
    const probes = probeSource.split("\n").filter(Boolean);

    return { code, probes, stderr, stdout, timedOut };
  } finally {
    await rm(root, {
      force: true,
      maxRetries: 10,
      recursive: true,
      retryDelay: 100,
    });
  }
}

describe("deploy.sh release identity gate", () => {
  it("rejects a live API that repeatedly reports a different release", async () => {
    const result = await runDeploy(
      '{"ok":true,"data":{"status":"ok","release":"fedcba9876543210fedcba9876543210fedcba98"}}',
    );

    assert.equal(result.timedOut, false);
    assert.equal(result.code, 1, `${result.stderr}\n${result.stdout}`);
    assert.equal(result.probes.length, 30);
    assert.match(
      result.stderr,
      new RegExp(`did not become healthy and report release ${releaseSha}`),
    );
  });

  it("rejects the expected release outside data.release", async () => {
    const result = await runDeploy(
      `{"ok":true,"data":{"status":"ok","release":"fedcba9876543210fedcba9876543210fedcba98"},"previous":{"release":"${releaseSha}"}}`,
    );

    assert.equal(result.timedOut, false);
    assert.equal(result.code, 1, `${result.stderr}\n${result.stdout}`);
    assert.equal(result.probes.length, 30);
  });

  it("accepts a live API that reports the exact release", async () => {
    const result = await runDeploy(
      `{"ok":true,"data":{"status":"ok","release":"${releaseSha}"}}`,
    );

    assert.equal(result.timedOut, false);
    assert.equal(result.code, 0, `${result.stderr}\n${result.stdout}`);
    assert.deepEqual(result.probes, ["api"]);
    assert.match(result.stdout, new RegExp(`reports release ${releaseSha}`));
  });
});
