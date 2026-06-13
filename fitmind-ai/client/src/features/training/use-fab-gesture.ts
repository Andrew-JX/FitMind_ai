import { useRef, useState } from "react";

export type FabGestureDirection = "up" | "right";

export interface UseFabGestureOptions {
  /** Fired on a plain tap / keyboard activation (no swipe, no long press). */
  onTap: () => void;
  /** Fired when the finger is released after swiping past the threshold. */
  onSwipe: (direction: FabGestureDirection) => void;
}

export interface UseFabGestureResult {
  /** Whether the gesture overlay (direction hints) should be visible. */
  isActive: boolean;
  /** Direction currently targeted by the in-progress swipe, or null. */
  direction: FabGestureDirection | null;
  handlers: {
    onClick: () => void;
    onPointerCancel: () => void;
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
  };
}

const LONG_PRESS_MS = 220;
const SWIPE_THRESHOLD_PX = 28;
const TAP_MAX_MOVE_PX = 10;

/**
 * Hold-and-swipe gesture controller for a floating action button.
 *
 * A quick tap (or keyboard/click activation) runs {@link UseFabGestureOptions.onTap};
 * holding the button reveals direction hints (with haptic feedback), and releasing
 * after swiping up or right runs {@link UseFabGestureOptions.onSwipe}.
 *
 * @param options - Tap and swipe callbacks
 * @returns Reactive gesture state plus pointer/click handlers to spread onto the button
 */
export function useFabGesture(options: UseFabGestureOptions): UseFabGestureResult {
  const [isActive, setIsActive] = useState(false);
  const [direction, setDirection] = useState<FabGestureDirection | null>(null);

  const startRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);
  const suppressClickRef = useRef(false);
  const directionRef = useRef<FabGestureDirection | null>(null);

  function clearLongPressTimer(): void {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function reset(): void {
    clearLongPressTimer();
    startRef.current = null;
    longPressFiredRef.current = false;
    directionRef.current = null;
    setIsActive(false);
    setDirection(null);
  }

  function reveal(): void {
    setIsActive(true);
  }

  function updateDirection(next: FabGestureDirection | null): void {
    if (directionRef.current === next) {
      return;
    }

    directionRef.current = next;
    setDirection(next);

    if (next !== null) {
      vibrate(8);
    }
  }

  function handlePointerDown(event: React.PointerEvent<HTMLElement>): void {
    startRef.current = { x: event.clientX, y: event.clientY };
    longPressFiredRef.current = false;
    suppressClickRef.current = false;
    directionRef.current = null;
    setDirection(null);

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is best-effort; ignore unsupported environments.
    }

    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      reveal();
      vibrate(12);
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLElement>): void {
    const start = startRef.current;

    if (!start) {
      return;
    }

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const distance = Math.hypot(deltaX, deltaY);

    if (distance > SWIPE_THRESHOLD_PX && !isActive) {
      // A quick flick reveals the hints without waiting for the long-press timer.
      reveal();
    }

    if (distance <= SWIPE_THRESHOLD_PX) {
      updateDirection(null);
      return;
    }

    if (Math.abs(deltaY) >= Math.abs(deltaX)) {
      updateDirection(deltaY < 0 ? "up" : null);
      return;
    }

    updateDirection(deltaX > 0 ? "right" : null);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLElement>): void {
    clearLongPressTimer();

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Releasing capture is best-effort.
    }

    const start = startRef.current;
    const resolvedDirection = directionRef.current;
    const distance = start
      ? Math.hypot(event.clientX - start.x, event.clientY - start.y)
      : 0;

    if (resolvedDirection !== null) {
      suppressClickRef.current = true;
      vibrate(14);
      options.onSwipe(resolvedDirection);
    } else if (longPressFiredRef.current || distance > TAP_MAX_MOVE_PX) {
      // Held in place or dragged without committing to a direction: cancel.
      suppressClickRef.current = true;
    }

    reset();
  }

  function handlePointerCancel(): void {
    reset();
  }

  function handleClick(): void {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    options.onTap();
  }

  return {
    direction,
    isActive,
    handlers: {
      onClick: handleClick,
      onPointerCancel: handlePointerCancel,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
    },
  };
}

function vibrate(durationMs: number): void {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(durationMs);
  }
}
