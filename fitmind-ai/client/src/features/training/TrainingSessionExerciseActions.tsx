import { useEffect, useRef, useState } from "react";

import type { DraftExercise } from "./training-session-draft";

import { Pill } from "../../components/Pill";
import { useTheme } from "../../theme/ThemeContext";
import {
  formatWeight,
  getExerciseDisplayName,
} from "./exercise-display";
import { getExerciseSummary } from "./training-session-draft";

export interface TrainingSessionExerciseActionsProps {
  canMoveDown: boolean;
  canMoveUp: boolean;
  draftExercise: DraftExercise;
  onMoveDown: () => void;
  onMoveUp: () => void;
  onOpenChange?: ((isOpen: boolean) => void) | undefined;
  onRemove: () => void;
  onReplace: () => void;
}

interface MenuPosition {
  placement: "above" | "below";
}

export function TrainingSessionExerciseActions(props: TrainingSessionExerciseActionsProps) {
  const { theme } = useTheme();
  const { onOpenChange } = props;
  const actionRootRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({ placement: "below" });
  const summary = getExerciseSummary(props.draftExercise);

  useEffect(() => {
    onOpenChange?.(isMenuOpen || isDetailOpen);
  }, [isDetailOpen, isMenuOpen, onOpenChange]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const targetNode = event.target;

      if (!(targetNode instanceof Node)) {
        return;
      }

      if (
        menuRef.current?.contains(targetNode) ||
        menuButtonRef.current?.contains(targetNode) ||
        actionRootRef.current?.contains(targetNode)
      ) {
        return;
      }

      setIsMenuOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    const updateMenuPosition = () => {
      setMenuPosition(getMenuPosition(menuButtonRef.current));
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isMenuOpen]);

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      ref={actionRootRef}
      style={actionRootStyle}
    >
      <button
        aria-expanded={isMenuOpen}
        aria-label="动作设置"
        ref={menuButtonRef}
        onClick={(event) => {
          event.stopPropagation();
          setIsMenuOpen((currentValue) => {
            if (!currentValue) {
              setMenuPosition(getMenuPosition(menuButtonRef.current));
            }

            return !currentValue;
          });
        }}
        style={menuButtonStyle(theme)}
        type="button"
      >
        ⋯
      </button>

      {isMenuOpen ? (
        <div ref={menuRef} style={menuStyle(theme, menuPosition)} role="menu">
          <strong style={menuTitleStyle(theme)}>动作设置</strong>
          <button
            onClick={() => {
              setIsDetailOpen(true);
              setIsMenuOpen(false);
            }}
            style={menuItemStyle(theme)}
            type="button"
          >
            查看动作详情
          </button>
          <button
            onClick={() => {
              setIsMenuOpen(false);
              props.onReplace();
            }}
            style={menuItemStyle(theme)}
            type="button"
          >
            替换动作
          </button>
          <button
            disabled={!props.canMoveUp}
            onClick={() => {
              setIsMenuOpen(false);
              props.onMoveUp();
            }}
            style={menuItemStyle(theme, !props.canMoveUp)}
            type="button"
          >
            上移
          </button>
          <button
            disabled={!props.canMoveDown}
            onClick={() => {
              setIsMenuOpen(false);
              props.onMoveDown();
            }}
            style={menuItemStyle(theme, !props.canMoveDown)}
            type="button"
          >
            下移
          </button>
          <button
            onClick={() => {
              setIsMenuOpen(false);
              props.onRemove();
            }}
            style={dangerMenuItemStyle(theme)}
            type="button"
          >
            移除动作
          </button>
        </div>
      ) : null}

      {isDetailOpen ? (
        <div
          onClick={() => setIsDetailOpen(false)}
          style={detailBackdropStyle(theme)}
        >
          <section
            onClick={(event) => event.stopPropagation()}
            style={detailCardStyle(theme)}
          >
            <header style={detailHeaderStyle}>
              <div>
                <h3 style={detailTitleStyle(theme)}>{props.draftExercise.name}</h3>
                {props.draftExercise.exercise ? (
                  <p style={detailSubtitleStyle(theme)}>
                    {getExerciseDisplayName(props.draftExercise.exercise)}
                  </p>
                ) : null}
              </div>
              <button
                aria-label="关闭动作详情"
                onClick={() => setIsDetailOpen(false)}
                style={closeButtonStyle(theme)}
                type="button"
              >
                ×
              </button>
            </header>

            <div style={detailGridStyle}>
              <div style={detailRowStyle(theme)}>
                <span>分类</span>
                <Pill tone="info">{props.draftExercise.categoryLabel}</Pill>
              </div>
              <div style={detailRowStyle(theme)}>
                <span>动作来源</span>
                <strong>系统动作库</strong>
              </div>
              <div style={detailRowStyle(theme)}>
                <span>本次训练</span>
                <strong>
                  {summary.completedSets} 组 · 总容量 {formatWeight(formatVolume(summary.totalVolumeKg))}
                </strong>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function formatVolume(totalVolumeKg: number): string {
  if (Number.isInteger(totalVolumeKg)) {
    return `${totalVolumeKg}`;
  }

  return totalVolumeKg.toFixed(2);
}

function getMenuPosition(buttonElement: HTMLButtonElement | null): MenuPosition {
  if (!buttonElement) {
    return {
      placement: "below",
    };
  }

  const rect = buttonElement.getBoundingClientRect();
  const estimatedMenuHeight = 248;
  const viewportPadding = 12;
  const hasRoomBelow = window.innerHeight - rect.bottom >= estimatedMenuHeight + viewportPadding;

  return {
    placement: hasRoomBelow ? "below" : "above",
  };
}

const actionRootStyle: React.CSSProperties = {
  position: "absolute",
  right: 12,
  top: 12,
  zIndex: 2,
};

function menuButtonStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    alignItems: "center",
    backgroundColor: theme.colors.surf2,
    border: `1px solid ${theme.colors.bdr}`,
    borderRadius: 10,
    color: theme.colors.tx2,
    cursor: "pointer",
    display: "inline-flex",
    fontSize: 18,
    fontWeight: 800,
    height: 32,
    justifyContent: "center",
    lineHeight: 1,
    padding: 0,
    width: 32,
  };
}

function menuStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  position: MenuPosition,
): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf,
    border: `1px solid ${theme.colors.bdr2}`,
    borderRadius: theme.radius.control,
    boxShadow: theme.shadows.card,
    display: "grid",
    gap: 4,
    minWidth: 176,
    padding: 8,
    position: "absolute",
    right: 0,
    ...(position.placement === "below"
      ? { top: "calc(100% + 6px)" }
      : { bottom: "calc(100% + 6px)" }),
    zIndex: 220,
  };
}

function menuTitleStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
    padding: "4px 8px 6px",
  };
}

function menuItemStyle(
  theme: ReturnType<typeof useTheme>["theme"],
  disabled = false,
): React.CSSProperties {
  return {
    background: "transparent",
    border: "none",
    borderRadius: 8,
    color: disabled ? theme.colors.tx3 : theme.colors.tx,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
    fontWeight: 600,
    opacity: disabled ? 0.52 : 1,
    padding: "9px 8px",
    textAlign: "left",
  };
}

function dangerMenuItemStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    ...menuItemStyle(theme),
    color: theme.colors.red,
  };
}

function detailBackdropStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    alignItems: "end",
    backgroundColor: theme.isDark ? "rgba(0,0,0,0.42)" : "rgba(0,0,0,0.24)",
    display: "flex",
    inset: 0,
    justifyContent: "center",
    padding: 12,
    position: "fixed",
    zIndex: 240,
  };
}

function detailCardStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    backgroundColor: theme.colors.surf,
    border: `1px solid ${theme.colors.bdr2}`,
    borderRadius: theme.radius.card,
    color: theme.colors.tx,
    display: "grid",
    gap: 16,
    maxWidth: 358,
    padding: 16,
    width: "100%",
  };
}

const detailHeaderStyle: React.CSSProperties = {
  alignItems: "start",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
};

function detailTitleStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontSize: 18,
    lineHeight: 1.25,
    margin: 0,
  };
}

function detailSubtitleStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    color: theme.colors.tx2,
    fontSize: 12,
    lineHeight: 1.5,
    margin: "6px 0 0",
  };
}

const detailGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

function detailRowStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    alignItems: "center",
    backgroundColor: theme.colors.surf2,
    borderRadius: theme.radius.control,
    color: theme.colors.tx2,
    display: "flex",
    fontSize: 12,
    justifyContent: "space-between",
    padding: "10px 12px",
  };
}

function closeButtonStyle(theme: ReturnType<typeof useTheme>["theme"]): React.CSSProperties {
  return {
    background: "transparent",
    border: "none",
    color: theme.colors.tx3,
    cursor: "pointer",
    fontSize: 22,
    lineHeight: 1,
    padding: 0,
  };
}
