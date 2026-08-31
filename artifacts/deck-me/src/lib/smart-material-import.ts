import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Material } from "@workspace/api-client-react";

export const IMPORT_VENDORS = [
  "Finlaysons",
  "Bunnings Trade",
  "Mitre 10",
  "Other",
] as const;

export type ImportVendor = (typeof IMPORT_VENDORS)[number];
export type ImportPhase = "idle" | "reading" | "ready" | "error";

export type ImportedMaterialRow = {
  id: string;
  name: string;
  vendorSku: string;
  quantity: number;
  unitPrice: number;
  vendorName: string;
  stockStatus: string;
  matchedMaterialId?: number;
  isSubstituted?: boolean;
};

type ParsedCsvRow = Omit<ImportedMaterialRow, "id" | "matchedMaterialId" | "isSubstituted">;

const SPECIAL_ITEM = "140x45mm Merbau Decking";
const BUNNINGS_SUBSTITUTE = {
  vendorName: "Bunnings Trade",
  vendorSku: "BUN-MERBAU-14045",
  unitPrice: 89.9,
  stockStatus: "In Stock",
};

function normaliseHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseCsvCells(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const next = line[index + 1];
    if (character === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function numberFromCell(value: string | undefined, fallback: number): number {
  const parsed = Number((value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function columnIndex(headers: string[], names: string[]): number {
  return headers.findIndex((header) => names.some((name) => header.includes(name)));
}

export function parseMaterialPricingCsv(
  text: string,
  selectedVendor: ImportVendor,
): ParsedCsvRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = parseCsvCells(lines[0]).map(normaliseHeader);
  const nameIndex = columnIndex(headers, ["name", "material", "description", "item"]);
  const skuIndex = columnIndex(headers, ["vendorsku", "sku", "code", "part"]);
  const priceIndex = columnIndex(headers, ["tradecost", "cost", "price", "buy", "unitprice"]);
  const quantityIndex = columnIndex(headers, ["quantity", "qty"]);
  const stockIndex = columnIndex(headers, ["stock", "availability", "status"]);
  if (nameIndex < 0 || priceIndex < 0) return [];

  return lines.slice(1).flatMap((line) => {
    const cells = parseCsvCells(line);
    const name = cells[nameIndex]?.trim();
    const unitPrice = numberFromCell(cells[priceIndex], 0);
    if (!name || unitPrice <= 0) return [];
    return [{
      name,
      vendorSku: cells[skuIndex]?.trim() || "Pending SKU",
      quantity: numberFromCell(cells[quantityIndex], 1),
      unitPrice,
      vendorName: selectedVendor,
      stockStatus: cells[stockIndex]?.trim() || "In Stock",
    }];
  });
}

function isSpecialItem(name: string): boolean {
  return name.trim().toLocaleLowerCase("en-AU") === SPECIAL_ITEM.toLocaleLowerCase("en-AU");
}

export function useSmartMaterialImport(materials?: Material[]) {
  const [selectedVendor, setSelectedVendorState] = useState<ImportVendor>("Finlaysons");
  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [readingCount, setReadingCount] = useState(0);
  const [rows, setRows] = useState<ImportedMaterialRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [alertRowId, setAlertRowId] = useState<string | null>(null);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const parseTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (parseTimer.current !== null) window.clearTimeout(parseTimer.current);
  }, []);

  const matchRows = useCallback((parsedRows: ParsedCsvRow[]) => {
    return parsedRows.map((row, index) => {
      const matched = materials?.find((material) =>
        (row.vendorSku !== "Pending SKU" && (
          material.vendorSku?.toLowerCase() === row.vendorSku.toLowerCase()
          || material.sku?.toLowerCase() === row.vendorSku.toLowerCase()
        )) || material.name.toLowerCase() === row.name.toLowerCase(),
      );
      return {
        ...row,
        id: `${Date.now()}-${index}`,
        matchedMaterialId: matched?.id,
      };
    });
  }, [materials]);

  const parseText = useCallback((text: string) => {
    const nonEmptyLines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    setPhase("reading");
    setReadingCount(Math.max(0, nonEmptyLines.length - 1));
    setError(null);
    setRows([]);
    setAlertRowId(null);
    setAlertDismissed(false);
    if (parseTimer.current !== null) window.clearTimeout(parseTimer.current);
    parseTimer.current = window.setTimeout(() => {
      const parsedRows = parseMaterialPricingCsv(text, selectedVendor);
      if (!parsedRows.length) {
        setPhase("error");
        setError("No valid rows found. Include an item name and a price or trade cost column.");
        return;
      }
      setRows(matchRows(parsedRows));
      setPhase("ready");
    }, 450);
  }, [matchRows, selectedVendor]);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => parseText(String(reader.result ?? ""));
    reader.onerror = () => {
      setPhase("error");
      setError("The CSV could not be read. Try exporting it again as UTF-8 CSV.");
    };
    reader.readAsText(file);
  }, [parseText]);

  const setSelectedVendor = useCallback((vendor: ImportVendor) => {
    setSelectedVendorState(vendor);
    setAlertDismissed(false);
    setRows((currentRows) => currentRows.map((row) => ({
      ...row,
      vendorName: vendor,
    })));
  }, []);

  useEffect(() => {
    if (
      phase === "ready"
      && selectedVendor === "Finlaysons"
      && !alertDismissed
      && !alertRowId
    ) {
      const specialRow = rows.find((row) => isSpecialItem(row.name) && row.vendorName === "Finlaysons");
      if (specialRow) setAlertRowId(specialRow.id);
    }
  }, [alertDismissed, alertRowId, phase, rows, selectedVendor]);

  const acceptSubstitute = useCallback(() => {
    if (!alertRowId) return;
    setRows((currentRows) => currentRows.map((row) => row.id === alertRowId
      ? { ...row, ...BUNNINGS_SUBSTITUTE, isSubstituted: true }
      : row));
    setAlertRowId(null);
    setAlertDismissed(true);
  }, [alertRowId]);

  const declineSubstitute = useCallback(() => {
    setAlertRowId(null);
    setAlertDismissed(true);
  }, []);

  const alertRow = rows.find((row) => row.id === alertRowId);
  const quoteSubtotal = useMemo(
    () => rows.reduce((total, row) => total + row.quantity * row.unitPrice, 0),
    [rows],
  );
  const quoteTotal = Math.round(quoteSubtotal * 1.1 * 100) / 100;

  return {
    selectedVendor,
    setSelectedVendor,
    phase,
    readingCount,
    rows,
    error,
    handleFile,
    parseText,
    alertRow,
    acceptSubstitute,
    declineSubstitute,
    quoteSubtotal,
    quoteTotal,
    specialItemName: SPECIAL_ITEM,
  };
}