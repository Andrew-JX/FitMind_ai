import { Icon, type IconName } from "../../components/Icon";
import { useTheme } from "../../theme/ThemeContext";
import { getToneColors, type SemanticTone } from "../../theme/tokens";
import type {
  AssistantAgentStepKind,
  AssistantAgentStepStatus,
  AssistantAgentTrace,
  AssistantAgentTraceStep,
} from "./assistant-types";

export interface AssistantAgentTraceProps {
  trace: AssistantAgentTrace;
}

const KIND_LABEL: Record<AssistantAgentStepKind, string> = {
  tool: "查数据",
  retrieval: "检索知识",
  synthesis: "生成草案",
};

const KIND_ICON: Record<AssistantAgentStepKind, IconName> = {
  tool: "tool",
  retrieval: "search",
  synthesis: "zap",
};

const STATUS_LABEL: Record<AssistantAgentStepStatus, string> = {
  running: "进行中",
  success: "完成",
  error: "失败",
  skipped: "跳过",
};

const STATUS_TONE: Record<AssistantAgentStepStatus, SemanticTone> = {
  running: "accent",
  success: "success",
  error: "danger",
  skipped: "neutral",
};

/**
 * Renders the multi-step ReAct planner trace as a vertical thought → action →
 * observation timeline.
 *
 * @param props - The accumulated agent trace for one assistant message
 * @returns The trace timeline, or null when there are no steps
 */
export function AssistantAgentTrace(props: AssistantAgentTraceProps) {
  const { theme } = useTheme();
  const steps = props.trace.steps;

  if (steps.length === 0) {
    return null;
  }

  return (
    <details open style={containerStyle(theme)}>
      <summary style={summaryStyle(theme)}>
        <Icon name="bot" size={13} />
        <span>多步推理 · {steps.length} 步</span>
        {props.trace.goal ? (
          <span style={goalStyle(theme)}>{props.trace.goal}</span>
        ) : null}
      </summary>

      <ol style={listStyle}>
        {steps.map((step, index) => (
          <AgentTraceRow
            isLast={index === steps.length - 1}
            key={step.index}
            step={step}
          />
        ))}
      </ol>
    </details>
  );
}

function AgentTraceRow(props: {
  isLast: boolean;
  step: AssistantAgentTraceStep;
}) {
  const { theme } = useTheme();
  const { step } = props;
  const tone = getToneColors(theme, STATUS_TONE[step.status]);
  const isMuted = step.status === "skipped";

  return (
    <li style={rowStyle}>
      <div style={railStyle}>
        <span
          style={{
            ...nodeStyle,
            backgroundColor: tone.background,
            borderColor: tone.border,
            color: tone.text,
          }}
        >
          <Icon name={KIND_ICON[step.kind]} size={12} />
        </span>
        {props.isLast ? null : (
          <span style={connectorStyle(theme)} aria-hidden="true" />
        )}
      </div>

      <div style={{ ...contentStyle, opacity: isMuted ? 0.62 : 1 }}>
        <div style={headerRowStyle}>
          <span style={titleStyle(theme)}>
            {step.index}. {step.title}
          </span>
          <span
            style={{
              ...statusChipStyle,
              backgroundColor: tone.background,
              borderColor: tone.border,
              color: tone.text,
            }}
          >
            {STATUS_LABEL[step.status]}
          </span>
        </div>

        <p style={thoughtStyle(theme)}>{step.thought}</p>

        <div style={metaRowStyle}>
          <span style={kindBadgeStyle(theme)}>{KIND_LABEL[step.kind]}</span>
          {step.toolName ? (
            <code style={toolStyle(theme)}>{step.toolName}</code>
          ) : null}
          {typeof step.durationMs === "number" && step.durationMs > 0 ? (
            <span style={durationStyle(theme)}>{step.durationMs}ms</span>
          ) : null}
        </div>

        {step.observation ? (
          <p style={observationStyle(theme)}>
            <span style={observationLabelStyle(theme)}>观察</span>
            {step.observation}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function containerStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.control,
    marginTop: 12,
    padding: "10px 12px",
  };
}

function summaryStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    color: theme.colors.tx,
    cursor: "pointer",
    display: "flex",
    flexWrap: "wrap",
    fontSize: 12,
    fontWeight: 800,
    gap: 8,
  };
}

function goalStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
    fontWeight: 600,
  };
}

const listStyle: React.CSSProperties = {
  display: "grid",
  gap: 0,
  listStyle: "none",
  margin: "12px 0 0",
  padding: 0,
};

const rowStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "24px minmax(0, 1fr)",
};

const railStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const nodeStyle: React.CSSProperties = {
  alignItems: "center",
  border: "1px solid",
  borderRadius: 999,
  display: "inline-flex",
  flexShrink: 0,
  height: 24,
  justifyContent: "center",
  width: 24,
};

function connectorStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.bdr,
    flex: 1,
    minHeight: 14,
    width: 2,
  };
}

const contentStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  paddingBottom: 14,
};

const headerRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  justifyContent: "space-between",
};

function titleStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontSize: 13,
    fontWeight: 700,
  };
}

const statusChipStyle: React.CSSProperties = {
  border: "1px solid",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 700,
  padding: "2px 8px",
};

function thoughtStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
    margin: 0,
  };
}

const metaRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

function kindBadgeStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.pill,
    color: theme.colors.tx3,
    fontSize: 10,
    fontWeight: 700,
    padding: "2px 8px",
  };
}

function toolStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 6,
    color: theme.colors.tx2,
    fontSize: 11,
    padding: "1px 6px",
  };
}

function durationStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 10,
  };
}

function observationStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
    margin: "2px 0 0",
  };
}

function observationLabelStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 10,
    fontWeight: 700,
    marginRight: 6,
  };
}
