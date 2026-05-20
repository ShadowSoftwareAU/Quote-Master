import type { Material } from "@workspace/db";

export interface DeckSpec {
  lengthM: number;
  widthM: number;
  heightM: number;
  boardWidthMm: number;
  joistSpacingMm: number;
  bearerSpacingMm: number;
  postSpacingMm: number;
  wastageFactor: number;
}

export interface EstimateLine {
  materialId: number | null;
  description: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
}

const FALLBACK_PRICE: Record<string, { unit: string; price: number; name: string }> = {
  decking: { unit: "metre", price: 9.5, name: "Merbau decking 90x19mm" },
  joist: { unit: "metre", price: 8.2, name: "Treated pine joist 90x45mm" },
  bearer: { unit: "metre", price: 12.4, name: "Treated pine bearer 140x45mm" },
  post: { unit: "metre", price: 11.9, name: "Treated pine post 90x90mm" },
  stump: { unit: "each", price: 22.5, name: "Galvanised stirrup stump bracket" },
  screw: { unit: "pack", price: 28.9, name: "Decking screws 65mm (100pk)" },
  bracket: { unit: "each", price: 4.8, name: "Galvanised joist hanger" },
  sealant: { unit: "each", price: 49.0, name: "Decking oil 4L" },
};

function pickMaterial(
  materials: Material[],
  category: string,
): Material | undefined {
  return materials.find((m) => m.category === category);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function estimateDeck(
  spec: DeckSpec,
  materials: Material[],
): {
  lines: EstimateLine[];
  deckAreaM2: number;
  materialsSubtotal: number;
} {
  const lines: EstimateLine[] = [];
  const area = spec.lengthM * spec.widthM;
  const wastage = spec.wastageFactor || 1.1;

  const make = (
    category: string,
    rawQuantity: number,
    descriptionOverride?: string,
  ): void => {
    const m = pickMaterial(materials, category);
    const fallback = FALLBACK_PRICE[category] ?? {
      unit: "each",
      price: 10,
      name: category,
    };
    const unit = m?.unit ?? fallback.unit;
    const unitPrice = m ? Number(m.unitPrice) : fallback.price;
    const name = m?.name ?? fallback.name;
    let quantity = rawQuantity;
    if (unit === "pack" && m?.packSize) {
      quantity = Math.ceil(rawQuantity / m.packSize);
    } else if (unit === "pack") {
      quantity = Math.ceil(rawQuantity / 100);
    } else {
      quantity = Math.ceil(rawQuantity * 10) / 10;
    }
    const lineTotal = round2(quantity * unitPrice);
    lines.push({
      materialId: m?.id ?? null,
      description: descriptionOverride ?? name,
      category,
      quantity,
      unit,
      unitPrice: round2(unitPrice),
      lineTotal,
    });
  };

  // Decking boards — linear metres
  const boardGapMm = 4;
  const boardsAcross = Math.ceil(
    (spec.widthM * 1000) / (spec.boardWidthMm + boardGapMm),
  );
  const deckingLinearM = boardsAcross * spec.lengthM * wastage;
  make("decking", deckingLinearM, `Decking boards ${spec.boardWidthMm}mm`);

  // Joists — run across width, spaced along length
  const joistCount = Math.ceil((spec.lengthM * 1000) / spec.joistSpacingMm) + 1;
  const joistLinearM = joistCount * spec.widthM * wastage;
  make("joist", joistLinearM, `Joists @ ${spec.joistSpacingMm}mm centres`);

  // Bearers — run along length, spaced across width
  const bearerCount =
    Math.ceil((spec.widthM * 1000) / spec.bearerSpacingMm) + 1;
  const bearerLinearM = bearerCount * spec.lengthM * wastage;
  make("bearer", bearerLinearM, `Bearers @ ${spec.bearerSpacingMm}mm centres`);

  // Posts — under bearer/post grid
  const postsPerBearer =
    Math.ceil((spec.lengthM * 1000) / spec.postSpacingMm) + 1;
  const postCount = bearerCount * postsPerBearer;
  const postLinearM = postCount * (spec.heightM + 0.6); // 600mm in ground
  make("post", postLinearM, `Posts ${spec.heightM.toFixed(1)}m above ground`);

  // Stump brackets — one per post
  make("stump", postCount, "Stump brackets / stirrups");

  // Joist hangers — joistCount * 2 ends
  make("bracket", joistCount * 2, "Joist hangers");

  // Screws — ~ 2 screws per joist per board crossing
  const screwCount = Math.ceil(boardsAcross * joistCount * 2 * wastage);
  make("screw", screwCount, `Decking screws (qty ${screwCount})`);

  // Decking oil — 1L per ~5m2
  const oilLitres = Math.max(1, Math.ceil(area / 5));
  const sealMaterial = pickMaterial(materials, "sealant");
  const sealEach = Math.max(1, Math.ceil(oilLitres / 4));
  if (sealMaterial) {
    const lt = round2(sealEach * Number(sealMaterial.unitPrice));
    lines.push({
      materialId: sealMaterial.id,
      description: sealMaterial.name,
      category: "sealant",
      quantity: sealEach,
      unit: sealMaterial.unit,
      unitPrice: round2(Number(sealMaterial.unitPrice)),
      lineTotal: lt,
    });
  } else {
    make("sealant", sealEach, "Decking oil 4L");
  }

  const materialsSubtotal = round2(
    lines.reduce((sum, l) => sum + l.lineTotal, 0),
  );

  return { lines, deckAreaM2: round2(area), materialsSubtotal };
}

export function calcTotals(opts: {
  materialsSubtotal: number;
  labourHours: number;
  labourRate: number;
}): { labourCost: number; gst: number; total: number } {
  const labourCost = round2(opts.labourHours * opts.labourRate);
  const exGst = round2(opts.materialsSubtotal + labourCost);
  const gst = round2(exGst * 0.1);
  const total = round2(exGst + gst);
  return { labourCost, gst, total };
}
