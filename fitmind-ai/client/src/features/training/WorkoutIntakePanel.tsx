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
      props.onDraftParsed(response.draft);
      resetIntakeState();
      setIsModalOpen(false);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setStatus("error");
    }
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
