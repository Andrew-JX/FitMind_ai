import { Button } from "../../components/Button";
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

export function AssistantComposer(props: AssistantComposerProps) {
  const { theme } = useTheme();

  return (
    <form onSubmit={props.onSubmit} style={composerStyle(theme)}>
      <div style={{ flex: 1 }}>
        <textarea
          onChange={(event) => props.onChangeMessage(event.target.value)}
          placeholder="例如：为什么建议我练背？这周训练量是不是太少？我今天还能练胸吗？"
          rows={3}
          style={textareaStyle(theme)}
          value={props.message}
        />
      </div>
      <div style={actionRowStyle}>
        {props.isStreaming ? (
          <Button onClick={props.onStop} type="button" variant="secondary">
            停止
          </Button>
        ) : (
          <Button type="submit">发送追问</Button>
        )}
        <Button
          disabled={!props.canRetry || props.isStreaming}
          onClick={props.onRetry}
          type="button"
          variant="secondary"
        >
          重试
        </Button>
        <Button
          disabled={props.isStreaming}
          onClick={props.onClear}
          type="button"
          variant="secondary"
        >
          清空
        </Button>
      </div>
    </form>
  );
}

function composerStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    alignItems: "flex-end",
    backgroundColor: theme.colors.surf,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.card,
    display: "grid",
    gap: 10,
    padding: "12px 12px 14px",
  };
}

function textareaStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr2}`,
    borderRadius: theme.radius.control,
    color: theme.colors.tx,
    font: "inherit",
    minHeight: 82,
    padding: "12px 12px",
    resize: "none",
    width: "100%",
  };
}

const actionRowStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
};
