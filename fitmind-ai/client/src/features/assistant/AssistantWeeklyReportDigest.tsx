import { useEffect, useState } from "react";

import { Badge } from "../../components/Badge";
import { Card } from "../../components/Card";
import { IconButton } from "../../components/IconButton";
import { useTheme } from "../../theme/ThemeContext";
import {
  dismissWeeklyReportDigest,
  getWeeklyReportDigest,
  type WeeklyReportDigest,
} from "./weekly-report-digest-api";

export interface AssistantWeeklyReportDigestProps {
  token: string | null;
}

export function AssistantWeeklyReportDigest(
  props: AssistantWeeklyReportDigestProps,
) {
  const { theme } = useTheme();
  const [digest, setDigest] = useState<WeeklyReportDigest | null>(null);
  const [isDismissing, setIsDismissing] = useState(false);

  useEffect(() => {
    if (!props.token) {
      setDigest(null);
      return;
    }

    let isActive = true;

    getWeeklyReportDigest(props.token)
      .then((nextDigest) => {
        if (isActive) {
          setDigest(nextDigest);
        }
      })
      .catch(() => {
        if (isActive) {
          setDigest(null);
        }
      });

    return () => {
      isActive = false;
    };
  }, [props.token]);

  async function dismissDigest(): Promise<void> {
    if (!props.token || digest === null) {
      return;
    }

    setIsDismissing(true);

    try {
      await dismissWeeklyReportDigest(props.token, digest.id);
      setDigest(null);
    } finally {
      setIsDismissing(false);
    }
  }

  if (digest === null) {
    return null;
  }

  return (
    <Card padding="14px">
      <section style={containerStyle}>
        <div style={contentStyle}>
          <div style={titleRowStyle}>
            <h3 style={titleStyle}>{digest.title}</h3>
            <Badge tone="accent">Weekly Digest</Badge>
          </div>
          <p style={summaryStyle(theme)}>{digest.summary}</p>
          <time dateTime={digest.generated_at} style={metaStyle(theme)}>
            {formatDigestMeta(digest)}
          </time>
        </div>
        <IconButton
          disabled={isDismissing}
          icon="x"
          label="Dismiss weekly report digest"
          onClick={() => void dismissDigest()}
        />
      </section>
    </Card>
  );
}

function formatDigestMeta(digest: WeeklyReportDigest): string {
  return `ISO week ${digest.iso_week}, ${digest.week_start_date} to ${digest.week_end_date}`;
}

const containerStyle: React.CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
};

const contentStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  minWidth: 0,
};

const titleRowStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const titleStyle: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.4,
  margin: 0,
};

function summaryStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx,
    fontSize: 13,
    lineHeight: 1.6,
    margin: 0,
  };
}

function metaStyle(
  theme: ReturnType<typeof useTheme>["theme"],
): React.CSSProperties {
  return {
    color: theme.colors.tx3,
    fontSize: 11,
  };
}
