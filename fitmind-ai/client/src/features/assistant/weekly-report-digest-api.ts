import { requestJson } from "../../services/http-client";

export interface WeeklyReportDigest {
  id: string;
  iso_year: number;
  iso_week: number;
  week_start_date: string;
  week_end_date: string;
  status: "ready" | "empty";
  title: string;
  summary: string;
  report_snapshot: unknown;
  generated_at: string;
  dismissed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface WeeklyReportDigestResponse {
  digest: WeeklyReportDigest | null;
}

interface DismissWeeklyReportDigestResponse {
  dismissed: true;
  id: string;
}

export async function getWeeklyReportDigest(
  token: string,
): Promise<WeeklyReportDigest | null> {
  const response = await requestJson<WeeklyReportDigestResponse>(
    "/api/training/weekly-report-digest",
    { token },
  );

  return response.digest;
}

export async function dismissWeeklyReportDigest(
  token: string,
  id: string,
): Promise<DismissWeeklyReportDigestResponse> {
  return requestJson<
    DismissWeeklyReportDigestResponse,
    {
      dismissed: true;
    }
  >(`/api/training/weekly-report-digests/${id}`, {
    method: "PATCH",
    token,
    body: { dismissed: true },
  });
}
