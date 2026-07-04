import { forwardRef } from "react";

import { useTheme } from "../theme/ThemeContext";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * Renders a themed text input compatible with the current mobile shell.
 *
 * @param props - Native input props
 * @returns Themed input element
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input(props, ref) {
    const { theme } = useTheme();

    return (
      <input
        {...props}
        ref={ref}
        style={{
          backgroundColor: theme.colors.surf2,
          border: `1px solid ${theme.colors.bdr}`,
          borderRadius: theme.radius.control,
          color: theme.colors.tx,
          padding: "10px 12px",
          transition: "border-color 150ms ease, opacity 150ms ease",
          width: "100%",
          ...(props.style ?? {}),
        }}
      />
    );
  },
);
