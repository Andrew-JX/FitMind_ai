import { useRef, useState } from "react";

export type FabAction = "voice" | "library";

export interface UseFabGestureOptions {
  /** Fired when an action is chosen by swipe-release, satellite tap, or quick tap. */
  onSelect: (action: FabAction) => void;
}

export interface UseFabGestureResult {
  /** Whether the speed-dial is split open. */
  isOpen: boolean;
  /** Action currently targeted by an in-progress swipe, or null. */
  activeAction: FabAction | null;
  /** Collapse the speed-dial back into a single button. */
  close: () => void;
  /** Choose an action (used by the satellite buttons); also collapses. */
  select: (action: FabAction) => void;
  buttonHandlers: {
    onClick: () => void;
    onPointerCancel: () => void;
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
  };
}

const LONG_PRESS_MS = 200;
const OPEN_MOVE_PX = 14;
const SELECT_THRESHOLD_PX = 30;
const TAP_MOVE_MAX_PX = 10;
/** Quick tap with no committed direction falls back to opening the library. */
const DEFAULT_TAP_ACTION: FabAction = "library";

/**
 * Speed-dial gesture controller for the composer's floating action button.
 *
 * Holding (or decisively dragging) the button splits it open into satellite
 * actions; swiping up targets voice and swiping left targets the library, and
 * releasing on a target runs {@link UseFabGestureOptions.onSelect}. A quick tap
 * runs the default library action without opening the dial.
 *
 * @param options - Action select callback
 * @returns Reactive speed-dial state plus pointer/click handlers for the button
 */
export function useFabGesture(
  options: UseFabGestureOptions,
): UseFabGestureResult {
  const [isOpen, setIsOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<FabAction | null>(null);

  const startRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const openedThisPressRef = useRef(false);
  const suppressClickRef = useRef(false);
  const isOpenRef = useRef(false);
  const actionRef = useRef<FabAction | null>(null);

  function setOpen(next: boolean): void {
    isOpenRef.current = next;
    setIsOpen(next);
  }

  function setAction(next: FabAction | null): void {
    if (actionRef.current === next) {
      return;
    }

    actionRef.current = next;
    setActiveAction(next);

    if (next !== null) {
      vibrate(8);
    }
  }

  function clearLongPressTimer(): void {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function openDial(): void {
    if (isOpenRef.current) {
      return;
    }

    openedThisPressRef.current = true;
    setOpen(true);
    vibrate(12);
  }

  function close(): void {
    clearLongPressTimer();
    setOpen(false);
    setAction(null);
  }

  function select(action: FabAction): void {
    close();
    options.onSelect(action);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLElement>): void {
    startRef.current = { x: event.clientX, y: event.clientY };
    openedThisPressRef.current = false;
    suppressClickRef.current = false;
    setAction(null);

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is best-effort; ignore unsupported environments.
    }

    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(openDial, LONG_PRESS_MS);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLElement>): void {
    const start = startRef.current;

    if (!start) {
      return;
    }

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const distance = Math.hypot(deltaX, deltaY);

    if (!isOpenRef.current && distance > OPEN_MOVE_PX) {
      // A decisive drag splits the dial open without waiting for the timer.
      clearLongPressTimer();
      openDial();
    }

    if (!isOpenRef.current || distance <= SELECT_THRESHOLD_PX) {
      setAction(null);
      return;
    }

    if (Math.abs(deltaY) >= Math.abs(deltaX)) {
      setAction(deltaY < 0 ? "voice" : null);
      return;
    }

    setAction(deltaX < 0 ? "library" : null);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLElement>): void {
    clearLongPressTimer();

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Releasing capture is best-effort.
    }

    const start = startRef.current;
    const resolvedAction = actionRef.current;
    const distance = start
      ? Math.hypot(event.clientX - start.x, event.clientY - start.y)
      : 0;

    startRef.current = null;

    if (resolvedAction !== null) {
      // Swiped to a target and released: activate it.
      suppressClickRef.current = true;
      vibrate(14);
      select(resolvedAction);
      return;
    }

    if (openedThisPressRef.current || distance > TAP_MOVE_MAX_PX) {
      // Opened the dial (now awaiting a satellite tap) or dragged without a
      // committed direction: swallow the trailing click, keep current state.
      suppressClickRef.current = true;
      setAction(null);
    }
  }

  function handlePointerCancel(): void {
    clearLongPressTimer();
    startRef.current = null;
    setAction(null);
  }

  function handleClick(): void {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    if (isOpenRef.current) {
      close();
      return;
    }

    options.onSelect(DEFAULT_TAP_ACTION);
  }

  return {
    activeAction,
    isOpen,
    close,
    select,
    buttonHandlers: {
      onClick: handleClick,
      onPointerCancel: handlePointerCancel,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
    },
  };
}

function vibrate(durationMs: number): void {
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.vibrate === "function"
  ) {
    navigator.vibrate(durationMs);
  }
}
