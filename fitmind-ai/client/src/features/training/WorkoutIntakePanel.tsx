import { useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
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
  cancel: "\u53d6\u6d88",
  errorTitle: "\u89e3\u6790\u5931\u8d25",
  inputLabel: "\u8bad\u7ec3\u63cf\u8ff0",
  modalHelp:
    "\u8bed\u97f3\u8bc6\u522b\u53ef\u80fd\u6709\u8bef\uff0c\u8bf7\u5148\u68c0\u67e5\u6587\u5b57\uff0c\u518d\u89e3\u6790\u4e3a\u8bad\u7ec3\u8349\u7a3f\u3002",
  modalTitle: "\u786e\u8ba4\u8bad\u7ec3\u63cf\u8ff0",
  parse: "\u89e3\u6790\u8bad\u7ec3",
  parsing: "\u89e3\u6790\u4e2d...",
  placeholder:
    "\u4f8b\u5982\uff1a\u4eca\u5929\u6760\u94c3\u5367\u63a8\u4e09\u7ec4 60x10 65x8 70x6\uff0c\u9ad8\u4f4d\u4e0b\u62c9\u4e24\u7ec4 45x12\u3002",
  speechFallback:
    "\u5f53\u524d\u6d4f\u89c8\u5668\u6682\u4e0d\u652f\u6301\u8bed\u97f3\u8bc6\u522b\uff0c\u53ef\u4ee5\u7ee7\u7eed\u4f7f\u7528\u6587\u672c\u8bb0\u5f55\u3002",
  speechListening: "\u6b63\u5728\u542c...",
  speechNoticeTitle: "\u8bed\u97f3\u8bc6\u522b\u63d0\u793a",
  speechRelease: "\u677e\u5f00\u7ed3\u675f\u5f55\u97f3",
  speechTrigger: "\u8bed\u97f3\u8f93\u5165",
  textTrigger: "\u6587\u672c\u8f93\u5165",
};

const MIN_VOICE_HOLD_MS = 350;

export function WorkoutIntakePanel(props: WorkoutIntakePanelProps) {
  const { theme } = useTheme();
  const voiceStartTimeRef = useRef<number | null>(null);
  const [text, setText] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVoiceOverlayOpen, setIsVoiceOverlayOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<IntakeStatus>("idle");
  const speechRecognition = useSpeechRecognition({
    onFinalTranscript: (transcript) => {
      setText((currentText) => appendSpeechTranscript(currentText, transcript));
    },
  });

  const isBusy = status === "parsing";
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

  function handleTextOpen() {
    if (isBusy) {
      return;
    }

    setErrorMessage(null);
    setIsModalOpen(true);
  }

  function handleVoiceStart(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();

    if (isBusy) {
      return;
    }

    setErrorMessage(null);
    setIsModalOpen(false);

    if (!speechRecognition.isSupported) {
      setIsModalOpen(true);
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    voiceStartTimeRef.current = Date.now();
    speechRecognition.resetTranscript();
    setIsVoiceOverlayOpen(true);
    speechRecognition.startListening();
  }

  function handleVoiceStop() {
    if (isBusy) {
      return;
    }

    const elapsedMs =
      voiceStartTimeRef.current === null
        ? MIN_VOICE_HOLD_MS
        : Date.now() - voiceStartTimeRef.current;
    voiceStartTimeRef.current = null;
    setIsVoiceOverlayOpen(false);
    speechRecognition.stopListening();

    if (elapsedMs >= MIN_VOICE_HOLD_MS) {
      setIsModalOpen(true);
    }
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
        <Button disabled={isBusy} onClick={handleTextOpen} type="button" variant="secondary">
          {COPY.textTrigger}
        </Button>
        <Button
          aria-label={COPY.speechTrigger}
          disabled={isBusy}
          onContextMenu={(event) => event.preventDefault()}
          onPointerCancel={handleVoiceStop}
          onPointerDown={handleVoiceStart}
          onPointerLeave={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              handleVoiceStop();
            }
          }}
          onPointerUp={handleVoiceStop}
          style={micButtonStyle}
          title={COPY.speechTrigger}
          type="button"
          variant="secondary"
        >
          <Icon name="mic" size={18} />
        </Button>
      </div>

      {isVoiceOverlayOpen
        ? createPortal(<VoiceListeningOverlay />, document.body)
        : null}

      {isModalOpen
        ? createPortal(
            <div style={modalBackdropStyle}>
              <div style={modalShellStyle}>
                <Card padding="0">
                  <div style={modalLayoutStyle}>
                    <div style={modalHeaderStyle}>
                      <h2 style={titleStyle}>{COPY.modalTitle}</h2>
                      <p style={{ ...copyStyle, color: theme.colors.tx2 }}>
                        {COPY.modalHelp}
                      </p>
                    </div>

                    <div style={modalBodyStyle}>
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
                      </label>
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

                      {errorMessage ? (
                        <StateNotice
                          description={errorMessage}
                          title={COPY.errorTitle}
                          tone="error"
                        />
                      ) : null}
                    </div>

                    <div
                      style={{
                        ...modalFooterStyle,
                        backgroundColor: theme.colors.surf,
                        borderTop: `1px solid ${theme.colors.bdr}`,
                      }}
                    >
                      <Button
                        disabled={isBusy}
                        onClick={handleModalCancel}
                        type="button"
                        variant="secondary"
                      >
                        {COPY.cancel}
                      </Button>
                      <Button
                        disabled={!canParse || isBusy}
                        onClick={handleParse}
                        type="button"
                      >
                        {status === "parsing" ? COPY.parsing : COPY.parse}
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function VoiceListeningOverlay() {
  const { theme } = useTheme();

  return (
    <div style={voiceOverlayStyle}>
      <style>
        {`
          @keyframes fitmindVoiceWave {
            0%, 100% { transform: scaleY(0.35); opacity: 0.55; }
            50% { transform: scaleY(1); opacity: 1; }
          }
        `}
      </style>
      <div
        style={{
          ...voiceOverlayCardStyle,
          backgroundColor: theme.colors.surf,
          border: `1px solid ${theme.colors.bdr}`,
          boxShadow: theme.shadows.card,
        }}
      >
        <h2 style={{ ...titleStyle, color: theme.colors.tx }}>
          {COPY.speechListening}
        </h2>
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
          {COPY.speechRelease}
        </p>
      </div>
    </div>
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "The request could not be completed.";
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
  display: "flex",
  gap: 8,
};

const micButtonStyle: React.CSSProperties = {
  alignItems: "center",
  display: "inline-flex",
  justifyContent: "center",
  minWidth: 46,
  touchAction: "none",
  WebkitTouchCallout: "none",
  WebkitUserSelect: "none",
  userSelect: "none",
};

const modalBackdropStyle: React.CSSProperties = {
  alignItems: "center",
  background: "rgba(12, 16, 24, 0.52)",
  bottom: 0,
  display: "flex",
  justifyContent: "center",
  left: 0,
  overflow: "hidden",
  padding: 12,
  pointerEvents: "auto",
  position: "fixed",
  right: 0,
  top: 0,
  zIndex: 2147483647,
};

const modalShellStyle: React.CSSProperties = {
  maxHeight: "min(720px, calc(100dvh - 24px))",
  maxWidth: 420,
  width: "min(420px, 100%)",
};

const modalLayoutStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  maxHeight: "min(720px, calc(100dvh - 24px))",
  minHeight: 0,
};

const modalHeaderStyle: React.CSSProperties = {
  flex: "0 0 auto",
  padding: "18px 18px 12px",
};

const modalBodyStyle: React.CSSProperties = {
  display: "grid",
  flex: "1 1 auto",
  gap: 12,
  minHeight: 0,
  overflowY: "auto",
  padding: "0 18px 16px",
};

const modalFooterStyle: React.CSSProperties = {
  display: "grid",
  flex: "0 0 auto",
  gap: 10,
  gridTemplateColumns: "repeat(2, minmax(105px, 1fr))",
  padding: "12px 18px 16px",
  position: "sticky",
  bottom: 0,
};

const titleStyle: React.CSSProperties = {
  fontSize: 16,
  margin: 0,
};

const copyStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.6,
  margin: "4px 0 0",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  marginBottom: 8,
  marginTop: 14,
};

const textareaStyle: React.CSSProperties = {
  boxSizing: "border-box",
  fontSize: 16,
  lineHeight: 1.6,
  minHeight: 124,
  outline: "none",
  padding: "12px 14px",
  resize: "vertical",
  width: "100%",
};

const voiceOverlayStyle: React.CSSProperties = {
  alignItems: "center",
  background: "rgba(12, 16, 24, 0.58)",
  bottom: 0,
  display: "flex",
  justifyContent: "center",
  left: 0,
  padding: 24,
  position: "fixed",
  right: 0,
  top: 0,
  pointerEvents: "auto",
  zIndex: 2147483647,
};

const voiceOverlayCardStyle: React.CSSProperties = {
  borderRadius: 24,
  display: "grid",
  gap: 14,
  justifyItems: "center",
  maxWidth: 320,
  padding: "28px 30px",
  width: "min(320px, 100%)",
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
