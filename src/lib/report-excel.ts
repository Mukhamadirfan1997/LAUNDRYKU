import type { Worksheet } from "exceljs";

import type { ReportData } from "@/features/laporan/types";
import {
  formatAngka,
  formatTanggalWaktu,
} from "./format";
import type { ReportFileResult } from "./report-pdf";

const CURRENCY_FORMAT = '"Rp"#,##0';

function setTitle(
  sheet: Worksheet,
  title: string,
  subtitle: string,
  periodLine: string,
): void {
  sheet.mergeCells("A1:D1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = title;
  titleCell.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0E7490" },
  };
  titleCell.alignment = { vertical: "middle", horizontal: "center" };
  sheet.getRow(1).height = 28;

  sheet.mergeCells("A2:D2");
  const subtitleCell = sheet.getCell("A2");
  subtitleCell.value = subtitle;
  subtitleCell.font = { bold: true, size: 12 };
  subtitleCell.alignment = { horizontal: "center" };

  sheet.mergeCells("A3:D3");
  const periodCell = sheet.getCell("A3");
  periodCell.value = periodLine;
  periodCell.font = { size: 9, color: { argb: "FF64748B" } };
  periodCell.alignment = { horizontal: "center" };
}

function addSectionHeader(
  sheet: Worksheet,
  row: number,
  title: string,
): void {
  sheet.mergeCells(`A${row}:D${row}`);
  const cell = sheet.getCell(`A${row}`);
  cell.value = title;
  cell.font = { bold: true, color: { argb: "FF155E75" } };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFECFEFF" },
  };
  cell.alignment = { vertical: "middle" };
  sheet.getRow(row).height = 20;
}

export async function buildReportExcel(
  data: ReportData,
): Promise<ReportFileResult> {
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  workbook.creator = "LaundryKu";
  workbook.created = new Date();
  workbook.modified = new Date();

  const summary = workbook.addWorksheet("Ringkasan", {
    properties: { defaultRowHeight: 18 },
    views: [{ state: "frozen", ySplit: 4 }],
  });
  summary.columns = [
    { key: "label", width: 34 },
    { key: "value", width: 24 },
    { key: "extra", width: 18 },
    { key: "note", width: 18 },
  ];

  setTitle(
    summary,
    "LAPORAN KEUANGAN LAUNDRYKU",
    data.profile?.business_name?.trim() || "LaundryKu",
    `${data.modeLabel} · ${data.periodLabel} · Periode ${data.startDate} s.d. ${data.endDate} · Dicetak ${formatTanggalWaktu(new Date())}`,
  );

  addSectionHeader(summary, 5, "Ringkasan Keuangan");
  const summaryRows: Array<{
    label: string;
    value: string | number;
    currency?: boolean;
    tone?: "good" | "bad";
  }> = [
    { label: "Pendapatan diterima", value: data.revenue, currency: true },
    { label: "Pengeluaran", value: data.expenseTotal, currency: true },
    {
      label: "Saldo",
      value: data.balance,
      currency: true,
      tone: data.balance < 0 ? "bad" : "good",
    },
    { label: "Jumlah order", value: data.orderCount },
    { label: "Order selesai", value: data.completedOrderCount },
    { label: "Nilai order", value: data.orderValue, currency: true },
    {
      label: "Item terjual",
      value: `${formatAngka(data.itemQty)} qty (${data.itemLineCount} baris)`,
    },
  ];

  summaryRows.forEach((item, index) => {
    const rowNumber = 6 + index;
    const row = summary.getRow(rowNumber);
    row.getCell(1).value = item.label;
    row.getCell(2).value = item.value;
    row.getCell(2).alignment = { horizontal: "right" };
    if (item.currency) {
      row.getCell(2).numFmt = CURRENCY_FORMAT;
    }
    if (item.tone) {
      row.getCell(2).font = {
        bold: true,
        color: { argb: item.tone === "good" ? "FF15803D" : "FFB91C1C" },
      };
    }
  });

  const categoryHeader = 5 + summaryRows.length + 2;
  addSectionHeader(summary, categoryHeader, "Pengeluaran per Kategori");
  const categoryHead = summary.getRow(categoryHeader + 1);
  categoryHead.values = ["Kategori", "Nominal", "Porsi", ""];
  categoryHead.font = { bold: true, color: { argb: "FF334155" } };
  categoryHead.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF1F5F9" },
  };

  if (data.expenseCategories.length === 0) {
    const row = summary.getRow(categoryHeader + 2);
    row.getCell(1).value = "Belum ada pengeluaran pada periode ini";
    row.getCell(1).font = { italic: true, color: { argb: "FF64748B" } };
    summary.mergeCells(
      `A${categoryHeader + 2}:D${categoryHeader + 2}`,
    );
  } else {
    data.expenseCategories.forEach((category, index) => {
      const row = summary.getRow(categoryHeader + 2 + index);
      row.getCell(1).value = category.name;
      row.getCell(2).value = category.amount;
      row.getCell(2).numFmt = CURRENCY_FORMAT;
      row.getCell(2).alignment = { horizontal: "right" };
      row.getCell(3).value = category.percentage / 100;
      row.getCell(3).numFmt = "0.0%";
      row.getCell(3).alignment = { horizontal: "right" };
    });
  }

  const trend = workbook.addWorksheet("Tren", {
    properties: { defaultRowHeight: 18 },
    views: [{ state: "frozen", ySplit: 5 }],
  });
  trend.columns = [
    { key: "period", width: 24 },
    { key: "revenue", width: 22 },
    { key: "expense", width: 22 },
    { key: "balance", width: 22 },
  ];

  setTitle(
    trend,
    "TREN PENDAPATAN & PENGELUARAN",
    data.profile?.business_name?.trim() || "LaundryKu",
    `${data.modeLabel} · ${data.periodLabel}`,
  );

  addSectionHeader(trend, 5, "Rincian per Periode");
  const trendHead = trend.getRow(6);
  trendHead.values = ["Periode", "Pendapatan", "Pengeluaran", "Saldo"];
  trendHead.font = { bold: true, color: { argb: "FF334155" } };
  trendHead.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF1F5F9" },
  };

  data.trend.forEach((point, index) => {
    const row = trend.getRow(7 + index);
    row.getCell(1).value = point.label;
    row.getCell(2).value = point.revenue;
    row.getCell(3).value = point.expense;
    row.getCell(4).value = point.balance;
    [2, 3, 4].forEach((column) => {
      row.getCell(column).numFmt = CURRENCY_FORMAT;
      row.getCell(column).alignment = { horizontal: "right" };
    });
  });

  const totalRow = trend.getRow(7 + data.trend.length);
  totalRow.getCell(1).value = "Total";
  totalRow.getCell(2).value = data.revenue;
  totalRow.getCell(3).value = data.expenseTotal;
  totalRow.getCell(4).value = data.balance;
  totalRow.font = { bold: true };
  totalRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF8FAFC" },
  };
  [2, 3, 4].forEach((column) => {
    totalRow.getCell(column).numFmt = CURRENCY_FORMAT;
    totalRow.getCell(column).alignment = { horizontal: "right" };
  });

  trend.autoFilter = {
    from: "A6",
    to: `D${6 + data.trend.length}`,
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return {
    bytes: new Uint8Array(buffer),
    fileName: `${data.fileBase}.xlsx`,
  };
}
