import { Badge } from "../../components/Badge";
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

/**
 * One chat message.
 *
 * The design's bubble is deliberately bare: neon green right-aligned for the
 * user, inset left-aligned for the coach. The faithfulness badge stays because
 * it is the only place the app shows that an answer's numbers were checked;
 * everything else the answer carries (agent trace, evidence, sources,
 * limitations) collapses into one 查看依据 row so it costs no vertical space
 * until asked for.
 *
 * @param props - The message plus its save / plan action state
 * @returns Message element
 */
export function AssistantMessageBubble(props: AssistantMessageBubbleProps) {
  const { message } = props;
  const { theme } = useTheme();
  const isAssistant = message.role === "assistant";
  const showDebugMetadata =
    import.meta.env.DEV && import.meta.env.VITE_ASSISTANT_DEBUG === "true";
  const isAwaitingFirstToken = message.isStreaming && !message.text;

  if (isAwaitingFirstToken) {
    return (
      <div style={columnStyle(false)}>
        <div style={typingBubbleStyle(theme)}>教练正在输入…</div>
      </div>
    );
  }

  const hasFooter =
    isAssistant &&
    (Boolean(message.faithfulness) ||
      isAssistantMessageSaveEligible(message) ||
      message.isStreaming);

  return (
    <article style={columnStyle(!isAssistant)}>
      <div style={bubbleStyle(theme, isAssistant)}>{message.text}</div>

      {hasFooter ? (
        <div style={footerStyle}>
          {message.isStreaming ? <Badge tone="info">生成中</Badge> : null}
          {!message.isStreaming && message.faithfulness ? (
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
          {isAssistantMessageSaveEligible(message) ? (
            <>
              <button
                disabled={props.isSaving || props.isSaved}
                onClick={() => props.onSaveInsight?.(message)}
                style={textButtonStyle(theme, props.isSaved ?? false)}
                type="button"
              >
                {props.isSaved ? "✓ 已保存" : "☆ 保存为洞察"}
              </button>
              <button
                onClick={() => props.onCopyInsight?.(message)}
                style={textButtonStyle(theme, false)}
                type="button"
              >
                复制
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {isAssistant && message.plan ? (
        <AssistantPlanCard
          isAccepted={props.isPlanAccepted}
          isAccepting={props.isPlanAccepting}
          onAccept={
            props.onAcceptPlan ? () => props.onAcceptPlan?.(message) : undefined
          }
          plan={message.plan}
        />
      ) : null}

      {isAssistant ? (
        <AssistantMessageBasis
          message={message}
          showDebugMetadata={showDebugMetadata}
        />
      ) : null}
    </article>
  );
}

/**
 * Collapsed 查看依据 row holding everything traceable about one answer.
 *
 * @param props - The message and whether to expose dev-only routing metadata
 * @returns Details element, or null when the answer carries no basis
 */
function AssistantMessageBasis(props: {
  message: AssistantChatMessage;
  showDebugMetadata: boolean;
}) {
  const { message } = props;
  const { theme } = useTheme();
  const hasEvidence =
    (message.evidence?.toolNames.length ?? 0) > 0 ||
    (message.evidence?.workoutIds.length ?? 0) > 0 ||
    (message.evidence?.setIds.length ?? 0) > 0;
  const hasSources = (message.sources?.length ?? 0) > 0;
  const hasLimitations = (message.limitations?.length ?? 0) > 0;
  const hasTrace = Boolean(message.agentTrace);

  if (!hasEvidence && !hasSources && !hasLimitations && !hasTrace) {
    return null;
  }

  return (
    <details style={basisStyle(theme)}>
      <summary style={basisSummaryStyle(theme)}>查看依据</summary>
      <div style={basisBodyStyle}>
        {props.showDebugMetadata && message.intent ? (
          <div style={basisLineStyle(theme)}>Intent: {message.intent}</div>
        ) : null}
        {hasTrace && message.agentTrace ? (
          <AssistantAgentTrace trace={message.agentTrace} />
        ) : null}
        {hasEvidence ? (
          <ul style={basisListStyle(theme)}>
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
        ) : null}
        {hasSources ? (
          <div style={basisBlockStyle}>
            <strong style={basisLabelStyle(theme)}>知识来源</strong>
            <ul style={basisListStyle(theme)}>
              {message.sources?.map((source) => (
                <li key={source.id}>
                  <strong>{source.title}</strong>：{source.chunkText}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {hasLimitations ? (
          <div style={basisBlockStyle}>
            <strong style={basisLabelStyle(theme)}>边界</strong>
            <ul style={basisListStyle(theme)}>
              {message.limitations?.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function columnStyle(isUser: boolean): React.CSSProperties {
  return {
    alignItems: isUser ? "flex-end" : "flex-start",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  };
}

/**
 * Design's chat bubble.
 *
 * The user bubble keeps the fixed neon green in both themes, like the FAB and
 * the chart's latest bar.
 *
 * The coach bubble takes a hairline border in light mode only: the design's
 * inset fill (#e9e9ef) sits almost on top of the light page background
 * (#f2f2f7), and the thread has no card behind it to give the bubble an edge.
 *
 * @param theme - Active theme tokens
 * @param isAssistant - Whether the coach authored the message
 * @returns Bubble style
 */
function bubbleStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isAssistant: boolean,
): React.CSSProperties {
  return {
    background: isAssistant ? theme.colors.surf2 : "#c8f035",
    border:
      isAssistant && !theme.isDark
        ? `1px solid ${theme.colors.bdr}`
        : "1px solid transparent",
    borderRadius: isAssistant ? "14px 14px 14px 4px" : "14px 14px 4px 14px",
    color: isAssistant ? theme.colors.tx : "#0f0f0f",
    fontSize: 13,
    lineHeight: 1.6,
    maxWidth: "85%",
    padding: "10px 12px",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  };
}

function typingBubbleStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: theme.isDark
      ? "1px solid transparent"
      : `1px solid ${theme.colors.bdr}`,
    borderRadius: "14px 14px 14px 4px",
    color: theme.colors.tx2,
    fontSize: 13,
    padding: "10px 12px",
  };
}

const footerStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  padding: "0 4px",
};

function textButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isDone: boolean,
): React.CSSProperties {
  return {
    background: "transparent",
    border: "none",
    color: isDone ? theme.colors.ac : theme.colors.tx3,
    cursor: isDone ? "default" : "pointer",
    fontSize: 11,
    padding: 0,
  };
}

function basisStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.soft,
    borderRadius: 12,
    marginTop: 2,
    padding: "9px 12px",
    width: "100%",
  };
}

function basisSummaryStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 700,
  };
}

const basisBodyStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  marginTop: 10,
};

const basisBlockStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
};

function basisLabelStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx2, fontSize: 11, fontWeight: 700 };
}

function basisLineStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx3, fontSize: 11, fontWeight: 700 };
}

function basisListStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    display: "grid",
    fontSize: 11,
    gap: 4,
    lineHeight: 1.6,
    margin: 0,
    paddingLeft: "1rem",
  };
}
