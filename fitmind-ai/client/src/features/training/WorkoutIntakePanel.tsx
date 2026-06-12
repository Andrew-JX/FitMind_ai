import { useState } from "react";

import { ActionSheet } from "../../components/ActionSheet";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { StateNotice } from "../../components/StateNotice";
import { useTheme } from "../../theme/ThemeContext";
import { appendSpeechTranscript } from "./speech-recognition-utils";
import { useSpeechRecognition } from "./use-speech-recognition";
import {
  parseWorkoutIntake,
  type WorkoutIntakeDraft,
} from "./workout-intake-api";

type IntakeStatus = "idle" | "parsing" | "error";

type ExerciseResolution =
  | { type: "keep"; exerciseId: string; exerciseName: string }
  | { type: "remove" };

export interface WorkoutIntakePanelProps {
  onDraftParsed: (draft: WorkoutIntakeDraft) => void;
  token: string | null;
}

const COPY = {
  cancel: "取消",
  errorTitle: "识别失败",
  inputLabel: "训练描述",
  modalHelp: "语音识别可能有误，请先检查文字；如果还没说完，可以继续语音补充。",
  modalTitle: "确认训练内容",
  resolveTitle: "确认识别到的动作",
  resolveHelp: "有动作需要先确认是哪一个，确认后才会加入训练记录。",
  resolveApply: "加入训练",
  resolveAmbiguous: "请选择具体动作：",
  resolveUnmatched: "没有识别到标准动作，可移除该动作。",
  resolveRemove: "移除",
  resolveReselect: "重选",
  resolveMatched: "已匹配",
  resolveSelected: "已选择",
  resolveRemoved: "已移除",
  resolveEmpty: "没有可加入的动作，请至少确认一个，或点取消。",
  parse: "生成训练记录",
  parsing: "识别中...",
  placeholder: "例如：今天杠铃卧推三组 60x10 65x8 70x6，高位下拉两组 45x12。",
  speechContinue: "继续说",
  speechFallback: "当前浏览器暂不支持语音识别，请换用支持语音识别的浏览器。",
  speechListening: "正在听你说训练内容",
  speechCancel: "取消",
  speechDone: "完成",
  speechHelp:
    "可以说动作、重量、次数和组数。说慢一点也没关系，下方会实时显示识别结果。",
  speechNoticeTitle: "语音识别提示",
  speechRelease: "说完后点完成；如果浏览器自动暂停，可以点继续说。",
  speechTrigger: "语音输入",
  speechTriggerLong: "语音记录训练",
};

export function WorkoutIntakePanel(props: WorkoutIntakePanelProps) {
  const { theme } = useTheme();
  const [text, setText] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVoiceOverlayOpen, setIsVoiceOverlayOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<IntakeStatus>("idle");
  const [pendingDraft, setPendingDraft] = useState<WorkoutIntakeDraft | null>(
    null,
  );
  const [resolutions, setResolutions] = useState<
    Record<number, ExerciseResolution>
  >({});
  const [resolveError, setResolveError] = useState<string | null>(null);
  const speechRecognition = useSpeechRecognition();

  const isBusy = status === "parsing";
  const voicePreviewText = appendSpeechTranscript(
    text,
    speechRecognition.transcript,
  );
  const canParse =
    props.token !== null && text.trim().length > 0 && status !== "parsing";

  async function handleParse() {
    if (!props.token || !text.trim() || isBusy) {
      return;
    }

    speechRecognition.stopListening();
    setErrorMessage(null);
    setStatus("parsing");

    try {
      const response = await parseWorkoutIntake(props.token, {
        performed_at: formatLocalIsoWithOffset(new Date()),
        text: text.trim(),
      });

      const draft = response.draft;
      const needsResolution = draft.exercises.some(
        (exercise) => exercise.match_status !== "matched",
      );

      if (needsResolution) {
        // Confirm ambiguous/unrecognized exercises here, before the composer.
        setPendingDraft(draft);
        setResolutions(buildInitialResolutions(draft));
        setResolveError(null);
        setStatus("idle");
        setIsModalOpen(false);
        return;
      }

      props.onDraftParsed(draft);
      resetIntakeState();
      setIsModalOpen(false);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setStatus("error");
    }
  }

  function chooseCandidate(
    index: number,
    exerciseId: string,
    exerciseName: string,
  ) {
    setResolveError(null);
    setResolutions((current) => ({
      ...current,
      [index]: { type: "keep", exerciseId, exerciseName },
    }));
  }

  function removeExerciseAt(index: number) {
    setResolveError(null);
    setResolutions((current) => ({
      ...current,
      [index]: { type: "remove" },
    }));
  }

  function clearResolution(index: number) {
    setResolveError(null);
    setResolutions((current) => {
      const next = { ...current };
      delete next[index];
      return next;
    });
  }

  function handleApplyResolution() {
    if (!pendingDraft) {
      return;
    }

    const allResolved = pendingDraft.exercises.every(
      (_, index) => resolutions[index] !== undefined,
    );

    if (!allResolved) {
      setResolveError(COPY.resolveEmpty);
      return;
    }

    const exercises = pendingDraft.exercises
      .map((exercise, index) => ({ exercise, resolution: resolutions[index] }))
      .filter(
        (entry): entry is {
          exercise: (typeof pendingDraft.exercises)[number];
          resolution: Extract<ExerciseResolution, { type: "keep" }>;
        } => entry.resolution?.type === "keep",
      )
      .map(({ exercise, resolution }) => ({
        ...exercise,
        candidate_exercises: [],
        match_confidence: 1,
        match_status: "matched" as const,
        matched_exercise_id: resolution.exerciseId,
        matched_exercise_name: resolution.exerciseName,
      }));

    if (exercises.length === 0) {
      setResolveError(COPY.resolveEmpty);
      return;
    }

    props.onDraftParsed({ ...pendingDraft, exercises });
    closeResolution();
    resetIntakeState();
  }

  function closeResolution() {
    setPendingDraft(null);
    setResolutions({});
    setResolveError(null);
  }

  function handleVoiceStart() {
    if (isBusy) {
      return;
    }

    setErrorMessage(null);

    if (!speechRecognition.isSupported) {
      setErrorMessage(COPY.speechFallback);
      return;
    }

    speechRecognition.resetTranscript();
    setIsVoiceOverlayOpen(true);
    speechRecognition.startListening();
  }

  function handleVoiceDone() {
    if (isBusy) {
      return;
    }

    setText((currentText) =>
      appendSpeechTranscript(currentText, speechRecognition.transcript),
    );
    setIsVoiceOverlayOpen(false);
    speechRecognition.stopListening();
    setIsModalOpen(true);
  }

  function handleVoiceCancel() {
    if (isBusy) {
      return;
    }

    setIsVoiceOverlayOpen(false);
    speechRecognition.stopListening();
  }

  function handleModalCancel() {
    if (isBusy) {
      return;
    }

    speechRecognition.stopListening();
    setIsModalOpen(false);
    setIsVoiceOverlayOpen(false);
    resetIntakeState();
  }

  function resetIntakeState() {
    setErrorMessage(null);
    setStatus("idle");
    setText("");
    speechRecognition.resetTranscript();
  }

  return (
    <>
      <div style={triggerActionsStyle}>
        <Button
          aria-label={COPY.speechTrigger}
          disabled={isBusy}
          onClick={handleVoiceStart}
          style={micButtonStyle}
          title={COPY.speechTrigger}
          type="button"
          variant="secondary"
        >
          <Icon name="mic" size={18} />
          <span>{COPY.speechTriggerLong}</span>
        </Button>
      </div>

      {errorMessage && !isModalOpen ? (
        <StateNotice
          description={errorMessage}
          title={COPY.errorTitle}
          tone="error"
        />
      ) : null}

      <ActionSheet
        closeOnBackdrop={!isBusy}
        description={COPY.modalHelp}
        footer={
          <div style={actionGridStyle}>
            <Button
              disabled={isBusy}
              onClick={handleModalCancel}
              type="button"
              variant="secondary"
            >
              {COPY.cancel}
            </Button>
            <Button
              disabled={isBusy}
              onClick={() => {
                setIsModalOpen(false);
                handleVoiceStart();
              }}
              type="button"
              variant="secondary"
            >
              {COPY.speechContinue}
            </Button>
            <Button
              disabled={!canParse || isBusy}
              onClick={handleParse}
              type="button"
            >
              {status === "parsing" ? COPY.parsing : COPY.parse}
            </Button>
          </div>
        }
        onClose={handleModalCancel}
        open={isModalOpen}
        title={COPY.modalTitle}
      >
        {!speechRecognition.isSupported ? (
          <p style={{ ...copyStyle, color: theme.colors.orange }}>
            {COPY.speechFallback}
          </p>
        ) : null}

        {speechRecognition.errorMessage ? (
          <StateNotice
            description={speechRecognition.errorMessage}
            title={COPY.speechNoticeTitle}
            tone="warning"
          />
        ) : null}

        <label style={{ ...labelStyle, color: theme.colors.tx2 }}>
          {COPY.inputLabel}
          <textarea
            disabled={isBusy}
            onChange={(event) => {
              setText(event.target.value);
              setErrorMessage(null);
            }}
            placeholder={COPY.placeholder}
            style={{
              ...textareaStyle,
              backgroundColor: theme.colors.surf2,
              border: `1px solid ${theme.colors.bdr}`,
              borderRadius: theme.radius.control,
              color: theme.colors.tx,
              fontFamily: theme.fonts.body,
            }}
            value={text}
          />
        </label>

        {errorMessage ? (
          <StateNotice
            description={errorMessage}
            title={COPY.errorTitle}
            tone="error"
          />
        ) : null}
      </ActionSheet>

      <ActionSheet
        closeOnBackdrop={false}
        description={COPY.resolveHelp}
        footer={
          <div style={actionGridStyle}>
            <Button
              onClick={() => {
                closeResolution();
                resetIntakeState();
              }}
              type="button"
              variant="secondary"
            >
              {COPY.cancel}
            </Button>
            <Button onClick={handleApplyResolution} type="button">
              {COPY.resolveApply}
            </Button>
          </div>
        }
        onClose={() => {
          closeResolution();
          resetIntakeState();
        }}
        open={pendingDraft !== null}
        title={COPY.resolveTitle}
      >
        <div style={resolveListStyle}>
          {pendingDraft?.exercises.map((exercise, index) => {
            const resolution = resolutions[index];

            return (
              <div
                key={`${exercise.input_name}-${index}`}
                style={{ ...resolveRowStyle, borderColor: theme.colors.bdr }}
              >
                <div style={resolveRowHeaderStyle}>
                  <span style={{ color: theme.colors.tx, fontWeight: 700 }}>
                    {exercise.input_name}
                  </span>
                  <span style={{ color: theme.colors.tx3, fontSize: 12 }}>
                    {summarizeSets(exercise)}
                  </span>
                </div>

                {resolution?.type === "keep" ? (
                  <div style={resolveStatusRowStyle}>
                    <span style={{ color: theme.colors.ac, fontSize: 13 }}>
                      {exercise.match_status === "matched"
                        ? COPY.resolveMatched
                        : COPY.resolveSelected}
                      ：{resolution.exerciseName}
                    </span>
                    {exercise.match_status !== "matched" ? (
                      <button
                        onClick={() => clearResolution(index)}
                        style={resolveLinkStyle(theme)}
                        type="button"
                      >
                        {COPY.resolveReselect}
                      </button>
                    ) : null}
                  </div>
                ) : resolution?.type === "remove" ? (
                  <div style={resolveStatusRowStyle}>
                    <span style={{ color: theme.colors.tx3, fontSize: 13 }}>
                      {COPY.resolveRemoved}
                    </span>
                    <button
                      onClick={() => clearResolution(index)}
                      style={resolveLinkStyle(theme)}
                      type="button"
                    >
                      {COPY.resolveReselect}
                    </button>
                  </div>
                ) : exercise.candidate_exercises.length > 0 ? (
                  <div style={resolveChoicesStyle}>
                    <span style={{ color: theme.colors.tx2, fontSize: 12 }}>
                      {COPY.resolveAmbiguous}
                    </span>
                    <div style={resolveCandidateGridStyle}>
                      {exercise.candidate_exercises.map((candidate) => (
                        <Button
                          key={candidate.exercise_id}
                          onClick={() =>
                            chooseCandidate(
                              index,
                              candidate.exercise_id,
                              candidate.exercise_name,
                            )
                          }
                          type="button"
                          variant="secondary"
                        >
                          {candidate.exercise_name}
                        </Button>
                      ))}
                    </div>
                    <button
                      onClick={() => removeExerciseAt(index)}
                      style={resolveLinkStyle(theme)}
                      type="button"
                    >
                      {COPY.resolveRemove}
                    </button>
                  </div>
                ) : (
                  <div style={resolveChoicesStyle}>
                    <span style={{ color: theme.colors.orange, fontSize: 12 }}>
                      {COPY.resolveUnmatched}
                    </span>
                    <Button
                      onClick={() => removeExerciseAt(index)}
                      type="button"
                      variant="secondary"
                    >
                      {COPY.resolveRemove}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {resolveError ? (
          <div style={{ marginTop: 12 }}>
            <StateNotice
              description={resolveError}
              title={COPY.resolveTitle}
              tone="warning"
            />
          </div>
        ) : null}
      </ActionSheet>

      <ActionSheet
        description={COPY.speechRelease}
        footer={
          <div style={actionGridStyle}>
            <Button
              onClick={handleVoiceCancel}
              type="button"
              variant="secondary"
            >
              {COPY.speechCancel}
            </Button>
            <Button onClick={handleVoiceDone} type="button">
              {COPY.speechDone}
            </Button>
          </div>
        }
        onClose={handleVoiceCancel}
        open={isVoiceOverlayOpen}
        title={COPY.speechListening}
      >
        <style>
          {`
            @keyframes fitmindVoiceWave {
              0%, 100% { transform: scaleY(0.35); opacity: 0.55; }
              50% { transform: scaleY(1); opacity: 1; }
            }
          `}
        </style>
        <div style={voiceContentStyle}>
          <div style={voiceWaveStyle} aria-hidden="true">
            {Array.from({ length: 7 }, (_, index) => (
              <span
                key={index}
                style={{
                  ...voiceWaveBarStyle,
                  animationDelay: `${index * 80}ms`,
                  backgroundColor: theme.colors.ac,
                }}
              />
            ))}
          </div>
          <p style={{ ...copyStyle, color: theme.colors.tx2 }}>
            {COPY.speechHelp}
          </p>
          <label
            style={{ ...labelStyle, color: theme.colors.tx2, width: "100%" }}
          >
            {COPY.inputLabel}
            <textarea
              aria-live="polite"
              readOnly
              placeholder="开始说训练内容后，这里会实时出现识别结果。"
              style={{
                ...textareaStyle,
                backgroundColor: theme.colors.surf2,
                border: `1px solid ${theme.colors.bdr}`,
                borderRadius: theme.radius.control,
                color: theme.colors.tx,
                fontFamily: theme.fonts.body,
                minHeight: 120,
              }}
              value={voicePreviewText}
            />
          </label>
          {speechRecognition.errorMessage ? (
            <StateNotice
              description={speechRecognition.errorMessage}
              title={COPY.speechNoticeTitle}
              tone="warning"
            />
          ) : null}
          {!speechRecognition.isListening ? (
            <Button
              onClick={handleVoiceStart}
              type="button"
              variant="secondary"
            >
              {COPY.speechContinue}
            </Button>
          ) : null}
        </div>
      </ActionSheet>
    </>
  );
}

function buildInitialResolutions(
  draft: WorkoutIntakeDraft,
): Record<number, ExerciseResolution> {
  const initial: Record<number, ExerciseResolution> = {};

  draft.exercises.forEach((exercise, index) => {
    if (exercise.match_status === "matched" && exercise.matched_exercise_id) {
      initial[index] = {
        type: "keep",
        exerciseId: exercise.matched_exercise_id,
        exerciseName: exercise.matched_exercise_name ?? exercise.input_name,
      };
    }
  });

  return initial;
}

function summarizeSets(
  exercise: WorkoutIntakeDraft["exercises"][number],
): string {
  if (exercise.sets.length > 0) {
    const first = exercise.sets[0];

    return `${exercise.sets.length} 组 · ${first?.weight_kg ?? 0}kg×${first?.reps ?? 0}`;
  }

  if (exercise.incomplete_sets.length > 0) {
    return `${exercise.incomplete_sets.length} 组 · 待补全`;
  }

  return "暂无组数";
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "训练内容暂时无法识别，请稍后重试。";
}

function formatLocalIsoWithOffset(date: Date): string {
  const offsetMinutes = -date.getTimezoneOffset();
  const offsetSign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffsetMinutes = Math.abs(offsetMinutes);
  const offsetHours = Math.floor(absoluteOffsetMinutes / 60);
  const offsetRemainderMinutes = absoluteOffsetMinutes % 60;

  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}T${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}:${padDatePart(date.getSeconds())}.${String(date.getMilliseconds()).padStart(3, "0")}${offsetSign}${padDatePart(offsetHours)}:${padDatePart(offsetRemainderMinutes)}`;
}

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

const triggerActionsStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "minmax(0, 1fr)",
};

const resolveListStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const resolveRowStyle: React.CSSProperties = {
  border: "1px solid",
  borderRadius: 12,
  display: "grid",
  gap: 8,
  padding: 12,
};

const resolveRowHeaderStyle: React.CSSProperties = {
  alignItems: "baseline",
  display: "flex",
  gap: 8,
  justifyContent: "space-between",
};

const resolveStatusRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
};

const resolveChoicesStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const resolveCandidateGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "repeat(auto-fit, minmax(0, 1fr))",
};

function resolveLinkStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: "none",
    border: "none",
    color: theme.colors.tx3,
    cursor: "pointer",
    fontSize: 12,
    justifySelf: "end",
    padding: 0,
    textDecoration: "underline",
  };
}

const micButtonStyle: React.CSSProperties = {
  alignItems: "center",
  display: "inline-flex",
  gap: 8,
  justifyContent: "center",
  minWidth: 0,
};

const actionGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(auto-fit, minmax(0, 1fr))",
};

const copyStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.6,
  margin: 0,
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  fontSize: 12,
  fontWeight: 700,
  gap: 8,
};

const textareaStyle: React.CSSProperties = {
  boxSizing: "border-box",
  fontSize: 16,
  lineHeight: 1.6,
  minHeight: 150,
  outline: "none",
  padding: "12px 14px",
  resize: "vertical",
  width: "100%",
};

const voiceContentStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
  justifyItems: "center",
};

const voiceWaveStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 7,
  height: 74,
};

const voiceWaveBarStyle: React.CSSProperties = {
  animation: "fitmindVoiceWave 820ms ease-in-out infinite",
  borderRadius: 999,
  display: "block",
  height: 58,
  transformOrigin: "center",
  width: 8,
};
