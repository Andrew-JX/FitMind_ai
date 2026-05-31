import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(scriptDir, "..", "src");
const outputRoot = resolve(scriptDir, "..", "dist");

copyJavaScriptFiles(sourceRoot);

function copyJavaScriptFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const sourcePath = join(directory, entry.name);

    if (entry.isDirectory()) {
      copyJavaScriptFiles(sourcePath);
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith(".js")) {
      continue;
    }

    const outputPath = join(outputRoot, relative(sourceRoot, sourcePath));

    mkdirSync(dirname(outputPath), { recursive: true });
    copyFileSync(sourcePath, outputPath);
  }
}
