import { jsPDF } from "jspdf";
import type { InvoiceDetail, JobCardDetail } from "../api";

function formatMoney(paise: number): string {
  const value = (paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `Rs. ${value}`;
}

interface PdfLineItem {
  serviceName: string;
  qty: number;
  price: number;
  type?: "service" | "product";
}

interface PdfDocumentConfig {
  docTitle: string;
  docRef: string;
  detailsHeading: string;
  recipientHeading: string;
  dateLabel: string;
  statusText: string;
  statusColor: [number, number, number];
  orgName: string;
  clientName: string;
  clientPhone: string;
  clientAddress?: string | null;
  vehicleLabel: string;
  lineItems: PdfLineItem[];
  subtotal: number;
  discount: number;
  discountLabel?: string;
  taxAmount: number;
  totalLabel: string;
  total: number;
  paidSoFar?: number;
  balanceDue?: number;
  footerNote: string;
  fileName: string;
}

function renderPdfDocument(cfg: PdfDocumentConfig) {
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
  doc.text((cfg.orgName || "Workshop").toUpperCase(), margin, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(cfg.docTitle, pageWidth - margin, y, { align: "right" });

  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Automotive Care, Service & Parts", margin, y);
  doc.text(cfg.docRef, pageWidth - margin, y, { align: "right" });

  y += 18;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(1);
  doc.line(margin, y, pageWidth - margin, y);

  // --- Document & Client Metadata ---
  y += 22;
  const colRight = pageWidth / 2 + 12;
  const rightColWidth = pageWidth - margin - colRight;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text(cfg.detailsHeading, margin, y);
  doc.text(cfg.recipientHeading, colRight, y);

  y += 15;
  let yLeft = y;
  let yRight = y;

  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.text(cfg.docRef, margin, yLeft);
  const clientNameLines = doc.splitTextToSize(cfg.clientName, rightColWidth);
  doc.text(clientNameLines, colRight, yRight);

  yLeft += 14;
  yRight += clientNameLines.length * 13 + 2;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`Date: ${cfg.dateLabel}`, margin, yLeft);
  doc.text(`Phone: ${cfg.clientPhone}`, colRight, yRight);

  yLeft += 14;
  yRight += 14;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...cfg.statusColor);
  doc.text(`Status: ${cfg.statusText}`, margin, yLeft);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  const vehicleLines = doc.splitTextToSize(`Vehicle: ${cfg.vehicleLabel}`, rightColWidth);
  doc.text(vehicleLines, colRight, yRight);
  yRight += vehicleLines.length * 13;

  if (cfg.clientAddress) {
    yRight += 2;
    const addrLines = doc.splitTextToSize(`Address: ${cfg.clientAddress}`, rightColWidth);
    doc.text(addrLines, colRight, yRight);
    yRight += addrLines.length * 12;
  }

  y = Math.max(yLeft, yRight);

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

  for (const item of cfg.lineItems) {
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
  doc.text(formatMoney(cfg.subtotal), sumValX, y, { align: "right" });

  if (cfg.discount > 0) {
    y += 16;
    doc.setTextColor(100, 116, 139);
    doc.text(cfg.discountLabel || "Discount", sumLabelX, y);
    doc.setTextColor(225, 29, 72);
    doc.text(`- ${formatMoney(cfg.discount)}`, sumValX, y, { align: "right" });
  }

  if (cfg.taxAmount > 0) {
    y += 16;
    doc.setTextColor(100, 116, 139);
    doc.text("Tax / GST", sumLabelX, y);
    doc.setTextColor(15, 23, 42);
    doc.text(formatMoney(cfg.taxAmount), sumValX, y, { align: "right" });
  }

  y += 12;
  doc.setDrawColor(203, 213, 225);
  doc.line(sumLabelX, y, pageWidth - margin, y);
  y += 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(cfg.totalLabel, sumLabelX, y);
  doc.text(formatMoney(cfg.total), sumValX, y, { align: "right" });

  if (cfg.paidSoFar !== undefined) {
    y += 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(5, 150, 105);
    doc.text("Amount Paid", sumLabelX, y);
    doc.text(formatMoney(cfg.paidSoFar), sumValX, y, { align: "right" });
  }

  if (cfg.balanceDue && cfg.balanceDue > 0) {
    y += 18;
    doc.setFillColor(254, 242, 242);
    doc.rect(sumLabelX - 8, y - 13, pageWidth - margin - (sumLabelX - 8), 22, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(190, 18, 60);
    doc.text("Balance Due", sumLabelX, y + 2);
    doc.text(formatMoney(cfg.balanceDue), sumValX, y + 2, { align: "right" });
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
    `Thank you for choosing ${cfg.orgName || "us"}!`,
    pageWidth / 2,
    footerY,
    { align: "center" }
  );
  if (cfg.footerNote) {
    doc.text(cfg.footerNote, pageWidth / 2, footerY + 13, { align: "center" });
  }

  doc.save(cfg.fileName);
}

export function downloadInvoicePdf(detail: InvoiceDetail, orgName: string) {
  const invLabel = detail.invoice.invoiceNo || `#${detail.invoice.id.slice(0, 8).toUpperCase()}`;
  const dateLabel = new Date(detail.invoice.createdAt).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const statusText =
    detail.invoice.status === "draft"
      ? "UNPAID / PENDING PAYMENT"
      : detail.invoice.status.toUpperCase();
  const statusColor: [number, number, number] =
    detail.invoice.status === "paid"
      ? [5, 150, 105]
      : detail.invoice.status === "partial"
        ? [217, 119, 6]
        : [225, 29, 72];

  const afterDiscount = Math.max(detail.invoice.subtotal - detail.invoice.discount, 0);
  const taxAmount = Math.max(0, detail.invoice.total - afterDiscount);
  const safeRef = (detail.invoice.invoiceNo || detail.invoice.id.slice(0, 8)).replace(/[^a-zA-Z0-9_-]+/g, "-");

  renderPdfDocument({
    docTitle: "INVOICE",
    docRef: invLabel,
    detailsHeading: "INVOICE DETAILS",
    recipientHeading: "BILLED TO",
    dateLabel,
    statusText,
    statusColor,
    orgName,
    clientName: detail.client?.name || "Customer",
    clientPhone: detail.client?.phone || "-",
    clientAddress: detail.client?.address,
    vehicleLabel: detail.vehicle?.plateNumber || "-",
    lineItems: detail.lineItems,
    subtotal: detail.invoice.subtotal,
    discount: detail.invoice.discount,
    discountLabel: detail.invoice.appliedOfferCode ? `Discount (${detail.invoice.appliedOfferCode})` : "Discount",
    taxAmount,
    totalLabel: "Total Amount",
    total: detail.invoice.total,
    paidSoFar: detail.paidSoFar,
    balanceDue: detail.balanceDue,
    footerNote: detail.balanceDue > 0 ? `Please remit ${formatMoney(detail.balanceDue)} toward ${invLabel}.` : "",
    fileName: `Invoice-${safeRef}.pdf`,
  });
}

export function downloadJobCardDocumentPdf(
  detail: JobCardDetail,
  orgName: string,
  docType: "estimate" | "proforma",
  overrides?: { discountPaise?: number; taxPercent?: number }
) {
  const shortId = detail.jobCard.id.slice(0, 8).toUpperCase();
  const isEstimate = docType === "estimate";
  const docRef = `${isEstimate ? "EST" : "PI"}-${shortId}`;

  const subtotal = detail.jobCard.subtotal;
  const discount = overrides?.discountPaise ?? detail.jobCard.discount;
  const taxPct = overrides?.taxPercent ?? detail.jobCard.taxPercent;
  const afterDiscount = Math.max(subtotal - discount, 0);
  const taxAmount = Math.round(afterDiscount * (taxPct / 100));
  const total = afterDiscount + taxAmount;

  const vehicleParts = [
    detail.vehicle?.plateNumber || "-",
    detail.vehicle?.makeName,
    detail.vehicle?.modelName,
  ].filter(Boolean);

  renderPdfDocument({
    docTitle: isEstimate ? "ESTIMATE" : "PROFORMA INVOICE",
    docRef,
    detailsHeading: isEstimate ? "ESTIMATE DETAILS" : "PROFORMA DETAILS",
    recipientHeading: isEstimate ? "PREPARED FOR" : "BILLED TO",
    dateLabel: detail.jobCard.jobDate,
    statusText: isEstimate ? "ESTIMATE (SUBJECT TO REVISION)" : "PROFORMA · PAYMENT REQUEST",
    statusColor: isEstimate ? [217, 119, 6] : [37, 99, 235],
    orgName,
    clientName: detail.client?.name || "Customer",
    clientPhone: detail.client?.phone || "-",
    clientAddress: detail.client?.address,
    vehicleLabel: vehicleParts.join(" · "),
    lineItems: detail.lineItems,
    subtotal,
    discount,
    discountLabel: "Discount",
    taxAmount,
    totalLabel: isEstimate ? "Estimated Total" : "Total Payable",
    total,
    footerNote: isEstimate
      ? "Estimate only. Final charges may change if additional faults or parts are required."
      : `Proforma reference ${docRef}. Final Tax Invoice will be issued upon settlement.`,
    fileName: `${isEstimate ? "Estimate" : "Proforma"}-${shortId}.pdf`,
  });
}
