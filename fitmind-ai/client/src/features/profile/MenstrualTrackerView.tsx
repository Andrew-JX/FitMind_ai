import { useCallback, useEffect, useMemo, useState } from "react";
import { CURRENT_PRIVACY_POLICY_VERSION } from "../../../../shared/src/consent";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { useTheme } from "../../theme/ThemeContext";
import { accentAlpha } from "../../theme/tokens";
import {
  deleteMenstrualRecords,
  getMenstrualOverview,
  setMenstrualDate,
  updateMenstrualSettings,
} from "./personal-tools-api";
import { getPersonalToolWriteErrorMessage } from "./personal-tool-error-message";
import {
  addMonths,
  formatLocalDate,
  formatMonth,
  groupConsecutiveDates,
} from "./personal-tools-model";
import {
  HealthConsentNotice,
  InlineStatus,
  PersonalToolShell,
} from "./PersonalToolShell";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

export function MenstrualTrackerView(props: {
  onBack: () => void;
  token: string | null;
}) {
  const { theme } = useTheme();
  const [viewMonth, setViewMonth] = useState(() => new Date());
  const [dates, setDates] = useState<string[]>([]);
  const [showInHistory, setShowInHistory] = useState(false);
  const [healthConsentOnFile, setHealthConsentOnFile] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingDate, setSavingDate] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const month = formatMonth(viewMonth);

  const load = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const overview = await getMenstrualOverview(props.token, month);
      setDates(overview.dates);
      setShowInHistory(overview.showInHistory);
      setHealthConsentOnFile(overview.healthConsentOnFile);
    } catch {
      setStatus("经期记录暂时无法加载，请检查服务后重试。");
    } finally {
      setLoading(false);
    }
  }, [month, props.token]);

  useEffect(() => {
    void load();
  }, [load]);

  const cells = useMemo(() => buildMonthCells(viewMonth), [viewMonth]);
  const ranges = groupConsecutiveDates(dates);

  async function toggleDate(date: string) {
    const isSelected = dates.includes(date);
    if (!isSelected && !healthConsentOnFile && !consentAccepted) {
      setStatus("首次保存前，请先勾选健康数据的单独同意。");
      return;
    }

    setSavingDate(date);
    setStatus(null);
    try {
      await setMenstrualDate(props.token, date, {
        isPeriod: !isSelected,
        ...(!isSelected && !healthConsentOnFile
          ? {
              sensitiveHealthConsent: {
                accepted: true,
                policy_version: CURRENT_PRIVACY_POLICY_VERSION,
              },
            }
          : {}),
      });
      setDates((current) =>
        isSelected
          ? current.filter((item) => item !== date)
          : [...current, date].sort(),
      );
      if (!isSelected) {
        setHealthConsentOnFile(true);
        setConsentAccepted(false);
      }
    } catch (error) {
      setStatus(
        getPersonalToolWriteErrorMessage(
          error,
          "这一天没有保存成功，请稍后重试。",
        ),
      );
    } finally {
      setSavingDate(null);
    }
  }

  return (
    <PersonalToolShell
      description="点选实际经期日期；当前版本不做周期或排卵预测"
      onBack={props.onBack}
      title="经期记录"
    >
      <Card>
        <div style={{ display: "grid", gap: 12 }}>
          <div
            style={{
              alignItems: "center",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <button
              aria-label="上个月"
              onClick={() => setViewMonth((current) => addMonths(current, -1))}
              style={monthButtonStyle(theme)}
              type="button"
            >
              上月
            </button>
            <strong style={{ fontSize: 15 }}>
              {viewMonth.getFullYear()} 年 {viewMonth.getMonth() + 1} 月
            </strong>
            <button
              aria-label="下个月"
              onClick={() => setViewMonth((current) => addMonths(current, 1))}
              style={monthButtonStyle(theme)}
              type="button"
            >
              下月
            </button>
          </div>

          <div style={{ display: "grid", gap: 5 }}>
            <div style={calendarGridStyle}>
              {WEEKDAYS.map((weekday) => (
                <span key={weekday} style={weekdayStyle(theme)}>
                  {weekday}
                </span>
              ))}
            </div>
            <div style={calendarGridStyle}>
              {cells.map((cell) => {
                const selected = dates.includes(cell.key);
                const isToday = cell.key === formatLocalDate(new Date());
                return (
                  <button
                    aria-label={`${cell.day} 日${selected ? "，经期" : ""}`}
                    aria-pressed={selected}
                    disabled={!cell.current || savingDate !== null}
                    key={cell.key}
                    onClick={() => void toggleDate(cell.key)}
                    style={dateButtonStyle(theme, {
                      current: cell.current,
                      selected,
                      today: isToday,
                    })}
                    type="button"
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            style={{
              background: theme.colors.soft,
              borderRadius: 12,
              display: "grid",
              gap: 4,
              padding: "10px 12px",
            }}
          >
            <strong style={{ fontSize: 12 }}>本月记录</strong>
            <span style={{ color: theme.colors.tx2, fontSize: 11 }}>
              {ranges.length > 0
                ? `${ranges.join("、")}，共 ${dates.length} 天`
                : loading
                  ? "正在加载…"
                  : "还没有标记日期"}
            </span>
          </div>
        </div>
      </Card>

      {!healthConsentOnFile ? (
        <HealthConsentNotice
          accepted={consentAccepted}
          onChange={setConsentAccepted}
        />
      ) : null}

      <Card>
        <label
          style={{
            alignItems: "center",
            display: "flex",
            fontSize: 13,
            gap: 10,
            justifyContent: "space-between",
          }}
        >
          <span>
            <strong style={{ display: "block" }}>在历史日历中显示经期</strong>
            <span style={{ color: theme.colors.tx2, fontSize: 11 }}>
              仅显示日期标记，不展示预测信息
            </span>
          </span>
          <input
            checked={showInHistory}
            onChange={(event) => {
              const next = event.target.checked;
              setShowInHistory(next);
              void updateMenstrualSettings(props.token, {
                showInHistory: next,
              }).catch(() => {
                setShowInHistory(!next);
                setStatus("显示设置没有保存成功。");
              });
            }}
            style={{ accentColor: theme.colors.ac }}
            type="checkbox"
          />
        </label>
      </Card>

      {status ? <InlineStatus tone="error">{status}</InlineStatus> : null}

      {confirmingDelete ? (
        <Card>
          <div style={{ display: "grid", gap: 9 }}>
            <InlineStatus>
              删除全部经期日期？身体数据和训练记录不会被删除。
            </InlineStatus>
            <div
              style={{
                display: "grid",
                gap: 8,
                gridTemplateColumns: "1fr 1fr",
              }}
            >
              <Button
                onClick={() => setConfirmingDelete(false)}
                variant="secondary"
              >
                取消
              </Button>
              <Button
                onClick={() => {
                  void deleteMenstrualRecords(props.token)
                    .then(() => {
                      setDates([]);
                      setHealthConsentOnFile(false);
                      setConfirmingDelete(false);
                      setStatus("经期记录已删除。");
                    })
                    .catch(() => setStatus("删除失败，请稍后重试。"));
                }}
                style={{ background: theme.colors.red, color: "#fff" }}
              >
                确认删除
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <button
          onClick={() => setConfirmingDelete(true)}
          style={{
            background: "transparent",
            border: `1px solid ${theme.colors.bdr}`,
            borderRadius: 12,
            color: theme.colors.red,
            cursor: "pointer",
            fontSize: 12,
            padding: 10,
          }}
          type="button"
        >
          删除全部经期记录
        </button>
      )}
    </PersonalToolShell>
  );
}

function buildMonthCells(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(
    month.getFullYear(),
    month.getMonth(),
    1 - first.getDay(),
  );
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + index,
    );
    return {
      current: date.getMonth() === month.getMonth(),
      day: date.getDate(),
      key: formatLocalDate(date),
    };
  });
}

const calendarGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 5,
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
};

function weekdayStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 10,
    fontWeight: 700,
    textAlign: "center",
  };
}

function monthButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 9,
    color: theme.colors.tx2,
    cursor: "pointer",
    fontSize: 11,
    padding: "6px 9px",
  };
}

function dateButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  state: { current: boolean; selected: boolean; today: boolean },
): React.CSSProperties {
  return {
    alignItems: "center",
    aspectRatio: "1",
    background: state.selected
      ? theme.colors.pink
      : state.today
        ? accentAlpha(theme, 0.12)
        : "transparent",
    border: state.today
      ? `1px solid ${theme.colors.ac}`
      : "1px solid transparent",
    borderRadius: 10,
    color: state.selected ? "#fff" : theme.colors.tx,
    cursor: state.current ? "pointer" : "default",
    display: "flex",
    fontSize: 12,
    fontWeight: state.selected || state.today ? 800 : 500,
    justifyContent: "center",
    opacity: state.current ? 1 : 0.2,
    padding: 0,
  };
}
