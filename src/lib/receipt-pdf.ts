import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import type { BusinessProfile } from "@/db/types";
import type { OrderDetail } from "@/features/transaksi/types";

import { formatAngka, formatRupiah, formatTanggal, formatTanggalWaktu } from "./format";
import {
  orderStatusLabels,
  paymentMethodLabels,
  paymentStatusLabels,
} from "./order-labels";

export type ReceiptFormat = "58mm" | "80mm" | "a5";

export interface ReceiptResult {
  bytes: Uint8Array;
  fileName: string;
}

const formatConfig: Record<
  ReceiptFormat,
  {
    width: number;
    margin: number;
    titleSize: number;
    textSize: number;
    tableSize: number;
    showPrice: boolean;
  }
> = {
  "58mm": {
    width: 58,
    margin: 3.5,
    titleSize: 10,
    textSize: 6.8,
    tableSize: 6.2,
    showPrice: false,
  },
  "80mm": {
    width: 80,
    margin: 5,
    titleSize: 12,
    textSize: 7.5,
    tableSize: 7,
    showPrice: true,
  },
  a5: {
    width: 148,
    margin: 12,
    titleSize: 16,
    textSize: 9,
    tableSize: 8.5,
    showPrice: true,
  },
};

export function buildReceiptPdf(
  order: OrderDetail,
  profile: BusinessProfile | null,
  format: ReceiptFormat,
): ReceiptResult {
  const config = formatConfig[format];
  const contentWidth = config.width - config.margin * 2;
  const estimatedHeight =
    95 +
    order.items.length * 7 +
    order.payments.length * 5 +
    (order.notes ? 12 : 0);

  const doc =
    format === "a5"
      ? new jsPDF({ unit: "mm", format: "a5" })
      : new jsPDF({
          unit: "mm",
          format: [config.width, Math.max(130, estimatedHeight)],
        });

  const center = config.width / 2;
  let cursorY = config.margin + 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(config.titleSize);
  doc.text(profile?.business_name?.trim() || "LaundryKu", center, cursorY, {
    align: "center",
  });
  cursorY += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(config.textSize);
  if (profile?.owner_name?.trim()) {
    doc.text(profile.owner_name.trim(), center, cursorY, { align: "center" });
    cursorY += 3.6;
  }
  if (profile?.address?.trim()) {
    const lines = doc.splitTextToSize(profile.address.trim(), contentWidth);
    doc.text(lines, center, cursorY, { align: "center" });
    cursorY += lines.length * 3.4;
  }
  if (profile?.phone?.trim()) {
    doc.text(`Telp. ${profile.phone.trim()}`, center, cursorY, {
      align: "center",
    });
    cursorY += 3.6;
  }

  cursorY += 1.5;
  doc.setDrawColor(80, 80, 80);
  doc.setLineWidth(0.2);
  doc.line(config.margin, cursorY, config.width - config.margin, cursorY);
  cursorY += 4;

  const writeInfoRow = (label: string, value: string): void => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(config.textSize);
    doc.text(label, config.margin, cursorY);
    doc.text(value, config.width - config.margin, cursorY, { align: "right" });
    cursorY += 3.8;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(config.textSize + 0.5);
  doc.text(order.order_number, config.margin, cursorY);
  cursorY += 4.5;

  writeInfoRow("Tanggal order", formatTanggal(order.order_date));
  writeInfoRow("Pelanggan", order.customer_name);
  writeInfoRow("No. HP", order.customer_phone);
  writeInfoRow("Status order", orderStatusLabels[order.status]);
  writeInfoRow(
    "Pembayaran",
    paymentStatusLabels[order.payment_status],
  );

  cursorY += 1.5;
  doc.line(config.margin, cursorY, config.width - config.margin, cursorY);
  cursorY += 3;

  const tableColumns = config.showPrice
    ? ["Item", "Qty", "Harga", "Subtotal"]
    : ["Item", "Qty", "Subtotal"];

  const tableBody = order.items.map((item) => {
    const qty = `${formatAngka(item.qty)} ${item.unit}`;
    if (config.showPrice) {
      return [
        item.name_snapshot,
        qty,
        formatRupiah(item.price),
        formatRupiah(item.subtotal),
      ];
    }
    return [item.name_snapshot, qty, formatRupiah(item.subtotal)];
  });

  autoTable(doc, {
    startY: cursorY,
    head: [tableColumns],
    body: tableBody,
    theme: "plain",
    margin: { left: config.margin, right: config.margin },
    tableWidth: contentWidth,
    styles: {
      font: "helvetica",
      fontSize: config.tableSize,
      cellPadding: 1.1,
      overflow: "linebreak",
      textColor: [25, 25, 25],
      lineColor: [210, 210, 210],
      lineWidth: { top: 0, right: 0, bottom: 0.1, left: 0 },
    },
    headStyles: {
      fontStyle: "bold",
      fillColor: [242, 242, 242],
      textColor: [20, 20, 20],
      lineWidth: { top: 0, right: 0, bottom: 0.2, left: 0 },
    },
    columnStyles: config.showPrice
      ? {
          0: { cellWidth: contentWidth * 0.46 },
          1: { cellWidth: contentWidth * 0.16, halign: "right" },
          2: { cellWidth: contentWidth * 0.18, halign: "right" },
          3: { cellWidth: contentWidth * 0.2, halign: "right" },
        }
      : {
          0: { cellWidth: contentWidth * 0.58 },
          1: { cellWidth: contentWidth * 0.17, halign: "right" },
          2: { cellWidth: contentWidth * 0.25, halign: "right" },
        },
  });

  const tableDoc = doc as jsPDF & {
    lastAutoTable?: { finalY: number };
  };
  cursorY = (tableDoc.lastAutoTable?.finalY ?? cursorY) + 4;

  const writeTotalRow = (
    label: string,
    value: string,
    emphasis = false,
  ): void => {
    doc.setFont("helvetica", emphasis ? "bold" : "normal");
    doc.setFontSize(emphasis ? config.textSize + 1 : config.textSize);
    doc.text(label, config.margin, cursorY);
    doc.text(value, config.width - config.margin, cursorY, { align: "right" });
    cursorY += emphasis ? 5 : 3.8;
  };

  writeTotalRow("Total", formatRupiah(order.total), true);
  writeTotalRow("Dibayar", formatRupiah(order.paid_amount));
  writeTotalRow("Sisa bayar", formatRupiah(order.remaining_amount), true);

  if (order.payments.length > 0) {
    cursorY += 1;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(config.textSize);
    doc.text("Riwayat pembayaran", config.margin, cursorY);
    cursorY += 4;

    for (const payment of order.payments) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(config.textSize - 0.3);
      const label = `${paymentMethodLabels[payment.method]} · ${formatTanggalWaktu(payment.paid_at)}`;
      doc.text(label, config.margin, cursorY);
      doc.text(formatRupiah(payment.amount), config.width - config.margin, cursorY, {
        align: "right",
      });
      cursorY += 3.6;
    }
  }

  if (order.notes?.trim()) {
    cursorY += 1.5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(config.textSize);
    doc.text("Catatan", config.margin, cursorY);
    cursorY += 3.6;
    doc.setFont("helvetica", "normal");
    const noteLines = doc.splitTextToSize(order.notes.trim(), contentWidth);
    doc.text(noteLines, config.margin, cursorY);
    cursorY += noteLines.length * 3.5;
  }

  cursorY += 3;
  doc.setDrawColor(80, 80, 80);
  doc.line(config.margin, cursorY, config.width - config.margin, cursorY);
  cursorY += 4;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(config.textSize - 0.3);
  doc.text("Terima kasih telah mempercayakan cucian Anda.", center, cursorY, {
    align: "center",
  });
  cursorY += 3.6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(config.textSize - 0.8);
  doc.text(
    `Dicetak ${formatTanggalWaktu(new Date())} · LaundryKu`,
    center,
    cursorY,
    { align: "center" },
  );

  const arrayBuffer = doc.output("arraybuffer");
  const formatLabel = format === "a5" ? "A5" : format;
  return {
    bytes: new Uint8Array(arrayBuffer),
    fileName: `Struk-${order.order_number}-${formatLabel}.pdf`,
  };
}
