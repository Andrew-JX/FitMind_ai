import { useTheme } from "../theme/ThemeContext";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | undefined;
}

/**
 * Renders a shared primary or secondary action button.
 *
 * @param props - Native button props plus visual variant
 * @returns Themed button
 */
export function Button(props: ButtonProps) {
  const { theme } = useTheme();
  const { disabled, variant = "primary", style, ...rest } = props;

  return (
    <button
      {...rest}
      disabled={disabled}
      style={{
        backgroundColor:
          variant === "primary" ? theme.colors.ac : theme.colors.surf2,
        border:
          variant === "primary" ? "none" : `1px solid ${theme.colors.bdr}`,
        borderRadius: theme.radius.control,
        color: variant === "primary" ? theme.colors.acText : theme.colors.tx2,
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 13,
        fontWeight: 700,
        opacity: disabled ? 0.56 : 1,
        padding: "12px 14px",
        transition: "opacity 150ms ease, transform 150ms ease",
        ...(style ?? {}),
      }}
    />
  );
}
