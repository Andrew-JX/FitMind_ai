/* global console, process */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const serverRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const envFileArg = process.argv[2];
const useProcessEnv = envFileArg === "--from-process-env";

if (!envFileArg) {
  console.error(
    "Usage: node scripts/run-db-init-with-env-file.mjs <env-file-path|--from-process-env>",
  );
  process.exit(1);
}

const parsedEnv = useProcessEnv ? process.env : loadEnvFile(envFileArg);

if (!parsedEnv.DATABASE_URL || parsedEnv.DATABASE_URL.trim().length < 10) {
  console.error("DATABASE_URL is missing or incomplete.");
  process.exit(1);
}

console.log(useProcessEnv ? "Process env loaded: yes" : "Env file loaded: yes");
console.log("DATABASE_URL present: yes");

const childEnv = {
  ...process.env,
  ...parsedEnv,
};

if (!["mock", "anthropic"].includes(childEnv.ASSISTANT_PROVIDER ?? "")) {
  childEnv.ASSISTANT_PROVIDER = "mock";
}

if (
  !["off", "mock", "anthropic"].includes(
    childEnv.WORKOUT_INTAKE_LLM_PROVIDER ?? "",
  )
) {
  childEnv.WORKOUT_INTAKE_LLM_PROVIDER = "off";
}

runStep("migration", process.execPath, [
  "./node_modules/node-pg-migrate/bin/node-pg-migrate.js",
  "-m",
  "./migrations",
  "-t",
  "pgmigrations",
  "up",
]);

runStep("seed", process.execPath, [
  "./node_modules/tsx/dist/cli.mjs",
  "scripts/seed.ts",
]);

function runStep(label, command, args) {
  console.log(`${label} started`);

  const result = spawnSync(command, args, {
    cwd: serverRoot,
    env: childEnv,
    shell: false,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    console.error(`${label} failed`);
    process.exit(result.status ?? 1);
  }

  console.log(`${label} completed`);
}

function parseEnvFile(contents) {
  const result = {};

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(key)) {
      continue;
    }

    result[key] = unquoteEnvValue(rawValue);
  }

  return result;
}

function loadEnvFile(envFileArg) {
  const envFilePath = path.resolve(process.cwd(), envFileArg);

  if (!fs.existsSync(envFilePath)) {
    console.error("Env file not found.");
    process.exit(1);
  }

  return parseEnvFile(fs.readFileSync(envFilePath, "utf8"));
}

function unquoteEnvValue(value) {
  if (value.length < 2) {
    return value;
  }

  const first = value[0];
  const last = value[value.length - 1];

  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1);
  }

  return value;
}
