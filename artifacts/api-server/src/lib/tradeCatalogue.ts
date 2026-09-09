export interface TradeCatalogueEntry {
  value: string;
  quotingFunctions: string[];
  quotingParameters: string[];
}

export const TRADE_CATALOGUE: readonly TradeCatalogueEntry[] = [
  {
    value: "Carpenter / Joiner",
    quotingFunctions: ["Decks", "Subframes", "Stairs", "Timber framing", "Cladding", "Internal linings", "Skirtings", "Door/window frames"],
    quotingParameters: ["Material type", "Dimensions", "Fixings", "Labour rate", "Finish", "Waste factor"],
  },
  {
    value: "Roofer",
    quotingFunctions: ["Roof sheeting", "Battens", "Flashings", "Gutters", "Downpipes", "Roof insulation", "Roof repairs"],
    quotingParameters: ["Roof material", "Pitch", "Area m²", "Underlay type", "Fasteners", "Safety/access", "Waste factor"],
  },
  {
    value: "Plumber",
    quotingFunctions: ["Hot/cold water supply", "Sanitary fixtures", "Drainage", "Stormwater", "Gas fitting", "Roof plumbing"],
    quotingParameters: ["Fixture types", "Pipe material", "Run length", "Connection type", "AS/NZS 3500 checks", "Pressure testing"],
  },
  {
    value: "Electrician",
    quotingFunctions: ["Switchboards", "Lighting circuits", "Power outlets", "Data/network cabling", "Smoke alarms", "RCDs", "EV charger install"],
    quotingParameters: ["Circuit type", "Cable runs", "Fixture type", "Load calculations", "Safety devices", "AS/NZS 3000 checks"],
  },
  {
    value: "HVAC / Air Conditioning",
    quotingFunctions: ["Split systems", "Ducted systems", "Ventilation", "Refrigerant lines", "Commissioning"],
    quotingParameters: ["System type", "Capacity", "Duct length/runs", "Refrigerant type", "Commissioning/testing", "Clearances"],
  },
  {
    value: "Tiler",
    quotingFunctions: ["Floor tiling", "Wall tiling", "Waterproofing", "Screeds", "Tile removal"],
    quotingParameters: ["Tile size/type", "Area m²", "Substrate preparation", "Grout type", "Layout pattern", "Waste factor"],
  },
  {
    value: "Painter / Decorator",
    quotingFunctions: ["Internal painting", "External painting", "Protective coatings", "Texture finishes"],
    quotingParameters: ["Surface area m²", "Coats required", "Paint type", "Preparation work", "Colour codes", "Labour rate"],
  },
  {
    value: "Plasterer / Gib Fixer",
    quotingFunctions: ["Internal linings", "Bulkheads", "Cornices", "Patch repairs", "Fire-rated linings"],
    quotingParameters: ["Board type", "Area m²", "Jointing finish", "Fire rating", "Fixing centres"],
  },
  {
    value: "Flooring Installer",
    quotingFunctions: ["Timber flooring", "Laminate", "Vinyl", "Carpet", "Subfloor preparation"],
    quotingParameters: ["Floor type", "Area m²", "Underlay", "Finish", "Transition trims", "Installation method"],
  },
  {
    value: "Glazier",
    quotingFunctions: ["Window supply/install", "Shopfronts", "Balustrades", "Mirrors", "Splashbacks"],
    quotingParameters: ["Glass type", "Thickness", "Frame type", "Safety rating", "Sealing"],
  },
  {
    value: "Bricklayer / Blocklayer",
    quotingFunctions: ["New walls", "Re-pointing", "Retaining walls", "Masonry repairs"],
    quotingParameters: ["Brick/block type", "Wall area m²", "Mortar type", "Reinforcement", "Footing requirements"],
  },
  {
    value: "Concreter",
    quotingFunctions: ["Slabs", "Footings", "Paths", "Driveways", "Exposed aggregate"],
    quotingParameters: ["Concrete class", "Volume m³", "Reinforcement", "Finish", "Curing"],
  },
  {
    value: "Landscape / Irrigation",
    quotingFunctions: ["Soft landscaping", "Paving", "Retaining walls", "Irrigation systems"],
    quotingParameters: ["Planting schedule", "Paving area m²", "Irrigation zones", "Water source", "Soil preparation"],
  },
  {
    value: "Fencing / Gates",
    quotingFunctions: ["Timber fencing", "Metal fencing", "Gates", "Pool fencing"],
    quotingParameters: ["Fence type", "Linear metres", "Post spacing", "Gates/hardware", "Pool-fence compliance"],
  },
  {
    value: "Security / Access Control",
    quotingFunctions: ["Alarm systems", "CCTV", "Access control", "Intercoms"],
    quotingParameters: ["Device types", "Cable runs", "Power requirements", "Monitoring options"],
  },
  {
    value: "Data / Communications",
    quotingFunctions: ["Network cabling", "Structured cabling", "Wi-Fi access points", "Phone systems"],
    quotingParameters: ["Cable type", "Run length", "Outlet count", "Testing/certification"],
  },
  {
    value: "Solar / Renewable Energy",
    quotingFunctions: ["PV panels", "Inverters", "Battery storage", "Mounting systems"],
    quotingParameters: ["Panel capacity", "Inverter size", "Roof mounting type", "Export limits", "Electrical integration"],
  },
  {
    value: "Demolition / Asbestos Removal",
    quotingFunctions: ["Strip-outs", "Selective demolition", "Asbestos testing/removal"],
    quotingParameters: ["Scope", "Hazard classification", "Licensing requirements", "Waste disposal"],
  },
  {
    value: "Insulation",
    quotingFunctions: ["Ceiling insulation", "Wall insulation", "Acoustic treatments"],
    quotingParameters: ["Insulation type", "R-value", "Area m²", "Installation method"],
  },
  {
    value: "Steel Fabrication / Structural",
    quotingFunctions: ["Steel beams", "Columns", "Stairs", "Balustrades", "Connections"],
    quotingParameters: ["Section sizes", "Connection method", "Surface treatment", "Engineering certification"],
  },
  {
    value: "Pool Builder / Specialist",
    quotingFunctions: ["Pool shell", "Tiling", "Filtration", "Fencing", "Landscaping"],
    quotingParameters: ["Pool type", "Volume", "Filtration system", "Safety compliance"],
  },
  {
    value: "Cabinetmaker / Joinery",
    quotingFunctions: ["Kitchen cabinets", "Wardrobes", "Benchtops", "Custom joinery"],
    quotingParameters: ["Material", "Linear metres", "Hardware", "Benchtop type", "Finish"],
  },
  {
    value: "Fire Protection",
    quotingFunctions: ["Fire sprinklers", "Hydrants", "Fire doors", "Passive fire sealing"],
    quotingParameters: ["System type", "Coverage area", "Pipework runs", "Certification", "NCC compliance"],
  },
  {
    value: "Asbestos / Hazardous Materials",
    quotingFunctions: ["Testing", "Removal", "Remediation", "Disposal"],
    quotingParameters: ["Material type", "Area m²", "Licensing", "Air monitoring"],
  },
] as const;

const LEGACY_TRADE_ALIASES: Readonly<Record<string, string>> = {
  carpenter: "Carpenter / Joiner",
  carpentry: "Carpenter / Joiner",
  decking: "Carpenter / Joiner",
  landscaper: "Landscape / Irrigation",
  landscaping: "Landscape / Irrigation",
  painter: "Painter / Decorator",
  plasterer: "Plasterer / Gib Fixer",
};

const canonicalByNormalisedValue = new Map(
  TRADE_CATALOGUE.map((entry) => [entry.value.toLowerCase(), entry.value]),
);

export function canonicalTradeType(value: string): string | null {
  const normalised = value.trim().toLowerCase();
  return (
    canonicalByNormalisedValue.get(normalised) ??
    LEGACY_TRADE_ALIASES[normalised] ??
    null
  );
}

export function normaliseTradeTypes(values: readonly string[]): string[] | null {
  const canonical = values.map(canonicalTradeType);
  if (canonical.some((value) => value === null)) return null;
  return Array.from(new Set(canonical as string[]));
}

export function tradeTypeStorageAliases(value: string): string[] {
  const canonical = canonicalTradeType(value);
  if (canonical === "Carpenter / Joiner") {
    return ["Carpenter / Joiner", "Carpenter", "Carpentry", "decking"];
  }
  if (canonical === "Landscape / Irrigation") {
    return ["Landscape / Irrigation", "Landscaper", "Landscaping"];
  }
  if (canonical === "Painter / Decorator") {
    return ["Painter / Decorator", "Painter"];
  }
  if (canonical === "Plasterer / Gib Fixer") {
    return ["Plasterer / Gib Fixer", "Plasterer"];
  }
  return canonical ? [canonical] : [value.trim()];
}

export function profileTradeTypes(profile: {
  tradeType: string;
  tradeTypes?: string[] | null;
}): string[] {
  const values =
    profile.tradeTypes && profile.tradeTypes.length > 0
      ? profile.tradeTypes
      : [profile.tradeType];
  return normaliseTradeTypes(values) ?? values.map((value) => value.trim());
}

export function isCarpentryTrade(value: string | null | undefined): boolean {
  return value ? canonicalTradeType(value) === "Carpenter / Joiner" : false;
}