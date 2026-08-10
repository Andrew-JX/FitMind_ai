import { useEffect, useMemo, useRef, useState } from "react";

import type { WorkoutSummaryDto } from "../../../../shared/src/training";

import { ActionSheet } from "../../components/ActionSheet";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { useTheme } from "../../theme/ThemeContext";
import { accentAlpha } from "../../theme/tokens";
import { getMenstrualOverview } from "../profile/personal-tools-api";
import {
  calculateWorkoutVolume,
  formatAccessibleCalendarVolume,
  formatCalendarVolume,
  summarizeWorkoutCalendarDays,
  toWorkoutLocalDateKey,
} from "./workout-calendar-model";
import { getWorkoutDetail } from "./workout-api";

export interface WorkoutCalendarProps {
  workouts: WorkoutSummaryDto[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  token: string | null;
}

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];
const MONTH_LABELS = [
  "1 月",
  "2 月",
  "3 月",
  "4 月",
  "5 月",
  "6 月",
  "7 月",
  "8 月",
  "9 月",
  "10 月",
  "11 月",
  "12 月",
];

/**
 * Month calendar that previews each training day's volume and workout notes.
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
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());
  const [fallbackVolumes, setFallbackVolumes] = useState<
    Record<string, number>
  >({});
  const [periodDates, setPeriodDates] = useState<string[]>([]);
  const isMountedRef = useRef(true);
  const pendingVolumeIdsRef = useRef(new Set<string>());
  const cells = useMemo(() => buildMonthCells(viewMonth), [viewMonth]);
  const visibleDateKeys = useMemo(
    () => new Set(cells.map((cell) => cell.key)),
    [cells],
  );
  const calendarWorkouts = useMemo(
    () =>
      props.workouts.map((workout) => {
        if (workout.total_volume !== undefined) {
          return workout;
        }

        const fallbackVolume = fallbackVolumes[workout.id];
        return fallbackVolume === undefined
          ? workout
          : { ...workout, total_volume: fallbackVolume };
      }),
    [fallbackVolumes, props.workouts],
  );

  const workoutDays = useMemo(
    () => summarizeWorkoutCalendarDays(calendarWorkouts),
    [calendarWorkouts],
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!props.token) {
      return;
    }

    const missingVisibleWorkouts = props.workouts.filter(
      (workout) =>
        workout.total_volume === undefined &&
        fallbackVolumes[workout.id] === undefined &&
        !pendingVolumeIdsRef.current.has(workout.id) &&
        visibleDateKeys.has(
          toWorkoutLocalDateKey(new Date(workout.performed_at)),
        ),
    );

    for (const workout of missingVisibleWorkouts) {
      pendingVolumeIdsRef.current.add(workout.id);
      void getWorkoutDetail(props.token, workout.id)
        .then((detail) => {
          if (isMountedRef.current) {
            setFallbackVolumes((current) => ({
              ...current,
              [workout.id]: calculateWorkoutVolume(detail),
            }));
          }
        })
        .catch(() => {
          // Keep the honest unavailable marker if an older API detail fails.
        })
        .finally(() => {
          pendingVolumeIdsRef.current.delete(workout.id);
        });
    }
  }, [fallbackVolumes, props.token, props.workouts, visibleDateKeys]);

  useEffect(() => {
    if (!props.token) {
      return;
    }

    let active = true;
    const month = `${viewMonth.getFullYear()}-${`${viewMonth.getMonth() + 1}`.padStart(2, "0")}`;
    void getMenstrualOverview(props.token, month)
      .then((overview) => {
        if (active) {
          setPeriodDates(overview.showInHistory ? overview.dates : []);
        }
      })
      .catch(() => {
        if (active) setPeriodDates([]);
      });

    return () => {
      active = false;
    };
  }, [props.token, viewMonth]);

  const todayKey = toWorkoutLocalDateKey(new Date());
  const monthLabel = `${viewMonth.getFullYear()} 年 ${viewMonth.getMonth() + 1} 月`;
  const yearOptions = buildYearOptions(viewMonth, props.workouts);

  return (
    <div data-testid="workout-calendar" style={{ display: "grid", gap: 10 }}>
      <ActionSheet
        description="选择要查看的年份和月份。"
        footer={
          <Button
            onClick={() => {
              goToMonth(startOfMonth(new Date()));
              setIsMonthPickerOpen(false);
            }}
            type="button"
            variant="secondary"
          >
            回到本月
          </Button>
        }
        onClose={() => setIsMonthPickerOpen(false)}
        open={isMonthPickerOpen}
        showCloseButton
        title="选择时间范围"
      >
        <label style={pickerFieldStyle(theme)}>
          <span>年份</span>
          <select
            aria-label="选择年份"
            onChange={(event) => setPickerYear(Number(event.target.value))}
            style={yearSelectStyle(theme)}
            value={pickerYear}
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year} 年
              </option>
            ))}
          </select>
        </label>
        <div aria-label="选择月份" role="group" style={monthGridStyle}>
          {MONTH_LABELS.map((label, monthIndex) => {
            const isActive =
              pickerYear === viewMonth.getFullYear() &&
              monthIndex === viewMonth.getMonth();
            return (
              <button
                aria-pressed={isActive}
                key={label}
                onClick={() => {
                  goToMonth(new Date(pickerYear, monthIndex, 1));
                  setIsMonthPickerOpen(false);
                }}
                style={monthOptionStyle(theme, isActive)}
                type="button"
              >
                {label}
              </button>
            );
          })}
        </div>
      </ActionSheet>

      <div style={navRowStyle}>
        <button
          aria-label="上个月"
          onClick={() => goToMonth(addMonths(viewMonth, -1))}
          style={navButtonStyle(theme)}
          type="button"
        >
          ‹
        </button>
        <button
          aria-expanded={isMonthPickerOpen}
          aria-haspopup="dialog"
          aria-label={`选择时间范围，当前 ${monthLabel}`}
          onClick={() => {
            setPickerYear(viewMonth.getFullYear());
            setIsMonthPickerOpen(true);
          }}
          style={monthTriggerStyle(theme)}
          type="button"
        >
          <span style={monthTriggerLabelStyle}>
            <strong style={{ fontSize: 13 }}>{monthLabel}</strong>
            <Icon name="chevron-down" size={12} />
          </span>
          <span style={{ color: theme.colors.tx3, fontSize: 9 }}>
            选择月份 · 总容量（公斤）· 训练备注
          </span>
        </button>
        <button
          aria-label="下个月"
          onClick={() => goToMonth(addMonths(viewMonth, 1))}
          style={navButtonStyle(theme)}
          type="button"
        >
          ›
        </button>
      </div>

      <div data-testid="workout-calendar-grid" style={gridWrapStyle(theme)}>
        <div style={rowGridStyle}>
          {WEEKDAY_LABELS.map((label) => (
            <span key={label} style={weekdayStyle(theme)}>
              {label}
            </span>
          ))}
        </div>
        <div style={rowGridStyle}>
          {cells.map((cell) => {
            const daySummary = workoutDays.get(cell.key);
            const hasWorkout = daySummary !== undefined;
            const isSelected = props.selectedDate === cell.key;
            const isToday = cell.key === todayKey;
            const isPeriod = periodDates.includes(cell.key);
            const accessibleSummary = daySummary
              ? `，${daySummary.workoutCount} 次训练，总容量 ${formatAccessibleCalendarVolume(daySummary.totalVolume)}，备注 ${daySummary.notes.join("；")}`
              : "";

            return (
              <button
                aria-label={`${cell.day} 日${accessibleSummary}${isPeriod ? "，经期" : ""}`}
                aria-pressed={isSelected}
                disabled={!hasWorkout}
                key={cell.key}
                onClick={() => props.onSelectDate(isSelected ? null : cell.key)}
                style={dayCellStyle(theme, {
                  hasWorkout,
                  isCurrentMonth: cell.isCurrentMonth,
                  isSelected,
                  isToday,
                })}
                type="button"
              >
                <span style={dayNumberStyle(theme, isToday, isSelected)}>
                  {cell.day}
                </span>
                {isPeriod ? (
                  <span
                    aria-hidden="true"
                    style={{
                      alignSelf: "center",
                      background: theme.colors.pink,
                      borderRadius: 999,
                      height: 4,
                      width: 14,
                    }}
                  />
                ) : null}
                {daySummary ? (
                  <>
                    <span style={volumeBadgeStyle(theme, isSelected)}>
                      {formatCalendarVolume(daySummary.totalVolume)}
                    </span>
                    <span style={notesStackStyle}>
                      {daySummary.notes.map((note, noteIndex) => (
                        <span
                          key={`${cell.key}-${noteIndex}`}
                          style={noteLineStyle(theme, isSelected)}
                          title={note}
                        >
                          {note}
                        </span>
                      ))}
                    </span>
                  </>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  function goToMonth(nextMonth: Date): void {
    const normalizedMonth = startOfMonth(nextMonth);
    setViewMonth(normalizedMonth);
    const selectedMonthPrefix = `${normalizedMonth.getFullYear()}-${`${normalizedMonth.getMonth() + 1}`.padStart(2, "0")}`;
    if (
      props.selectedDate !== null &&
      !props.selectedDate.startsWith(selectedMonthPrefix)
    ) {
      props.onSelectDate(null);
    }
  }
}

interface DayCell {
  day: number;
  isCurrentMonth: boolean;
  key: string;
}

function buildMonthCells(monthStart: Date): DayCell[] {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const leadingBlanks = monthStart.getDay();
  const gridStart = new Date(year, month, 1 - leadingBlanks);
  const cells: DayCell[] = [];

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index,
    );
    cells.push({
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === month,
      key: toWorkoutLocalDateKey(date),
    });
  }

  return cells;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function buildYearOptions(
  viewMonth: Date,
  workouts: WorkoutSummaryDto[],
): number[] {
  const currentYear = new Date().getFullYear();
  const workoutYears = workouts
    .map((workout) => new Date(workout.performed_at).getFullYear())
    .filter(Number.isFinite);
  const minimum = Math.min(
    currentYear - 10,
    viewMonth.getFullYear(),
    ...workoutYears,
  );
  const maximum = Math.max(
    currentYear + 10,
    viewMonth.getFullYear(),
    ...workoutYears,
  );
  return Array.from(
    { length: maximum - minimum + 1 },
    (_, index) => maximum - index,
  );
}

const navRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 8,
  justifyContent: "space-between",
};

function monthTriggerStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: "transparent",
    border: "none",
    borderRadius: 8,
    color: theme.colors.tx,
    cursor: "pointer",
    minWidth: 0,
    padding: "4px 8px",
    textAlign: "center",
  };
}

const monthTriggerLabelStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 4,
  justifyContent: "center",
};

function pickerFieldStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    display: "grid",
    fontSize: 12,
    fontWeight: 700,
    gap: 7,
  };
}

function yearSelectStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    appearance: "none",
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 10,
    color: theme.colors.tx,
    font: "inherit",
    padding: "11px 12px",
    width: "100%",
  };
}

const monthGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
};

function monthOptionStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isActive: boolean,
): React.CSSProperties {
  return {
    background: isActive ? theme.colors.ac : theme.colors.surf2,
    border: `1px solid ${isActive ? theme.colors.ac : theme.colors.bdr}`,
    borderRadius: 10,
    color: isActive ? theme.colors.acText : theme.colors.tx,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
    padding: "11px 6px",
  };
}

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
  gap: 3,
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
};

function weekdayStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 10,
    fontWeight: 700,
    padding: "2px 0",
    textAlign: "center",
  };
}

function dayCellStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  state: {
    hasWorkout: boolean;
    isCurrentMonth: boolean;
    isSelected: boolean;
    isToday: boolean;
  },
): React.CSSProperties {
  const base: React.CSSProperties = {
    alignItems: "stretch",
    background: "transparent",
    border: "1px solid transparent",
    borderRadius: 8,
    cursor: state.hasWorkout ? "pointer" : "default",
    display: "flex",
    flexDirection: "column",
    fontSize: 11,
    fontVariantNumeric: "tabular-nums",
    fontWeight: 500,
    gap: 3,
    minHeight: 72,
    minWidth: 0,
    opacity: state.isCurrentMonth ? 1 : 0.36,
    overflow: "hidden",
    padding: "4px 3px",
    transition: "all 0.2s ease",
  };

  if (state.isSelected) {
    return {
      ...base,
      background: accentAlpha(theme, 0.12),
      borderColor: theme.colors.ac,
      color: theme.colors.tx,
      fontWeight: 800,
    };
  }

  if (state.hasWorkout) {
    return {
      ...base,
      background: theme.colors.surf2,
      borderColor: theme.colors.bdr,
      color: theme.colors.tx,
      fontWeight: 700,
    };
  }

  return {
    ...base,
    color: state.isToday
      ? theme.colors.tx
      : state.isCurrentMonth
        ? theme.colors.tx2
        : theme.colors.tx3,
  };
}

function dayNumberStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isToday: boolean,
  isSelected: boolean,
): React.CSSProperties {
  return {
    alignItems: "center",
    alignSelf: "center",
    background: isToday ? theme.colors.blue : "transparent",
    borderRadius: theme.radius.capsule,
    color: isToday ? "#ffffff" : isSelected ? theme.colors.ac : "inherit",
    display: "inline-flex",
    fontSize: 11,
    fontWeight: isToday || isSelected ? 800 : 600,
    height: 20,
    justifyContent: "center",
    lineHeight: 1,
    width: 20,
  };
}

function volumeBadgeStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isSelected: boolean,
): React.CSSProperties {
  return {
    background: theme.colors.ac,
    borderRadius: 4,
    color: theme.colors.acText,
    display: "block",
    fontSize: 9,
    fontWeight: 800,
    lineHeight: "15px",
    overflow: "hidden",
    padding: "0 2px",
    textAlign: "center",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    ...(isSelected
      ? { boxShadow: `0 0 0 1px ${accentAlpha(theme, 0.45)}` }
      : {}),
  };
}

const notesStackStyle: React.CSSProperties = {
  display: "grid",
  gap: 2,
  minWidth: 0,
};

function noteLineStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  isSelected: boolean,
): React.CSSProperties {
  return {
    background: isSelected ? accentAlpha(theme, 0.12) : theme.colors.soft,
    borderRadius: 3,
    color: theme.colors.tx,
    display: "block",
    fontSize: 9,
    fontWeight: 600,
    lineHeight: "14px",
    overflow: "hidden",
    padding: "0 3px",
    textAlign: "left",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}
