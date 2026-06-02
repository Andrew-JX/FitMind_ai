import { Badge } from "../../components/Badge";
import { Card } from "../../components/Card";
import { useTheme } from "../../theme/ThemeContext";
import type { AssistantMode, AssistantPromptSuggestion } from "./assistant-types";

export interface AssistantQuickPromptsProps {
  activeMode: AssistantMode;
  onSelectPrompt: (prompt: AssistantPromptSuggestion) => void;
  selectedExerciseId?: string | null | undefined;
  selectedExerciseName?: string | null | undefined;
}

interface PromptDefinition {
  description: string;
  disabled?: boolean | undefined;
  helper?: string | undefined;
  prompt: AssistantPromptSuggestion;
  title: string;
}

export function AssistantQuickPrompts(props: AssistantQuickPromptsProps) {
  const { theme } = useTheme();
  const selectedExerciseName = props.selectedExerciseName?.trim() || "当前动作";
  const prompts: PromptDefinition[] = [
    {
      description: "快速看最近训练次数、组数、训练量和当前主要训练动作。",
      prompt: {
        mode: "training_overview",
        message: "最近训练总览",
      },
      title: "最近训练总览",
    },
    {
      description: "基于最近记录，先给一个保守的下一次训练方向建议。",
      prompt: {
        mode: "next_training_focus",
        message: "我今天练什么？",
      },
      title: "我今天练什么？",
    },
    {
      description: "看最近训练量分布，判断胸部相关训练是否已经比较集中。",
      prompt: {
        mode: "muscle_balance",
        message: "我胸练得够吗？",
      },
      title: "我胸练得够吗？",
    },
    {
      description: "判断最近训练是不是明显集中在少数动作或同一类部位。",
      prompt: {
        mode: "training_imbalance",
        message: "我是不是偏科？",
      },
      title: "我是不是偏科？",
    },
    {
      description: props.selectedExerciseName
        ? `分析 ${selectedExerciseName} 的重量变化、最高重量和估算最大重量。`
        : "分析当前选中动作的重量变化、最高重量和估算最大重量。",
      disabled: !props.selectedExerciseId,
      helper: "请先去“分析”页选中一个动作。",
      prompt: {
        mode: "exercise_progress",
        message: `分析一下${selectedExerciseName}的进展。`,
      },
      title: "当前动作进展",
    },
    {
      description: "解释这些建议背后具体参考了哪些训练记录和计算规则。",
      prompt: {
        mode: "evidence_explain",
        message: "智能助手根据什么判断？",
      },
      title: "智能助手根据什么判断？",
    },
  ];

  return (
    <Card>
      <div style={sectionHeaderStyle}>
        <div>
          <h3 style={sectionTitleStyle}>快捷问题</h3>
          <p style={sectionCopyStyle(theme)}>
            这些入口会直接帮你追问最常见、也最稳定的训练问题，不需要先猜该怎么问。
          </p>
        </div>
        <Badge tone="neutral">6 个常用问题</Badge>
      </div>

      <div style={promptListStyle}>
        {prompts.map((prompt) => {
          const isActive = props.activeMode === prompt.prompt.mode;

          return (
            <button
              disabled={prompt.disabled}
              key={prompt.title}
              onClick={() => props.onSelectPrompt(prompt.prompt)}
              style={promptButtonStyle(theme, isActive, Boolean(prompt.disabled))}
              type="button"
            >
              <div style={promptTitleRowStyle}>
                <span style={promptTitleStyle(theme, Boolean(prompt.disabled))}>
                  {prompt.title}
                </span>
                {isActive ? <Badge tone="accent">当前</Badge> : null}
              </div>
              <span style={promptDescriptionStyle(theme, Boolean(prompt.disabled))}>
                {prompt.description}
              </span>
              {prompt.disabled && prompt.helper ? (
                <span style={promptHelperStyle(theme)}>{prompt.helper}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

const sectionHeaderStyle: React.CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 16,
  margin: 0,
};

function sectionCopyStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
    margin: "6px 0 0",
  };
}

const promptListStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  marginTop: 14,
};

const promptTitleRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 8,
  justifyContent: "space-between",
};

function promptButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isActive: boolean,
  isDisabled: boolean,
): React.CSSProperties {
  return {
    backgroundColor: isActive ? theme.colors.surf2 : theme.colors.surf,
    border: `1px solid ${isActive ? theme.colors.ac : theme.colors.bdr}`,
    borderRadius: theme.radius.card,
    cursor: isDisabled ? "not-allowed" : "pointer",
    display: "grid",
    gap: 8,
    opacity: isDisabled ? 0.45 : 1,
    padding: "14px 14px 13px",
    textAlign: "left",
  };
}

function promptTitleStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isDisabled: boolean,
): React.CSSProperties {
  return {
    color: isDisabled ? theme.colors.tx2 : theme.colors.tx,
    fontSize: 14,
    fontWeight: 700,
  };
}

function promptDescriptionStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isDisabled: boolean,
): React.CSSProperties {
  return {
    color: isDisabled ? theme.colors.tx3 : theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.6,
  };
}

function promptHelperStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.orange,
    fontSize: 11,
    lineHeight: 1.5,
  };
}
