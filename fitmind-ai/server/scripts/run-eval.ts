import {
  runAssistantEval,
  type AssistantEvalReport,
} from "../src/services/assistant/assistant-eval.js";

function formatPercent(score: number): string {
  return `${(score * 100).toFixed(0)}%`;
}

function printReport(report: AssistantEvalReport): void {
  console.log("=== FitMind Assistant Eval (mock-first, offline) ===");

  for (const check of report.checks) {
    const status = check.failures.length === 0 ? "PASS" : "FAIL";
    console.log(
      `[${status}] ${check.name}: ${check.passed}/${check.total} (${formatPercent(check.score)})`,
    );

    for (const failure of check.failures) {
      console.error(`  - ${failure}`);
    }
  }

  console.log(`Overall: ${report.passed ? "PASS" : "FAIL"}`);
}

async function main(): Promise<void> {
  // 默认不注入 narrativeJudge：保持零成本、可离线复现。
  const report = await runAssistantEval();

  printReport(report);

  if (!report.passed) {
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error(`Assistant eval failed: ${message}`);
  process.exit(1);
});
