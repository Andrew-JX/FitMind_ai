import { useEffect, useState } from "react";

import { HttpClientError } from "../../services/http-client";
import {
  getExerciseProgress,
  type ExerciseProgress,
  type ExerciseProgressRange,
} from "./exercise-progress-api";

export interface ExerciseProgressPanelProps {
  refreshSignal: number;
  selectedExerciseId: string | null;
  selectedExerciseName: string | null;
  token: string | null;
}

/**
 * Renders readonly progress details for one selected exercise.
 *
 * @param props - Auth token, selection, and refresh signal
 * @returns The exercise progress panel
 */
export function ExerciseProgressPanel(props: ExerciseProgressPanelProps) {
  const { refreshSignal, selectedExerciseId, selectedExerciseName, token } = props;
  const [progress, setProgress] = useState<ExerciseProgress | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [range] = useState<ExerciseProgressRange>(() => createDefaultRange());

  useEffect(() => {
    let isActive = true;

    async function loadProgress(): Promise<void> {
      if (!token || !selectedExerciseId) {
        setProgress(null);
        setIsLoading(false);
        setErrorMessage(null);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextProgress = await getExerciseProgress(token, {
          endDate: range.end_date,
          exerciseId: selectedExerciseId,
          startDate: range.start_date,
        });

        if (!isActive) {
          return;
        }

        setProgress(nextProgress);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setProgress(null);
        setErrorMessage(getReadableErrorMessage(error));
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadProgress();

    return () => {
      isActive = false;
    };
  }, [range.end_date, range.start_date, refreshSignal, selectedExerciseId, token]);

  if (!selectedExerciseId) {
    return (
      <section style={panelStyle}>
        <h2 style={titleStyle}>Exercise Progress</h2>
        <p style={copyStyle}>
          Select a top exercise from the summary above to inspect its recent
          deterministic progress.
        </p>
      </section>
    );
  }

  const displayExerciseName =
    selectedExerciseName?.trim() ||
    progress?.exercise.exercise_name ||
    "Selected exercise";
  const hasEmptyState =
    progress !== null &&
    progress.totals.workout_count === 0 &&
    progress.sessions.length === 0;
  const recentSessions = progress?.sessions.slice(-5).reverse() ?? [];

  return (
    <section style={panelStyle}>
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>Exercise Progress</h2>
          <p style={copyStyle}>{displayExerciseName}</p>
          <p style={subtleStyle}>
            Range: {formatRangeLabel(range.start_date, range.end_date)}
          </p>
        </div>
      </div>
      {errorMessage ? <p style={errorStyle}>Error: {errorMessage}</p> : null}
      {isLoading && !progress ? (
        <p style={copyStyle}>Loading exercise progress...</p>
      ) : null}
      {hasEmptyState ? (
        <p style={copyStyle}>
          No matching sets were found for this exercise in the last 30 days yet.
        </p>
      ) : null}
      {progress ? (
        <>
          <div style={statsGridStyle}>
            <SummaryStat
              label="Workouts"
              value={progress.totals.workout_count.toLocaleString()}
            />
            <SummaryStat
              label="Sets"
              value={progress.totals.set_count.toLocaleString()}
            />
            <SummaryStat
              label="Reps"
              value={progress.totals.total_reps.toLocaleString()}
            />
            <SummaryStat
              label="Volume"
              value={progress.totals.total_volume.toLocaleString()}
            />
            <SummaryStat
              label="Max Weight"
              value={formatMetric(progress.totals.max_weight_kg, "kg")}
            />
            <SummaryStat
              label="Best 1RM"
              value={formatMetric(progress.totals.estimated_1rm_kg, "kg")}
            />
          </div>
          <div style={sessionSectionStyle}>
            <h3 style={subheadingStyle}>Recent Sessions</h3>
            {recentSessions.length === 0 ? (
              <p style={copyStyle}>No recent sessions are available for this range.</p>
            ) : (
              <ul style={sessionListStyle}>
                {recentSessions.map((session) => {
                  return (
                    <li key={session.workout_id} style={sessionItemStyle}>
                      <div style={sessionHeaderStyle}>
                        <strong>{formatDisplayDateTime(session.performed_at)}</strong>
                        <span style={pillStyle}>
                          {session.total_volume.toLocaleString()} volume
                        </span>
                      </div>
                      <div style={sessionMetaStyle}>
                        {session.set_count.toLocaleString()} sets 路{" "}
                        {session.total_reps.toLocaleString()} reps
                      </div>
                      <div style={sessionMetaStyle}>
                        Max {formatMetric(session.max_weight_kg, "kg")} 路 Est 1RM{" "}
                        {formatMetric(session.estimated_1rm_kg, "kg")}
                      </div>
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

function getReadableErrorMessage(error: unknown): string {
  if (error instanceof HttpClientError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Exercise progress is unavailable right now.";
}

function createDefaultRange(): ExerciseProgressRange {
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
  alignItems: "flex-start",
  display: "flex",
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

const sessionSectionStyle: React.CSSProperties = {
  backgroundColor: "rgba(255,255,255,0.03)",
  borderRadius: "14px",
  padding: "0.9rem",
};

const sessionListStyle: React.CSSProperties = {
  display: "grid",
  gap: "0.75rem",
  listStyle: "none",
  margin: 0,
  padding: 0,
};

const sessionItemStyle: React.CSSProperties = {
  backgroundColor: "#1a1a1a",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "12px",
  padding: "0.75rem",
};

const sessionHeaderStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: "0.75rem",
  justifyContent: "space-between",
  marginBottom: "0.35rem",
};

const sessionMetaStyle: React.CSSProperties = {
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
