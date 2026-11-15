import { invoke } from "@tauri-apps/api/core";

export type ReportExportFormat = "PDF" | "Excel";

export async function logReportExportRequest(
  token: string,
  input: {
    reportType: "Bulanan" | "Tahunan";
    periodLabel: string;
    format: ReportExportFormat;
  },
): Promise<void> {
  return invoke<void>("log_report_export", {
    token,
    reportType: input.reportType,
    periodLabel: input.periodLabel,
    format: input.format,
  });
}
