export type IconName =
  | "zap"
  | "dumbbell"
  | "chart"
  | "bot"
  | "send"
  | "plus"
  | "x"
  | "chevron-down"
  | "chevron-right"
  | "tool"
  | "target"
  | "user"
  | "clock"
  | "eye"
  | "trash"
  | "refresh"
  | "check"
  | "search"
  | "sun"
  | "moon"
  | "stop";

export interface IconProps {
  name: IconName;
  size?: number | undefined;
}

/**
 * Renders a small inline SVG icon without a third-party icon library.
 *
 * @param props - Icon name and optional pixel size
 * @returns SVG icon
 */
export function Icon(props: IconProps) {
  const { name, size = 20 } = props;

  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width={size}
    >
      {renderPath(name)}
    </svg>
  );
}

function renderPath(name: IconName): React.ReactNode {
  if (name === "zap") {
    return <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />;
  }

  if (name === "dumbbell") {
    return (
      <>
        <path d="M3 10v4" />
        <path d="M6 8v8" />
        <path d="M18 8v8" />
        <path d="M21 10v4" />
        <path d="M6 12h12" />
      </>
    );
  }

  if (name === "chart") {
    return (
      <>
        <path d="M4 19h16" />
        <path d="M7 15V9" />
        <path d="M12 15V5" />
        <path d="M17 15v-3" />
      </>
    );
  }

  if (name === "bot") {
    return (
      <>
        <rect height="10" rx="2" width="14" x="5" y="8" />
        <path d="M12 4v4" />
        <path d="M9 12h.01" />
        <path d="M15 12h.01" />
      </>
    );
  }

  if (name === "send") {
    return <path d="M22 2 11 13" />;
  }

  if (name === "plus") {
    return (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    );
  }

  if (name === "x") {
    return (
      <>
        <path d="m18 6-12 12" />
        <path d="m6 6 12 12" />
      </>
    );
  }

  if (name === "chevron-down") {
    return <path d="m6 9 6 6 6-6" />;
  }

  if (name === "chevron-right") {
    return <path d="m9 6 6 6-6 6" />;
  }

  if (name === "tool") {
    return (
      <>
        <path d="M14.7 6.3a4 4 0 1 0 3 3L21 6l-3-3-3.3 3.3a4 4 0 0 0 .01 0Z" />
        <path d="m8 16-5 5" />
      </>
    );
  }

  if (name === "target") {
    return (
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" />
      </>
    );
  }

  if (name === "user") {
    return (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M6 20a6 6 0 0 1 12 0" />
      </>
    );
  }

  if (name === "clock") {
    return (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </>
    );
  }

  if (name === "eye") {
    return (
      <>
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    );
  }

  if (name === "trash") {
    return (
      <>
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="m19 6-1 14H6L5 6" />
      </>
    );
  }

  if (name === "refresh") {
    return (
      <>
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </>
    );
  }

  if (name === "check") {
    return <path d="m5 13 4 4L19 7" />;
  }

  if (name === "search") {
    return (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </>
    );
  }

  if (name === "sun") {
    return (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="m4.93 4.93 1.41 1.41" />
        <path d="m17.66 17.66 1.41 1.41" />
      </>
    );
  }

  if (name === "moon") {
    return <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />;
  }

  return <rect height="8" rx="1" width="8" x="8" y="8" />;
}
