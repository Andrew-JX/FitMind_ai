import { Card } from "../../components/Card";
import { useTheme } from "../../theme/ThemeContext";
import type { AssistantPromptSuggestion } from "./assistant-types";

export interface AssistantQuickPromptsProps {
  onSelectPrompt: (prompt: AssistantPromptSuggestion) => void;
  selectedExerciseId?: string | null | undefined;
  selectedExerciseName?: string | null | undefined;
}

interface PromptCardDefinition {
  description: string;
  disabled?: boolean | undefined;
  helper?: string | undefined;
  prompt: AssistantPromptSuggestion;
  title: string;
}

interface PromptChipDefinition {
  disabled?: boolean | undefined;
  prompt: AssistantPromptSuggestion;
  title: string;
}

/**
 * Assistant tab's 快捷问题 card: the design's four core coach questions as a
 * 2×2 grid, with the remaining modes as capsules underneath.
 *
 * @param props - Prompt handler and the currently focused exercise
 * @returns Quick prompts card
 */
export function AssistantQuickPrompts(props: AssistantQuickPromptsProps) {
  const { theme } = useTheme();
  const selectedExerciseName = props.selectedExerciseName?.trim() || "当前动作";
  const hasSelectedExercise = Boolean(props.selectedExerciseId);
  const cards = buildPromptCards(selectedExerciseName, hasSelectedExercise);
  const chips = buildPromptChips(selectedExerciseName, hasSelectedExercise);

  return (
    <Card>
      <div style={bodyStyle}>
        <div style={headingStyle}>
          <h3 style={titleStyle}>快捷问题</h3>
          <span style={subtitleStyle(theme)}>
            先从核心教练问题开始，也可以直接输入自己的训练问题。
          </span>
        </div>

        <div style={cardGridStyle}>
          {cards.map((card) => (
            <button
              disabled={card.disabled}
              key={card.title}
              onClick={() => props.onSelectPrompt(card.prompt)}
              style={cardStyle(theme, Boolean(card.disabled))}
              type="button"
            >
              <strong style={cardTitleStyle}>{card.title}</strong>
              <span style={cardCopyStyle(theme)}>{card.description}</span>
              {card.disabled && card.helper ? (
                <span style={cardHelperStyle(theme)}>{card.helper}</span>
              ) : null}
            </button>
          ))}
        </div>

        <div style={chipRowStyle}>
          {chips.map((chip) => (
            <button
              disabled={chip.disabled}
              key={chip.title}
              onClick={() => props.onSelectPrompt(chip.prompt)}
              style={chipStyle(theme, Boolean(chip.disabled))}
              type="button"
            >
              {chip.title}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

/** The design's four core cards, in its order. */
function buildPromptCards(
  selectedExerciseName: string,
  hasSelectedExercise: boolean,
): PromptCardDefinition[] {
  return [
    {
      description: "总结本周训练频率、总量、主要动作、肌群分布和 Evidence。",
      prompt: { mode: "weekly_report", message: "帮我做一份本周训练报告" },
      title: "本周训练报告",
    },
    {
      description:
        "结合训练 Evidence 和知识 Sources，保守诊断动作是否进入平台期。",
      disabled: !hasSelectedExercise,
      helper: "请先在分析页选择一个重点动作。",
      prompt: {
        mode: "plateau_diagnosis",
        message: `${selectedExerciseName}平台期怎么诊断？`,
      },
      title: "平台期诊断",
    },
    {
      description: "基于 Evidence + Sources 生成下周训练草案，不把它当作处方。",
      prompt: { mode: "next_week_plan", message: "给我一个下周训练草案" },
      title: "下周训练草案",
    },
    {
      description: "快速查看最近训练次数、组数、训练量和主要动作。",
      prompt: { mode: "training_overview", message: "最近训练总览" },
      title: "最近训练总览",
    },
  ];
}

/**
 * Modes the design's four cards do not cover.
 *
 * The design fills this row with three free-text examples; these are the same
 * shape (one tap prefills the composer) but keep the existing intent routing
 * instead of dropping five working entry points.
 */
function buildPromptChips(
  selectedExerciseName: string,
  hasSelectedExercise: boolean,
): PromptChipDefinition[] {
  return [
    {
      prompt: { mode: "next_training_focus", message: "我今天练什么？" },
      title: "我今天练什么？",
    },
    {
      prompt: { mode: "muscle_balance", message: "我胸练得够吗？" },
      title: "我胸练得够吗？",
    },
    {
      prompt: { mode: "training_imbalance", message: "我是不是偏科？" },
      title: "我是不是偏科？",
    },
    {
      disabled: !hasSelectedExercise,
      prompt: {
        mode: "exercise_progress",
        message: `分析一下${selectedExerciseName}的进展。`,
      },
      title: "当前动作进展",
    },
    {
      prompt: { mode: "evidence_explain", message: "智能助手根据什么判断？" },
      title: "判断依据",
    },
  ];
}

const bodyStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const headingStyle: React.CSSProperties = {
  display: "grid",
  gap: 2,
};

const titleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: "-0.2px",
  margin: 0,
};

function subtitleStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx3, fontSize: 11, lineHeight: 1.6 };
}

const cardGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "1fr 1fr",
};

function cardStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isDisabled: boolean,
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.soft,
    border: "none",
    borderRadius: 14,
    color: theme.colors.tx,
    cursor: isDisabled ? "not-allowed" : "pointer",
    display: "grid",
    gap: 4,
    minWidth: 0,
    opacity: isDisabled ? 0.45 : 1,
    padding: 13,
    textAlign: "left",
    whiteSpace: "normal",
  };
}

const cardTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "-0.1px",
};

function cardCopyStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx3, fontSize: 10, lineHeight: 1.5 };
}

function cardHelperStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.orange, fontSize: 10, lineHeight: 1.5 };
}

const chipRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

function chipStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isDisabled: boolean,
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.divider,
    border: "none",
    borderRadius: theme.radius.capsule,
    color: theme.colors.tx2,
    cursor: isDisabled ? "not-allowed" : "pointer",
    fontSize: 11,
    fontWeight: 600,
    opacity: isDisabled ? 0.45 : 1,
    padding: "8px 12px",
  };
}
