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
  // Handrails
  includeHandrails: boolean;
  handrailHeightMm: number;
  balustradeType: string;
  timberGapMm: number;
  wireSpacingMm: number;
  // Stairs
  includeStairs: boolean;
  stairFlights: number;
  // Fencing
  includeFencing: boolean;
  fencingSides: number;
  fencingHeightM: number;
  fencingWidthM: number;
  // Awning
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

function pickMaterial(
  materials: Material[],
  category: string,
  spec?: Pick<DeckSpec, "deckBoardType" | "balustradeType">,
): Material | undefined {
  const candidates = materials.filter((m) => m.category === category);
  if (candidates.length === 0) return undefined;

  if (category === "decking") {
    if (spec?.deckBoardType === "composite") {
      return candidates.find((m) => /composite/i.test(m.name)) ?? candidates[0];
    }
    if (spec?.deckBoardType === "hardwood") {
      return candidates.find((m) => /hardwood|spotted gum/i.test(m.name)) ?? candidates[0];
    }
  }

  if (category === "balustrade") {
    if (spec?.balustradeType === "stainless_cable") {
      return candidates.find((m) => /stainless|cable/i.test(m.name)) ?? candidates[0];
    }
    return candidates.find((m) => /timber|picket/i.test(m.name)) ?? candidates[0];
  }

  return candidates[0];
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
    const m = pickMaterial(materials, category, spec);
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
  const sealMaterial = pickMaterial(materials, "sealant", spec);
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

  // ── Handrails & Balustrade ──
  if (spec.includeHandrails) {
    const handrailHeightMm = spec.handrailHeightMm || 1000;
    const handrailHeightM = handrailHeightMm / 1000;
    // Auto-calc: 3 exposed deck sides + stair flight handrails (2 sides per flight, ~1.5m run)
    const deckRailM = spec.lengthM * 2 + spec.widthM;
    const stairRailM = spec.includeStairs ? (spec.stairFlights || 0) * 1.5 * 2 : 0;
    const railLength = round2((deckRailM + stairRailM) * wastage);

    make("handrail", railLength, `Handrail ${handrailHeightMm}mm, 3 sides${stairRailM > 0 ? " + stairs" : ""} (${railLength}m)`);

    const baluType = spec.balustradeType || "timber";
    if (baluType === "stainless_cable") {
      // Horizontal wire runs: from 100mm to handrail height, spaced at wireSpacingMm
      const wireSpacingMm = spec.wireSpacingMm || 100;
      const wireRuns = Math.ceil((handrailHeightMm - 100) / wireSpacingMm);
      const wireMetres = round2(wireRuns * railLength * 1.05); // 5% for termination loops
      make("balustrade", wireMetres, `Stainless cable ${wireRuns} runs × ${railLength}m (${wireSpacingMm}mm spacing)`);
    } else {
      // Timber picket infill
      const timberGapMm = spec.timberGapMm || 15;
      const baluWidthMm = 42; // typical 42×42 baluster
      const picketsPerMetre = 1000 / (baluWidthMm + timberGapMm);
      const totalPickets = Math.ceil(railLength * picketsPerMetre);
      const timberLinearM = round2(totalPickets * handrailHeightM);
      make("balustrade", timberLinearM, `Timber infill ${totalPickets} pickets (${timberGapMm}mm gap, ${handrailHeightMm}mm high)`);
    }
  }

  // ── Stairs ──
  if (spec.includeStairs && spec.stairFlights > 0) {
    const flights = spec.stairFlights;
    make("stair_stringer", flights * 2, `Stair stringers (${flights} flight${flights > 1 ? "s" : ""})`);
    make("stair_tread", flights * 8, `Stair treads (${flights * 8} treads)`);
  }

  // ── Fencing ──
  if (spec.includeFencing && spec.fencingSides > 0) {
    const sides = spec.fencingSides;
    const avgSideLen = (spec.lengthM + spec.widthM) / 2;
    const fenceLen = sides * avgSideLen;
    const bayWidthM = spec.fencingWidthM || 1.8;
    const fenceHeightM = spec.fencingHeightM || 1.8;

    // Posts: one per bay boundary + one at each end per side
    const fencePostCount = Math.ceil(fenceLen / bayWidthM) + sides;
    // Rails: height-dependent — 2 rails ≤1.2m, 3 rails ≤1.8m, 4 rails >1.8m
    const railsPerRun = fenceHeightM <= 1.2 ? 2 : fenceHeightM <= 1.8 ? 3 : 4;
    const fenceRailM = round2(fenceLen * railsPerRun * wastage);
    // Palings: 100mm paling + 10mm gap = 110mm per paling, full fence height
    const palingCount = Math.ceil((fenceLen * 1000) / 110);

    make("fencing_post", fencePostCount, `Fence posts @ ${bayWidthM}m bays, ${sides} side${sides > 1 ? "s" : ""}`);
    make("fencing_rail", fenceRailM, `Fence rails (${railsPerRun} per run, ${fenceLen.toFixed(1)}m total run)`);
    make("fencing_paling", palingCount, `Fence palings ${Math.round(fenceHeightM * 1000)}mm high (${palingCount} off)`);
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
