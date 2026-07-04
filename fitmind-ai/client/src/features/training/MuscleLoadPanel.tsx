import { useEffect, useState } from "react";

import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Pill } from "../../components/Pill";
import { StateNotice } from "../../components/StateNotice";
import { StatCell } from "../../components/StatCell";
import { HttpClientError } from "../../services/http-client";
import { useTheme } from "../../theme/ThemeContext";
import {
  getMuscleLoad,
  type MuscleLoadGroup,
  type MuscleLoadRange,
  type MuscleLoadResponse,
} from "./muscle-load-api";

export interface MuscleLoadPanelProps {
  refreshSignal: number;
  token: string | null;
}

export function MuscleLoadPanel(props: MuscleLoadPanelProps) {
  const { refreshSignal, token } = props;
  const { theme } = useTheme();
  const [muscleLoad, setMuscleLoad] = useState<MuscleLoadResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [range] = useState<MuscleLoadRange>(() => createDefaultRange());

  useEffect(() => {
    let isActive = true;

    async function loadMuscleLoad(): Promise<void> {
      if (!token) {
        setMuscleLoad(null);
        setErrorMessage(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextMuscleLoad = await getMuscleLoad(token, {
          endDate: range.end_date,
          startDate: range.start_date,
        });

        if (!isActive) {
          return;
        }

        setMuscleLoad(nextMuscleLoad);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setMuscleLoad(null);
        setErrorMessage(getReadableErrorMessage(error));
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadMuscleLoad();

    return () => {
      isActive = false;
    };
  }, [range.end_date, range.start_date, refreshSignal, token]);

  const hasNoWorkouts =
    muscleLoad !== null &&
    muscleLoad.totals.workout_count === 0 &&
    muscleLoad.by_muscle_group.length === 0;
  const hasThinEvidence =
    muscleLoad !== null &&
    muscleLoad.totals.workout_count > 0 &&
    (muscleLoad.totals.set_count === 0 ||
      muscleLoad.totals.total_weighted_volume === 0 ||
      muscleLoad.by_muscle_group.length === 0);
  const showContent =
    muscleLoad !== null && !hasNoWorkouts && !hasThinEvidence && !errorMessage;
  const strongestGroup = muscleLoad?.top_muscle_groups[0] ?? null;

  return (
    <Card>
      <div style={headerStyle}>
        <div>
          <div style={titleRowStyle}>
            <h2 style={titleStyle}>肌群负荷分析</h2>
            <Badge tone="analysis">肌群负荷</Badge>
          </div>
          <p style={copyStyle(theme)}>
            {muscleLoad
              ? `范围：${formatRangeLabel(muscleLoad.range.start_date, muscleLoad.range.end_date)}`
              : `范围：${formatRangeLabel(range.start_date, range.end_date)}`}
          </p>
          <p style={subtleStyle(theme)}>
            按动作关联肌群的贡献权重拆分训练容量，展示最近记录更集中在哪些肌群。
          </p>
        </div>

        <Button
          disabled={isLoading}
          onClick={() => void refresh()}
          type="button"
          variant="secondary"
        >
          {isLoading ? "刷新中..." : "刷新"}
        </Button>
      </div>

      {errorMessage ? (
        <StateNotice
          description="请确认后端服务已启动、登录状态有效，或稍后重试。"
          icon="chart"
          title="肌群负荷加载失败"
          tone="error"
        />
      ) : null}

      {isLoading && !muscleLoad ? (
        <p style={copyStyle(theme)}>正在加载肌群负荷分析...</p>
      ) : null}

      {hasNoWorkouts ? (
        <StateNotice
          description="最近还没有足够训练记录生成肌群负荷分析。完成 1-2 次包含重量和次数的训练后，这里会按动作-肌群贡献权重展示训练分布。"
          icon="chart"
          title="暂无肌群负荷数据"
        />
      ) : null}

      {hasThinEvidence ? (
        <StateNotice
          description="当前范围内已有训练记录，但还缺少可计算的有效组数或动作-肌群映射。继续记录包含重量和次数的训练后，这里会生成更稳定的肌群分布。"
          icon="chart"
          title="肌群证据还不够完整"
          tone="warning"
        />
      ) : null}

      {showContent && muscleLoad ? (
        <>
          <div style={statsGridStyle}>
            <StatCell
              label="训练次数"
              tone="accent"
              unit="次"
              value={`${muscleLoad.totals.workout_count}`}
            />
            <StatCell
              label="有效组数"
              tone="info"
              unit="组"
              value={`${muscleLoad.totals.set_count}`}
            />
            <StatCell
              label="原始容量"
              tone="analysis"
              unit="公斤"
              value={formatVolume(muscleLoad.totals.total_raw_volume)}
            />
            <StatCell
              label="加权容量"
              tone="warning"
              unit="公斤"
              value={formatVolume(muscleLoad.totals.total_weighted_volume)}
            />
          </div>

          {strongestGroup ? (
            <section style={calloutStyle(theme)}>
              <div>
                <p style={eyebrowStyle(theme)}>当前记录更集中于</p>
                <strong style={calloutTitleStyle(theme)}>
                  {strongestGroup.muscle_group_name}
                </strong>
              </div>
              <Pill tone="accent">
                {formatRatio(strongestGroup.contribution_ratio)}
              </Pill>
            </section>
          ) : null}

          <section style={sectionCardStyle(theme)}>
            <div style={sectionHeaderStyle}>
              <div>
                <h3 style={subheadingStyle}>肌群负荷排行</h3>
                <p style={sectionCopyStyle(theme)}>
                  加权容量越高，表示当前记录中分配到该肌群的训练容量越高。
                </p>
              </div>
              <Pill tone="analysis">
                {muscleLoad.totals.muscle_group_count} 个肌群
              </Pill>
            </div>

            <ul style={groupListStyle}>
              {muscleLoad.by_muscle_group.map((group) => (
                <MuscleLoadGroupRow
                  group={group}
                  key={group.muscle_group_id}
                  maxWeightedVolume={
                    muscleLoad.by_muscle_group[0]?.weighted_volume ?? 0
                  }
                />
              ))}
            </ul>
          </section>

          <div style={splitGridStyle}>
            <MuscleGroupSummaryCard
              groups={muscleLoad.top_muscle_groups}
              title="高占比肌群"
              tone="accent"
            />
            <MuscleGroupSummaryCard
              copy="这只表示最近记录中占比较低，不等同于医学或训练计划意义上的不足。"
              groups={muscleLoad.low_volume_muscle_groups}
              title="低占比肌群"
              tone="warning"
            />
          </div>

          <section style={sectionCardStyle(theme)}>
            <div style={sectionHeaderStyle}>
              <h3 style={subheadingStyle}>证据摘要</h3>
              <Pill tone="info">训练记录</Pill>
            </div>
            <div style={evidenceGridStyle}>
              <EvidenceCell
                label="关联训练"
                value={`${muscleLoad.evidence.workout_ids.length} 条`}
              />
              <EvidenceCell
                label="关联组数"
                value={`${muscleLoad.evidence.set_ids.length} 条`}
              />
              <EvidenceCell
                label="计算规则"
                value={`${muscleLoad.evidence.calculation_rules.length} 条`}
              />
              <EvidenceCell label="口径" value="加权容量" />
            </div>

            <details style={detailsStyle}>
              <summary style={summaryStyle(theme)}>查看计算规则</summary>
              <ul style={rulesListStyle(theme)}>
                {muscleLoad.evidence.calculation_rules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </details>
          </section>
        </>
      ) : null}
    </Card>
  );

  async function refresh(): Promise<void> {
    if (!token) {
      setErrorMessage("你必须先登录才能查看肌群负荷分析。");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const nextMuscleLoad = await getMuscleLoad(token, {
        endDate: range.end_date,
        startDate: range.start_date,
      });
      setMuscleLoad(nextMuscleLoad);
    } catch (error) {
      setMuscleLoad(null);
      setErrorMessage(getReadableErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }
}

interface MuscleLoadGroupRowProps {
  group: MuscleLoadGroup;
  maxWeightedVolume: number;
}

function MuscleLoadGroupRow(props: MuscleLoadGroupRowProps) {
  const { group, maxWeightedVolume } = props;
  const { theme } = useTheme();
  const barWidth =
    maxWeightedVolume > 0
      ? Math.max((group.weighted_volume / maxWeightedVolume) * 100, 4)
      : 0;

  return (
    <li style={groupRowStyle(theme)}>
      <div style={groupHeaderStyle}>
        <div>
          <strong style={groupNameStyle(theme)}>
            {group.muscle_group_name}
          </strong>
          <p style={groupMetaStyle(theme)}>
            {group.set_count.toLocaleString()} 组 ·{" "}
            {group.total_reps.toLocaleString()} 次
          </p>
        </div>
        <div style={groupMetricStyle}>
          <strong>{formatRatio(group.contribution_ratio)}</strong>
          <span>{formatVolume(group.weighted_volume)} 公斤</span>
        </div>
      </div>

      <div style={barTrackStyle(theme)}>
        <div style={barFillStyle(theme, barWidth)} />
      </div>

      {group.top_exercises.length > 0 ? (
        <div style={exerciseChipRowStyle}>
          {group.top_exercises.slice(0, 3).map((exercise) => (
            <span key={exercise.exercise_id} style={exerciseChipStyle(theme)}>
              {exercise.exercise_name} ·{" "}
              {formatVolume(exercise.weighted_volume)} 公斤
            </span>
          ))}
        </div>
      ) : (
        <p style={groupMetaStyle(theme)}>
          当前范围内还没有可展示的主要贡献动作。
        </p>
      )}
    </li>
  );
}

interface MuscleGroupSummaryCardProps {
  copy?: string | undefined;
  groups: MuscleLoadGroup[];
  title: string;
  tone: "accent" | "warning";
}

function MuscleGroupSummaryCard(props: MuscleGroupSummaryCardProps) {
  const { copy, groups, title, tone } = props;
  const { theme } = useTheme();

  return (
    <section style={sectionCardStyle(theme)}>
      <div style={sectionHeaderStyle}>
        <h3 style={subheadingStyle}>{title}</h3>
        <Pill tone={tone}>{groups.length} 项</Pill>
      </div>
      {copy ? <p style={sectionCopyStyle(theme)}>{copy}</p> : null}
      {groups.length === 0 ? (
        <p style={copyStyle(theme)}>当前范围内还没有足够数据形成这个列表。</p>
      ) : (
        <ul style={summaryListStyle}>
          {groups.slice(0, 3).map((group) => (
            <li key={group.muscle_group_id} style={summaryItemStyle(theme)}>
              <span>{group.muscle_group_name}</span>
              <strong>{formatRatio(group.contribution_ratio)}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface EvidenceCellProps {
  label: string;
  value: string;
}

function EvidenceCell(props: EvidenceCellProps) {
  const { theme } = useTheme();

  return (
    <div style={evidenceCellStyle(theme)}>
      <span style={evidenceLabelStyle(theme)}>{props.label}</span>
      <strong style={evidenceValueStyle(theme)}>{props.value}</strong>
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

  return "肌群负荷分析暂时不可用。";
}

function createDefaultRange(): MuscleLoadRange {
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
  return `${formatDisplayDate(startDate)} 至 ${formatDisplayDate(endDate)}`;
}

function formatDisplayDate(value: string): string {
  const [yearValue, monthValue, dayValue] = value.split("-");
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return value;
  }

  return new Date(year, month - 1, day).toLocaleDateString("zh-CN", {
    day: "numeric",
    month: "short",
  });
}

function formatVolume(value: number): string {
  return Math.round(value).toLocaleString();
}

function formatRatio(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

const headerStyle: React.CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  gap: 16,
  justifyContent: "space-between",
  marginBottom: 16,
};

const titleRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 8,
  marginBottom: 4,
};

const titleStyle: React.CSSProperties = {
  fontSize: 16,
  margin: 0,
};

const subheadingStyle: React.CSSProperties = {
  fontSize: 15,
  margin: 0,
};

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  marginBottom: 16,
};

const sectionHeaderStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
  marginBottom: 12,
};

const groupListStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  listStyle: "none",
  margin: 0,
  padding: 0,
};

const groupHeaderStyle: React.CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
};

const groupMetricStyle: React.CSSProperties = {
  display: "grid",
  gap: 2,
  justifyItems: "end",
  whiteSpace: "nowrap",
};

const exerciseChipRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  marginTop: 10,
};

const splitGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "1fr",
};

const evidenceGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
};

const detailsStyle: React.CSSProperties = {
  marginTop: 12,
};

const summaryListStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  listStyle: "none",
  margin: "12px 0 0",
  padding: 0,
};

function copyStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx2, fontSize: 12, lineHeight: 1.6, margin: 0 };
}

function subtleStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
    lineHeight: 1.6,
    margin: "0.35rem 0 0",
  };
}

function sectionCopyStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
    lineHeight: 1.6,
    margin: 0,
  };
}

function sectionCardStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    borderRadius: 14,
    marginTop: 16,
    padding: 14,
  };
}

function calloutStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    background: theme.isDark
      ? "linear-gradient(135deg, rgba(107,127,255,0.18), rgba(50,196,141,0.1))"
      : "linear-gradient(135deg, rgba(57,86,214,0.1), rgba(19,150,98,0.08))",
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 16,
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 16,
    padding: 14,
  };
}

function eyebrowStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
    letterSpacing: "0.06em",
    margin: "0 0 4px",
    textTransform: "uppercase",
  };
}

function calloutTitleStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontSize: 18,
  };
}

function groupRowStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 14,
    padding: 12,
  };
}

function groupNameStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontSize: 14,
  };
}

function groupMetaStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
    lineHeight: 1.5,
    margin: "4px 0 0",
  };
}

function barTrackStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    borderRadius: 999,
    height: 8,
    marginTop: 12,
    overflow: "hidden",
  };
}

function barFillStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  widthPercent: number,
): React.CSSProperties {
  return {
    background: `linear-gradient(90deg, ${theme.colors.ac}, ${theme.colors.blue})`,
    borderRadius: 999,
    height: "100%",
    width: `${widthPercent}%`,
  };
}

function exerciseChipStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 999,
    color: theme.colors.tx2,
    fontSize: 11,
    padding: "5px 8px",
  };
}

function summaryItemStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    alignItems: "center",
    backgroundColor: theme.colors.surf,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 12,
    color: theme.colors.tx2,
    display: "flex",
    fontSize: 12,
    justifyContent: "space-between",
    padding: "9px 10px",
  };
}

function evidenceCellStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: theme.radius.control,
    display: "grid",
    gap: 4,
    padding: 10,
  };
}

function evidenceLabelStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
  };
}

function evidenceValueStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontSize: 12,
    lineHeight: 1.5,
  };
}

function summaryStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.ac, fontSize: 12, fontWeight: 700 };
}

function rulesListStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    display: "grid",
    fontSize: 12,
    gap: 6,
    lineHeight: 1.6,
    margin: "0.75rem 0 0",
    paddingLeft: "1rem",
  };
}
