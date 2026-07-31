import { useTheme } from "../theme/ThemeContext";
import { buildSiteFooterContent } from "./site-footer-content";

/**
 * Legal footer: filing numbers plus links to the agreement and privacy pages.
 *
 * @returns The site footer, or nothing when there is nothing to show
 *
 * @remarks
 * Filing numbers come from build-time env so the same repo can serve a filed
 * host and an unfiled demo. The legal links always render; a filing row only
 * appears once configured.
 */
export function SiteFooter() {
  const { theme } = useTheme();
  const content = buildSiteFooterContent({
    icpNumber: import.meta.env.VITE_ICP_BEIAN_NUMBER,
    publicSecurityNumber: import.meta.env.VITE_PUBLIC_SECURITY_BEIAN_NUMBER,
  });

  const linkStyle: React.CSSProperties = {
    color: theme.colors.tx3,
    textDecoration: "none",
  };

  return (
    <footer
      style={{
        color: theme.colors.tx3,
        display: "grid",
        fontSize: 11,
        gap: 6,
        justifyItems: "center",
        lineHeight: 1.7,
        padding: "20px 0 8px",
        textAlign: "center",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {content.legalLinks.map((link) => (
          <a href={link.href} key={link.href} style={linkStyle}>
            {link.label}
          </a>
        ))}
      </div>
      {content.filings.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {content.filings.map((filing) => (
            <a
              href={filing.href}
              key={filing.href}
              rel="noreferrer"
              style={linkStyle}
              target="_blank"
            >
              {filing.label}
            </a>
          ))}
        </div>
      ) : null}
    </footer>
  );
}
