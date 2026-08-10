import { useCallback, useEffect, useMemo, useState } from "react";
import { CURRENT_PRIVACY_POLICY_VERSION } from "../../../../shared/src/consent";
import type {
  BodyMeasurementDto,
  SaveBodyMeasurementRequest,
} from "../../../../shared/src/personal-tools";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Input } from "../../components/Input";
import { SegmentedControl } from "../../components/SegmentedControl";
import { useTheme } from "../../theme/ThemeContext";
import {
  deleteAllBodyMeasurements,
  deleteBodyMeasurement,
  getBodyMeasurements,
  saveBodyMeasurement,
} from "./personal-tools-api";
import {
  convertWeight,
  formatLocalDate,
  type WeightUnit,
} from "./personal-tools-model";
import {
  HealthConsentNotice,
  InlineStatus,
  PersonalToolShell,
} from "./PersonalToolShell";

type BodyTab = "data" | "trend" | "calendar";

const MEASUREMENT_FIELDS = [
  ["weightKg", "体重", "weight"],
  ["targetWeightKg", "目标体重", "weight"],
  ["bodyFatPercent", "体脂率", "percent"],
  ["neckCm", "颈围", "cm"],
  ["shoulderCm", "肩宽", "cm"],
  ["chestCm", "胸围", "cm"],
  ["waistCm", "腰围", "cm"],
  ["hipCm", "臀围", "cm"],
  ["leftUpperArmCm", "左臂围", "cm"],
  ["rightUpperArmCm", "右臂围", "cm"],
  ["leftThighCm", "左腿围", "cm"],
  ["rightThighCm", "右腿围", "cm"],
  ["leftCalfCm", "左小腿", "cm"],
  ["rightCalfCm", "右小腿", "cm"],
] as const;

type MeasurementKey = (typeof MEASUREMENT_FIELDS)[number][0];
type FormValues = Record<MeasurementKey, string> & { measuredOn: string };

export function BodyMeasurementsView(props: {
  onBack: () => void;
  token: string | null;
}) {
  const { theme } = useTheme();
  const [items, setItems] = useState<BodyMeasurementDto[]>([]);
  const [tab, setTab] = useState<BodyTab>("data");
  const [unit, setUnit] = useState<WeightUnit>("kg");
  const [healthConsentOnFile, setHealthConsentOnFile] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormValues>(() => emptyForm());
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [confirmingDeleteAll, setConfirmingDeleteAll] = useState(false);

  const load = useCallback(async () => {
    setStatus(null);
    try {
      const result = await getBodyMeasurements(props.token);
      setItems(result.items);
      setHealthConsentOnFile(result.healthConsentOnFile);
    } catch {
      setStatus("身体数据暂时无法加载，请检查服务后重试。");
    }
  }, [props.token]);

  useEffect(() => {
    void load();
  }, [load]);

  const latest = items[0];

  function changeUnit(next: WeightUnit) {
    if (next === unit) return;
    setForm((current) => ({
      ...current,
      weightKg: convertInputWeight(current.weightKg, unit, next),
      targetWeightKg: convertInputWeight(current.targetWeightKg, unit, next),
    }));
    setUnit(next);
  }

  function openMeasurement(item?: BodyMeasurementDto) {
    setForm(item ? formFromMeasurement(item, unit) : emptyForm());
    setFormOpen(true);
    setStatus(null);
  }

  async function submitMeasurement() {
    if (!healthConsentOnFile && !consentAccepted) {
      setStatus("首次保存前，请先勾选健康数据的单独同意。");
      return;
    }

    const payload = buildPayload(form, unit);
    if (MEASUREMENT_FIELDS.every(([key]) => payload[key] == null)) {
      setStatus("请至少填写一项身体数据。");
      return;
    }

    setSaving(true);
    setStatus(null);
    try {
      const saved = await saveBodyMeasurement(props.token, {
        ...payload,
        ...(!healthConsentOnFile
          ? {
              sensitiveHealthConsent: {
                accepted: true,
                policy_version: CURRENT_PRIVACY_POLICY_VERSION,
              },
            }
          : {}),
      });
      setItems((current) =>
        [saved, ...current.filter((item) => item.id !== saved.id)].sort(
          (a, b) => b.measuredOn.localeCompare(a.measuredOn),
        ),
      );
      setHealthConsentOnFile(true);
      setConsentAccepted(false);
      setFormOpen(false);
      setStatus("身体数据已保存。");
    } catch {
      setStatus("身体数据没有保存成功，请稍后重试。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PersonalToolShell
      description="按日期保存体重、体脂率与围度，支持公斤和斤"
      onBack={props.onBack}
      title="身体数据"
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: 8,
          justifyContent: "space-between",
        }}
      >
        <SegmentedControl
          label="身体数据视图"
          onChange={setTab}
          options={[
            { label: "数据", value: "data" },
            { label: "趋势", value: "trend" },
            { label: "日历", value: "calendar" },
          ]}
          value={tab}
        />
        <div style={{ display: "flex", flex: "0 0 auto", gap: 4 }}>
          {(["kg", "jin"] as const).map((value) => (
            <button
              aria-pressed={unit === value}
              key={value}
              onClick={() => changeUnit(value)}
              style={unitButtonStyle(theme, unit === value)}
              type="button"
            >
              {value === "kg" ? "公斤" : "斤"}
            </button>
          ))}
        </div>
      </div>

      {tab === "data" ? (
        <DataPanel
          items={items}
          latest={latest}
          onDelete={setDeleteId}
          onEdit={openMeasurement}
          unit={unit}
        />
      ) : tab === "trend" ? (
        <TrendPanel items={items} unit={unit} />
      ) : (
        <BodyCalendar items={items} unit={unit} />
      )}

      {!healthConsentOnFile ? (
        <HealthConsentNotice
          accepted={consentAccepted}
          onChange={setConsentAccepted}
        />
      ) : null}

      {formOpen ? (
        <Card>
          <div style={{ display: "grid", gap: 12 }}>
            <div
              style={{
                alignItems: "center",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <strong style={{ fontSize: 14 }}>记录身体数据</strong>
              <button
                onClick={() => setFormOpen(false)}
                style={textButtonStyle(theme)}
                type="button"
              >
                收起
              </button>
            </div>
            <label style={labelStyle(theme)}>
              日期
              <Input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    measuredOn: event.target.value,
                  }))
                }
                type="date"
                value={form.measuredOn}
              />
            </label>
            <div
              style={{
                display: "grid",
                gap: 10,
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              }}
            >
              {MEASUREMENT_FIELDS.map(([key, label, kind]) => (
                <label key={key} style={labelStyle(theme)}>
                  {label}（
                  {kind === "weight"
                    ? unit === "kg"
                      ? "公斤"
                      : "斤"
                    : kind === "percent"
                      ? "%"
                      : "cm"}
                  ）
                  <Input
                    inputMode="decimal"
                    min="0"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                    placeholder="—"
                    step="0.1"
                    type="number"
                    value={form[key]}
                  />
                </label>
              ))}
            </div>
            <Button disabled={saving} onClick={() => void submitMeasurement()}>
              {saving ? "保存中…" : "保存这一天"}
            </Button>
          </div>
        </Card>
      ) : (
        <Button onClick={() => openMeasurement()}>新增身体数据</Button>
      )}

      {deleteId ? (
        <Card>
          <div style={{ display: "grid", gap: 9 }}>
            <InlineStatus>确认删除这条身体数据？</InlineStatus>
            <div
              style={{
                display: "grid",
                gap: 8,
                gridTemplateColumns: "1fr 1fr",
              }}
            >
              <Button onClick={() => setDeleteId(null)} variant="secondary">
                取消
              </Button>
              <Button
                onClick={() => {
                  void deleteBodyMeasurement(props.token, deleteId)
                    .then(() => {
                      setItems((current) =>
                        current.filter((item) => item.id !== deleteId),
                      );
                      setDeleteId(null);
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
      ) : null}

      {status ? (
        <InlineStatus tone={status.includes("已保存") ? "success" : "error"}>
          {status}
        </InlineStatus>
      ) : null}

      {items.length > 0 ? (
        confirmingDeleteAll ? (
          <Card>
            <div style={{ display: "grid", gap: 9 }}>
              <InlineStatus>
                删除全部身体数据？训练记录不会被删除。
              </InlineStatus>
              <div
                style={{
                  display: "grid",
                  gap: 8,
                  gridTemplateColumns: "1fr 1fr",
                }}
              >
                <Button
                  onClick={() => setConfirmingDeleteAll(false)}
                  variant="secondary"
                >
                  取消
                </Button>
                <Button
                  onClick={() => {
                    void deleteAllBodyMeasurements(props.token)
                      .then(() => {
                        setItems([]);
                        setHealthConsentOnFile(false);
                        setConfirmingDeleteAll(false);
                      })
                      .catch(() => setStatus("删除失败，请稍后重试。"));
                  }}
                  style={{ background: theme.colors.red, color: "#fff" }}
                >
                  全部删除
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <button
            onClick={() => setConfirmingDeleteAll(true)}
            style={{ ...textButtonStyle(theme), color: theme.colors.red }}
            type="button"
          >
            删除全部身体数据
          </button>
        )
      ) : null}
    </PersonalToolShell>
  );
}

function DataPanel(props: {
  items: BodyMeasurementDto[];
  latest: BodyMeasurementDto | undefined;
  onDelete: (id: string) => void;
  onEdit: (item: BodyMeasurementDto) => void;
  unit: WeightUnit;
}) {
  const { theme } = useTheme();
  return (
    <>
      <div
        style={{
          display: "grid",
          gap: 8,
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        }}
      >
        <SummaryCard
          label="当前体重"
          value={formatWeight(props.latest?.weightKg, props.unit)}
        />
        <SummaryCard
          label="目标体重"
          value={formatWeight(props.latest?.targetWeightKg, props.unit)}
        />
        <SummaryCard
          label="体脂率"
          value={
            props.latest?.bodyFatPercent == null
              ? "—"
              : `${props.latest.bodyFatPercent}%`
          }
        />
      </div>
      <Card>
        <div style={{ display: "grid", gap: 9 }}>
          <strong style={{ fontSize: 14 }}>最近记录</strong>
          {props.items.length === 0 ? (
            <InlineStatus>还没有身体数据，先记录一次作为基线。</InlineStatus>
          ) : (
            props.items.slice(0, 8).map((item) => (
              <div
                key={item.id}
                style={{
                  alignItems: "center",
                  borderTop: `1px solid ${theme.colors.divider}`,
                  display: "flex",
                  gap: 8,
                  paddingTop: 9,
                }}
              >
                <button
                  onClick={() => props.onEdit(item)}
                  style={{
                    ...textButtonStyle(theme),
                    flex: 1,
                    textAlign: "left",
                  }}
                  type="button"
                >
                  <strong style={{ color: theme.colors.tx, display: "block" }}>
                    {item.measuredOn}
                  </strong>
                  <span style={{ color: theme.colors.tx2, fontSize: 11 }}>
                    {formatWeight(item.weightKg, props.unit)} ·{" "}
                    {item.bodyFatPercent == null
                      ? "体脂未填"
                      : `体脂 ${item.bodyFatPercent}%`}{" "}
                    · {summarizeCircumferences(item)}
                  </span>
                </button>
                <button
                  onClick={() => props.onDelete(item.id)}
                  style={{ ...textButtonStyle(theme), color: theme.colors.red }}
                  type="button"
                >
                  删除
                </button>
              </div>
            ))
          )}
        </div>
      </Card>
    </>
  );
}

function TrendPanel(props: { items: BodyMeasurementDto[]; unit: WeightUnit }) {
  const { theme } = useTheme();
  const points = props.items
    .filter((item) => item.weightKg !== null)
    .slice(0, 10)
    .reverse();
  const weights = points.map((item) => item.weightKg ?? 0);
  const min = Math.min(...weights, 0);
  const max = Math.max(...weights, 1);

  return (
    <Card>
      <div style={{ display: "grid", gap: 12 }}>
        <strong style={{ fontSize: 14 }}>体重趋势</strong>
        {points.length < 2 ? (
          <InlineStatus>至少记录两次体重后，这里会显示变化趋势。</InlineStatus>
        ) : (
          points.map((point) => {
            const value = point.weightKg ?? 0;
            return (
              <div key={point.id} style={{ display: "grid", gap: 4 }}>
                <div
                  style={{
                    color: theme.colors.tx2,
                    display: "flex",
                    fontSize: 11,
                    justifyContent: "space-between",
                  }}
                >
                  <span>{point.measuredOn}</span>
                  <strong style={{ color: theme.colors.tx }}>
                    {formatWeight(value, props.unit)}
                  </strong>
                </div>
                <meter
                  max={max}
                  min={Math.max(0, min - 5)}
                  style={{ accentColor: theme.colors.ac, width: "100%" }}
                  value={value}
                />
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

function BodyCalendar(props: {
  items: BodyMeasurementDto[];
  unit: WeightUnit;
}) {
  const { theme } = useTheme();
  const [month, setMonth] = useState(() => new Date());
  const cells = useMemo(() => buildCalendar(month), [month]);
  const byDate = new Map(props.items.map((item) => [item.measuredOn, item]));
  return (
    <Card>
      <div style={{ display: "grid", gap: 10 }}>
        <div
          style={{
            alignItems: "center",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <button
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
            style={textButtonStyle(theme)}
            type="button"
          >
            上月
          </button>
          <strong>
            {month.getFullYear()} 年 {month.getMonth() + 1} 月
          </strong>
          <button
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
            style={textButtonStyle(theme)}
            type="button"
          >
            下月
          </button>
        </div>
        <div
          style={{
            display: "grid",
            gap: 4,
            gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          }}
        >
          {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
            <span
              key={day}
              style={{
                color: theme.colors.tx2,
                fontSize: 10,
                textAlign: "center",
              }}
            >
              {day}
            </span>
          ))}
          {cells.map((cell) => {
            const item = byDate.get(cell.key);
            return (
              <div
                key={cell.key}
                style={{
                  background: item ? theme.colors.surf2 : "transparent",
                  border: `1px solid ${item ? theme.colors.bdr : "transparent"}`,
                  borderRadius: 8,
                  display: "grid",
                  fontSize: 10,
                  gap: 2,
                  minHeight: 48,
                  opacity: cell.current ? 1 : 0.22,
                  padding: 4,
                  textAlign: "center",
                }}
              >
                <span>{cell.day}</span>
                {item?.weightKg != null ? (
                  <strong style={{ color: theme.colors.ac, fontSize: 9 }}>
                    {formatWeight(item.weightKg, props.unit)
                      .replace(" 公斤", "")
                      .replace(" 斤", "")}
                  </strong>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function SummaryCard(props: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <div
      style={{
        background: theme.colors.surf,
        border: `1px solid ${theme.colors.bdr}`,
        borderRadius: 14,
        padding: "12px 10px",
      }}
    >
      <span style={{ color: theme.colors.tx2, display: "block", fontSize: 10 }}>
        {props.label}
      </span>
      <strong style={{ display: "block", fontSize: 15, marginTop: 5 }}>
        {props.value}
      </strong>
    </div>
  );
}

function emptyForm(): FormValues {
  return {
    measuredOn: formatLocalDate(new Date()),
    weightKg: "",
    targetWeightKg: "",
    bodyFatPercent: "",
    neckCm: "",
    shoulderCm: "",
    chestCm: "",
    waistCm: "",
    hipCm: "",
    leftUpperArmCm: "",
    rightUpperArmCm: "",
    leftThighCm: "",
    rightThighCm: "",
    leftCalfCm: "",
    rightCalfCm: "",
  };
}

function formFromMeasurement(
  item: BodyMeasurementDto,
  unit: WeightUnit,
): FormValues {
  const form = emptyForm();
  form.measuredOn = item.measuredOn;
  for (const [key, , kind] of MEASUREMENT_FIELDS) {
    const value = item[key];
    form[key] =
      value == null
        ? ""
        : `${kind === "weight" ? convertWeight(value, "kg", unit) : value}`;
  }
  return form;
}

function buildPayload(
  form: FormValues,
  unit: WeightUnit,
): SaveBodyMeasurementRequest {
  const payload: SaveBodyMeasurementRequest = { measuredOn: form.measuredOn };
  for (const [key, , kind] of MEASUREMENT_FIELDS) {
    const raw = form[key].trim();
    const parsed = raw === "" ? null : Number(raw);
    payload[key] =
      parsed == null || !Number.isFinite(parsed)
        ? null
        : kind === "weight"
          ? convertWeight(parsed, unit, "kg")
          : parsed;
  }
  return payload;
}

function formatWeight(
  value: number | null | undefined,
  unit: WeightUnit,
): string {
  if (value == null) return "—";
  const shown = convertWeight(value, "kg", unit);
  return `${shown.toFixed(1)} ${unit === "kg" ? "公斤" : "斤"}`;
}

function convertInputWeight(value: string, from: WeightUnit, to: WeightUnit) {
  const parsed = Number(value);
  return value.trim() === "" || !Number.isFinite(parsed)
    ? value
    : `${convertWeight(parsed, from, to)}`;
}

function summarizeCircumferences(item: BodyMeasurementDto) {
  const values = MEASUREMENT_FIELDS.filter(([, , kind]) => kind === "cm")
    .map(([key, label]) =>
      item[key] == null ? null : `${label} ${item[key]}cm`,
    )
    .filter(Boolean);
  return values.slice(0, 2).join(" · ") || "围度未填";
}

function buildCalendar(month: Date) {
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

function labelStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return { color: theme.colors.tx2, display: "grid", fontSize: 11, gap: 5 };
}

function unitButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  active: boolean,
): React.CSSProperties {
  return {
    background: active ? theme.colors.ac : theme.colors.surf2,
    border: `1px solid ${active ? theme.colors.ac : theme.colors.bdr}`,
    borderRadius: 9,
    color: active ? theme.colors.acText : theme.colors.tx2,
    cursor: "pointer",
    fontSize: 10,
    padding: "7px 8px",
  };
}

function textButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: "transparent",
    border: "none",
    color: theme.colors.tx2,
    cursor: "pointer",
    fontSize: 11,
    padding: 4,
  };
}
