import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const workflowPath = resolve(
  repositoryRoot,
  ".github/workflows/deploy-tencent.yml",
);

interface WorkflowStep {
  name: string;
  source: string;
}

interface WorkflowJob {
  name: string;
  source: string;
}

function readWorkflowSteps(source: string): WorkflowStep[] {
  const matches = [...source.matchAll(/^ {6}- name: (.+)$/gmu)];

  return matches.map((match, index) => ({
    name: match[1] ?? "",
    source: source.slice(
      match.index,
      matches[index + 1]?.index ?? source.length,
    ),
  }));
}

function getStep(steps: WorkflowStep[], name: string): WorkflowStep {
  const step = steps.find((candidate) => candidate.name === name);
  if (step === undefined) {
    throw new Error(`Missing workflow step: ${name}`);
  }
  return step;
}

function readWorkflowJobs(source: string): WorkflowJob[] {
  const jobsStart = source.indexOf("\njobs:\n");
  if (jobsStart < 0) {
    return [];
  }
  const jobsSource = source.slice(jobsStart + 1);
  const matches = [...jobsSource.matchAll(/^ {2}([a-z][a-z0-9_-]*):$/gmu)];

  return matches.map((match, index) => ({
    name: match[1] ?? "",
    source: jobsSource.slice(
      match.index,
      matches[index + 1]?.index ?? jobsSource.length,
    ),
  }));
}

function getJob(jobs: WorkflowJob[], name: string): WorkflowJob {
  const job = jobs.find((candidate) => candidate.name === name);
  if (job === undefined) {
    throw new Error(`Missing workflow job: ${name}`);
  }
  return job;
}

function assertReleaseGates(source: string): void {
  const steps = readWorkflowSteps(source);
  const requiredOrder = [
    "Verify repository",
    "Evaluate assistant regressions",
    "Build production applications",
    "Install Playwright Chromium",
    "Run release compliance E2E",
    "Test production monitor command boundary",
    "Upload Playwright failure artifacts",
    "Freeze verified release SHA",
    "Configure restricted deployment key",
    "Deploy reviewed commit and verify containers",
  ];
  const positions = requiredOrder.map((name) =>
    steps.findIndex((step) => step.name === name),
  );

  expect(positions.every((position) => position >= 0)).toBe(true);
  expect(positions).toEqual([...positions].sort((left, right) => left - right));

  const verify = getStep(steps, "Verify repository");
  const evaluation = getStep(steps, "Evaluate assistant regressions");
  const browser = getStep(steps, "Install Playwright Chromium");
  const e2e = getStep(steps, "Run release compliance E2E");
  const monitor = getStep(steps, "Test production monitor command boundary");
  const artifacts = getStep(steps, "Upload Playwright failure artifacts");

  expect(verify.source).toContain("run: pnpm verify");
  expect(evaluation.source).toContain("run: pnpm eval");
  expect(evaluation.source).not.toContain("continue-on-error");
  expect(browser.source).toContain("playwright install --with-deps chromium");
  expect(e2e.source).toContain("run: pnpm test:e2e:release");
  expect(e2e.source).not.toContain("continue-on-error");
  expect(monitor.source).toContain(
    "run: bash deploy/scripts/test-fitmind-monitor.sh",
  );
  expect(monitor.source).not.toContain("continue-on-error");
  expect(artifacts.source).toContain("if: failure()");
  expect(artifacts.source).toContain("uses: actions/upload-artifact@v4");
  expect(artifacts.source).toContain("fitmind-ai/client/test-results");
  expect(artifacts.source).toContain("fitmind-ai/client/playwright-report");
}

function assertApprovalBoundary(source: string): void {
  const jobs = readWorkflowJobs(source);
  const verify = getJob(jobs, "verify").source;
  const deploy = getJob(jobs, "deploy").source;

  expect(verify).toContain("release_sha: ${{ steps.release.outputs.sha }}");
  expect(verify).toContain("- name: Freeze verified release SHA");
  expect(verify).toContain("id: release");
  expect(verify).toContain('[[ "$GITHUB_SHA" =~ ^[0-9a-f]{40}$ ]]');
  expect(verify).toContain(
    `printf 'sha=%s\\n' "$GITHUB_SHA" >> "$GITHUB_OUTPUT"`,
  );
  expect(verify).not.toContain("environment:");
  expect(verify).not.toContain("TENCENT_DEPLOY_KEY");
  expect(verify).not.toContain("Configure restricted deployment key");
  expect(verify).not.toContain("Deploy reviewed commit and verify containers");

  expect(deploy).toContain("needs: verify");
  expect(deploy).toContain("if: github.ref == 'refs/heads/main'");
  expect(deploy).toContain("permissions:\n      deployments: write");
  expect(deploy).toContain("environment:");
  expect(deploy).toContain("name: production");
  expect(deploy).toContain(
    "RELEASE_SHA: ${{ needs.verify.outputs.release_sha }}",
  );
  expect(deploy).not.toContain("RELEASE_SHA: ${{ github.sha }}");
  expect(deploy).not.toContain("GITHUB_SHA");
  expect(deploy).not.toContain("Check out repository");
  expect(deploy).not.toContain("Verify repository");
  expect(deploy).not.toContain("Run release compliance E2E");
  expect(deploy).not.toContain("Test production monitor command boundary");
  expect(deploy).not.toContain("actions/download-artifact");
  expect(deploy).not.toMatch(/docker\s+push|ghcr\.io|tcr/u);
}

function removeStep(source: string, name: string): string {
  return source.replace(getStep(readWorkflowSteps(source), name).source, "");
}

describe("Tencent production release workflow", () => {
  it("runs release gates and uploads diagnostics before using SSH", async () => {
    const source = await readFile(workflowPath, "utf8");
    assertReleaseGates(source);
    assertApprovalBoundary(source);
  });

  it("rejects missing or post-deploy release gates", async () => {
    const source = await readFile(workflowPath, "utf8");
    const e2eStep = getStep(
      readWorkflowSteps(source),
      "Run release compliance E2E",
    ).source;

    expect(() =>
      assertReleaseGates(removeStep(source, "Evaluate assistant regressions")),
    ).toThrow();
    expect(() =>
      assertReleaseGates(removeStep(source, "Run release compliance E2E")),
    ).toThrow();
    expect(() =>
      assertReleaseGates(
        removeStep(source, "Test production monitor command boundary"),
      ),
    ).toThrow();
    expect(() =>
      assertReleaseGates(
        `${removeStep(source, "Run release compliance E2E")}\n${e2eStep}`,
      ),
    ).toThrow();
  });

  it("rejects an unprotected or unverified deployment job", async () => {
    const source = await readFile(workflowPath, "utf8");

    expect(() =>
      assertApprovalBoundary(source.replace("    needs: verify\n", "")),
    ).toThrow();
    expect(() =>
      assertApprovalBoundary(
        source.replace(
          "    environment:\n      name: production\n      url: https://fitmind.jimmyuuu.com/\n",
          "",
        ),
      ),
    ).toThrow();
    expect(() =>
      assertApprovalBoundary(
        source.replace(
          "RELEASE_SHA: ${{ needs.verify.outputs.release_sha }}",
          "RELEASE_SHA: ${{ github.sha }}",
        ),
      ),
    ).toThrow();
    expect(() =>
      assertApprovalBoundary(
        source.replace(
          "    outputs:\n      release_sha: ${{ steps.release.outputs.sha }}\n",
          "",
        ),
      ),
    ).toThrow();
  });
});
