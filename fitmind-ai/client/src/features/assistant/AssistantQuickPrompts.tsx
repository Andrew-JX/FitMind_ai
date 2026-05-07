import { useMemo } from "react";

import { Badge } from "../../components/Badge";
import { Card } from "../../components/Card";
import { useTheme } from "../../theme/ThemeContext";
import type { AssistantMode } from "./assistant-types";

export interface AssistantQuickPromptsProps {
  activeMode: AssistantMode;
  onSelectMode: (mode: AssistantMode) => void;
  selectedExerciseId?: string | null | undefined;
  selectedExerciseName?: string | null | undefined;
}

interface PromptDefinition {
  description: string;
  disabled?: boolean | undefined;
  helper?: string | undefined;
  mode: AssistantMode;
  title: string;
}

export function AssistantQuickPrompts(props: AssistantQuickPromptsProps) {
  const { theme } = useTheme();
  const prompts = useMemo<PromptDefinition[]>(
    () => [
      {
        description: "查看最近训练量、总容量和主要动作。",
        mode: "training_overview",
        title: "训练总览",
      },
      {
        description: props.selectedExerciseName
          ? `分析 ${props.selectedExerciseName} 的重量、次数和估算 1RM。`
          : "分析当前选中动作的重量、次数和估算 1RM。",
        disabled: !props.selectedExerciseId,
        helper: "请先在分析页选择一个动作。",
        mode: "exercise_progress",
        title: "动作进展",
      },
      {
        description: "预览 AI 回答前会读取的确定性上下文。",
        mode: "recommendation_context",
        title: "推荐上下文",
      },
    ],
    [props.selectedExerciseId, props.selectedExerciseName],
  );

  return (
    <Card>
      <div style={sectionHeaderStyle}>
        <div>
          <h3 style={sectionTitleStyle}>快捷问题</h3>
          <p style={sectionCopyStyle(theme)}>
            保留现有 quick prompt mode 和 payload 语义，只优化展示与说明。
          </p>
        </div>
        <Badge tone="neutral">Quick Prompts</Badge>
      </div>

      <div style={promptListStyle}>
        {prompts.map((prompt) => {
          const isActive = props.activeMode === prompt.mode;

          return (
            <button
              disabled={prompt.disabled}
              key={prompt.mode}
              onClick={() => props.onSelectMode(prompt.mode)}
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
