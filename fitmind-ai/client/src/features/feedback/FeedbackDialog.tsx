import { useState } from "react";

import { ActionSheet } from "../../components/ActionSheet";
import { Button } from "../../components/Button";
import { useTheme } from "../../theme/ThemeContext";
import { submitFeedback } from "./feedback-api";
import { buildFeedbackSubmission } from "./feedback-form";

export interface FeedbackDialogProps {
  onClose: () => void;
  onSubmitted: (message: string) => void;
  open: boolean;
  sourceRoute: string;
  token: string;
}

export function FeedbackDialog(props: FeedbackDialogProps) {
  const { theme } = useTheme();
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(): Promise<void> {
    const payload = buildFeedbackSubmission({
      message,
      rating,
      sourceRoute: props.sourceRoute,
    });

    if (payload === null) {
      setErrorText("请至少选择星级或填写反馈内容。");
      return;
    }

    setErrorText(null);
    setIsSubmitting(true);

    try {
      await submitFeedback(props.token, payload);
      setMessage("");
      setRating(null);
      props.onClose();
      props.onSubmitted("感谢反馈，我会用它继续改进 FitMind AI。");
    } catch {
      setErrorText("反馈提交失败，请稍后重试。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ActionSheet
      closeOnBackdrop={!isSubmitting}
      footer={
        <div style={footerStyle}>
          <Button
            disabled={isSubmitting}
            onClick={props.onClose}
            type="button"
            variant="secondary"
          >
            取消
          </Button>
          <Button disabled={isSubmitting} onClick={() => void handleSubmit()}>
            {isSubmitting ? "提交中..." : "提交反馈"}
          </Button>
        </div>
      }
      onClose={props.onClose}
      open={props.open}
      title="给 FitMind AI 一个反馈"
    >
      <div style={formStyle}>
        <div aria-label="反馈星级" role="group" style={starsStyle}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              aria-label={`${value} 星`}
              aria-pressed={rating === value}
              disabled={isSubmitting}
              key={value}
              onClick={() =>
                setRating((current) => (current === value ? null : value))
              }
              style={starButtonStyle(theme, rating !== null && value <= rating)}
              type="button"
            >
              ★
            </button>
          ))}
        </div>

        <textarea
          disabled={isSubmitting}
          maxLength={2000}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="哪里好用？哪里不准？你希望下次改进什么？"
          rows={5}
          style={textareaStyle(theme)}
          value={message}
        />

        {errorText ? (
          <p role="alert" style={errorStyle(theme)}>
            {errorText}
          </p>
        ) : null}
      </div>
    </ActionSheet>
  );
}

const formStyle: React.CSSProperties = {
  display: "grid",
  gap: 14,
};

const starsStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "repeat(5, 40px)",
};

function starButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isActive: boolean,
): React.CSSProperties {
  return {
    alignItems: "center",
    backgroundColor: isActive ? theme.colors.ac : theme.colors.surf2,
    border: `1px solid ${isActive ? theme.colors.ac : theme.colors.bdr}`,
    borderRadius: theme.radius.control,
    color: isActive ? theme.colors.acText : theme.colors.tx3,
    cursor: "pointer",
    display: "flex",
    fontSize: 20,
    height: 40,
    justifyContent: "center",
    lineHeight: 1,
    width: 40,
  };
}

function textareaStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.control,
    color: theme.colors.tx,
    font: "inherit",
    fontSize: 14,
    lineHeight: 1.5,
    minHeight: 132,
    outline: "none",
    padding: 12,
    resize: "vertical",
    width: "100%",
  };
}

function errorStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.red,
    fontSize: 12,
    lineHeight: 1.5,
    margin: 0,
  };
}

const footerStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "1fr 1fr",
};
