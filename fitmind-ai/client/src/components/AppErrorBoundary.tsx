import React from "react";

interface AppErrorBoundaryState {
  hasError: boolean;
}

/** Keeps one unexpected render error from leaving the user on a blank screen. */
export class AppErrorBoundary extends React.Component<
  React.PropsWithChildren,
  AppErrorBoundaryState
> {
  public state: AppErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: unknown): void {
    console.error("FitMind render error", error);
  }

  public render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main style={fallbackStyle}>
        <section style={fallbackCardStyle}>
          <strong style={fallbackTitleStyle}>页面暂时无法显示</strong>
          <p style={fallbackCopyStyle}>
            当前操作没有丢失到线上。请刷新页面重试；如果仍然出现，请返回后重新进入。
          </p>
          <button
            onClick={() => window.location.reload()}
            style={reloadButtonStyle}
            type="button"
          >
            刷新页面
          </button>
        </section>
      </main>
    );
  }
}

const fallbackStyle: React.CSSProperties = {
  background: "#0f1115",
  color: "#f7f8fa",
  display: "grid",
  minHeight: "100vh",
  padding: 24,
  placeItems: "center",
};

const fallbackCardStyle: React.CSSProperties = {
  background: "#181b20",
  border: "1px solid #30343b",
  borderRadius: 18,
  display: "grid",
  gap: 12,
  maxWidth: 420,
  padding: 24,
  width: "100%",
};

const fallbackTitleStyle: React.CSSProperties = { fontSize: 18 };
const fallbackCopyStyle: React.CSSProperties = {
  color: "#b6bbc4",
  lineHeight: 1.7,
  margin: 0,
};
const reloadButtonStyle: React.CSSProperties = {
  background: "#c8ff00",
  border: "none",
  borderRadius: 12,
  color: "#0f0f0f",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 800,
  padding: "11px 14px",
};
