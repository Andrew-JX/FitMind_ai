import { useState } from "react";

import { Badge } from "../../components/Badge";
import { Card } from "../../components/Card";
import { useTheme } from "../../theme/ThemeContext";
import type {
  AssistantMode,
  AssistantPromptSuggestion,
} from "./assistant-types";
import { splitAssistantQuickPrompts } from "./assistant-quick-prompts";

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
  const [showMorePrompts, setShowMorePrompts] = useState(false);
  const selectedExerciseName = props.selectedExerciseName?.trim() || "当前动作";
  const prompts = buildPromptDefinitions({
    selectedExerciseId: props.selectedExerciseId,
    selectedExerciseName,
  });
  const promptGroups = splitAssistantQuickPrompts(prompts);
  const visiblePrompts = showMorePrompts
    ? [...promptGroups.primary, ...promptGroups.more]
    : promptGroups.primary;

  return (
    <Card>
      <div style={sectionHeaderStyle}>
        <div>
          <h3 style={sectionTitleStyle}>快捷问题</h3>
          <p style={sectionCopyStyle(theme)}>
            先从核心教练问题开始，也可以直接输入自己的训练问题。
          </p>
        </div>
        <Badge tone="neutral">建议</Badge>
      </div>

      <div style={promptListStyle}>
        {visiblePrompts.map((prompt) => {
          const isActive = props.activeMode === prompt.prompt.mode;

          return (
            <button
              disabled={prompt.disabled}
              key={prompt.title}
              onClick={() => props.onSelectPrompt(prompt.prompt)}
              style={promptButtonStyle(
                theme,
                isActive,
                Boolean(prompt.disabled),
              )}
              type="button"
            >
              <div style={promptTitleRowStyle}>
                <span style={promptTitleStyle(theme, Boolean(prompt.disabled))}>
                  {prompt.title}
                </span>
                {isActive ? <Badge tone="accent">当前</Badge> : null}
              </div>
              <span
                style={promptDescriptionStyle(theme, Boolean(prompt.disabled))}
              >
                {prompt.description}
              </span>
              {prompt.disabled && prompt.helper ? (
                <span style={promptHelperStyle(theme)}>{prompt.helper}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {promptGroups.more.length > 0 ? (
        <button
          onClick={() => setShowMorePrompts((currentValue) => !currentValue)}
          style={moreButtonStyle(theme)}
          type="button"
        >
          {showMorePrompts ? "收起问题" : "更多问题"}
        </button>
      ) : null}
    </Card>
  );
}

function buildPromptDefinitions(input: {
  selectedExerciseId?: string | null | undefined;
  selectedExerciseName: string;
}): PromptDefinition[] {
  return [
    {
      description: "总结本周训练频率、总量、主要动作、肌群分布和 Evidence。",
      prompt: {
        mode: "weekly_report",
        message: "帮我做一份本周训练报告",
      },
      title: "本周训练报告",
    },
    {
      description: "结合训练 Evidence 和知识 Sources，保守诊断动作是否进入平台期。",
      disabled: !input.selectedExerciseId,
      helper: "请先在分析页选择一个重点动作。",
      prompt: {
        mode: "plateau_diagnosis",
        message: `${input.selectedExerciseName}平台期怎么诊断？`,
      },
      title: "平台期诊断",
    },
    {
      description: "基于 Evidence + Sources 生成下周训练草案，不把它当作处方。",
      prompt: {
        mode: "next_week_plan",
        message: "给我一个下周训练草案",
      },
      title: "下周训练草案",
    },
    {
      description: "快速查看最近训练次数、组数、训练量和主要动作。",
      prompt: {
        mode: "training_overview",
        message: "最近训练总览",
      },
      title: "最近训练总览",
    },
    {
      description: "根据最近记录，给出保守的下一次训练方向。",
      prompt: {
        mode: "next_training_focus",
        message: "我今天练什么？",
      },
      title: "我今天练什么？",
    },
    {
      description: "查看训练量分布，判断胸部相关训练是否比较集中。",
      prompt: {
        mode: "muscle_balance",
        message: "我胸练得够吗？",
      },
      title: "我胸练得够吗？",
    },
    {
      description: "判断最近训练是否明显集中在少数动作或同一类部位。",
      prompt: {
        mode: "training_imbalance",
        message: "我是不是偏科？",
      },
      title: "我是不是偏科？",
    },
    {
      description: `分析 ${input.selectedExerciseName} 的重量变化、最高重量和估算 1RM。`,
      disabled: !input.selectedExerciseId,
      helper: "请先在分析页选择一个动作。",
      prompt: {
        mode: "exercise_progress",
        message: `分析一下${input.selectedExerciseName}的进展。`,
      },
      title: "当前动作进展",
    },
    {
      description: "解释这些建议背后参考了哪些训练记录和计算规则。",
      prompt: {
        mode: "evidence_explain",
        message: "智能助手根据什么判断？",
      },
      title: "判断依据",
    },
  ];
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

function sectionCopyStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
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

function promptHelperStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.orange,
    fontSize: 11,
    lineHeight: 1.5,
  };
}

function moreButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.control,
    color: theme.colors.tx2,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
    marginTop: 12,
    padding: "10px 12px",
    width: "100%",
  };
}
