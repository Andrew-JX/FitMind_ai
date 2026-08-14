import { useCallback, useEffect, useState } from "react";
import type { TrainingMemoDto } from "../../../../shared/src/personal-tools";

import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Input } from "../../components/Input";
import { useTheme } from "../../theme/ThemeContext";
import {
  createTrainingMemo,
  deleteTrainingMemo,
  getTrainingMemos,
  updateTrainingMemo,
} from "./personal-tools-api";
import { InlineStatus, PersonalToolShell } from "./PersonalToolShell";

type LoadState = "loading" | "ready" | "error";

export function TrainingMemosView(props: {
  onBack: () => void;
  token: string | null;
}) {
  const { theme } = useTheme();
  const [items, setItems] = useState<TrainingMemoDto[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  const load = useCallback(async () => {
    setLoadState("loading");
    setStatus(null);
    try {
      setItems(await getTrainingMemos(props.token));
      setLoadState("ready");
    } catch {
      setStatus("训练备忘录暂时无法加载，请检查服务后重试。");
      setLoadState("error");
    }
  }, [props.token]);

  useEffect(() => {
    void load();
  }, [load]);

  function openEditor(item?: TrainingMemoDto) {
    setEditingId(item?.id ?? null);
    setTitle(item?.title ?? "");
    setContent(item?.content ?? "");
    setEditorOpen(true);
    setStatus(null);
  }

  async function saveMemo() {
    if (title.trim() === "" || content.trim() === "") {
      setStatus("标题和内容都需要填写。");
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const saved = editingId
        ? await updateTrainingMemo(props.token, editingId, {
            title: title.trim(),
            content: content.trim(),
          })
        : await createTrainingMemo(props.token, {
            title: title.trim(),
            content: content.trim(),
          });
      setItems((current) =>
        sortMemos([saved, ...current.filter((item) => item.id !== saved.id)]),
      );
      setEditorOpen(false);
      setStatus("备忘录已保存。");
    } catch {
      setStatus("备忘录没有保存成功，请稍后重试。");
    } finally {
      setSaving(false);
    }
  }

  async function togglePinned(item: TrainingMemoDto) {
    try {
      const updated = await updateTrainingMemo(props.token, item.id, {
        isPinned: !item.isPinned,
      });
      setItems((current) =>
        sortMemos(
          current.map((entry) => (entry.id === updated.id ? updated : entry)),
        ),
      );
    } catch {
      setStatus("置顶状态没有保存成功。");
    }
  }

  return (
    <PersonalToolShell
      description="记录动作提示、下次训练安排与临时想法"
      onBack={props.onBack}
      title="训练备忘录"
    >
      {editorOpen ? (
        <Card>
          <div style={{ display: "grid", gap: 10 }}>
            <strong style={{ fontSize: 14 }}>
              {editingId ? "编辑备忘录" : "新建备忘录"}
            </strong>
            <label
              style={{
                color: theme.colors.tx2,
                display: "grid",
                fontSize: 11,
                gap: 5,
              }}
            >
              标题
              <Input
                maxLength={80}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="例如：下次练胸"
                value={title}
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
              内容
              <textarea
                maxLength={4000}
                onChange={(event) => setContent(event.target.value)}
                placeholder="记录要调整的重量、动作顺序或技术提示…"
                rows={7}
                style={{
                  background: theme.colors.surf2,
                  border: `1px solid ${theme.colors.bdr}`,
                  borderRadius: 12,
                  color: theme.colors.tx,
                  font: "inherit",
                  lineHeight: 1.6,
                  padding: "10px 12px",
                  resize: "vertical",
                  width: "100%",
                }}
                value={content}
              />
            </label>
            <div
              style={{
                display: "grid",
                gap: 8,
                gridTemplateColumns: "1fr 1fr",
              }}
            >
              <Button onClick={() => setEditorOpen(false)} variant="secondary">
                取消
              </Button>
              <Button disabled={saving} onClick={() => void saveMemo()}>
                {saving ? "保存中…" : "保存"}
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Button onClick={() => openEditor()}>新增备忘录</Button>
      )}

      {status ? (
        <InlineStatus tone={status.includes("已保存") ? "success" : "error"}>
          {status}
        </InlineStatus>
      ) : null}

      {loadState === "loading" ? (
        <Card>
          <InlineStatus>正在加载训练备忘录…</InlineStatus>
        </Card>
      ) : null}

      {loadState === "error" ? (
        <Button onClick={() => void load()} variant="secondary">
          重试加载训练备忘录
        </Button>
      ) : null}

      {loadState === "ready" && items.length === 0 && !editorOpen ? (
        <Card>
          <div style={{ padding: "18px 4px", textAlign: "center" }}>
            <strong style={{ display: "block", fontSize: 14 }}>
              还没有备忘录
            </strong>
            <span
              style={{
                color: theme.colors.tx2,
                display: "block",
                fontSize: 11,
                marginTop: 5,
              }}
            >
              记下训练前后容易忘的细节，下次打开就能接着看。
            </span>
          </div>
        </Card>
      ) : loadState === "ready" && items.length > 0 ? (
        items.map((item) => (
          <Card key={item.id}>
            <div style={{ display: "grid", gap: 9 }}>
              <div
                style={{ alignItems: "flex-start", display: "flex", gap: 8 }}
              >
                <button
                  onClick={() => openEditor(item)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: theme.colors.tx,
                    cursor: "pointer",
                    flex: 1,
                    padding: 0,
                    textAlign: "left",
                  }}
                  type="button"
                >
                  <strong style={{ display: "block", fontSize: 14 }}>
                    {item.title}
                  </strong>
                  <span
                    style={{
                      color: theme.colors.tx2,
                      display: "-webkit-box",
                      fontSize: 12,
                      lineHeight: 1.6,
                      marginTop: 5,
                      overflow: "hidden",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: 3,
                    }}
                  >
                    {item.content}
                  </span>
                </button>
                {item.isPinned ? (
                  <span
                    style={{
                      background: theme.colors.ac,
                      borderRadius: 999,
                      color: theme.colors.acText,
                      fontSize: 9,
                      fontWeight: 800,
                      padding: "4px 7px",
                    }}
                  >
                    置顶
                  </span>
                ) : null}
              </div>
              <div
                style={{
                  alignItems: "center",
                  borderTop: `1px solid ${theme.colors.divider}`,
                  display: "flex",
                  justifyContent: "space-between",
                  paddingTop: 8,
                }}
              >
                <span style={{ color: theme.colors.tx3, fontSize: 10 }}>
                  更新于 {formatTimestamp(item.updatedAt)}
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => void togglePinned(item)}
                    style={smallButtonStyle(theme)}
                    type="button"
                  >
                    {item.isPinned ? "取消置顶" : "置顶"}
                  </button>
                  <button
                    onClick={() => setDeleteId(item.id)}
                    style={{
                      ...smallButtonStyle(theme),
                      color: theme.colors.red,
                    }}
                    type="button"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          </Card>
        ))
      ) : null}

      {deleteId ? (
        <Card>
          <div style={{ display: "grid", gap: 9 }}>
            <InlineStatus>确认删除这条备忘录？</InlineStatus>
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
                  void deleteTrainingMemo(props.token, deleteId)
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
    </PersonalToolShell>
  );
}

function sortMemos(items: TrainingMemoDto[]) {
  return [...items].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("zh-CN", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
}

function smallButtonStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    background: "transparent",
    border: "none",
    color: theme.colors.tx2,
    cursor: "pointer",
    fontSize: 10,
    padding: 2,
  };
}
