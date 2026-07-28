import { useMemo, useState } from "react";

import type { WorkoutSummaryDto } from "../../../../shared/src/training";

import { useTheme } from "../../theme/ThemeContext";
import { accentAlpha } from "../../theme/tokens";

export interface WorkoutCalendarProps {
  workouts: WorkoutSummaryDto[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

/**
 * Month calendar that marks the days with training records (design Screens §2).
 *
 * Weeks start on Sunday, matching the assistant's "本周" convention. Tapping a
 * day that has records selects it; tapping it again clears the selection. Days
 * without records are inert.
 *
 * @param props - Workouts to mark, the selected day, and its change handler
 * @returns The month grid with previous/next navigation
 */
export function WorkoutCalendar(props: WorkoutCalendarProps) {
  const { theme } = useTheme();
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));

  const workoutDays = useMemo(() => {
    const days = new Set<string>();
    for (const workout of props.workouts) {
      days.add(toLocalDateKey(new Date(workout.performed_at)));
    }
    return days;
  }, [props.workouts]);

  const todayKey = toLocalDateKey(new Date());
  const cells = useMemo(() => buildMonthCells(viewMonth), [viewMonth]);
  const monthLabel = `${viewMonth.getFullYear()} 年 ${viewMonth.getMonth() + 1} 月`;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={navRowStyle}>
        <button
          aria-label="上个月"
          onClick={() => setViewMonth((m) => addMonths(m, -1))}
          style={navButtonStyle(theme)}
          type="button"
        >
          ‹
        </button>
        <strong style={{ fontSize: 13, letterSpacing: "-0.1px" }}>
          {monthLabel}
        </strong>
        <button
          aria-label="下个月"
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          style={navButtonStyle(theme)}
          type="button"
        >
          ›
        </button>
      </div>

      <div style={gridWrapStyle(theme)}>
        <div style={rowGridStyle}>
          {WEEKDAY_LABELS.map((label) => (
            <span key={label} style={weekdayStyle(theme)}>
              {label}
            </span>
          ))}
        </div>
        <div style={rowGridStyle}>
          {cells.map((cell, index) => {
            if (cell === null) {
              return <span key={`pad-${index}`} />;
            }

            const hasWorkout = workoutDays.has(cell.key);
            const isSelected = props.selectedDate === cell.key;
            const isToday = cell.key === todayKey;

            return (
              <button
                aria-label={`${cell.day} 日${hasWorkout ? "，有训练记录" : ""}`}
                aria-pressed={isSelected}
                disabled={!hasWorkout}
                key={cell.key}
                onClick={() => props.onSelectDate(isSelected ? null : cell.key)}
                style={dayCellStyle(theme, {
                  hasWorkout,
                  isSelected,
                  isToday,
                })}
                type="button"
              >
                {cell.day}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface DayCell {
  day: number;
  key: string;
}

function buildMonthCells(monthStart: Date): (DayCell | null)[] {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const leadingBlanks = monthStart.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (DayCell | null)[] = [];

  for (let i = 0; i < leadingBlanks; i += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, key: toLocalDateKey(new Date(year, month, day)) });
  }

  return cells;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const navRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 8,
  justifyContent: "space-between",
};

function navButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: theme.colors.divider,
    border: "none",
    borderRadius: 8,
    color: theme.colors.tx2,
    cursor: "pointer",
    fontSize: 13,
    padding: "5px 11px",
  };
}

function gridWrapStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.soft,
    borderRadius: 14,
    display: "grid",
    gap: 6,
    padding: 10,
  };
}

const rowGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  gridTemplateColumns: "repeat(7, 1fr)",
};

function weekdayStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 10,
    padding: "2px 0",
    textAlign: "center",
  };
}

function dayCellStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  state: { hasWorkout: boolean; isSelected: boolean; isToday: boolean },
): React.CSSProperties {
  const base: React.CSSProperties = {
    alignItems: "center",
    aspectRatio: "1",
    border: "1px solid transparent",
    borderRadius: 9,
    cursor: state.hasWorkout ? "pointer" : "default",
    display: "flex",
    fontSize: 12,
    fontVariantNumeric: "tabular-nums",
    fontWeight: 500,
    justifyContent: "center",
    minHeight: 34,
    padding: 0,
    transition: "all 0.2s ease",
  };

  if (state.isSelected) {
    return {
      ...base,
      background: theme.colors.ac,
      borderColor: theme.colors.ac,
      color: theme.colors.acText,
      fontWeight: 800,
    };
  }

  if (state.hasWorkout) {
    return {
      ...base,
      background: accentAlpha(theme, 0.12),
      borderColor: accentAlpha(theme, 0.3),
      color: theme.colors.ac,
      fontWeight: 700,
    };
  }

  return {
    ...base,
    color: state.isToday ? theme.colors.tx : theme.colors.tx3,
    ...(state.isToday ? { borderColor: theme.colors.bdr } : {}),
  };
}
