import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("training knowledge migration", () => {
  it("uses a raw jsonb expression for empty chunk tags", async () => {
    const source = await readFile(
      resolve(
        process.cwd(),
        "server/migrations/20260606090000_create_training_knowledge_tables.js",
      ),
      "utf8",
    );

    expect(source).toContain(`default: pgm.func("'[]'::jsonb")`);
    expect(source).not.toContain(`default: "'[]'::jsonb"`);
  });
});
