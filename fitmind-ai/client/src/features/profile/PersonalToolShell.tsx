import { CURRENT_PRIVACY_POLICY_VERSION } from "../../../../shared/src/consent";

import { Icon } from "../../components/Icon";
import { useTheme } from "../../theme/ThemeContext";
import { accentAlpha } from "../../theme/tokens";

export function PersonalToolShell(props: {
  children: React.ReactNode;
  description: string;
  onBack: () => void;
  title: string;
}) {
  const { theme } = useTheme();

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <header
        style={{
          alignItems: "center",
          display: "flex",
          gap: 10,
          minHeight: 44,
        }}
      >
        <button
          aria-label="返回个人页"
          onClick={props.onBack}
          style={{
            alignItems: "center",
            background: theme.colors.surf2,
            border: `1px solid ${theme.colors.bdr}`,
            borderRadius: 10,
            color: theme.colors.tx,
            cursor: "pointer",
            display: "flex",
            height: 36,
            justifyContent: "center",
            padding: 0,
            width: 36,
          }}
          type="button"
        >
          <span style={{ transform: "rotate(180deg)" }}>
            <Icon name="chevron-right" size={18} />
          </span>
        </button>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ fontSize: 18, lineHeight: 1.3, margin: 0 }}>
            {props.title}
          </h2>
          <p
            style={{
              color: theme.colors.tx2,
              fontSize: 11,
              lineHeight: 1.5,
              margin: "3px 0 0",
            }}
          >
            {props.description}
          </p>
        </div>
      </header>
      {props.children}
    </div>
  );
}

export function HealthConsentNotice(props: {
  accepted: boolean;
  onChange: (accepted: boolean) => void;
}) {
  const { theme } = useTheme();

  return (
    <label
      style={{
        alignItems: "flex-start",
        background: accentAlpha(theme, 0.08),
        border: `1px solid ${accentAlpha(theme, 0.28)}`,
        borderRadius: 12,
        color: theme.colors.tx2,
        display: "flex",
        fontSize: 11,
        gap: 9,
        lineHeight: 1.6,
        padding: "11px 12px",
      }}
    >
      <input
        checked={props.accepted}
        onChange={(event) => props.onChange(event.target.checked)}
        style={{ accentColor: theme.colors.ac, marginTop: 2 }}
        type="checkbox"
      />
      <span>
        我同意 FitMind
        处理我主动填写的健康数据，仅用于本功能的记录、展示与同步。
        这项同意与注册分开，可随时删除对应数据；全部健康数据删除后，同意会一并撤回。详见
        <a
          href="/legal/privacy.html"
          rel="noreferrer"
          style={{ color: theme.colors.ac, marginLeft: 3 }}
          target="_blank"
        >
          隐私政策
        </a>
        （版本 {CURRENT_PRIVACY_POLICY_VERSION}）。
      </span>
    </label>
  );
}

export function InlineStatus(props: {
  children: React.ReactNode;
  tone?: "error" | "success" | "muted" | undefined;
}) {
  const { theme } = useTheme();
  const color =
    props.tone === "error"
      ? theme.colors.red
      : props.tone === "success"
        ? theme.colors.green
        : theme.colors.tx2;

  return (
    <p aria-live="polite" style={{ color, fontSize: 12, margin: 0 }}>
      {props.children}
    </p>
  );
}
