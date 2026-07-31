import { describe, expect, it } from "vitest";

import { buildSiteFooterContent } from "./site-footer-content";

describe("buildSiteFooterContent", () => {
  // An unconfigured build must not invent a filing number: showing a
  // placeholder that looks like a real registration is worse than showing none.
  it("renders no filing when nothing is configured", () => {
    const content = buildSiteFooterContent({});

    expect(content.filings).toEqual([]);
    expect(content.legalLinks).toHaveLength(2);
  });

  it("treats a blank filing number as unset", () => {
    const content = buildSiteFooterContent({
      icpNumber: "   ",
      publicSecurityNumber: "",
    });

    expect(content.filings).toEqual([]);
  });

  it("links an ICP number to the MIIT lookup", () => {
    const content = buildSiteFooterContent({
      icpNumber: "沪ICP备2026000001号",
    });

    expect(content.filings).toEqual([
      { label: "沪ICP备2026000001号", href: "https://beian.miit.gov.cn/" },
    ]);
  });

  // The lookup URL takes bare digits while the label keeps its prefix.
  it("derives the public-security lookup code from the digits", () => {
    const content = buildSiteFooterContent({
      publicSecurityNumber: "沪公网安备 31010502001234号",
    });

    expect(content.filings).toEqual([
      {
        label: "沪公网安备 31010502001234号",
        href: "https://beian.mps.gov.cn/#/query/webSearch?code=31010502001234",
      },
    ]);
  });

  it("keeps ICP ahead of the public-security filing", () => {
    const content = buildSiteFooterContent({
      icpNumber: "沪ICP备2026000001号",
      publicSecurityNumber: "沪公网安备 31010502001234号",
    });

    expect(content.filings.map((filing) => filing.label)).toEqual([
      "沪ICP备2026000001号",
      "沪公网安备 31010502001234号",
    ]);
  });

  it("points the legal links at the static pages", () => {
    const content = buildSiteFooterContent({});

    expect(content.legalLinks).toEqual([
      { label: "用户协议", href: "/legal/terms.html" },
      { label: "隐私政策", href: "/legal/privacy.html" },
    ]);
  });
});
