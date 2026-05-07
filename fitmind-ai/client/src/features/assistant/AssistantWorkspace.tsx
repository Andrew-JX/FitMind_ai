import { Badge } from "../../components/Badge";
import { Card } from "../../components/Card";
import { StatusPill } from "../../components/StatusPill";
import { useTheme } from "../../theme/ThemeContext";
import { AssistantChatPanel } from "./AssistantChatPanel";
import type { AssistantChatStatus, AssistantProvider } from "./assistant-types";
import { useAssistantChat } from "./use-assistant-chat";

export interface AssistantWorkspaceProps {
  selectedExerciseId?: string | null | undefined;
  selectedExerciseName?: string | null | undefined;
  token: string | null;
}

const FLOW_STEPS = [
  "训练日志",
  "确定性工具",
  "Provider 适配层",
  "SSE 流",
  "AI 回答",
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

export function AssistantWorkspace(props: AssistantWorkspaceProps) {
  const chat = useAssistantChat(props.token);
  const { theme } = useTheme();

  return (
    <section style={{ display: "grid", gap: 16 }}>
      <Card>
        <div style={titleRowStyle}>
          <h2 style={{ margin: 0 }}>AI 助手</h2>
          <Badge tone="info">SSE</Badge>
        </div>
        <p style={copyStyle(theme)}>
          基于真实训练日志和确定性计算结果生成可追溯回答。当前链路保持为 Tool
          Calling + Provider Adapter + SSE 流式返回。
        </p>

        <div style={summaryGridStyle}>
          <InfoBlock label="当前状态">
            <StatusPill status={chat.status} />
          </InfoBlock>
          <InfoBlock label="Provider">
            <Badge tone="analysis">
              {formatProvider(chat.provider) ?? "等待选择"}
            </Badge>
          </InfoBlock>
          <InfoBlock label="Session ID">
            <code style={sessionCodeStyle(theme)}>
              {chat.sessionId ?? "尚未建立会话"}
            </code>
          </InfoBlock>
        </div>
      </Card>

      <div style={flowGridStyle}>
        {FLOW_STEPS.map((step, index) => (
          <Card key={step} padding="14px">
            <div style={flowStepNumberStyle(theme)}>步骤 {index + 1}</div>
            <div style={flowStepLabelStyle(theme)}>{step}</div>
            <div style={flowStepMetaStyle(theme)}>{getFlowMeta(step, chat.provider)}</div>
          </Card>
        ))}
      </div>

      <Card>
        <h3 style={{ margin: 0 }}>可见工具</h3>
        <p style={copyStyle(theme)}>
          当前前端会把以下三个确定性工具的调用过程可视化显示出来。
        </p>
        <div style={toolListStyle}>
          {TOOL_NAMES.map((toolName) => (
            <Badge key={toolName} tone="info">
              {toolName}
            </Badge>
          ))}
        </div>
      </Card>

      <Card>
        <h3 style={{ margin: 0 }}>状态机说明</h3>
        <p style={copyStyle(theme)}>
          前端状态机语义保持不变，这里只做中文产品化展示。
        </p>
        <div style={statusListStyle}>
          {STATUS_STEPS.map((statusStep) => (
            <StatusPill key={statusStep} status={statusStep} />
          ))}
        </div>
      </Card>

      <AssistantChatPanel
        chat={chat}
        selectedExerciseId={props.selectedExerciseId}
        selectedExerciseName={props.selectedExerciseName}
        token={props.token}
      />
    </section>
  );
}

interface InfoBlockProps {
  children: React.ReactNode;
  label: string;
}

function InfoBlock(props: InfoBlockProps) {
  const { theme } = useTheme();

  return (
    <div
      style={{
        backgroundColor: theme.colors.surf2,
        borderRadius: theme.radius.control,
        padding: 12,
      }}
    >
      <div style={{ color: theme.colors.tx3, fontSize: 11, marginBottom: 6 }}>
        {props.label}
      </div>
      {props.children}
    </div>
  );
}

function formatProvider(provider: AssistantProvider | null): string | null {
  if (provider === null) {
    return null;
  }

  return provider === "mock" ? "Mock Provider" : "Anthropic Provider";
}

function getFlowMeta(
  step: (typeof FLOW_STEPS)[number],
  provider: AssistantProvider | null,
): string {
  if (step === "训练日志") {
    return "复用训练 Tab 和分析 Tab 中已经可见的真实训练数据。";
  }

  if (step === "确定性工具") {
    return "根据 quick prompt 的 mode 选择固定训练工具。";
  }

  if (step === "Provider 适配层") {
    return formatProvider(provider) ?? "流开始后显示当前 provider。";
  }

  if (step === "SSE 流") {
    return "前端按事件逐步接收状态、工具调用、session 和回答增量。";
  }

  return "最终回答由 answer_delta 增量拼接而成。";
}

function copyStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 13,
    lineHeight: 1.6,
    margin: "8px 0 0",
  };
}

function sessionCodeStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx,
    display: "block",
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    overflowWrap: "anywhere",
  };
}

const titleRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 8,
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "1fr",
  marginTop: 16,
};

const flowGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

function flowStepNumberStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 8,
  };
}

function flowStepLabelStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 8,
  };
}

function flowStepMetaStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
  };
}

const toolListStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 12,
};

const statusListStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 12,
};
