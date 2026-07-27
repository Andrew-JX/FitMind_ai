import { useTheme } from "../../theme/ThemeContext";

export interface AssistantComposerProps {
  canRetry: boolean;
  isStreaming: boolean;
  message: string;
  onChangeMessage: (value: string) => void;
  onClear: () => void;
  onRetry: () => void;
  onStop: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
}

/**
 * Assistant tab's composer card.
 *
 * The design pairs one neon 发送追问 with 清空 at 2fr/1fr. 重试 is kept as a
 * third column — it is a real action with no other entry point — and while a
 * reply streams the primary button becomes 停止 in place.
 *
 * @param props - Message value plus send / stop / retry / clear handlers
 * @returns Composer form
 */
export function AssistantComposer(props: AssistantComposerProps) {
  const { theme } = useTheme();

  return (
    <form onSubmit={props.onSubmit} style={composerStyle(theme)}>
      <textarea
        onChange={(event) => props.onChangeMessage(event.target.value)}
        placeholder="例如：为什么建议我练背？RPE 是什么？"
        rows={2}
        style={textareaStyle(theme)}
        value={props.message}
      />
      <div style={actionRowStyle}>
        {props.isStreaming ? (
          <button
            onClick={props.onStop}
            style={primaryButtonStyle(false)}
            type="button"
          >
            停止
          </button>
        ) : (
          <button style={primaryButtonStyle(false)} type="submit">
            发送追问
          </button>
        )}
        <button
          disabled={!props.canRetry || props.isStreaming}
          onClick={props.onRetry}
          style={secondaryButtonStyle(
            theme,
            !props.canRetry || props.isStreaming,
          )}
          type="button"
        >
          重试
        </button>
        <button
          disabled={props.isStreaming}
          onClick={props.onClear}
          style={secondaryButtonStyle(theme, props.isStreaming)}
          type="button"
        >
          清空
        </button>
      </div>
    </form>
  );
}

function composerStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: `${theme.gradients.card}, ${theme.colors.surf}`,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.card,
    boxShadow: theme.shadows.card,
    display: "grid",
    gap: 10,
    padding: 14,
  };
}

function textareaStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.soft,
    border: `1px solid ${theme.colors.bdr2}`,
    borderRadius: 14,
    color: theme.colors.tx,
    font: "inherit",
    // Design: 15px keeps iOS from zooming the viewport on focus.
    fontSize: 15,
    minHeight: 58,
    padding: 10,
    resize: "none",
    width: "100%",
  };
}

const actionRowStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "2fr 1fr 1fr",
};

/** Design keeps the primary action neon in both themes. */
function primaryButtonStyle(isDisabled: boolean): React.CSSProperties {
  return {
    background: "#c8f035",
    border: "none",
    borderRadius: 12,
    color: "#0f0f0f",
    cursor: isDisabled ? "not-allowed" : "pointer",
    fontSize: 13,
    fontWeight: 700,
    padding: "11px 12px",
  };
}

function secondaryButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isDisabled: boolean,
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 12,
    color: theme.colors.tx2,
    cursor: isDisabled ? "not-allowed" : "pointer",
    fontSize: 13,
    fontWeight: 700,
    opacity: isDisabled ? 0.5 : 1,
    padding: "11px 12px",
  };
}
