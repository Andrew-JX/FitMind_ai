import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const nginxDirectory = resolve(repositoryRoot, "deploy/nginx");

function countOccurrences(source: string, expected: string): number {
  return source.split(expected).length - 1;
}

function extractContainingBlock(source: string, marker: string): string {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`Missing Nginx block marker: ${marker}`);
  }

  const openingBrace = source.lastIndexOf("{", markerIndex);
  if (openingBrace === -1) {
    throw new Error(`Missing opening brace for Nginx block: ${marker}`);
  }

  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") {
      depth += 1;
    } else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openingBrace + 1, index);
      }
    }
  }

  throw new Error(`Missing closing brace for Nginx block: ${marker}`);
}

function extractDeclaredBlock(source: string, declaration: string): string {
  const declarationIndex = source.indexOf(declaration);
  if (declarationIndex === -1) {
    throw new Error(`Missing Nginx block declaration: ${declaration}`);
  }

  const openingBrace = source.indexOf("{", declarationIndex);
  if (openingBrace === -1) {
    throw new Error(`Missing opening brace for Nginx block: ${declaration}`);
  }

  return extractContainingBlock(source.slice(openingBrace), "{");
}

function assertSecurityHeaderScopes(
  httpsConfig: string,
  securityHeaders: string,
): void {
  const mainHttpsServer = extractContainingBlock(
    httpsConfig,
    "server_name fitmind.jimmyuuu.com;",
  );
  const apiLocation = extractDeclaredBlock(mainHttpsServer, "location /api/");
  const includeDirective =
    "include /etc/nginx/snippets/fitmind-security-headers.conf;";

  expect(mainHttpsServer).toContain("listen 443 ssl;");
  expect(countOccurrences(mainHttpsServer, includeDirective)).toBe(2);
  expect(countOccurrences(apiLocation, includeDirective)).toBe(1);
  expect(apiLocation).toContain("add_header X-Accel-Buffering no always;");

  expect(securityHeaders).toContain(
    'add_header Strict-Transport-Security "max-age=31536000" always;',
  );
  expect(securityHeaders).toContain(
    "add_header X-Content-Type-Options nosniff always;",
  );
  expect(securityHeaders).toContain("add_header X-Frame-Options DENY always;");
  expect(securityHeaders).toContain(
    "add_header Referrer-Policy strict-origin-when-cross-origin always;",
  );
  expect(securityHeaders).not.toContain("X-Accel-Buffering");
}

describe("production Nginx security headers", () => {
  it("applies the shared header snippet at server and API location scopes", async () => {
    const [httpsConfig, securityHeaders] = await Promise.all([
      readFile(resolve(nginxDirectory, "fitmind-https.conf"), "utf8"),
      readFile(
        resolve(nginxDirectory, "fitmind-security-headers.conf"),
        "utf8",
      ),
    ]);
    assertSecurityHeaderScopes(httpsConfig, securityHeaders);
  });

  it("rejects an API location that regresses to parent-only headers", async () => {
    const [httpsConfig, securityHeaders] = await Promise.all([
      readFile(resolve(nginxDirectory, "fitmind-https.conf"), "utf8"),
      readFile(
        resolve(nginxDirectory, "fitmind-security-headers.conf"),
        "utf8",
      ),
    ]);
    const regressedConfig = httpsConfig.replace(
      "        include /etc/nginx/snippets/fitmind-security-headers.conf;\n        add_header X-Accel-Buffering no always;",
      "        add_header X-Accel-Buffering no always;",
    );

    expect(regressedConfig).not.toBe(httpsConfig);
    expect(() =>
      assertSecurityHeaderScopes(regressedConfig, securityHeaders),
    ).toThrow();
  });

  it("installs the shared snippet before validating and reloading Nginx", async () => {
    const deployReadme = await readFile(
      resolve(repositoryRoot, "deploy/README.md"),
      "utf8",
    );
    const httpsInstallSection = deployReadme.slice(
      deployReadme.indexOf(
        "After issuance, install the final HTTPS configuration:",
      ),
      deployReadme.indexOf("## 6. Preserve the independent port 8080 site"),
    );
    const installSnippet =
      "sudo cp deploy/nginx/fitmind-security-headers.conf /etc/nginx/snippets/fitmind-security-headers.conf";
    const installSite =
      "sudo cp deploy/nginx/fitmind-https.conf /etc/nginx/sites-available/fitmind.conf";
    const validate = "sudo nginx -t";
    const reload = "sudo systemctl reload nginx";
    const positions = [installSnippet, installSite, validate, reload].map(
      (command) => httpsInstallSection.indexOf(command),
    );

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual(
      [...positions].sort((left, right) => left - right),
    );
  });
});
