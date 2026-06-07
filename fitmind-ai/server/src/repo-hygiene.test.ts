import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("repo hygiene ignores", () => {
  it("ignores local process ids, env history, and editor history", async () => {
    const source = await readFile(
      resolve(process.cwd(), "../.gitignore"),
      "utf8",
    );

    expect(source).toContain(".history/");
    expect(source).toContain("fitmind-ai/client-dev.pid");
    expect(source).toContain("*.env_*");
    expect(source).toContain(".env_*");
  });
});
