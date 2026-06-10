import { useState } from "react";

import { Button } from "../../components/Button";
import { useTheme } from "../../theme/ThemeContext";
import { FeedbackDialog } from "./FeedbackDialog";

export interface FeedbackButtonProps {
  sourceRoute: string;
  token: string;
}

export function FeedbackButton(props: FeedbackButtonProps) {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);

  return (
    <div style={containerStyle}>
      <Button
        onClick={() => {
          setStatusText(null);
          setIsOpen(true);
        }}
        style={{ fontSize: 11, padding: "7px 12px" }}
        type="button"
        variant="secondary"
      >
        反馈
      </Button>

      {statusText ? (
        <span aria-live="polite" style={statusStyle(theme)}>
          {statusText}
        </span>
      ) : null}

      <FeedbackDialog
        onClose={() => setIsOpen(false)}
        onSubmitted={setStatusText}
        open={isOpen}
        sourceRoute={props.sourceRoute}
        token={props.token}
      />
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  flex: "0 0 auto",
  gap: 8,
  minWidth: 0,
};

function statusStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.green,
    fontSize: 11,
    lineHeight: 1.35,
    maxWidth: 132,
  };
}
