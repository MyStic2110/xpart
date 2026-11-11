import { jsPDF } from "jspdf";
import type { InvoiceDetail } from "../api";

function formatMoney(paise: number): string {
  const value = (paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `Rs. ${value}`;
}

export function downloadInvoicePdf(detail: InvoiceDetail, orgName: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;
  const contentWidth = pageWidth - margin * 2;
  let y = 52;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 54) {
      doc.addPage();
      y = 50;
    }
  };

  // --- Header Band ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(17, 24, 39);
  doc.text((orgName || "Workshop").toUpperCase(), margin, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text("INVOICE", pageWidth - margin, y, { align: "right" });

  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Automotive Care, Service & Parts", margin, y);

  const invLabel = detail.invoice.invoiceNo || `#${detail.invoice.id.slice(0, 8).toUpperCase()}`;
  doc.text(invLabel, pageWidth - margin, y, { align: "right" });

  y += 18;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(1);
  doc.line(margin, y, pageWidth - margin, y);

  // --- Invoice & Client Metadata ---
  y += 22;
  const colRight = pageWidth / 2 + 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text("INVOICE DETAILS", margin, y);
  doc.text("BILLED TO", colRight, y);

  y += 15;
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);

  const dateStr = new Date(detail.invoice.createdAt).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const statusLabel =
    detail.invoice.status === "draft"
      ? "UNPAID / PENDING PAYMENT"
      : detail.invoice.status.toUpperCase();

  doc.setFont("helvetica", "bold");
  doc.text(invLabel, margin, y);
  doc.text(detail.client?.name || "Customer", colRight, y);

  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`Date: ${dateStr}`, margin, y);
  doc.text(`Phone: ${detail.client?.phone || "-"}`, colRight, y);

  y += 14;
  doc.setFont("helvetica", "bold");
  if (detail.invoice.status === "paid") {
    doc.setTextColor(5, 150, 105);
  } else if (detail.invoice.status === "partial") {
    doc.setTextColor(217, 119, 6);
  } else {
    doc.setTextColor(225, 29, 72);
  }
  doc.text(`Status: ${statusLabel}`, margin, y);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`Vehicle: ${detail.vehicle?.plateNumber || "-"}`, colRight, y);

  if (detail.client?.address) {
    y += 14;
    const addrLines = doc.splitTextToSize(`Address: ${detail.client.address}`, contentWidth / 2 - 14);
    doc.text(addrLines, colRight, y);
    y += (addrLines.length - 1) * 12;
  }

  // --- Items Table Header ---
  y += 26;
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y - 12, contentWidth, 22, "F");
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y + 10, pageWidth - margin, y + 10);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("DESCRIPTION", margin + 8, y + 2);
  doc.text("TYPE", pageWidth - margin - 210, y + 2);
  doc.text("QTY", pageWidth - margin - 145, y + 2, { align: "right" });
  doc.text("RATE", pageWidth - margin - 80, y + 2, { align: "right" });
  doc.text("AMOUNT", pageWidth - margin - 8, y + 2, { align: "right" });

  y += 24;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);

  for (const item of detail.lineItems) {
    const descLines = doc.splitTextToSize(item.serviceName || "Item", contentWidth - 230);
    const rowHeight = Math.max(descLines.length * 13, 18);
    ensureSpace(rowHeight + 10);

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text(descLines, margin + 8, y);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(item.type === "product" ? "Part" : "Service", pageWidth - margin - 210, y);

    doc.setTextColor(51, 65, 85);
    doc.text(String(item.qty), pageWidth - margin - 145, y, { align: "right" });
    doc.text(formatMoney(item.price), pageWidth - margin - 80, y, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(formatMoney(item.qty * item.price), pageWidth - margin - 8, y, { align: "right" });

    y += rowHeight;
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, y - 4, pageWidth - margin, y - 4);
    y += 6;
  }

  // --- Totals Summary ---
  ensureSpace(130);
  y += 10;
  const sumLabelX = pageWidth - margin - 190;
  const sumValX = pageWidth - margin - 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text("Subtotal", sumLabelX, y);
  doc.setTextColor(15, 23, 42);
  doc.text(formatMoney(detail.invoice.subtotal), sumValX, y, { align: "right" });

  if (detail.invoice.discount > 0) {
    y += 16;
    doc.setTextColor(100, 116, 139);
    const discLabel = detail.invoice.appliedOfferCode
      ? `Discount (${detail.invoice.appliedOfferCode})`
      : "Discount";
    doc.text(discLabel, sumLabelX, y);
    doc.setTextColor(225, 29, 72);
    doc.text(`- ${formatMoney(detail.invoice.discount)}`, sumValX, y, { align: "right" });
  }

  const afterDiscount = Math.max(detail.invoice.subtotal - detail.invoice.discount, 0);
  const taxAmount = Math.max(0, detail.invoice.total - afterDiscount);
  if (taxAmount > 0) {
    y += 16;
    doc.setTextColor(100, 116, 139);
    doc.text("Tax / GST", sumLabelX, y);
    doc.setTextColor(15, 23, 42);
    doc.text(formatMoney(taxAmount), sumValX, y, { align: "right" });
  }

  y += 12;
  doc.setDrawColor(203, 213, 225);
  doc.line(sumLabelX, y, pageWidth - margin, y);
  y += 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("Total Amount", sumLabelX, y);
  doc.text(formatMoney(detail.invoice.total), sumValX, y, { align: "right" });

  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(5, 150, 105);
  doc.text("Amount Paid", sumLabelX, y);
  doc.text(formatMoney(detail.paidSoFar), sumValX, y, { align: "right" });

  if (detail.balanceDue > 0) {
    y += 18;
    doc.setFillColor(254, 242, 242);
    doc.rect(sumLabelX - 8, y - 13, pageWidth - margin - (sumLabelX - 8), 22, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(190, 18, 60);
    doc.text("Balance Due", sumLabelX, y + 2);
    doc.text(formatMoney(detail.balanceDue), sumValX, y + 2, { align: "right" });
  }

  // --- Footer ---
  ensureSpace(60);
  const footerY = Math.max(y + 44, pageHeight - 70);
  doc.setDrawColor(241, 245, 249);
  doc.line(margin, footerY - 14, pageWidth - margin, footerY - 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Thank you for choosing ${orgName || "us"}!`,
    pageWidth / 2,
    footerY,
    { align: "center" }
  );
  if (detail.balanceDue > 0) {
    doc.text(
      `Please remit ${formatMoney(detail.balanceDue)} toward ${invLabel}.`,
      pageWidth / 2,
      footerY + 13,
      { align: "center" }
    );
  }

  const safeRef = (detail.invoice.invoiceNo || detail.invoice.id.slice(0, 8))
    .replace(/[^a-zA-Z0-9_-]+/g, "-");
  doc.save(`Invoice-${safeRef}.pdf`);
}

