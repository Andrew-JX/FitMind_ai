export interface SiteFooterLink {
  label: string;
  href: string;
}

export interface SiteFooterContent {
  /** ICP / public-security filings, in display order. Empty until configured. */
  filings: SiteFooterLink[];
  legalLinks: SiteFooterLink[];
}

export interface SiteFooterEnv {
  icpNumber?: string | undefined;
  publicSecurityNumber?: string | undefined;
}

const ICP_QUERY_URL = "https://beian.miit.gov.cn/";
const PUBLIC_SECURITY_QUERY_URL =
  "https://beian.mps.gov.cn/#/query/webSearch?code=";

const LEGAL_LINKS: SiteFooterLink[] = [
  { label: "用户协议", href: "/legal/terms.html" },
  { label: "隐私政策", href: "/legal/privacy.html" },
];

/**
 * Read a filing number, treating blank configuration as absent.
 *
 * @param value - Raw env value
 * @returns Trimmed number, or undefined when unset or blank
 */
function readFilingNumber(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? "";

  return trimmed === "" ? undefined : trimmed;
}

/**
 * Build the footer content for the current deployment.
 *
 * @param env - Filing numbers from the build environment
 * @returns Footer links to render
 *
 * @remarks
 * Filing numbers are per-deployment, not per-repo: the Shanghai host carries an
 * ICP number while the overseas demo must not display one. Nothing is rendered
 * until a number is configured, so an unconfigured build shows no filing rather
 * than a placeholder that reads as a real registration.
 */
export function buildSiteFooterContent(env: SiteFooterEnv): SiteFooterContent {
  const filings: SiteFooterLink[] = [];
  const icpNumber = readFilingNumber(env.icpNumber);
  const publicSecurityNumber = readFilingNumber(env.publicSecurityNumber);

  if (icpNumber !== undefined) {
    filings.push({ label: icpNumber, href: ICP_QUERY_URL });
  }

  if (publicSecurityNumber !== undefined) {
    // The public-security lookup takes the bare digits of the filing number,
    // while the displayed label keeps its province prefix and 号 suffix.
    const code = publicSecurityNumber.replace(/\D/gu, "");

    filings.push({
      label: publicSecurityNumber,
      href: `${PUBLIC_SECURITY_QUERY_URL}${code}`,
    });
  }

  return { filings, legalLinks: LEGAL_LINKS };
}
