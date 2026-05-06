import { AssistantChatPanel } from "./AssistantChatPanel";
import type {
  AssistantChatStatus,
  AssistantProvider,
} from "./assistant-types";
import { useAssistantChat } from "./use-assistant-chat";

export interface AssistantWorkspaceProps {
  selectedExerciseId?: string | null | undefined;
  selectedExerciseName?: string | null | undefined;
  token: string | null;
}

const FLOW_STEPS = [
  "Training logs",
  "Deterministic tools",
  "Provider adapter",
  "SSE stream",
  "Assistant answer",
] as const;

const TOOL_NAMES = [
  "get_training_summary",
  "get_exercise_progress",
  "get_recommendation_context",
] as const;

const STATUS_STEPS: AssistantChatStatus[] = [
  "idle",
  "thinking",
  "tool_calling",
  "answering",
  "done",
  "error",
];

/**
 * Presents the current assistant architecture as a demo-oriented workspace.
 *
 * @param props - Auth token and current selected exercise context from the app page.
 * @returns The assistant demo workspace.
 */
export function AssistantWorkspace(props: AssistantWorkspaceProps) {
  const chat = useAssistantChat(props.token);

  return (
    <section style={workspaceStyle}>
      <div style={heroCardStyle}>
        <div>
          <h2 style={workspaceTitleStyle}>Assistant Workspace</h2>
          <p style={workspaceCopyStyle}>
            This demo shows how the current frontend assistant experience maps real
            training logs into deterministic tools, through the provider adapter,
            across SSE, and into a streamed answer.
          </p>
        </div>
        <div style={heroMetaStyle}>
          <InfoBadge label="Current state" value={formatStatus(chat.status)} />
          <InfoBadge
            label="Provider adapter"
            value={formatProvider(chat.provider) ?? "Waiting for selection"}
          />
        </div>
      </div>

      <div style={flowGridStyle}>
        {FLOW_STEPS.map((step, index) => (
          <div key={step} style={flowCardStyle}>
            <div style={flowStepNumberStyle}>Step {index + 1}</div>
            <div style={flowStepLabelStyle}>{step}</div>
            <div style={flowStepMetaStyle}>{getFlowMeta(step, chat.provider)}</div>
          </div>
        ))}
      </div>

      <div style={overviewGridStyle}>
        <section style={cardStyle}>
          <h3 style={cardTitleStyle}>Deterministic Tools</h3>
          <p style={cardCopyStyle}>
            These are the three backend tools the current assistant can visibly call.
          </p>
          <div style={toolListStyle}>
            {TOOL_NAMES.map((toolName) => (
              <code key={toolName} style={toolChipStyle}>
                {toolName}
              </code>
            ))}
          </div>
        </section>

        <section style={cardStyle}>
          <h3 style={cardTitleStyle}>Assistant State Machine</h3>
          <p style={cardCopyStyle}>
            The hook keeps the current lifecycle explicit so the demo can show where
            the assistant is right now.
          </p>
          <div style={statusListStyle}>
            {STATUS_STEPS.map((statusStep) => (
              <div
                key={statusStep}
                style={statusChipStyle(statusStep === chat.status, statusStep)}
              >
                {formatStatus(statusStep)}
              </div>
            ))}
          </div>
        </section>

        <section style={cardStyle}>
          <h3 style={cardTitleStyle}>Session Continuity</h3>
          <p style={cardCopyStyle}>
            The current `sessionId` shows when later turns are continuing the same
            demo conversation.
          </p>
          <div style={sessionValueStyle}>
            {chat.sessionId ?? "Not started yet"}
          </div>
        </section>
      </div>

      <AssistantChatPanel
        chat={chat}
        selectedExerciseId={props.selectedExerciseId}
        selectedExerciseName={props.selectedExerciseName}
        token={props.token}
      />
    </section>
  );
}

interface InfoBadgeProps {
  label: string;
  value: string;
}

function InfoBadge(props: InfoBadgeProps) {
  return (
    <div style={infoBadgeStyle}>
      <div style={infoBadgeLabelStyle}>{props.label}</div>
      <div style={infoBadgeValueStyle}>{props.value}</div>
    </div>
  );
}

function formatStatus(status: AssistantChatStatus): string {
  return status.replace("_", " ");
}

function formatProvider(provider: AssistantProvider | null): string | null {
  if (provider === null) {
    return null;
  }

  return provider === "mock" ? "Mock provider" : "Anthropic provider";
}

function getFlowMeta(
  step: (typeof FLOW_STEPS)[number],
  provider: AssistantProvider | null,
): string {
  if (step === "Training logs") {
    return "Uses the same workout data already shown in the training panels.";
  }

  if (step === "Deterministic tools") {
    return "Calls one of three fixed training tools based on the selected prompt.";
  }

  if (step === "Provider adapter") {
    return formatProvider(provider) ?? "Provider will appear after the stream starts.";
  }

  if (step === "SSE stream") {
    return "Frontend receives state, tool, session, and answer events incrementally.";
  }

  return "Assistant text appears progressively as `answer_delta` events arrive.";
}

const workspaceStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
  marginBottom: 24,
};

const heroCardStyle: React.CSSProperties = {
  alignItems: "flex-start",
  background: "linear-gradient(160deg, #f8fafc 0%, #eef2ff 100%)",
  border: "1px solid #cbd5e1",
  borderRadius: 18,
  display: "flex",
  flexWrap: "wrap",
  gap: 16,
  justifyContent: "space-between",
  padding: 20,
};

const workspaceTitleStyle: React.CSSProperties = {
  margin: 0,
};

const workspaceCopyStyle: React.CSSProperties = {
  color: "#334155",
  marginBottom: 0,
  marginTop: 8,
  maxWidth: 720,
};

const heroMetaStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  minWidth: 220,
};

const infoBadgeStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #dbeafe",
  borderRadius: 14,
  padding: 12,
};

const infoBadgeLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 700,
  marginBottom: 4,
  textTransform: "uppercase",
};

const infoBadgeValueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontWeight: 700,
};

const flowGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
};

const flowCardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #cbd5e1",
  borderRadius: 16,
  padding: 16,
};

const flowStepNumberStyle: React.CSSProperties = {
  color: "#6366f1",
  fontSize: 12,
  fontWeight: 700,
  marginBottom: 8,
  textTransform: "uppercase",
};

const flowStepLabelStyle: React.CSSProperties = {
  color: "#0f172a",
  fontWeight: 700,
  marginBottom: 8,
};

const flowStepMetaStyle: React.CSSProperties = {
  color: "#475569",
  fontSize: 14,
  lineHeight: 1.45,
};

const overviewGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  border: "1px solid #cbd5e1",
  borderRadius: 16,
  padding: 18,
};

const cardTitleStyle: React.CSSProperties = {
  margin: 0,
};

const cardCopyStyle: React.CSSProperties = {
  color: "#475569",
  marginBottom: 12,
  marginTop: 8,
};

const toolListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const toolChipStyle: React.CSSProperties = {
  backgroundColor: "#eff6ff",
  border: "1px solid #bfdbfe",
  borderRadius: 10,
  color: "#1d4ed8",
  display: "block",
  fontSize: 14,
  padding: "10px 12px",
};

const statusListStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const sessionValueStyle: React.CSSProperties = {
  backgroundColor: "#f8fafc",
  border: "1px dashed #94a3b8",
  borderRadius: 12,
  color: "#0f172a",
  fontFamily: "monospace",
  minHeight: 44,
  padding: 12,
  wordBreak: "break-word",
};

function statusChipStyle(
  isActive: boolean,
  status: AssistantChatStatus,
): React.CSSProperties {
  const palette =
    status === "error"
      ? {
          backgroundColor: "#fee2e2",
          borderColor: "#fecaca",
          color: "#991b1b",
        }
      : status === "done"
        ? {
            backgroundColor: "#dcfce7",
            borderColor: "#bbf7d0",
            color: "#166534",
          }
        : {
            backgroundColor: "#f8fafc",
            borderColor: "#cbd5e1",
            color: "#334155",
          };

  return {
    ...palette,
    border: `1px solid ${palette.borderColor}`,
    borderRadius: 999,
    boxShadow: isActive ? "0 0 0 2px rgba(59,130,246,0.18)" : "none",
    fontSize: 13,
    fontWeight: isActive ? 700 : 600,
    padding: "8px 10px",
    textTransform: "uppercase",
  };
}
