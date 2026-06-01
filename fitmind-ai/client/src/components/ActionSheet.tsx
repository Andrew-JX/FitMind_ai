import { createPortal } from "react-dom";

import { useTheme } from "../theme/ThemeContext";

export interface ActionSheetProps {
  children: React.ReactNode;
  closeOnBackdrop?: boolean | undefined;
  description?: string | undefined;
  footer?: React.ReactNode | undefined;
  onClose: () => void;
  open: boolean;
  title: string;
  tone?: "default" | "danger" | undefined;
}

/**
 * Renders a viewport-level mobile action sheet with a scrollable body.
 *
 * @param props - Sheet content, close behavior, and optional footer actions
 * @returns Portal-mounted action sheet
 */
export function ActionSheet(props: ActionSheetProps) {
  const { theme } = useTheme();

  if (!props.open) {
    return null;
  }

  const closeOnBackdrop = props.closeOnBackdrop ?? true;

  return createPortal(
    <div
      aria-modal="true"
      onClick={() => {
        if (closeOnBackdrop) {
          props.onClose();
        }
      }}
      role="dialog"
      style={backdropStyle(theme)}
    >
      <section
        onClick={(event) => event.stopPropagation()}
        style={sheetStyle(theme)}
      >
        <header style={headerStyle(theme)}>
          <h2 style={titleStyle(theme, props.tone)}>{props.title}</h2>
          {props.description ? (
            <p style={descriptionStyle(theme)}>{props.description}</p>
          ) : null}
        </header>

        <div style={bodyStyle}>{props.children}</div>

        {props.footer ? (
          <footer style={footerStyle(theme)}>{props.footer}</footer>
        ) : null}
      </section>
    </div>,
    document.body,
  );
}

function backdropStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "end",
    backgroundColor: theme.isDark ? "rgba(0,0,0,0.58)" : "rgba(12,16,24,0.38)",
    bottom: 0,
    display: "flex",
    justifyContent: "center",
    left: 0,
    padding: "16px 12px calc(18px + env(safe-area-inset-bottom, 0px))",
    position: "fixed",
    right: 0,
    top: 0,
    zIndex: 2147483647,
  };
}

function sheetStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf,
    border: `1px solid ${theme.colors.bdr2}`,
    borderRadius: "18px 18px 14px 14px",
    boxShadow: theme.shadows.card,
    color: theme.colors.tx,
    display: "flex",
    flexDirection: "column",
    maxHeight: "min(720px, calc(100dvh - 32px))",
    maxWidth: 420,
    minHeight: 0,
    overflow: "hidden",
    width: "min(420px, 100%)",
  };
}

function headerStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    borderBottom: `1px solid ${theme.colors.bdr}`,
    flex: "0 0 auto",
    padding: "18px 18px 12px",
  };
}

function titleStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  tone: ActionSheetProps["tone"],
): React.CSSProperties {
  return {
    color: tone === "danger" ? theme.colors.red : theme.colors.tx,
    fontSize: 16,
    lineHeight: 1.35,
    margin: 0,
  };
}

function descriptionStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
    margin: "6px 0 0",
  };
}

const bodyStyle: React.CSSProperties = {
  display: "grid",
  flex: "1 1 auto",
  gap: 12,
  minHeight: 0,
  overflowY: "auto",
  padding: 18,
  WebkitOverflowScrolling: "touch",
};

function footerStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf,
    borderTop: `1px solid ${theme.colors.bdr}`,
    flex: "0 0 auto",
    padding: "12px 18px 16px",
  };
}
