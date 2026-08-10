import { useState } from "react";

import type { ExercisePickerProps } from "./ExercisePicker";
import type { WorkoutFormProps } from "./WorkoutForm";
import type { TrainingSummary } from "./training-summary-api";
import type { TrainingSessionInitialDraft } from "./training-session-draft";
import type { UseCurrentPlanResult } from "../assistant/use-current-plan";

import { ActionSheet } from "../../components/ActionSheet";
import { Card } from "../../components/Card";
import { Icon } from "../../components/Icon";
import { useTheme } from "../../theme/ThemeContext";
import { ExercisePicker } from "./ExercisePicker";
import { TrainingPlanCard } from "./TrainingPlanCard";
import { TrainingSessionComposer } from "./TrainingSessionComposer";
import { TrainingStatsStrip } from "./TrainingStatsStrip";
import { WorkoutIntakePanel } from "./WorkoutIntakePanel";
import { mapWorkoutIntakeDraftToSessionInitialDraft } from "./workout-intake-to-session-draft";
import { BRAND_NEON, brandAlpha } from "../../theme/tokens";

export interface TrainingViewProps {
  currentPlan: UseCurrentPlanResult;
  exercisePickerProps: ExercisePickerProps;
  onOpenAssistant: () => void;
  summary: TrainingSummary | null;
  summaryLoading: boolean;
  workoutFormProps: WorkoutFormProps;
}

export function TrainingView(props: TrainingViewProps) {
  const { theme } = useTheme();
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isDictionaryOpen, setIsDictionaryOpen] = useState(false);
  const [intakeEntryMode, setIntakeEntryMode] = useState<
    "text" | "voice" | null
  >(null);
  const [composerMode, setComposerMode] = useState<
    "create_active" | "create_from_intake"
  >("create_active");
  const [pendingInitialDraft, setPendingInitialDraft] =
    useState<TrainingSessionInitialDraft | null>(null);

  return (
    <section style={viewStyle}>
      <TrainingStatsStrip
        summary={props.summary}
        summaryLoading={props.summaryLoading}
      />

      {!isComposerOpen ? (
        <TrainingPlanCard
          currentPlan={props.currentPlan}
          onOpenAssistant={props.onOpenAssistant}
        />
      ) : null}

      {!isComposerOpen ? (
        <div style={recordActionsStyle}>
          <button
            onClick={() => setIntakeEntryMode("voice")}
            style={voiceRecordButtonStyle}
            type="button"
          >
            <svg
              aria-hidden="true"
              fill="none"
              height="20"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="20"
            >
              <rect height="12" rx="3" width="6" x="9" y="2" />
              <path d="M5 10a7 7 0 0 0 14 0" />
              <path d="M12 19v3" />
            </svg>
            <strong style={recordButtonLabelStyle}>语音记录训练</strong>
          </button>
          <button
            onClick={() => setIntakeEntryMode("text")}
            style={manualRecordButtonStyle(theme)}
            type="button"
          >
            <Icon name="copy" size={20} />
            <strong style={recordButtonLabelStyle}>文本录入训练</strong>
          </button>
          <button
            onClick={() => {
              setComposerMode("create_active");
              setPendingInitialDraft(null);
              setIsComposerOpen(true);
            }}
            style={manualRecordButtonStyle(theme)}
            type="button"
          >
            <svg
              aria-hidden="true"
              fill="none"
              height="20"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="20"
            >
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            <strong style={recordButtonLabelStyle}>手动记录训练</strong>
          </button>
        </div>
      ) : null}

      <ActionSheet
        description={
          intakeEntryMode === "text"
            ? "粘贴或输入包含动作、重量、次数和组数的训练笔记，识别后先确认再生成训练记录。"
            : "说出动作、重量、次数和组数，识别后先确认文字，再生成训练记录。"
        }
        onClose={() => setIntakeEntryMode(null)}
        open={intakeEntryMode !== null}
        title={intakeEntryMode === "text" ? "文本录入训练" : "语音记录训练"}
      >
        <WorkoutIntakePanel
          entryMode={intakeEntryMode ?? "voice"}
          exerciseLibraryProps={props.exercisePickerProps}
          onCancel={() => setIntakeEntryMode(null)}
          onDraftParsed={(draft) => {
            setPendingInitialDraft(
              mapWorkoutIntakeDraftToSessionInitialDraft(
                draft,
                props.exercisePickerProps.exercises,
              ),
            );
            setComposerMode("create_from_intake");
            setIsComposerOpen(true);
            setIntakeEntryMode(null);
          }}
          token={props.workoutFormProps.token}
        />
      </ActionSheet>

      <Card>
        <div style={dictionaryHeaderStyle}>
          <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
            <h2 style={dictionaryTitleStyle}>动作库</h2>
            <span style={dictionaryCopyStyle(theme)}>
              按肌群浏览标准动作要点
            </span>
          </div>
          <button
            onClick={() => setIsDictionaryOpen((currentValue) => !currentValue)}
            style={dictionaryToggleStyle(theme)}
            type="button"
          >
            {isDictionaryOpen ? "收起" : "展开"}
          </button>
        </div>

        {isDictionaryOpen ? (
          <div style={{ marginTop: 12 }}>
            <ExercisePicker
              {...props.exercisePickerProps}
              token={props.workoutFormProps.token}
            />
          </div>
        ) : null}
      </Card>

      <TrainingSessionComposer
        exerciseLibraryProps={props.exercisePickerProps}
        initialDraft={pendingInitialDraft}
        isOpen={isComposerOpen}
        mode={composerMode}
        onCancel={() => {
          setIsComposerOpen(false);
          setPendingInitialDraft(null);
          setComposerMode("create_active");
        }}
        onCreated={async () => {
          await props.workoutFormProps.onCreated?.();
          setIsComposerOpen(false);
          setPendingInitialDraft(null);
          setComposerMode("create_active");
        }}
        token={props.workoutFormProps.token}
      />
    </section>
  );
}

const viewStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
};

const recordActionsStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
};

/** Design: neon-green voice record button (green stays fixed in both themes). */
const voiceRecordButtonStyle: React.CSSProperties = {
  background: BRAND_NEON,
  border: "none",
  borderRadius: 18,
  boxShadow: `0 8px 20px ${brandAlpha(0.2)}`,
  color: "#0f0f0f",
  cursor: "pointer",
  display: "grid",
  gap: 4,
  justifyItems: "center",
  padding: "14px 10px",
};

const recordButtonLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  lineHeight: 1.35,
  textAlign: "center",
};

/** Design: neutral card-gradient manual record button. */
function manualRecordButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: `linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03)), ${theme.colors.surf}`,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 18,
    boxShadow: `inset 0 1px 0 ${theme.colors.bdr}`,
    color: theme.colors.tx,
    cursor: "pointer",
    display: "grid",
    gap: 4,
    justifyItems: "center",
    padding: "14px 10px",
  };
}

const dictionaryHeaderStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 8,
  justifyContent: "space-between",
};

const dictionaryTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: "-0.2px",
  margin: 0,
};

function dictionaryCopyStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 12,
  };
}

/** Design: accent-green chip toggling the exercise library section. */
function dictionaryToggleStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: theme.colors.divider,
    border: "none",
    borderRadius: 10,
    color: theme.colors.ac,
    cursor: "pointer",
    flex: "0 0 auto",
    fontSize: 11,
    fontWeight: 700,
    padding: "7px 11px",
  };
}
