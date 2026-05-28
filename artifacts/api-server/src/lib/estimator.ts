import type { Material } from "@workspace/db";

export interface DeckSpec {
  lengthM: number;
  widthM: number;
  heightM: number;
  boardWidthMm: number;
  gapSpacingMm: number;
  joistSpacingMm: number;
  bearerSpacingMm: number;
  postSpacingMm: number;
  wastageFactor: number;
  deckBoardType: string;
  subframeType: string;
  fastenerType: string;
  fasciaType: string;
  includeHandrails: boolean;
  includeStairs: boolean;
  stairFlights: number;
  includeFencing: boolean;
  fencingSides: number;
  includeAwning: boolean;
  awningWidthM: number;
  awningLengthM: number;
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
  clip: { unit: "pack", price: 38.5, name: "Hidden deck clips (50pk)" },
  bracket: { unit: "each", price: 4.8, name: "Galvanised joist hanger" },
  sealant: { unit: "each", price: 49.0, name: "Decking oil 4L" },
  handrail: { unit: "metre", price: 45.0, name: "Timber handrail 68x42mm" },
  balustrade: { unit: "metre", price: 85.0, name: "Stainless balustrade system" },
  stair_stringer: { unit: "each", price: 65.0, name: "Stair stringer LVL" },
  stair_tread: { unit: "each", price: 28.0, name: "Stair tread 90x19mm hardwood" },
  fascia: { unit: "metre", price: 14.5, name: "Fascia board 190x19mm" },
  fencing_post: { unit: "each", price: 18.5, name: "Fence post 100x100mm H4" },
  fencing_rail: { unit: "metre", price: 8.9, name: "Fence rail 70x35mm" },
  fencing_paling: { unit: "each", price: 3.2, name: "Fence paling 100x19mm" },
};

function pickMaterial(materials: Material[], category: string): Material | undefined {
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
  const wastage = spec.wastageFactor || 1.1;
  const gap = spec.gapSpacingMm ?? 4;

  const make = (category: string, rawQuantity: number, descriptionOverride?: string): void => {
    const m = pickMaterial(materials, category);
    const fallback = FALLBACK_PRICE[category] ?? { unit: "each", price: 10, name: category };
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

  // ── Awning cutout: subtract awning footprint from deck area for board count ──
  let effectiveDeckWidthM = spec.widthM;
  if (spec.includeAwning && spec.awningWidthM > 0 && spec.awningLengthM > 0) {
    // Awning sits along one end — remove that strip from board count
    effectiveDeckWidthM = Math.max(0, spec.widthM - spec.awningWidthM);
  }

  // ── Decking boards — linear metres ──
  const boardsAcross = Math.ceil((effectiveDeckWidthM * 1000) / (spec.boardWidthMm + gap));
  const deckingLinearM = boardsAcross * spec.lengthM * wastage;
  const boardTypeLabel = spec.deckBoardType === "hardwood" ? "Hardwood" : spec.deckBoardType === "composite" ? "Composite" : "Treated pine";
  make("decking", deckingLinearM, `${boardTypeLabel} decking ${spec.boardWidthMm}mm (${gap}mm gap)`);

  // ── Joists — run across width, spaced along length ──
  const joistCount = Math.ceil((spec.lengthM * 1000) / spec.joistSpacingMm) + 1;
  const joistLinearM = joistCount * spec.widthM * wastage;
  make("joist", joistLinearM, `Joists @ ${spec.joistSpacingMm}mm centres`);

  // ── Bearers — run along length, spaced across width ──
  const bearerCount = Math.ceil((spec.widthM * 1000) / spec.bearerSpacingMm) + 1;
  const bearerLinearM = bearerCount * spec.lengthM * wastage;
  make("bearer", bearerLinearM, `Bearers @ ${spec.bearerSpacingMm}mm centres`);

  // ── Posts / subframe — only for stumps (skip for slab or existing) ──
  if (spec.subframeType !== "concrete_slab" && spec.subframeType !== "existing_structure") {
    const postsPerBearer = Math.ceil((spec.lengthM * 1000) / spec.postSpacingMm) + 1;
    const postCount = bearerCount * postsPerBearer;
    const postLinearM = postCount * (spec.heightM + 0.6);
    make("post", postLinearM, `Posts ${spec.heightM.toFixed(1)}m above ground`);
    make("stump", postCount, "Stump brackets / stirrups");
  }

  // ── Joist hangers ──
  make("bracket", joistCount * 2, "Joist hangers");

  // ── Fasteners ──
  const boardsAcrossTotal = Math.ceil((spec.widthM * 1000) / (spec.boardWidthMm + gap));
  if (spec.fastenerType === "hidden_clips") {
    const clipCount = Math.ceil(boardsAcrossTotal * joistCount * 2 * wastage);
    make("clip", clipCount, `Hidden deck clips (qty ${clipCount})`);
  } else {
    const screwCount = Math.ceil(boardsAcrossTotal * joistCount * 2 * wastage);
    make("screw", screwCount, `Decking screws (qty ${screwCount})`);
  }

  // ── Decking oil — 1L per ~5m² ──
  const area = spec.lengthM * spec.widthM;
  const oilLitres = Math.max(1, Math.ceil(area / 5));
  const sealMaterial = pickMaterial(materials, "sealant");
  const sealEach = Math.max(1, Math.ceil(oilLitres / 4));
  if (sealMaterial) {
    lines.push({
      materialId: sealMaterial.id,
      description: sealMaterial.name,
      category: "sealant",
      quantity: sealEach,
      unit: sealMaterial.unit,
      unitPrice: round2(Number(sealMaterial.unitPrice)),
      lineTotal: round2(sealEach * Number(sealMaterial.unitPrice)),
    });
  } else {
    make("sealant", sealEach, "Decking oil 4L");
  }

  // ── Fascia ──
  if (spec.fasciaType && spec.fasciaType !== "none") {
    const perimeter = 2 * (spec.lengthM + spec.widthM);
    const fasciaLabel = spec.fasciaType === "composite" ? "Composite fascia" : "Timber fascia";
    make("fascia", perimeter * wastage, `${fasciaLabel} board (perimeter ${perimeter.toFixed(1)}m)`);
  }

  // ── Handrails ──
  if (spec.includeHandrails) {
    // Handrail along 3 exposed sides (not the house side)
    const railLength = (spec.lengthM * 2 + spec.widthM) * wastage;
    make("handrail", railLength, `Handrail 3 sides (${railLength.toFixed(1)}m)`);
    make("balustrade", railLength, `Balustrade system (${railLength.toFixed(1)}m)`);
  }

  // ── Stairs ──
  if (spec.includeStairs && spec.stairFlights > 0) {
    const flights = spec.stairFlights;
    // Typical flight: 2 stringers, ~8 treads
    make("stair_stringer", flights * 2, `Stair stringers (${flights} flight${flights > 1 ? "s" : ""})`);
    make("stair_tread", flights * 8, `Stair treads (${flights * 8} treads)`);
  }

  // ── Fencing ──
  if (spec.includeFencing && spec.fencingSides > 0) {
    const sides = spec.fencingSides;
    // Assume alternating long/short sides
    const avgSideLen = (spec.lengthM + spec.widthM) / 2;
    const fenceLen = sides * avgSideLen;
    const postSpacing = 1.8;
    const fencePostCount = Math.ceil(fenceLen / postSpacing) + sides;
    const fenceRailM = fenceLen * 3 * wastage; // 3 rails per run
    const palingCount = Math.ceil((fenceLen * 1000) / 110); // 100mm palings, 10mm gap
    make("fencing_post", fencePostCount, `Fence posts (${sides} side${sides > 1 ? "s" : ""})`);
    make("fencing_rail", fenceRailM, `Fence rails (3 per run)`);
    make("fencing_paling", palingCount, `Fence palings (${palingCount})`);
  }

  const materialsSubtotal = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0));
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
