import { useMemo, useState } from "react";

import { Card } from "../../components/Card";
import { Input } from "../../components/Input";
import { useTheme } from "../../theme/ThemeContext";
import {
  buildRmLoadTable,
  calculateEpleyOneRepMax,
  convertWeight,
  roundToHalf,
  type WeightUnit,
} from "./personal-tools-model";
import { InlineStatus, PersonalToolShell } from "./PersonalToolShell";

export function RmCalculatorView(props: { onBack: () => void }) {
  const { theme } = useTheme();
  const [unit, setUnit] = useState<WeightUnit>("kg");
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("8");
  const numericWeight = Number(weight);
  const numericReps = Number(reps);
  const estimate = useMemo(
    () => calculateEpleyOneRepMax(numericWeight, numericReps),
    [numericReps, numericWeight],
  );
  const loads = useMemo(() => buildRmLoadTable(estimate), [estimate]);

  function changeUnit(next: WeightUnit) {
    if (next === unit) return;
    const parsed = Number(weight);
    if (weight.trim() !== "" && Number.isFinite(parsed)) {
      setWeight(`${roundToHalf(convertWeight(parsed, unit, next))}`);
    }
    setUnit(next);
  }

  return (
    <PersonalToolShell
      description="输入一次真实完成的重量和次数，估算 1RM 与训练负荷"
      onBack={props.onBack}
      title="RM 计算器"
    >
      <Card>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
            {(["kg", "jin"] as const).map((value) => (
              <button
                aria-pressed={unit === value}
                key={value}
                onClick={() => changeUnit(value)}
                style={{
                  background:
                    unit === value ? theme.colors.ac : theme.colors.surf2,
                  border: `1px solid ${unit === value ? theme.colors.ac : theme.colors.bdr}`,
                  borderRadius: 9,
                  color:
                    unit === value ? theme.colors.acText : theme.colors.tx2,
                  cursor: "pointer",
                  fontSize: 11,
                  padding: "7px 10px",
                }}
                type="button"
              >
                {value === "kg" ? "公斤" : "斤"}
              </button>
            ))}
          </div>
          <div
            style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}
          >
            <label
              style={{
                color: theme.colors.tx2,
                display: "grid",
                fontSize: 11,
                gap: 5,
              }}
            >
              完成重量（{unit === "kg" ? "公斤" : "斤"}）
              <Input
                inputMode="decimal"
                min="0"
                onChange={(event) => setWeight(event.target.value)}
                placeholder="例如 80"
                step="0.5"
                type="number"
                value={weight}
              />
            </label>
            <label
              style={{
                color: theme.colors.tx2,
                display: "grid",
                fontSize: 11,
                gap: 5,
              }}
            >
              完成次数（1–12）
              <Input
                inputMode="numeric"
                max="12"
                min="1"
                onChange={(event) => setReps(event.target.value)}
                step="1"
                type="number"
                value={reps}
              />
            </label>
          </div>
        </div>
      </Card>

      {estimate > 0 ? (
        <>
          <Card>
            <div style={{ textAlign: "center" }}>
              <span
                style={{
                  color: theme.colors.tx2,
                  display: "block",
                  fontSize: 11,
                }}
              >
                Epley 估算 1RM
              </span>
              <strong
                style={{
                  color: theme.colors.ac,
                  display: "block",
                  fontSize: 28,
                  marginTop: 6,
                }}
              >
                {roundToHalf(estimate).toFixed(1)}{" "}
                {unit === "kg" ? "公斤" : "斤"}
              </strong>
            </div>
          </Card>
          <Card>
            <div style={{ display: "grid", gap: 10 }}>
              <strong style={{ fontSize: 14 }}>训练负荷参考</strong>
              <div
                style={{
                  display: "grid",
                  gap: 7,
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                }}
              >
                {loads.map((item) => (
                  <div
                    key={item.percentage}
                    style={{
                      background: theme.colors.soft,
                      borderRadius: 10,
                      padding: "9px 6px",
                      textAlign: "center",
                    }}
                  >
                    <span
                      style={{
                        color: theme.colors.tx2,
                        display: "block",
                        fontSize: 10,
                      }}
                    >
                      {item.percentage}%
                    </span>
                    <strong
                      style={{ display: "block", fontSize: 12, marginTop: 3 }}
                    >
                      {item.weight.toFixed(1)}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </>
      ) : (
        <Card>
          <InlineStatus>
            填写重量与 1–12
            次的有效次数后，会立即显示估算结果。计算值仅作训练安排参考，不代表测试成绩。
          </InlineStatus>
        </Card>
      )}
    </PersonalToolShell>
  );
}
