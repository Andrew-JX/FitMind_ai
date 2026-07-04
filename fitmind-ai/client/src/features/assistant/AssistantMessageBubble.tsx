import { Badge } from "../../components/Badge";
import { Icon } from "../../components/Icon";
import { IconButton } from "../../components/IconButton";
import { useTheme } from "../../theme/ThemeContext";
import { AssistantAgentTrace } from "./AssistantAgentTrace";
import { AssistantPlanCard } from "./AssistantPlanCard";
import { isAssistantMessageSaveEligible } from "./assistant-saved-insights";
import type { AssistantChatMessage } from "./assistant-types";

export interface AssistantMessageBubbleProps {
  isSaved?: boolean | undefined;
  isSaving?: boolean | undefined;
  isPlanAccepting?: boolean | undefined;
  isPlanAccepted?: boolean | undefined;
  message: AssistantChatMessage;
  onAcceptPlan?: ((message: AssistantChatMessage) => void) | undefined;
  onCopyInsight?: ((message: AssistantChatMessage) => void) | undefined;
  onSaveInsight?: ((message: AssistantChatMessage) => void) | undefined;
}

export function AssistantMessageBubble(props: AssistantMessageBubbleProps) {
  const { message } = props;
  const { theme } = useTheme();
  const isAssistant = message.role === "assistant";
  const showDebugMetadata =
    import.meta.env.DEV && import.meta.env.VITE_ASSISTANT_DEBUG === "true";

  return (
    <article style={bubbleLayoutStyle}>
      <div style={avatarStyle(theme, isAssistant)}>
        <Icon name={isAssistant ? "bot" : "user"} size={12} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={metaRowStyle}>
          <span style={nameStyle(theme)}>
            {isAssistant ? "训练助手" : "你"}
          </span>
          {message.isStreaming ? <Badge tone="info">生成中</Badge> : null}
          {isAssistant && !message.isStreaming && message.faithfulness ? (
            <Badge
              tone={
                message.faithfulness.status === "verified"
                  ? "success"
                  : "warning"
              }
            >
              {message.faithfulness.status === "verified"
                ? "✓ 数据已核对"
                : `⚠ ${message.faithfulness.unverifiedClaimCount} 处待核`}
            </Badge>
          ) : null}
        </div>
        <div style={bubbleStyle(theme, isAssistant)}>
          <p style={messageTextStyle}>{message.text || "..."}</p>
          {isAssistant && message.agentTrace ? (
            <AssistantAgentTrace trace={message.agentTrace} />
          ) : null}
          {isAssistant && message.plan ? (
            <AssistantPlanCard
              isAccepted={props.isPlanAccepted}
              isAccepting={props.isPlanAccepting}
              onAccept={
                props.onAcceptPlan
                  ? () => props.onAcceptPlan?.(message)
                  : undefined
              }
              plan={message.plan}
            />
          ) : null}
          {isAssistant ? (
            <AssistantMessageEvidenceSummary
              message={message}
              showDebugMetadata={showDebugMetadata}
            />
          ) : null}
          {isAssistantMessageSaveEligible(message) ? (
            <div style={actionRowStyle}>
              <IconButton
                disabled={props.isSaving || props.isSaved}
                icon={props.isSaved ? "check" : "plus"}
                label={props.isSaved ? "洞察已保存" : "保存洞察"}
                onClick={() => props.onSaveInsight?.(message)}
              />
              <IconButton
                icon="copy"
                label="复制洞察文本"
                onClick={() => props.onCopyInsight?.(message)}
              />
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function AssistantMessageEvidenceSummary(props: {
  message: AssistantChatMessage;
  showDebugMetadata: boolean;
}) {
  const { message } = props;
  const hasEvidence =
    (message.evidence?.toolNames.length ?? 0) > 0 ||
    (message.evidence?.workoutIds.length ?? 0) > 0 ||
    (message.evidence?.setIds.length ?? 0) > 0;
  const hasSources = (message.sources?.length ?? 0) > 0;
  const hasLimitations = (message.limitations?.length ?? 0) > 0;

  if (
    !hasEvidence &&
    !hasSources &&
    !hasLimitations &&
    !(props.showDebugMetadata && message.intent)
  ) {
    return null;
  }

  return (
    <div style={structuredOutputStyle}>
      {props.showDebugMetadata && message.intent ? (
        <div style={structuredLineStyle}>Intent: {message.intent}</div>
      ) : null}
      {hasEvidence ? (
        <details>
          <summary style={summaryStyle}>Evidence</summary>
          <ul style={listStyle}>
            {message.evidence?.toolNames.length ? (
              <li>工具：{message.evidence.toolNames.join("、")}</li>
            ) : null}
            {message.evidence?.workoutIds.length ? (
              <li>训练：{message.evidence.workoutIds.length} 条</li>
            ) : null}
            {message.evidence?.setIds.length ? (
              <li>组数：{message.evidence.setIds.length} 条</li>
            ) : null}
            {message.evidence?.calculationRules.length ? (
              <li>规则：{message.evidence.calculationRules.join("、")}</li>
            ) : null}
          </ul>
        </details>
      ) : null}
      {hasSources ? (
        <details>
          <summary style={summaryStyle}>Sources</summary>
          <ul style={listStyle}>
            {message.sources?.map((source) => (
              <li key={source.id}>
                <strong>{source.title}</strong>
                <span>：{source.chunkText}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {hasLimitations ? (
        <details>
          <summary style={summaryStyle}>Limitations</summary>
          <ul style={listStyle}>
            {message.limitations?.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

const bubbleLayoutStyle: React.CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  gap: 10,
};

function avatarStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isAssistant: boolean,
): React.CSSProperties {
  return {
    alignItems: "center",
    backgroundColor: isAssistant
      ? theme.isDark
        ? "rgba(200, 240, 53, 0.18)"
        : "rgba(74, 140, 0, 0.12)"
      : theme.colors.surf2,
    border: `1px solid ${isAssistant ? theme.colors.ac : theme.colors.bdr}`,
    borderRadius: 8,
    color: isAssistant ? theme.colors.ac : theme.colors.tx3,
    display: "inline-flex",
    flexShrink: 0,
    height: 24,
    justifyContent: "center",
    marginTop: 2,
    width: 24,
  };
}

const metaRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 8,
  marginBottom: 6,
};

function nameStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
    fontWeight: 700,
  };
}

function bubbleStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isAssistant: boolean,
): React.CSSProperties {
  return {
    backgroundColor: isAssistant ? theme.colors.surf : theme.colors.surf2,
    border: `1px solid ${isAssistant ? theme.colors.bdr : "transparent"}`,
    borderRadius: theme.radius.card,
    color: theme.colors.tx,
    padding: "12px 14px",
  };
}

const messageTextStyle: React.CSSProperties = {
  lineHeight: 1.7,
  margin: 0,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const structuredOutputStyle: React.CSSProperties = {
  borderTop: "1px solid rgba(128, 128, 128, 0.22)",
  display: "grid",
  gap: 8,
  marginTop: 12,
  paddingTop: 10,
};

const structuredLineStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  opacity: 0.7,
};

const summaryStyle: React.CSSProperties = {
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 800,
};

const listStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.6,
  margin: "8px 0 0",
  paddingLeft: 18,
};

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  justifyContent: "flex-end",
  marginTop: 10,
};
