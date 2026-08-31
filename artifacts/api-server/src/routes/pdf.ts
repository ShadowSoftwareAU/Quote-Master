import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import PDFDocument from "pdfkit";
import { and, eq } from "drizzle-orm";
import {
  db,
  quotesTable,
  quoteLineItemsTable,
  customersTable,
  businessProfilesTable,
} from "@workspace/db";
import { GetMasterProjectPdfParams, GetQuoteParams } from "@workspace/api-zod";
import { complianceDisclaimerForTrade } from "../lib/quoteCompliance";
import { requireMasterBuilder } from "../middlewares/masterBuilderAuth";
import { getMasterProject } from "../services/masterProjects";

const router: IRouter = Router();

const ORANGE = "#ff7a00";
const DARK = "#1a1a1a";
const MID = "#3a3a3a";
const LIGHT_GREY = "#f5f5f5";
const TEXT = "#1a1a1a";
const MUTED = "#888888";

function formatAUD(n: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(n);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

router.get(
  "/quotes/:id/pdf",
  async (req, res): Promise<void> => {
    try {
      const clerkUserId = getAuth(req).userId;
      if (!clerkUserId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const params = GetQuoteParams.safeParse(req.params);
      if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
      }
      const id = params.data.id;

      const [row] = await db
        .select({ q: quotesTable, customerName: customersTable.name })
        .from(quotesTable)
        .leftJoin(
          customersTable,
          and(
            eq(customersTable.id, quotesTable.customerId),
            eq(customersTable.clerkUserId, clerkUserId),
          ),
        )
        .where(
          and(eq(quotesTable.id, id), eq(quotesTable.clerkUserId, clerkUserId)),
        );

      if (!row) {
        res.status(404).json({ error: "Quote not found" });
        return;
      }

      const lines = await db
        .select({ line: quoteLineItemsTable })
        .from(quoteLineItemsTable)
        .innerJoin(
          quotesTable,
          and(
            eq(quotesTable.id, quoteLineItemsTable.quoteId),
            eq(quotesTable.clerkUserId, clerkUserId),
          ),
        )
        .where(eq(quoteLineItemsTable.quoteId, id))
        .orderBy(quoteLineItemsTable.id)
        .then((rows) => rows.map((line) => line.line));

      const q = row.q;
      const [profile] = await db
        .select({
          licenseNumber: businessProfilesTable.licenseNumber,
          businessName: businessProfilesTable.businessName,
          phoneNumber: businessProfilesTable.phoneNumber,
          tradeType: businessProfilesTable.tradeType,
        })
        .from(businessProfilesTable)
        .where(eq(businessProfilesTable.clerkUserId, clerkUserId))
        .limit(1);
      const complianceDisclaimer =
        q.complianceDisclaimer ??
        complianceDisclaimerForTrade(profile?.tradeType ?? q.tradeType);
      const contractorLicenseNumber =
        q.contractorLicenseNumber ?? profile?.licenseNumber ?? null;
      const businessName = profile?.businessName ?? "Quote Master";
      const businessPhone = profile?.phoneNumber ?? null;
      const businessTradeType = profile?.tradeType ?? q.tradeType;
      const customerName = row.customerName ?? "Customer";
      const deckArea =
        Math.round(Number(q.lengthM) * Number(q.widthM) * 100) / 100;
      const councilWarning = Number(q.heightM) >= 1.0;

      // Build PDF
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: q.title,
          Author: "Quote Master",
        },
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="quote-${id}.pdf"`,
      );
      doc.pipe(res);

      const pageW = 595.28;
      const margin = 50;
      const contentW = pageW - margin * 2;

      // ── Header banner ──
      doc.rect(0, 0, pageW, 90).fill(DARK);
      doc.rect(0, 90, pageW, 6).fill(ORANGE);

      // Logo / Brand. The mark is a safe PDF fallback when no uploaded business
      // logo is configured, while keeping the business identity prominent.
      doc.roundedRect(margin, 22, 34, 34, 6).fill(ORANGE);
      doc
        .fontSize(18)
        .font("Helvetica-Bold")
        .fillColor(DARK)
        .text(businessName.trim().slice(0, 2).toUpperCase(), margin, 30, {
          width: 34,
          align: "center",
        });
      doc
        .fontSize(20)
        .font("Helvetica-Bold")
        .fillColor(ORANGE)
        .text(businessName.toUpperCase(), margin + 44, 27, {
          continued: false,
          width: contentW * 0.48,
          ellipsis: true,
        });

      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("rgba(255,255,255,0.5)")
        .text(
          `${businessTradeType.toUpperCase()}${businessPhone ? `  ·  ${businessPhone}` : ""}`,
          margin + 44,
          55,
        );

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
        .text(`Quote #${q.id}  ·  ${formatDate(q.createdAt)}`, margin, 40, {
          align: "right",
        });

      const statusColor =
        q.status === "accepted"
          ? "#22c55e"
          : q.status === "rejected"
            ? "#ef4444"
            : q.status === "sent"
              ? "#3b82f6"
              : "#888";
      doc
        .fontSize(9)
        .font("Helvetica-Bold")
        .fillColor(statusColor)
        .text(q.status.toUpperCase(), margin, 58, { align: "right" });

      let y = 116;
      const pageContentBottom = 750;
      const drawTableHeader = () => {
        doc.rect(margin, y, contentW, 24).fill(DARK);
        doc
          .fontSize(8)
          .font("Helvetica-Bold")
          .fillColor("white")
          .text("ITEM", margin + 8, y + 8)
          .text("QTY", margin + contentW * 0.58, y + 8)
          .text("UNIT PRICE", margin + contentW * 0.72, y + 8)
          .text("TOTAL", margin + contentW * 0.88, y + 8);
        y += 24;
      };
      const ensureSpace = (height: number, redrawTableHeader = false) => {
        if (y + height <= pageContentBottom) return;
        doc.addPage();
        y = 50;
        if (redrawTableHeader) drawTableHeader();
      };

      // ── Client / Job info block ──
      const infoY = y;
      // Left: client
      doc
        .fontSize(8)
        .font("Helvetica-Bold")
        .fillColor(MUTED)
        .text("PREPARED FOR", margin, infoY);
      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .fillColor(TEXT)
        .text(customerName, margin, infoY + 14);
      if (q.siteAddress) {
        doc
          .fontSize(10)
          .font("Helvetica")
          .fillColor(MUTED)
          .text(q.siteAddress, margin, infoY + 32);
      }

      // Right: job and trade info
      const ri = margin + contentW / 2;
      doc
        .fontSize(8)
        .font("Helvetica-Bold")
        .fillColor(MUTED)
        .text("JOB DETAILS", ri, infoY);
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor(TEXT)
        .text(`${q.lengthM}m × ${q.widthM}m  (${deckArea}m²)`, ri, infoY + 14)
        .text(`${q.heightM}m above ground`, ri, infoY + 28)
        .text(businessTradeType, ri, infoY + 42);

      // Council warning
      if (councilWarning) {
        doc.rect(ri, infoY + 60, contentW / 2 - 5, 22).fill("#fef2f2");
        doc.rect(ri, infoY + 60, 3, 22).fill("#ef4444");
        doc
          .fontSize(8)
          .font("Helvetica-Bold")
          .fillColor("#dc2626")
          .text(
            "⚠  Council permit may be required (deck >1m)",
            ri + 8,
            infoY + 67,
          );
        y = infoY + 100;
      } else {
        y = infoY + 78;
      }

      // Divider
      doc
        .moveTo(margin, y)
        .lineTo(margin + contentW, y)
        .strokeColor("#e5e5e5")
        .stroke();
      y += 20;

      // ── BOM Table header ──
      drawTableHeader();

      // ── BOM rows ──
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        const rowH = 26;
        ensureSpace(rowH, true);
        const bg = i % 2 === 0 ? "#ffffff" : LIGHT_GREY;
        doc.rect(margin, y, contentW, rowH).fill(bg);

        const qty = Number(l.quantity);
        const lineTotal = Number(l.lineTotal);
        const unitPrice =
          qty > 0
            ? Math.round((lineTotal / qty + Number.EPSILON) * 100) / 100
            : 0;

        doc
          .fontSize(9)
          .font("Helvetica-Bold")
          .fillColor(TEXT)
          .text(l.description, margin + 8, y + 5, {
            width: contentW * 0.55,
            ellipsis: true,
          });
        doc
          .fontSize(8)
          .font("Helvetica")
          .fillColor(MUTED)
          .text(l.category, margin + 8, y + 16, { width: contentW * 0.5 });

        doc
          .fontSize(9)
          .font("Helvetica")
          .fillColor(TEXT)
          .text(
            `${qty} ${l.unitType || l.unit}`,
            margin + contentW * 0.58,
            y + 9,
            { width: contentW * 0.12 },
          )
          .text(formatAUD(unitPrice), margin + contentW * 0.72, y + 9, {
            width: contentW * 0.14,
          })
          .text(formatAUD(lineTotal), margin + contentW * 0.88, y + 9, {
            width: contentW * 0.11,
            align: "right",
          });

        y += rowH;
      }

      // ── Totals block ──
      y += 10;
      ensureSpace(112);
      const totalsX = margin + contentW * 0.58;
      const totalsW = contentW * 0.42;

      const drawTotalRow = (
        label: string,
        value: number,
        bold = false,
        big = false,
      ) => {
        if (bold)
          doc
            .rect(totalsX - 4, y - 2, totalsW + 4, big ? 30 : 24)
            .fill(big ? DARK : "#f0f0f0");
        doc
          .fontSize(big ? 11 : 9)
          .font(bold ? "Helvetica-Bold" : "Helvetica")
          .fillColor(big ? "white" : TEXT)
          .text(label, totalsX, y + (big ? 8 : 4), { width: totalsW * 0.55 });
        doc
          .fontSize(big ? 13 : 9)
          .font("Helvetica-Bold")
          .fillColor(big ? ORANGE : TEXT)
          .text(formatAUD(value), totalsX, y + (big ? 7 : 4), {
            width: totalsW,
            align: "right",
          });
        y += big ? 30 : 24;
      };

      drawTotalRow("Materials Subtotal", Number(q.materialsSubtotal));
      drawTotalRow("Labour", Number(q.labourCost));
      drawTotalRow("GST (10%)", Number(q.gst));
      drawTotalRow("TOTAL (inc GST)", Number(q.total), true, true);

      y += 30;

      // ── Notes ──
      if (q.notes) {
        ensureSpace(36);
        doc
          .fontSize(8)
          .font("Helvetica-Bold")
          .fillColor(MUTED)
          .text("NOTES", margin, y);
        doc
          .fontSize(9)
          .font("Helvetica")
          .fillColor(TEXT)
          .text(q.notes, margin, y + 12, { width: contentW });
        y = doc.y + 18;
      }

      ensureSpace(48);
      doc
        .fontSize(8)
        .font("Helvetica-Bold")
        .fillColor(MUTED)
        .text("COMPLIANCE", margin, y);
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor(TEXT)
        .text(complianceDisclaimer, margin, y + 12, { width: contentW });
      y = doc.y + 14;
      if (contractorLicenseNumber) {
        ensureSpace(24);
        doc
          .fontSize(9)
          .font("Helvetica-Bold")
          .fillColor(TEXT)
          .text(
            `Builder / Contractor Licence: ${contractorLicenseNumber}`,
            margin,
            y,
            { width: contentW },
          );
      }

      // ── Footer ──
      const footerY = 790;
      doc
        .moveTo(margin, footerY)
        .lineTo(margin + contentW, footerY)
        .strokeColor("#e5e5e5")
        .stroke();
      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor(MUTED)
        .text(
          "Generated by Quote Master  ·  Prices are estimates only  ·  GST inclusive",
          margin,
          footerY + 8,
          { align: "center", width: contentW },
        );

      if (councilWarning) {
        doc
          .fontSize(7)
          .fillColor("#dc2626")
          .text(
            "⚠  This deck may require council approval — verify with your local council before commencing work.",
            margin,
            footerY + 22,
            { align: "center", width: contentW },
          );
      }

      doc.end();
    } catch (error) {
      req.log?.error(
        { err: error, quoteId: req.params.id },
        "Quote PDF generation failed",
      );
      if (!res.headersSent) {
        res.status(500).json({ error: "Unable to generate quote PDF" });
      } else {
        res.end();
      }
    }
  },
);

router.get(
  "/master-projects/:id/pdf",
  requireMasterBuilder,
  async (req, res): Promise<void> => {
    const clerkUserId = getAuth(req).userId;
    if (!clerkUserId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const params = GetMasterProjectPdfParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const project = await getMasterProject(params.data.id, clerkUserId);
    if (!project) {
      res.status(404).json({ error: "Master Project not found" });
      return;
    }

    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, bottom: 55, left: 50, right: 50 },
      info: { Title: project.title, Author: "Quote Master" },
    });
    const pageW = 595.28;
    const margin = 50;
    const contentW = pageW - margin * 2;
    let y = 116;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="master-proposal-${project.id}.pdf"`,
    );
    doc.pipe(res);

    const drawHeader = () => {
      doc.rect(0, 0, pageW, 90).fill(DARK);
      doc.rect(0, 90, pageW, 6).fill(ORANGE);
      doc
        .fontSize(26)
        .font("Helvetica-Bold")
        .fillColor(ORANGE)
        .text("QUOTE MASTER", margin, 22);
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#c7c7c7")
        .text("MASTER PROJECT PROPOSAL", margin, 55);
      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .fillColor("white")
        .text(project.title.toUpperCase(), margin, 22, { align: "right" });
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#c7c7c7")
        .text(
          `Proposal #${project.id}  ·  ${formatDate(new Date(project.createdAt))}`,
          margin,
          42,
          { align: "right" },
        );
    };
    const ensureSpace = (height: number) => {
      if (y + height <= 760) return;
      doc.addPage();
      y = 50;
    };

    drawHeader();
    doc
      .fontSize(8)
      .font("Helvetica-Bold")
      .fillColor(MUTED)
      .text("PREPARED FOR", margin, y);
    doc
      .fontSize(15)
      .font("Helvetica-Bold")
      .fillColor(TEXT)
      .text(project.customerName ?? "Customer", margin, y + 14);
    doc
      .fontSize(8)
      .font("Helvetica-Bold")
      .fillColor(MUTED)
      .text("PROJECT SUMMARY", margin + contentW / 2, y);
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor(TEXT)
      .text(
        `${project.quotes.length} trade quote${project.quotes.length === 1 ? "" : "s"} combined`,
        margin + contentW / 2,
        y + 14,
      )
      .text(
        `Status: ${project.status.toUpperCase()}`,
        margin + contentW / 2,
        y + 30,
      );
    y += 66;
    if (project.notes) {
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor(MID)
        .text(project.notes, margin, y, { width: contentW });
      y += doc.heightOfString(project.notes, { width: contentW }) + 18;
    }

    for (const group of project.tradeGroups) {
      ensureSpace(70);
      doc.rect(margin, y, contentW, 28).fill(DARK);
      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .fillColor("white")
        .text(group.label.toUpperCase(), margin + 10, y + 8);
      y += 36;
      for (const quote of group.quotes) {
        ensureSpace(68);
        doc
          .fontSize(11)
          .font("Helvetica-Bold")
          .fillColor(TEXT)
          .text(quote.title, margin, y);
        doc
          .fontSize(8)
          .font("Helvetica-Bold")
          .fillColor(MUTED)
          .text(quote.status.toUpperCase(), margin, y, { align: "right" });
        y += 18;
        for (const line of quote.lineItems) {
          ensureSpace(22);
          doc
            .fontSize(8.5)
            .font("Helvetica")
            .fillColor(MID)
            .text(
              `${line.description}  ·  ${line.quantity} ${line.unit}`,
              margin + 8,
              y,
              { width: contentW * 0.7 },
            );
          doc
            .font("Helvetica-Bold")
            .fillColor(TEXT)
            .text(formatAUD(line.lineTotal), margin, y, {
              width: contentW,
              align: "right",
            });
          y += 17;
        }
        doc
          .moveTo(margin, y)
          .lineTo(margin + contentW, y)
          .strokeColor("#e5e5e5")
          .stroke();
        y += 9;
        doc
          .fontSize(9)
          .font("Helvetica-Bold")
          .fillColor(TEXT)
          .text(
            `Trade quote total (inc GST): ${formatAUD(quote.total)}`,
            margin,
            y,
            { align: "right" },
          );
        y += 25;
      }
    }

    ensureSpace(150);
    const totalsX = margin + contentW * 0.5;
    const totalsW = contentW * 0.5;
    const totalRow = (label: string, value: number, emphasis = false) => {
      if (emphasis) doc.rect(totalsX - 6, y - 3, totalsW + 6, 30).fill(DARK);
      doc
        .fontSize(emphasis ? 11 : 9)
        .font(emphasis ? "Helvetica-Bold" : "Helvetica")
        .fillColor(emphasis ? "white" : TEXT)
        .text(label, totalsX, y + (emphasis ? 7 : 3));
      doc
        .font("Helvetica-Bold")
        .fillColor(emphasis ? ORANGE : TEXT)
        .text(formatAUD(value), totalsX, y + (emphasis ? 7 : 3), {
          width: totalsW,
          align: "right",
        });
      y += emphasis ? 30 : 22;
    };
    totalRow("Materials subtotal", project.materialsSubtotal);
    totalRow("Labour subtotal", project.labourSubtotal);
    if (project.marginAmount > 0) {
      totalRow(
        `Builder margin (${project.builderMarginPct}%)`,
        project.marginAmount,
      );
    }
    totalRow("GST (10%)", project.gst);
    totalRow("TOTAL (inc GST)", project.total, true);

    ensureSpace(90);
    y += 24;
    doc
      .fontSize(8)
      .font("Helvetica-Bold")
      .fillColor(MUTED)
      .text("AUSTRALIAN BUILDING COMPLIANCE", margin, y);
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor(TEXT)
      .text(project.complianceDisclaimer, margin, y + 13, { width: contentW });

    doc
      .fontSize(8)
      .font("Helvetica")
      .fillColor(MUTED)
      .text(
        "Generated by Quote Master  ·  Prices are estimates only  ·  GST inclusive",
        margin,
        800,
        { align: "center", width: contentW },
      );
    doc.end();
  },
);

export default router;
