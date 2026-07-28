/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { brandAlpha } from "../theme/tokens";

export interface ToastContextValue {
  /** Shows one transient confirmation; a new call replaces the current toast. */
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Design: the toast clears itself after 2.2s. */
const TOAST_DURATION_MS = 2200;

export interface ToastProviderProps {
  children: React.ReactNode;
}

/**
 * App-wide transient confirmations.
 *
 * The design's toast keeps its dark pill and neon outline in both themes, so
 * the colors here are intentionally literal rather than theme tokens.
 *
 * @param props - Subtree that can raise toasts
 * @returns Provider with the toast layer mounted at the document root
 */
export function ToastProvider(props: ToastProviderProps) {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const showToast = useCallback((nextMessage: string) => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }

    setMessage(nextMessage);
    timerRef.current = window.setTimeout(() => {
      setMessage(null);
      timerRef.current = null;
    }, TOAST_DURATION_MS);
  }, []);

  return (
    <ToastContext value={{ showToast }}>
      {props.children}
      {message === null
        ? null
        : createPortal(
            <div aria-live="polite" role="status" style={toastStyle}>
              {message}
            </div>,
            document.body,
          )}
    </ToastContext>
  );
}

/**
 * Reads the toast action.
 *
 * @returns The toast context value
 * @throws When called outside {@link ToastProvider}
 */
export function useToast(): ToastContextValue {
  const value = use(ToastContext);

  if (!value) {
    throw new Error("useToast must be used inside a ToastProvider.");
  }

  return value;
}

/** Design: dark pill with a neon outline, floating above the bottom bar. */
const toastStyle: React.CSSProperties = {
  background: "rgba(15,15,15,0.92)",
  border: `1px solid ${brandAlpha(0.4)}`,
  borderRadius: 999,
  bottom: "calc(96px + env(safe-area-inset-bottom, 0px))",
  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
  color: "#f2f2f2",
  fontSize: 12,
  fontWeight: 600,
  left: "50%",
  maxWidth: "calc(100% - 48px)",
  padding: "10px 18px",
  position: "fixed",
  transform: "translateX(-50%)",
  // Above the bottom bar and FAB, below the action sheets.
  zIndex: 400,
};
