import { Router, type IRouter } from "express";
import PDFDocument from "pdfkit";
import { eq } from "drizzle-orm";
import {
  db,
  quotesTable,
  quoteLineItemsTable,
  customersTable,
} from "@workspace/db";

const router: IRouter = Router();

const ORANGE = "#ff7a00";
const DARK = "#1a1a1a";
const MID = "#3a3a3a";
const LIGHT_GREY = "#f5f5f5";
const TEXT = "#1a1a1a";
const MUTED = "#888888";

function formatAUD(n: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "long", year: "numeric" });
}

router.get("/quotes/:id/pdf", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [row] = await db
    .select({ q: quotesTable, customerName: customersTable.name })
    .from(quotesTable)
    .leftJoin(customersTable, eq(customersTable.id, quotesTable.customerId))
    .where(eq(quotesTable.id, id));

  if (!row) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }

  const lines = await db
    .select()
    .from(quoteLineItemsTable)
    .where(eq(quoteLineItemsTable.quoteId, id))
    .orderBy(quoteLineItemsTable.id);

  const q = row.q;
  const customerName = row.customerName ?? "Customer";
  const deckArea = Math.round(Number(q.lengthM) * Number(q.widthM) * 100) / 100;
  const councilWarning = Number(q.heightM) >= 1.0;

  // Build PDF
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    info: {
      Title: q.title,
      Author: "Deck Me",
    },
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="quote-${id}.pdf"`);
  doc.pipe(res);

  const pageW = 595.28;
  const margin = 50;
  const contentW = pageW - margin * 2;

  // ── Header banner ──
  doc.rect(0, 0, pageW, 90).fill(DARK);
  doc.rect(0, 90, pageW, 6).fill(ORANGE);

  // Logo / Brand
  doc
    .fontSize(28)
    .font("Helvetica-Bold")
    .fillColor(ORANGE)
    .text("DECK ME", margin, 22, { continued: false });

  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor("rgba(255,255,255,0.5)")
    .text("DECKING SPECIALISTS", margin, 55);

  // Quote title (right side of header)
  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .fillColor("white")
    .text(q.title.toUpperCase(), margin, 22, { align: "right" });

  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor("rgba(255,255,255,0.6)")
    .text(`Quote #${q.id}  ·  ${formatDate(q.createdAt)}`, margin, 40, { align: "right" });

  const statusColor = q.status === "accepted" ? "#22c55e" : q.status === "rejected" ? "#ef4444" : q.status === "sent" ? "#3b82f6" : "#888";
  doc.fontSize(9).font("Helvetica-Bold").fillColor(statusColor).text(q.status.toUpperCase(), margin, 58, { align: "right" });

  let y = 116;

  // ── Client / Job info block ──
  const infoY = y;
  // Left: client
  doc.fontSize(8).font("Helvetica-Bold").fillColor(MUTED).text("PREPARED FOR", margin, infoY);
  doc.fontSize(14).font("Helvetica-Bold").fillColor(TEXT).text(customerName, margin, infoY + 14);
  if (q.siteAddress) {
    doc.fontSize(10).font("Helvetica").fillColor(MUTED).text(q.siteAddress, margin, infoY + 32);
  }

  // Right: deck info
  const ri = margin + contentW / 2;
  doc.fontSize(8).font("Helvetica-Bold").fillColor(MUTED).text("DECK SPECIFICATION", ri, infoY);
  doc.fontSize(10).font("Helvetica").fillColor(TEXT)
    .text(`${q.lengthM}m × ${q.widthM}m  (${deckArea}m²)`, ri, infoY + 14)
    .text(`${q.heightM}m above ground`, ri, infoY + 28)
    .text(`${q.labourHours} hrs labour @ ${formatAUD(Number(q.labourRate))}/hr`, ri, infoY + 42);

  // Council warning
  if (councilWarning) {
    doc.rect(ri, infoY + 60, contentW / 2 - 5, 22).fill("#fef2f2");
    doc.rect(ri, infoY + 60, 3, 22).fill("#ef4444");
    doc.fontSize(8).font("Helvetica-Bold").fillColor("#dc2626")
      .text("⚠  Council permit may be required (deck >1m)", ri + 8, infoY + 67);
    y = infoY + 100;
  } else {
    y = infoY + 78;
  }

  // Divider
  doc.moveTo(margin, y).lineTo(margin + contentW, y).strokeColor("#e5e5e5").stroke();
  y += 20;

  // ── BOM Table header ──
  doc.rect(margin, y, contentW, 24).fill(DARK);
  doc.fontSize(8).font("Helvetica-Bold").fillColor("white")
    .text("ITEM", margin + 8, y + 8)
    .text("QTY", margin + contentW * 0.58, y + 8)
    .text("UNIT PRICE", margin + contentW * 0.72, y + 8)
    .text("TOTAL", margin + contentW * 0.88, y + 8);
  y += 24;

  // ── BOM rows ──
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const rowH = 26;
    const bg = i % 2 === 0 ? "#ffffff" : LIGHT_GREY;
    doc.rect(margin, y, contentW, rowH).fill(bg);

    const qty = Number(l.quantity);
    const unitPrice = Number(l.unitPrice);
    const lineTotal = Number(l.lineTotal);

    doc.fontSize(9).font("Helvetica-Bold").fillColor(TEXT)
      .text(l.description, margin + 8, y + 5, { width: contentW * 0.55, ellipsis: true });
    doc.fontSize(8).font("Helvetica").fillColor(MUTED)
      .text(l.category, margin + 8, y + 16, { width: contentW * 0.5 });

    doc.fontSize(9).font("Helvetica").fillColor(TEXT)
      .text(`${qty} ${l.unit}`, margin + contentW * 0.58, y + 9, { width: contentW * 0.12 })
      .text(formatAUD(unitPrice), margin + contentW * 0.72, y + 9, { width: contentW * 0.14 })
      .text(formatAUD(lineTotal), margin + contentW * 0.88, y + 9, { width: contentW * 0.11, align: "right" });

    y += rowH;

    // Page break
    if (y > 740) {
      doc.addPage();
      y = 50;
    }
  }

  // ── Totals block ──
  y += 10;
  const totalsX = margin + contentW * 0.58;
  const totalsW = contentW * 0.42;

  const drawTotalRow = (label: string, value: number, bold = false, big = false) => {
    if (bold) doc.rect(totalsX - 4, y - 2, totalsW + 4, big ? 30 : 24).fill(big ? DARK : "#f0f0f0");
    doc.fontSize(big ? 11 : 9)
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .fillColor(big ? "white" : TEXT)
      .text(label, totalsX, y + (big ? 8 : 4), { width: totalsW * 0.55 });
    doc.fontSize(big ? 13 : 9)
      .font("Helvetica-Bold")
      .fillColor(big ? ORANGE : TEXT)
      .text(formatAUD(value), totalsX, y + (big ? 7 : 4), { width: totalsW, align: "right" });
    y += big ? 30 : 24;
  };

  drawTotalRow("Materials Subtotal", Number(q.materialsSubtotal));
  drawTotalRow("Labour", Number(q.labourCost));
  drawTotalRow("GST (10%)", Number(q.gst));
  drawTotalRow("TOTAL (inc GST)", Number(q.total), true, true);

  y += 30;

  // ── Notes ──
  if (q.notes) {
    doc.fontSize(8).font("Helvetica-Bold").fillColor(MUTED).text("NOTES", margin, y);
    doc.fontSize(9).font("Helvetica").fillColor(TEXT).text(q.notes, margin, y + 12, { width: contentW });
    y += 40;
  }

  // ── Footer ──
  const footerY = 790;
  doc.moveTo(margin, footerY).lineTo(margin + contentW, footerY).strokeColor("#e5e5e5").stroke();
  doc.fontSize(8).font("Helvetica").fillColor(MUTED)
    .text("Generated by Deck Me  ·  Prices are estimates only  ·  GST inclusive", margin, footerY + 8, { align: "center", width: contentW });

  if (councilWarning) {
    doc.fontSize(7).fillColor("#dc2626")
      .text("⚠  This deck may require council approval — verify with your local council before commencing work.", margin, footerY + 22, { align: "center", width: contentW });
  }

  doc.end();
});

export default router;
