export type TradeInput = {
  id: string;
  label: string;
  unit: string;
  defaultValue: number;
  step?: number;
};

export type TradeOutput = {
  label: string;
  value: number;
  unit: string;
  note?: string;
};

export type TradeCalculationRule = {
  keywords: string[];
  calculate: (inputs: Record<string, number>) => number;
  unit: string;
  unitType: string;
};

export type TradeCalculatorDef = {
  inputs: TradeInput[];
  outputs: (inputs: Record<string, number>) => TradeOutput[];
  rules: TradeCalculationRule[];
};

export const TRADE_CALCULATORS: Record<string, TradeCalculatorDef> = {
  "concreter": {
    inputs: [
      { id: "lengthM", label: "Length", unit: "m", defaultValue: 5 },
      { id: "widthM", label: "Width", unit: "m", defaultValue: 4 },
      { id: "depthMm", label: "Depth", unit: "mm", defaultValue: 100, step: 10 },
    ],
    outputs: (i) => [
      { label: "Volume", value: i.lengthM * i.widthM * ((i.depthMm || 0) / 1000), unit: "m³" },
      { label: "Mesh Area", value: i.lengthM * i.widthM, unit: "m²" },
      { label: "Formwork", value: 2 * (i.lengthM + i.widthM), unit: "lm" },
    ],
    rules: [
      { keywords: ["concrete", "slab", "footing", "path", "driveway", "aggregate"], calculate: (i) => i.lengthM * i.widthM * ((i.depthMm || 0) / 1000), unit: "cubic metre", unitType: "m3" },
      { keywords: ["mesh", "plastic", "bar chair", "chair"], calculate: (i) => i.lengthM * i.widthM, unit: "square metre", unitType: "sqm" },
      { keywords: ["formwork", "timber", "peg"], calculate: (i) => 2 * (i.lengthM + i.widthM), unit: "linear metre", unitType: "lm" },
    ],
  },
  "tiler / flooring": {
    inputs: [
      { id: "lengthM", label: "Length", unit: "m", defaultValue: 5 },
      { id: "widthM", label: "Width", unit: "m", defaultValue: 4 },
    ],
    outputs: (i) => [
      { label: "Area (Tile/Underlay)", value: i.lengthM * i.widthM, unit: "m²" },
      { label: "Perimeter (Skirting)", value: 2 * (i.lengthM + i.widthM), unit: "lm" },
    ],
    rules: [
      { keywords: ["skirting", "trim", "scotia", "angle"], calculate: (i) => 2 * (i.lengthM + i.widthM), unit: "linear metre", unitType: "lm" },
      { keywords: ["tile", "underlay", "adhesive", "grout", "floor", "vinyl", "carpet", "hybrid", "laminate", "silicone", "waterproof", "screed"], calculate: (i) => i.lengthM * i.widthM, unit: "square metre", unitType: "sqm" },
    ]
  },
  "plasterer / gib fixer": {
    inputs: [
      { id: "lengthM", label: "Total Wall Length", unit: "m", defaultValue: 10 },
      { id: "heightM", label: "Wall Height", unit: "m", defaultValue: 2.4 },
    ],
    outputs: (i) => [
      { label: "Area", value: i.lengthM * i.heightM, unit: "m²" },
      { label: "Plasterboard", value: Math.ceil((i.lengthM * i.heightM) / (1.2 * 2.4)), unit: "sheets", note: "based on 1.2 × 2.4 m sheets" },
      { label: "Cornice", value: i.lengthM, unit: "lm" },
    ],
    rules: [
      { keywords: ["sheet", "plasterboard", "gib", "board", "villaboard", "aquachek"], calculate: (i) => Math.ceil((i.lengthM * i.heightM) / (1.2 * 2.4)), unit: "sheet", unitType: "item" },
      { keywords: ["cornice", "cove"], calculate: (i) => i.lengthM, unit: "linear metre", unitType: "lm" },
      { keywords: ["compound", "base coat", "top coat", "tape", "screw", "plaster", "glue", "lining", "bulkhead", "patch", "fire-rated"], calculate: (i) => i.lengthM * i.heightM, unit: "square metre", unitType: "sqm" },
    ]
  },
  "painter / decorator": {
    inputs: [
      { id: "lengthM", label: "Total Wall Length", unit: "m", defaultValue: 10 },
      { id: "heightM", label: "Wall Height", unit: "m", defaultValue: 2.4 },
    ],
    outputs: (i) => [
      { label: "Area", value: i.lengthM * i.heightM, unit: "m²" },
      { label: "Paint", value: (i.lengthM * i.heightM) / 12, unit: "litres", note: "at 12m²/L" },
    ],
    rules: [
      { keywords: ["painting", "coating", "finish", "prep", "sand", "wash", "gap", "fill"], calculate: (i) => i.lengthM * i.heightM, unit: "square metre", unitType: "sqm" },
      { keywords: ["paint", "primer", "sealer", "undercoat", "enamel", "acrylic"], calculate: (i) => (i.lengthM * i.heightM) / 12, unit: "litre", unitType: "item" },
    ]
  },
  "bricklayer / blocklayer": {
    inputs: [
      { id: "lengthM", label: "Wall Length", unit: "m", defaultValue: 10 },
      { id: "heightM", label: "Wall Height", unit: "m", defaultValue: 2.4 },
    ],
    outputs: (i) => [
      { label: "Area", value: i.lengthM * i.heightM, unit: "m²" },
      { label: "Bricks", value: i.lengthM * i.heightM * 50, unit: "standard bricks", note: "approx 50/m²" },
      { label: "Mortar", value: Math.ceil(i.lengthM * i.heightM), unit: "20kg bags", note: "allowed 1 bag/m²" },
    ],
    rules: [
      { keywords: ["brick"], calculate: (i) => i.lengthM * i.heightM * 50, unit: "each", unitType: "item" },
      { keywords: ["mortar", "cement", "sand", "lime"], calculate: (i) => Math.ceil(i.lengthM * i.heightM), unit: "bag", unitType: "item" },
      { keywords: ["wall", "scaffold", "tie", "joint", "damp", "flashing"], calculate: (i) => i.lengthM * i.heightM, unit: "square metre", unitType: "sqm" },
    ]
  },
  "fencing / gates": {
    inputs: [
      { id: "lengthM", label: "Fence Length", unit: "m", defaultValue: 10 },
      { id: "heightM", label: "Fence Height", unit: "m", defaultValue: 1.8 },
      { id: "postSpacingM", label: "Post Spacing", unit: "m", defaultValue: 2.4 },
    ],
    outputs: (i) => [
      { label: "Fence Length", value: i.lengthM, unit: "lm" },
      { label: "Posts", value: i.postSpacingM > 0 ? Math.ceil(i.lengthM / i.postSpacingM) + 1 : 0, unit: "posts", note: "spacing rounded up" },
    ],
    rules: [
      { keywords: ["post"], calculate: (i) => i.postSpacingM > 0 ? Math.ceil(i.lengthM / i.postSpacingM) + 1 : 0, unit: "each", unitType: "item" },
      { keywords: ["fence", "fencing", "rail", "paling", "panel", "sheet", "colorbond", "plinth"], calculate: (i) => i.lengthM, unit: "linear metre", unitType: "lm" },
    ]
  }
};

export function normaliseTradeKey(tradeType: string | null | undefined) {
  const t = (tradeType || "").trim().toLowerCase();
  if (["carpenter", "carpentry", "decking"].includes(t)) return "carpenter / joiner";
  if (["tiler", "tiling", "flooring", "flooring installer", "floor coverings"].includes(t)) return "tiler / flooring";
  if (["plasterer", "gib fixer", "plastering"].includes(t)) return "plasterer / gib fixer";
  if (["painter", "decorator", "painting"].includes(t)) return "painter / decorator";
  if (["bricklayer", "blocklayer", "bricklaying"].includes(t)) return "bricklayer / blocklayer";
  if (["fencing", "gates", "fencer"].includes(t)) return "fencing / gates";
  if (["concreter", "concreting"].includes(t)) return "concreter";
  return t;
}

export function defaultTradeInputs(calculator?: TradeCalculatorDef) {
  if (!calculator) return {};
  return Object.fromEntries(
    calculator.inputs.map((input) => [input.id, input.defaultValue]),
  );
}

export function applyTradeRules(description: string, inputs: Record<string, number>, calculator?: TradeCalculatorDef) {
  if (!calculator || !description.trim()) return null;
  const lowerDesc = description.toLowerCase();

  for (const rule of calculator.rules) {
    if (rule.keywords.some(kw => lowerDesc.includes(kw))) {
      const quantity = rule.calculate(inputs);
      if (!Number.isFinite(quantity) || quantity < 0) return null;
      return { quantity: Number(quantity.toFixed(3)), unit: rule.unit, unitType: rule.unitType };
    }
  }
  return null;
}
