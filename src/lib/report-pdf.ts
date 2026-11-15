import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import type { ReportData } from "@/features/laporan/types";
import {
  formatAngka,
  formatRupiah,
  formatTanggalWaktu,
} from "./format";

export interface ReportFileResult {
  bytes: Uint8Array;
  fileName: string;
}

export function buildReportPdf(data: ReportData): ReportFileResult {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;
  const center = pageWidth / 2;
  let cursorY = 16;

  doc.setProperties({
    title: `Laporan ${data.modeLabel} ${data.periodLabel}`,
    subject: "Laporan keuangan LaundryKu",
    author: "LaundryKu",
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(data.profile?.business_name?.trim() || "LaundryKu", center, cursorY, {
    align: "center",
  });
  cursorY += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  if (data.profile?.owner_name?.trim()) {
    doc.text(data.profile.owner_name.trim(), center, cursorY, {
      align: "center",
    });
    cursorY += 4;
  }
  if (data.profile?.address?.trim()) {
    const addressLines = doc.splitTextToSize(
      data.profile.address.trim(),
      contentWidth,
    );
    doc.text(addressLines, center, cursorY, { align: "center" });
    cursorY += addressLines.length * 4;
  }
  if (data.profile?.phone?.trim()) {
    doc.text(`Telp. ${data.profile.phone.trim()}`, center, cursorY, {
      align: "center",
    });
    cursorY += 4;
  }

  cursorY += 2;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 7;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text("LAPORAN KEUANGAN", center, cursorY, { align: "center" });
  cursorY += 5.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `${data.modeLabel} · ${data.periodLabel}`,
    center,
    cursorY,
    { align: "center" },
  );
  cursorY += 4;
  doc.setFontSize(8);
  doc.text(
    `Periode ${data.startDate} s.d. ${data.endDate} · Dicetak ${formatTanggalWaktu(new Date())}`,
    center,
    cursorY,
    { align: "center" },
  );
  cursorY += 7;

  autoTable(doc, {
    startY: cursorY,
    head: [["Ringkasan", "Nilai"]],
    body: [
      ["Pendapatan diterima", formatRupiah(data.revenue)],
      ["Pengeluaran", formatRupiah(data.expenseTotal)],
      ["Saldo", formatRupiah(data.balance)],
      ["Jumlah order", `${data.orderCount} order`],
      ["Order selesai", `${data.completedOrderCount} order`],
      ["Nilai order", formatRupiah(data.orderValue)],
      [
        "Item terjual",
        `${formatAngka(data.itemQty)} qty (${data.itemLineCount} baris)`,
      ],
    ],
    theme: "grid",
    margin: { left: margin, right: margin, bottom: 20 },
    tableWidth: contentWidth,
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [14, 116, 144],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { halign: "right", fontStyle: "bold" },
    },
    didParseCell: (hookData) => {
      if (hookData.section === "body" && hookData.row.index === 2) {
        hookData.cell.styles.textColor =
          data.balance < 0 ? [185, 28, 28] : [21, 128, 61];
      }
    },
  });

  const summaryDoc = doc as jsPDF & {
    lastAutoTable?: { finalY: number };
  };
  cursorY = (summaryDoc.lastAutoTable?.finalY ?? cursorY) + 7;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("Pengeluaran per Kategori", margin, cursorY);
  cursorY += 2.5;

  autoTable(doc, {
    startY: cursorY,
    head: [["Kategori", "Nominal", "Porsi"]],
    body:
      data.expenseCategories.length > 0
        ? data.expenseCategories.map((category) => [
            category.name,
            formatRupiah(category.amount),
            `${category.percentage.toFixed(1)}%`,
          ])
        : [["Belum ada pengeluaran pada periode ini", "-", "-"]],
    theme: "striped",
    margin: { left: margin, right: margin, bottom: 20 },
    tableWidth: contentWidth,
    styles: {
      font: "helvetica",
      fontSize: 8.2,
      cellPadding: 2,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [51, 65, 85],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.54 },
      1: { halign: "right", cellWidth: contentWidth * 0.26 },
      2: { halign: "right", cellWidth: contentWidth * 0.2 },
    },
  });

  const categoryDoc = doc as jsPDF & {
    lastAutoTable?: { finalY: number };
  };
  cursorY = (categoryDoc.lastAutoTable?.finalY ?? cursorY) + 7;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("Tren Pendapatan & Pengeluaran", margin, cursorY);
  cursorY += 2.5;

  autoTable(doc, {
    startY: cursorY,
    head: [["Periode", "Pendapatan", "Pengeluaran", "Saldo"]],
    body: data.trend.map((point) => [
      point.label,
      formatRupiah(point.revenue),
      formatRupiah(point.expense),
      formatRupiah(point.balance),
    ]),
    theme: "striped",
    margin: { left: margin, right: margin, bottom: 20 },
    tableWidth: contentWidth,
    styles: {
      font: "helvetica",
      fontSize: 7.8,
      cellPadding: 1.7,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [51, 65, 85],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.28 },
      1: { halign: "right", cellWidth: contentWidth * 0.24 },
      2: { halign: "right", cellWidth: contentWidth * 0.24 },
      3: { halign: "right", cellWidth: contentWidth * 0.24 },
    },
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(120, 133, 150);
    doc.text(
      `LaundryKu · Laporan ${data.modeLabel} ${data.periodLabel}`,
      margin,
      289,
    );
    doc.text(`Halaman ${page} dari ${pageCount}`, pageWidth - margin, 289, {
      align: "right",
    });
  }

  return {
    bytes: new Uint8Array(doc.output("arraybuffer")),
    fileName: `${data.fileBase}.pdf`,
  };
}
