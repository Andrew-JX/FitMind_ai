import type { TrainingSummary } from "./training-summary-api";

export interface TrainingSummaryPanelProps {
  errorMessage: string | null;
  isLoading: boolean;
  onExerciseSelect?: (exerciseId: string, exerciseName: string) => void;
  onRefresh: () => Promise<void>;
  selectedExerciseId?: string | null;
  summary: TrainingSummary | null;
}

/**
 * Renders a readonly summary snapshot for the current training range.
 *
 * @param props - Summary state and refresh action
 * @returns The summary panel
 */
export function TrainingSummaryPanel(props: TrainingSummaryPanelProps) {
  const {
    errorMessage,
    isLoading,
    onExerciseSelect,
    onRefresh,
    selectedExerciseId,
    summary,
  } = props;
  const hasEmptyState =
    summary !== null &&
    summary.totals.workout_count === 0 &&
    summary.by_exercise.length === 0;
  const topExercises = summary?.by_exercise.slice(0, 5) ?? [];

  return (
    <section style={panelStyle}>
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>Training Summary</h2>
          <p style={copyStyle}>
            {summary
              ? `Range: ${formatRangeLabel(summary.range.start_date, summary.range.end_date)}`
              : "Range: Last 30 days"}
          </p>
        </div>
        <button
          disabled={isLoading}
          onClick={() => void onRefresh()}
          style={buttonStyle}
          type="button"
        >
          {isLoading ? "Refreshing..." : "Refresh summary"}
        </button>
      </div>
      {errorMessage ? <p style={errorStyle}>Error: {errorMessage}</p> : null}
      {isLoading && !summary ? (
        <p style={copyStyle}>Loading your training summary...</p>
      ) : null}
      {hasEmptyState ? (
        <p style={copyStyle}>
          No workouts were recorded in this 30-day window yet. Create a workout to
          populate your summary.
        </p>
      ) : null}
      {summary ? (
        <>
          <div style={statsGridStyle}>
            <SummaryStat
              label="Workouts"
              value={summary.totals.workout_count.toLocaleString()}
            />
            <SummaryStat
              label="Sets"
              value={summary.totals.set_count.toLocaleString()}
            />
            <SummaryStat
              label="Total reps"
              value={summary.totals.total_reps.toLocaleString()}
            />
            <SummaryStat
              label="Total volume"
              value={summary.totals.total_volume.toLocaleString()}
            />
          </div>
          <div style={exerciseSectionStyle}>
            <h3 style={subheadingStyle}>Top Exercises</h3>
            {topExercises.length === 0 ? (
              <p style={copyStyle}>No exercise totals are available for this range.</p>
            ) : (
              <ul style={exerciseListStyle}>
                {topExercises.map((exercise) => {
                  const isSelected = selectedExerciseId === exercise.exercise_id;

                  return (
                    <li key={exercise.exercise_id} style={exerciseItemStyle}>
                      <button
                        onClick={() =>
                          onExerciseSelect?.(
                            exercise.exercise_id,
                            exercise.exercise_name,
                          )
                        }
                        style={{
                          ...exerciseButtonStyle,
                          borderColor: isSelected
                            ? "rgba(200,240,53,0.4)"
                            : "rgba(255,255,255,0.08)",
                          boxShadow: isSelected
                            ? "0 0 0 1px rgba(200,240,53,0.2) inset"
                            : "none",
                        }}
                        type="button"
                      >
                        <div style={exerciseHeaderStyle}>
                          <strong>{exercise.exercise_name}</strong>
                          <span style={pillStyle}>
                            {exercise.total_volume.toLocaleString()} volume
                          </span>
                        </div>
                        <div style={exerciseMetaStyle}>
                          {exercise.set_count.toLocaleString()} sets |{" "}
                          {exercise.total_reps.toLocaleString()} reps
                        </div>
                        <div style={exerciseActionStyle}>
                          {isSelected ? "Selected for progress" : "View progress"}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}

interface SummaryStatProps {
  label: string;
  value: string;
}

function SummaryStat(props: SummaryStatProps) {
  return (
    <div style={statCardStyle}>
      <div style={statLabelStyle}>{props.label}</div>
      <div style={statValueStyle}>{props.value}</div>
    </div>
  );
}

function formatRangeLabel(startDate: string, endDate: string): string {
  return `${formatDisplayDate(startDate)} to ${formatDisplayDate(endDate)}`;
}

function formatDisplayDate(value: string): string {
  const [yearValue, monthValue, dayValue] = value.split("-");
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return value;
  }

  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const panelStyle: React.CSSProperties = {
  background:
    "linear-gradient(160deg, rgba(26,26,26,0.98) 0%, rgba(18,18,18,0.98) 100%)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "14px",
  boxShadow: "0 18px 40px rgba(0,0,0,0.24)",
  color: "#f0f0f0",
  padding: "1rem",
};

const headerStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: "1rem",
  justifyContent: "space-between",
  marginBottom: "1rem",
};

const titleStyle: React.CSSProperties = {
  fontSize: "1.1rem",
  margin: "0 0 0.25rem",
};

const subheadingStyle: React.CSSProperties = {
  fontSize: "1rem",
  margin: "0 0 0.75rem",
};

const copyStyle: React.CSSProperties = {
  color: "#999999",
  margin: 0,
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: "#c8f035",
  border: "none",
  borderRadius: "12px",
  color: "#0f0f0f",
  cursor: "pointer",
  fontWeight: 600,
  padding: "0.75rem 1rem",
};

const errorStyle: React.CSSProperties = {
  color: "#ff9b42",
  marginBottom: "1rem",
};

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "0.75rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  marginBottom: "1rem",
};

const statCardStyle: React.CSSProperties = {
  backgroundColor: "#222222",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "14px",
  padding: "0.85rem",
};

const statLabelStyle: React.CSSProperties = {
  color: "#999999",
  fontSize: "0.85rem",
  marginBottom: "0.35rem",
  textTransform: "uppercase",
};

const statValueStyle: React.CSSProperties = {
  fontSize: "1.4rem",
  fontVariantNumeric: "tabular-nums",
  fontWeight: 700,
};

const exerciseSectionStyle: React.CSSProperties = {
  backgroundColor: "rgba(255,255,255,0.03)",
  borderRadius: "14px",
  padding: "0.9rem",
};

const exerciseListStyle: React.CSSProperties = {
  display: "grid",
  gap: "0.75rem",
  listStyle: "none",
  margin: 0,
  padding: 0,
};

const exerciseItemStyle: React.CSSProperties = {
  listStyle: "none",
};

const exerciseButtonStyle: React.CSSProperties = {
  backgroundColor: "#1a1a1a",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "12px",
  color: "#f0f0f0",
  cursor: "pointer",
  display: "block",
  padding: "0.75rem",
  textAlign: "left",
  width: "100%",
};

const exerciseHeaderStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: "0.75rem",
  justifyContent: "space-between",
  marginBottom: "0.35rem",
};

const exerciseMetaStyle: React.CSSProperties = {
  color: "#999999",
  fontSize: "0.95rem",
};

const exerciseActionStyle: React.CSSProperties = {
  color: "#c8f035",
  fontSize: "0.85rem",
  marginTop: "0.45rem",
};

const pillStyle: React.CSSProperties = {
  backgroundColor: "rgba(200,240,53,0.16)",
  borderRadius: "999px",
  color: "#c8f035",
  fontSize: "0.85rem",
  padding: "0.25rem 0.6rem",
  whiteSpace: "nowrap",
};
