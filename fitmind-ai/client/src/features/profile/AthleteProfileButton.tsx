import { useState } from "react";

import { IconButton } from "../../components/IconButton";
import { useTheme } from "../../theme/ThemeContext";
import { AthleteProfileSheet } from "./AthleteProfileSheet";

export interface AthleteProfileButtonProps {
  token: string | null;
}

/**
 * Header entry point that opens the athlete profile editor sheet.
 *
 * @param props - The in-memory auth token
 * @returns The profile icon button and its editing sheet
 */
export function AthleteProfileButton(props: AthleteProfileButtonProps) {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);

  return (
    <div style={containerStyle}>
      {statusText ? (
        <span aria-live="polite" style={statusStyle(theme)}>
          {statusText}
        </span>
      ) : null}

      <IconButton
        icon="user"
        label="训练档案"
        onClick={() => {
          setStatusText(null);
          setIsOpen(true);
        }}
      />

      <AthleteProfileSheet
        onClose={() => setIsOpen(false)}
        onSaved={setStatusText}
        open={isOpen}
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
    maxWidth: 112,
  };
}
