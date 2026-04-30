import { useEffect, useEffectEvent, useState } from "react";

import { HttpClientError } from "../../services/http-client";
import {
  getRecommendationContext,
  type RecommendationContext,
  type RecommendationContextRange,
} from "./recommendation-context-api";

export interface RecommendationContextPanelProps {
  refreshSignal: number;
  token: string | null;
}

/**
 * Renders a readonly preview of the deterministic recommendation context package.
 *
 * @param props - Auth token and external refresh signal
 * @returns The recommendation context preview panel
 */
export function RecommendationContextPanel(
  props: RecommendationContextPanelProps,
) {
  const { refreshSignal, token } = props;
  const [context, setContext] = useState<RecommendationContext | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [range] = useState<RecommendationContextRange>(() => createDefaultRange());

  const refreshOnTokenChange = useEffectEvent(async () => {
    await refresh();
  });
  const refreshOnSignalChange = useEffectEvent(async () => {
    await refresh();
  });

  useEffect(() => {
    if (!token) {
      setContext(null);
      setErrorMessage(null);
      setIsLoading(false);
      return;
    }

    void refreshOnTokenChange();
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    void refreshOnSignalChange();
  }, [refreshSignal, token]);

  async function refresh(): Promise<void> {
    if (!token) {
      setErrorMessage("You must be signed in to view recommendation context.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const nextContext = await getRecommendationContext(token, {
        endDate: range.end_date,
        startDate: range.start_date,
      });
      setContext(nextContext);
    } catch (error) {
      setContext(null);
      setErrorMessage(getReadableErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  const hasEmptyState =
    context !== null &&
    context.summary.workout_count === 0 &&
    context.focus_exercises.length === 0 &&
    context.recent_workouts.length === 0;

  return (
    <section style={panelStyle}>
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>Deterministic Recommendation Context Preview</h2>
          <p style={copyStyle}>
            {context
              ? `Range: ${formatRangeLabel(context.range.start_date, context.range.end_date)}`
              : `Range: ${formatRangeLabel(range.start_date, range.end_date)}`}
          </p>
          <p style={subtleStyle}>
            Readonly context package for future tool-calling or LLM explanation.
          </p>
        </div>
        <button
          disabled={isLoading}
          onClick={() => void refresh()}
          style={buttonStyle}
          type="button"
        >
          {isLoading ? "Refreshing..." : "Refresh context"}
        </button>
      </div>
      {errorMessage ? <p style={errorStyle}>Error: {errorMessage}</p> : null}
      {isLoading && !context ? (
        <p style={copyStyle}>Loading recommendation context...</p>
      ) : null}
      {hasEmptyState ? (
        <p style={copyStyle}>
          No workouts are available in this 30-day window yet, so the context
          package is still empty.
        </p>
      ) : null}
      {context ? (
        <>
          <div style={statsGridStyle}>
            <SummaryStat
              label="Workouts"
              value={context.summary.workout_count.toLocaleString()}
            />
            <SummaryStat
              label="Sets"
              value={context.summary.set_count.toLocaleString()}
            />
            <SummaryStat
              label="Total reps"
              value={context.summary.total_reps.toLocaleString()}
            />
            <SummaryStat
              label="Total volume"
              value={context.summary.total_volume.toLocaleString()}
            />
          </div>
          <div style={contentGridStyle}>
            <section style={sectionCardStyle}>
              <h3 style={subheadingStyle}>Focus Exercises</h3>
              {context.focus_exercises.length === 0 ? (
                <p style={copyStyle}>No focus exercises are available for this range.</p>
              ) : (
                <ul style={listStyle}>
                  {context.focus_exercises.map((exercise) => {
                    return (
                      <li key={exercise.exercise_id} style={listItemStyle}>
                        <div style={itemHeaderStyle}>
                          <strong>{exercise.exercise_name}</strong>
                          <span style={pillStyle}>
                            {exercise.total_volume.toLocaleString()} volume
                          </span>
                        </div>
                        <div style={itemMetaStyle}>
                          {exercise.workout_count.toLocaleString()} workouts |{" "}
                          {exercise.set_count.toLocaleString()} sets |{" "}
                          {exercise.total_reps.toLocaleString()} reps
                        </div>
                        <div style={itemMetaStyle}>
                          Max {formatMetric(exercise.max_weight_kg, "kg")} | Est 1RM{" "}
                          {formatMetric(exercise.estimated_1rm_kg, "kg")}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            <section style={sectionCardStyle}>
              <h3 style={subheadingStyle}>Recent Workouts</h3>
              {context.recent_workouts.length === 0 ? (
                <p style={copyStyle}>No recent workouts are available for this range.</p>
              ) : (
                <ul style={listStyle}>
                  {context.recent_workouts.map((workout) => {
                    return (
                      <li key={workout.workout_id} style={listItemStyle}>
                        <div style={itemHeaderStyle}>
                          <strong>{formatDisplayDateTime(workout.performed_at)}</strong>
                          <span style={pillStyle}>
                            {workout.total_volume.toLocaleString()} volume
                          </span>
                        </div>
                        <div style={itemMetaStyle}>
                          {workout.set_count.toLocaleString()} sets
                        </div>
                        <div style={itemMetaStyle}>
                          {workout.notes?.trim() || "No notes for this workout."}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
          <section style={sectionCardStyle}>
            <h3 style={subheadingStyle}>Evidence Snapshot</h3>
            <div style={statsGridStyle}>
              <SummaryStat
                label="Workout ids"
                value={context.evidence.workout_ids.length.toLocaleString()}
              />
              <SummaryStat
                label="Set ids"
                value={context.evidence.set_ids.length.toLocaleString()}
              />
              <SummaryStat
                label="Rule count"
                value={context.evidence.calculation_rules.length.toLocaleString()}
              />
            </div>
            <p style={copyStyle}>Source: {context.evidence.source}</p>
            <details style={detailsStyle}>
              <summary style={summaryStyle}>Show calculation rules</summary>
              <ul style={rulesListStyle}>
                {context.evidence.calculation_rules.map((rule) => (
                  <li key={rule} style={ruleItemStyle}>
                    {rule}
                  </li>
                ))}
              </ul>
            </details>
          </section>
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

function getReadableErrorMessage(error: unknown): string {
  if (error instanceof HttpClientError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Recommendation context is unavailable right now.";
}

function createDefaultRange(): RecommendationContextRange {
  const today = new Date();
  const endDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const startDate = new Date(endDate);

  startDate.setDate(startDate.getDate() - 29);

  return {
    end_date: formatDateOnly(endDate),
    start_date: formatDateOnly(startDate),
  };
}

function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
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

function formatDisplayDateTime(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(undefined, {
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        month: "short",
      });
}

function formatMetric(value: number | null, unit: string): string {
  if (value === null) {
    return "N/A";
  }

  return `${value.toLocaleString()} ${unit}`;
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

const subtleStyle: React.CSSProperties = {
  color: "#555555",
  margin: "0.35rem 0 0",
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
  fontSize: "1.2rem",
  fontVariantNumeric: "tabular-nums",
  fontWeight: 700,
};

const contentGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "1rem",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
};

const sectionCardStyle: React.CSSProperties = {
  backgroundColor: "rgba(255,255,255,0.03)",
  borderRadius: "14px",
  marginTop: "1rem",
  padding: "0.9rem",
};

const listStyle: React.CSSProperties = {
  display: "grid",
  gap: "0.75rem",
  listStyle: "none",
  margin: 0,
  padding: 0,
};

const listItemStyle: React.CSSProperties = {
  backgroundColor: "#1a1a1a",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "12px",
  padding: "0.75rem",
};

const itemHeaderStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: "0.75rem",
  justifyContent: "space-between",
  marginBottom: "0.35rem",
};

const itemMetaStyle: React.CSSProperties = {
  color: "#999999",
  fontSize: "0.95rem",
};

const pillStyle: React.CSSProperties = {
  backgroundColor: "rgba(200,240,53,0.16)",
  borderRadius: "999px",
  color: "#c8f035",
  fontSize: "0.85rem",
  padding: "0.25rem 0.6rem",
  whiteSpace: "nowrap",
};

const detailsStyle: React.CSSProperties = {
  marginTop: "0.75rem",
};

const summaryStyle: React.CSSProperties = {
  color: "#c8f035",
  cursor: "pointer",
};

const rulesListStyle: React.CSSProperties = {
  color: "#999999",
  margin: "0.75rem 0 0",
  paddingLeft: "1rem",
};

const ruleItemStyle: React.CSSProperties = {
  marginBottom: "0.4rem",
};
