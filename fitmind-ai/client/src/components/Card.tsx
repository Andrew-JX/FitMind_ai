import { useTheme } from "../theme/ThemeContext";

export interface CardProps {
  children: React.ReactNode;
  padding?: string | undefined;
}

/**
 * Wraps content in the shared mobile card surface.
 *
 * @param props - Card body and optional padding override
 * @returns Card container
 */
export function Card(props: CardProps) {
  const { theme } = useTheme();

  return (
    <section
      style={{
        backgroundColor: theme.colors.surf,
        border: `1px solid ${theme.colors.bdr}`,
        borderRadius: theme.radius.card,
        boxShadow: theme.shadows.card,
        padding: props.padding ?? theme.spacing.lg,
      }}
    >
      {props.children}
    </section>
  );
}
