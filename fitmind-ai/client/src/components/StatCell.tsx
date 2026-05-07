import { useTheme } from "../theme/ThemeContext";
import { type SemanticTone } from "../theme/tokens";

export interface StatCellProps {
  label: string;
  tone?: SemanticTone | undefined;
  unit?: string | undefined;
  value: string;
}

/**
 * Displays one compact dashboard statistic cell.
 *
 * @param props - Label, value, and optional unit/tone
 * @returns Statistic cell element
 */
export function StatCell(props: StatCellProps) {
  const { theme } = useTheme();
  const dotColor =
    props.tone === "success"
      ? theme.colors.green
      : props.tone === "warning"
        ? theme.colors.orange
        : props.tone === "danger"
          ? theme.colors.red
          : props.tone === "info"
            ? theme.colors.blue
            : props.tone === "analysis"
              ? theme.colors.purple
              : theme.colors.ac;

  return (
    <div
      style={{
        backgroundColor: theme.colors.surf2,
        borderRadius: theme.radius.card,
        padding: "14px",
      }}
    >
      <div
        style={{
          backgroundColor: dotColor,
          borderRadius: 999,
          height: 4,
          marginBottom: 8,
          width: 4,
        }}
      />
      <div style={{ alignItems: "baseline", display: "flex", gap: 2 }}>
        <strong
          style={{
            color: theme.colors.tx,
            fontSize: 22,
            fontWeight: 800,
          }}
        >
          {props.value}
        </strong>
        {props.unit ? (
          <span style={{ color: theme.colors.tx3, fontSize: 11 }}>{props.unit}</span>
        ) : null}
      </div>
      <div style={{ color: theme.colors.tx3, fontSize: 11, marginTop: 2 }}>
        {props.label}
      </div>
    </div>
  );
}
