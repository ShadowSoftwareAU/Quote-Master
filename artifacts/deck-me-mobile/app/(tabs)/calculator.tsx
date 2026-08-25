import {
  useEstimateDeck,
  useListMaterials,
  type Material,
  type QuoteEstimate,
} from "@workspace/api-client-react";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Button,
  Card,
  LabeledInput,
  ScreenHeader,
  StripedBar,
  TextInputStyled,
  formatAUD,
} from "@/components/ui";
import { useColors } from "@/hooks/useColors";

// ─── Types ────────────────────────────────────────────────────────────────

interface SupplierPrice {
  supplier: string;
  unitPrice: number;
  sku: string | null;
}

interface EnrichedLine {
  description: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
  supplierPrices: SupplierPrice[];
  cheapestTotal: number;
}

interface SupplierTotal {
  supplier: string;
  total: number;
  coveredLines: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const SUPPLIER_LABELS: Record<string, string> = {
  bunnings: "Bunnings",
  "bunnings warehouse": "Bunnings",
  mitre10: "Mitre 10",
  "mitre 10": "Mitre 10",
  bretts_trade: "Bretts Trade",
  finlaysons: "Finlaysons",
  local: "Local Yard",
  other: "Other",
};

const SUPPLIER_COLORS: Record<string, string> = {
  bunnings: "#d41f1f",
  "bunnings warehouse": "#d41f1f",
  mitre10: "#007a3d",
  "mitre 10": "#007a3d",
  bretts_trade: "#1d4ed8",
  finlaysons: "#7c3aed",
  local: "#b45309",
  other: "#6b7280",
};

function supplierLabel(s: string) {
  return SUPPLIER_LABELS[s.toLowerCase()] ?? s;
}
function supplierColor(s: string) {
  return SUPPLIER_COLORS[s.toLowerCase()] ?? "#6b7280";
}

function parseNum(s: string, fallback: number): number {
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// ─── Sub-components ───────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
        {label}
      </Text>
      <Text style={{ fontFamily: "Inter_700Bold", color: "#fff", fontSize: 13 }}>
        {value}
      </Text>
    </View>
  );
}

function CheckRow({
  label,
  checked,
  onToggle,
  colors,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}
      activeOpacity={0.7}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 4,
          borderWidth: 2,
          borderColor: checked ? colors.primary : colors.border,
          backgroundColor: checked ? colors.primary : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked && <Feather name="check" size={13} color="#fff" />}
      </View>
      <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.foreground, fontSize: 14 }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function SegmentedControl({
  options,
  value,
  onChange,
  colors,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        borderRadius: 6,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
      }}
    >
      {options.map((opt, i) => (
        <TouchableOpacity
          key={opt.value}
          onPress={() => onChange(opt.value)}
          style={{
            flex: 1,
            paddingVertical: 8,
            alignItems: "center",
            backgroundColor: value === opt.value ? colors.primary : colors.card,
            borderRightWidth: i < options.length - 1 ? 1 : 0,
            borderRightColor: colors.border,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_700Bold",
              fontSize: 11,
              color: value === opt.value ? "#fff" : colors.mutedForeground,
              letterSpacing: 0.5,
            }}
          >
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function BomLineItem({ line, colors }: { line: EnrichedLine; colors: ReturnType<typeof useColors> }) {
  const hasPrices = line.supplierPrices.length > 0;
  const cheapest = line.supplierPrices[0] ?? null;

  return (
    <View style={{ paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.foreground, fontSize: 13 }}>
            {line.description}
          </Text>
          <Text style={{ fontFamily: "Inter_500Medium", color: colors.mutedForeground, fontSize: 11, marginTop: 2 }}>
            {line.quantity} {line.unit}
          </Text>
        </View>
        <Text style={{ fontFamily: "Chivo_700Bold", color: colors.foreground, fontSize: 14 }}>
          {formatAUD(line.lineTotal)}
        </Text>
      </View>

      {hasPrices ? (
        <View style={{ gap: 4 }}>
          {line.supplierPrices.map((p, i) => {
            const isBest = i === 0 && line.supplierPrices.length > 1;
            return (
              <View
                key={p.supplier}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: isBest ? "#15803d18" : colors.muted + "44",
                  borderRadius: 5,
                  borderWidth: isBest ? 1 : 0,
                  borderColor: isBest ? "#15803d55" : "transparent",
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                }}
              >
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: supplierColor(p.supplier) }} />
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: isBest ? "#22c55e" : colors.mutedForeground, flex: 1 }}>
                  {supplierLabel(p.supplier)}{isBest && line.supplierPrices.length > 1 ? " ✓" : ""}
                  {p.sku ? `  ${p.sku}` : ""}
                </Text>
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: colors.mutedForeground }}>
                  {formatAUD(p.unitPrice)}/{line.unit}
                </Text>
                <Text style={{ fontFamily: "Chivo_700Bold", fontSize: 13, color: isBest ? "#22c55e" : colors.foreground, minWidth: 60, textAlign: "right" }}>
                  {formatAUD(p.unitPrice * line.quantity)}
                </Text>
              </View>
            );
          })}
          {line.supplierPrices.length > 1 && (() => {
            const saved = (line.supplierPrices[line.supplierPrices.length - 1].unitPrice - cheapest!.unitPrice) * line.quantity;
            if (saved > 0.005) {
              return (
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: "#22c55e", paddingLeft: 2 }}>
                  Save {formatAUD(saved)} buying from {supplierLabel(cheapest!.supplier)}
                </Text>
              );
            }
            return null;
          })()}
        </View>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.muted + "44", borderRadius: 5, paddingHorizontal: 10, paddingVertical: 6 }}>
          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: colors.mutedForeground }}>
            {formatAUD(line.unitPrice)}/{line.unit}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────

export default function CalculatorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  // Dimensions
  const [length, setLength] = useState("6");
  const [width, setWidth] = useState("4");
  const [height, setHeight] = useState("0.6");

  // Decking
  const [boardWidth, setBoardWidth] = useState("90");
  const [gapSpacing, setGapSpacing] = useState("4");
  const [deckBoardType, setDeckBoardType] = useState("treated_pine");
  const [fastenerType, setFastenerType] = useState("screws");

  // Framing
  const [joistSpacing, setJoistSpacing] = useState("450");
  const [bearerSpacing, setBearerSpacing] = useState("1800");
  const [postSpacing, setPostSpacing] = useState("1800");
  const [footingDepth, setFootingDepth] = useState("450");
  const [subframeType, setSubframeType] = useState("stumps");

  // Labour
  const [labourHours, setLabourHours] = useState("16");
  const [labourRate, setLabourRate] = useState("85");

  // Extras — handrails
  const [includeHandrails, setIncludeHandrails] = useState(false);
  const [handrailHeightMm, setHandrailHeightMm] = useState("1000");
  const [balustradeType, setBalustradeType] = useState("timber");
  const [timberGapMm, setTimberGapMm] = useState("15");
  const [wireSpacingMm, setWireSpacingMm] = useState("100");
  // Extras — stairs
  const [includeStairs, setIncludeStairs] = useState(false);
  // Extras — fencing
  const [includeFencing, setIncludeFencing] = useState(false);
  const [fencingSides, setFencingSides] = useState("1");
  const [fencingHeightM, setFencingHeightM] = useState("1.8");
  const [fencingWidthM, setFencingWidthM] = useState("1.8");
  // Extras — awning
  const [includeAwning, setIncludeAwning] = useState(false);

  const [estimate, setEstimate] = useState<QuoteEstimate | null>(null);
  const { mutate, isPending } = useEstimateDeck();
  const { data: materials } = useListMaterials();

  const spec = useMemo(
    () => ({
      lengthM: parseNum(length, 6),
      widthM: parseNum(width, 4),
      heightM: parseNum(height, 0.6),
      boardWidthMm: Math.round(parseNum(boardWidth, 90)),
      gapSpacingMm: Math.round(parseNum(gapSpacing, 4)),
      joistSpacingMm: Math.round(parseNum(joistSpacing, 450)),
      bearerSpacingMm: Math.round(parseNum(bearerSpacing, 1800)),
      postSpacingMm: Math.round(parseNum(postSpacing, 1800)),
      footingDepthMm: Math.round(parseNum(footingDepth, 450)),
      wastageFactor: 1.1,
      deckBoardType,
      subframeType,
      fastenerType,
      fasciaType: "none",
      includeHandrails,
      handrailHeightMm: Math.round(parseNum(handrailHeightMm, 1000)),
      balustradeType,
      timberGapMm: Math.round(parseNum(timberGapMm, 15)),
      wireSpacingMm: Math.round(parseNum(wireSpacingMm, 100)),
      includeStairs,
      stairFlights: 1,
      includeFencing,
      fencingSides: Math.round(parseNum(fencingSides, 1)),
      fencingHeightM: parseNum(fencingHeightM, 1.8),
      fencingWidthM: parseNum(fencingWidthM, 1.8),
      includeAwning,
      awningWidthM: 3,
      awningLengthM: 3,
    }),
    [length, width, height, boardWidth, gapSpacing, joistSpacing, bearerSpacing, postSpacing, footingDepth, deckBoardType, subframeType, fastenerType,
     includeHandrails, handrailHeightMm, balustradeType, timberGapMm, wireSpacingMm,
     includeStairs, includeFencing, fencingSides, fencingHeightM, fencingWidthM, includeAwning],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      mutate({ data: spec }, { onSuccess: (res) => setEstimate(res) });
    }, 350);
    return () => clearTimeout(t);
  }, [spec, mutate]);

  // ── Build material lookup ──────────────────────────────────────────
  const materialById = useMemo(() => {
    if (!materials) return new Map<number, Material>();
    return new Map(materials.map((m) => [m.id, m]));
  }, [materials]);

  const materialsByCategory = useMemo(() => {
    if (!materials) return new Map<string, Material[]>();
    const map = new Map<string, Material[]>();
    for (const m of materials) {
      if (!map.has(m.category)) map.set(m.category, []);
      map.get(m.category)!.push(m);
    }
    return map;
  }, [materials]);

  // ── Enrich BOM lines with supplier prices ─────────────────────────
  const enrichedLines = useMemo<EnrichedLine[]>(() => {
    if (!estimate) return [];
    return estimate.lines.map((l) => {
      let group: Material[] = [];
      if (l.materialId != null) {
        const m = materialById.get(l.materialId);
        if (m) group = materialsByCategory.get(m.category) ?? [];
      }
      if (group.length === 0) group = materialsByCategory.get(l.category) ?? [];

      const bySupplier = new Map<string, SupplierPrice>();
      for (const m of group) {
        const existing = bySupplier.get(m.supplier);
        if (!existing || Number(m.unitPrice) < existing.unitPrice) {
          bySupplier.set(m.supplier, { supplier: m.supplier, unitPrice: Number(m.unitPrice), sku: m.sku ?? null });
        }
      }
      const supplierPrices = Array.from(bySupplier.values()).sort((a, b) => a.unitPrice - b.unitPrice);
      const cheapestTotal = supplierPrices.length > 0 ? supplierPrices[0].unitPrice * l.quantity : l.lineTotal;
      return { ...l, supplierPrices, cheapestTotal };
    });
  }, [estimate, materialById, materialsByCategory]);

  // ── Total Cart by supplier ─────────────────────────────────────────
  const supplierTotals = useMemo<SupplierTotal[]>(() => {
    if (enrichedLines.length === 0) return [];
    const supplierSet = new Set<string>();
    for (const line of enrichedLines) for (const p of line.supplierPrices) supplierSet.add(p.supplier);
    if (supplierSet.size < 2) return [];
    return Array.from(supplierSet)
      .map((supplier) => {
        let total = 0;
        let coveredLines = 0;
        for (const line of enrichedLines) {
          const p = line.supplierPrices.find((sp) => sp.supplier === supplier);
          if (p) { total += p.unitPrice * line.quantity; coveredLines++; }
          else total += line.cheapestTotal;
        }
        return { supplier, total, coveredLines };
      })
      .sort((a, b) => a.total - b.total);
  }, [enrichedLines]);

  const labour = parseNum(labourHours, 0) * parseNum(labourRate, 0);
  const subtotal = estimate?.materialsSubtotal ?? 0;
  const exGst = subtotal + labour;
  const gst = Math.round(exGst * 0.1 * 100) / 100;
  const total = Math.round((exGst + gst) * 100) / 100;
  const cheapestSupplier = supplierTotals[0] ?? null;
  const pricestSupplier = supplierTotals[supplierTotals.length - 1] ?? null;
  const cartSaving = cheapestSupplier && pricestSupplier ? pricestSupplier.total - cheapestSupplier.total : 0;
  const councilWarning = parseNum(height, 0) >= 1.0;
  const complianceWarnings = estimate?.complianceWarnings ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ backgroundColor: colors.sidebar, paddingTop: topPad }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 }}>
          <Text style={{ fontFamily: "Inter_700Bold", color: colors.primary, fontSize: 11, letterSpacing: 1.4 }}>
            BILL OF MATERIALS
          </Text>
          <Text style={{ fontFamily: "Chivo_900Black", color: "#fff", fontSize: 28, letterSpacing: -0.5, marginTop: 4 }}>
            QUOTE UP A DECK
          </Text>
        </View>
        <StripedBar height={6} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }} keyboardShouldPersistTaps="handled">
        <View style={{ padding: 20, gap: 16 }}>

          {/* Council warning */}
          {councilWarning && (
            <View style={{ backgroundColor: "#dc2626", borderRadius: 8, padding: 14, flexDirection: "row", gap: 10 }}>
              <Feather name="alert-triangle" size={18} color="#fff" style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Inter_700Bold", color: "#fff", fontSize: 12, letterSpacing: 0.5 }}>
                  COUNCIL PERMIT MAY BE REQUIRED
                </Text>
                <Text style={{ fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 3 }}>
                  Deck height ≥1.0m — most Australian councils require a building permit.
                </Text>
              </View>
            </View>
          )}

          {complianceWarnings.length > 0 && (
            <View
              style={{
                backgroundColor: colors.destructive,
                borderRadius: colors.radius,
                padding: 14,
                gap: 10,
              }}
              testID="compliance-warnings"
            >
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Feather name="alert-triangle" size={18} color={colors.destructiveForeground} style={{ marginTop: 1 }} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ fontFamily: "Inter_700Bold", color: colors.destructiveForeground, fontSize: 12, letterSpacing: 0.5 }}>
                    STRUCTURAL COMPLIANCE WARNINGS
                  </Text>
                  <Text style={{ fontFamily: "Inter_400Regular", color: colors.destructiveForeground, fontSize: 12 }}>
                    Review these inputs before construction. Saving the estimate remains available.
                  </Text>
                </View>
              </View>
              {complianceWarnings.map((warning) => (
                <View key={warning.code} style={{ borderTopWidth: 1, borderTopColor: colors.destructiveForeground, paddingTop: 10, gap: 3 }}>
                  <Text style={{ fontFamily: "Inter_700Bold", color: colors.destructiveForeground, fontSize: 12 }}>
                    {warning.title}
                  </Text>
                  <Text style={{ fontFamily: "Inter_400Regular", color: colors.destructiveForeground, fontSize: 12 }}>
                    {warning.message}
                  </Text>
                  <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.destructiveForeground, fontSize: 12 }}>
                    {warning.recommendation}
                  </Text>
                </View>
              ))}
              <Text style={{ fontFamily: "Inter_400Regular", color: colors.destructiveForeground, fontSize: 10, lineHeight: 14 }}>
                Screening checks only. Confirm the final design against the current AS 1684 tables, NCC, soil classification, local approvals, and a qualified building professional where required.
              </Text>
            </View>
          )}

          {/* Dimensions */}
          <Card>
            <Text style={{ fontFamily: "Chivo_700Bold", fontSize: 13, color: colors.foreground, marginBottom: 12, letterSpacing: 0.4 }}>
              DIMENSIONS (METRES)
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <LabeledInput label="Length">
                <TextInputStyled value={length} onChangeText={setLength} keyboardType="decimal-pad" />
              </LabeledInput>
              <LabeledInput label="Width">
                <TextInputStyled value={width} onChangeText={setWidth} keyboardType="decimal-pad" />
              </LabeledInput>
              <LabeledInput label={councilWarning ? "⚠ Height" : "Height"}>
                <TextInputStyled value={height} onChangeText={setHeight} keyboardType="decimal-pad" />
              </LabeledInput>
            </View>
          </Card>

          {/* Decking */}
          <Card>
            <Text style={{ fontFamily: "Chivo_700Bold", fontSize: 13, color: colors.foreground, marginBottom: 12, letterSpacing: 0.4 }}>
              DECKING
            </Text>
            <View style={{ gap: 12 }}>
              <View>
                <Text style={{ fontFamily: "Inter_700Bold", color: colors.mutedForeground, fontSize: 10, letterSpacing: 1, marginBottom: 6 }}>
                  BOARD TYPE
                </Text>
                <SegmentedControl
                  options={[
                    { label: "PINE", value: "treated_pine" },
                    { label: "HARDWOOD", value: "hardwood" },
                    { label: "COMPOSITE", value: "composite" },
                  ]}
                  value={deckBoardType}
                  onChange={setDeckBoardType}
                  colors={colors}
                />
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <LabeledInput label="Board (mm)">
                  <TextInputStyled value={boardWidth} onChangeText={setBoardWidth} keyboardType="number-pad" />
                </LabeledInput>
                <LabeledInput label="Gap (mm) ★">
                  <TextInputStyled value={gapSpacing} onChangeText={setGapSpacing} keyboardType="number-pad" />
                </LabeledInput>
              </View>
              <View>
                <Text style={{ fontFamily: "Inter_700Bold", color: colors.mutedForeground, fontSize: 10, letterSpacing: 1, marginBottom: 6 }}>
                  FASTENER
                </Text>
                <SegmentedControl
                  options={[
                    { label: "SCREWS", value: "screws" },
                    { label: "HIDDEN CLIPS", value: "hidden_clips" },
                  ]}
                  value={fastenerType}
                  onChange={setFastenerType}
                  colors={colors}
                />
              </View>
            </View>
          </Card>

          {/* Framing */}
          <Card>
            <Text style={{ fontFamily: "Chivo_700Bold", fontSize: 13, color: colors.foreground, marginBottom: 12, letterSpacing: 0.4 }}>
              FRAMING
            </Text>
            <View style={{ gap: 12 }}>
              <View>
                <Text style={{ fontFamily: "Inter_700Bold", color: colors.mutedForeground, fontSize: 10, letterSpacing: 1, marginBottom: 6 }}>
                  SUBFRAME
                </Text>
                <SegmentedControl
                  options={[
                    { label: "STUMPS", value: "stumps" },
                    { label: "SLAB", value: "concrete_slab" },
                    { label: "EXISTING", value: "existing_structure" },
                  ]}
                  value={subframeType}
                  onChange={setSubframeType}
                  colors={colors}
                />
              </View>
              <LabeledInput label="Joists (mm)">
                <TextInputStyled value={joistSpacing} onChangeText={setJoistSpacing} keyboardType="number-pad" />
              </LabeledInput>
              <LabeledInput label="Bearers (mm)">
                <TextInputStyled value={bearerSpacing} onChangeText={setBearerSpacing} keyboardType="number-pad" />
              </LabeledInput>
              {subframeType === "stumps" && (
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <LabeledInput label="Posts (mm)">
                      <TextInputStyled value={postSpacing} onChangeText={setPostSpacing} keyboardType="number-pad" />
                    </LabeledInput>
                  </View>
                  <View style={{ flex: 1 }}>
                    <LabeledInput label="Footing (mm)">
                      <TextInputStyled value={footingDepth} onChangeText={setFootingDepth} keyboardType="number-pad" />
                    </LabeledInput>
                  </View>
                </View>
              )}
            </View>
          </Card>

          {/* Extras */}
          <Card>
            <Text style={{ fontFamily: "Chivo_700Bold", fontSize: 13, color: colors.foreground, marginBottom: 10, letterSpacing: 0.4 }}>
              EXTRAS
            </Text>
            <View style={{ gap: 4 }}>

              {/* Handrails */}
              <CheckRow label="Handrails / Balustrade" checked={includeHandrails} onToggle={() => setIncludeHandrails(!includeHandrails)} colors={colors} />
              {includeHandrails && (
                <View style={{ marginLeft: 32, gap: 12, paddingVertical: 8, paddingHorizontal: 4 }}>
                  <LabeledInput label={`Height (mm)`}>
                    <TextInputStyled value={handrailHeightMm} onChangeText={setHandrailHeightMm} keyboardType="number-pad" />
                  </LabeledInput>
                  <View>
                    <Text style={{ fontFamily: "Inter_700Bold", color: colors.mutedForeground, fontSize: 10, letterSpacing: 1, marginBottom: 6 }}>
                      BALUSTRADE INFILL
                    </Text>
                    <SegmentedControl
                      options={[
                        { label: "TIMBER", value: "timber" },
                        { label: "STAINLESS CABLE", value: "stainless_cable" },
                      ]}
                      value={balustradeType}
                      onChange={setBalustradeType}
                      colors={colors}
                    />
                  </View>
                  {balustradeType === "timber" ? (
                    <LabeledInput label="Timber Gap (mm)">
                      <TextInputStyled value={timberGapMm} onChangeText={setTimberGapMm} keyboardType="number-pad" />
                    </LabeledInput>
                  ) : (
                    <LabeledInput label="Wire Spacing (mm)">
                      <TextInputStyled value={wireSpacingMm} onChangeText={setWireSpacingMm} keyboardType="number-pad" />
                    </LabeledInput>
                  )}
                </View>
              )}

              {/* Stairs */}
              <CheckRow label="Stairs" checked={includeStairs} onToggle={() => setIncludeStairs(!includeStairs)} colors={colors} />

              {/* Fencing */}
              <CheckRow label="Fencing" checked={includeFencing} onToggle={() => setIncludeFencing(!includeFencing)} colors={colors} />
              {includeFencing && (
                <View style={{ marginLeft: 32, gap: 12, paddingVertical: 8, paddingHorizontal: 4 }}>
                  <LabeledInput label="Sides">
                    <TextInputStyled value={fencingSides} onChangeText={setFencingSides} keyboardType="number-pad" />
                  </LabeledInput>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <LabeledInput label="Height (m)">
                      <TextInputStyled value={fencingHeightM} onChangeText={setFencingHeightM} keyboardType="decimal-pad" />
                    </LabeledInput>
                    <LabeledInput label="Bay Width (m)">
                      <TextInputStyled value={fencingWidthM} onChangeText={setFencingWidthM} keyboardType="decimal-pad" />
                    </LabeledInput>
                  </View>
                </View>
              )}

              {/* Awning */}
              <CheckRow label="Awning (cuts boards)" checked={includeAwning} onToggle={() => setIncludeAwning(!includeAwning)} colors={colors} />
            </View>
          </Card>

          {/* Labour */}
          <Card>
            <Text style={{ fontFamily: "Chivo_700Bold", fontSize: 13, color: colors.foreground, marginBottom: 12, letterSpacing: 0.4 }}>
              LABOUR
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <LabeledInput label="Hours">
                <TextInputStyled value={labourHours} onChangeText={setLabourHours} keyboardType="decimal-pad" />
              </LabeledInput>
              <LabeledInput label="Rate $/hr">
                <TextInputStyled value={labourRate} onChangeText={setLabourRate} keyboardType="decimal-pad" />
              </LabeledInput>
            </View>
          </Card>

          {/* Total summary */}
          <View style={{ backgroundColor: colors.sidebar, borderRadius: colors.radius, padding: 18 }}>
            <Text style={{ fontFamily: "Inter_700Bold", color: colors.primary, fontSize: 11, letterSpacing: 1.4 }}>
              TOTAL (INC GST) {isPending ? "· UPDATING…" : ""}
            </Text>
            <Text
              style={{ fontFamily: "Chivo_900Black", color: "#fff", fontSize: 44, letterSpacing: -1, marginTop: 4 }}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatAUD(total)}
            </Text>
            <View style={{ marginTop: 14, gap: 6 }}>
              <Row label="Materials" value={formatAUD(subtotal)} />
              <Row label="Labour" value={formatAUD(labour)} />
              <Row label="GST" value={formatAUD(gst)} />
              <Row label={`Deck ${estimate?.deckAreaM2 ?? 0}m²`} value="" />
            </View>
          </View>

          <Button
            label="Save as quote"
            icon="save"
            onPress={() => {
              if (!estimate) return;
              router.push({ pathname: "/quote/new", params: { spec: JSON.stringify(spec), labourHours, labourRate } });
            }}
          />

          {/* BOM line items */}
          {estimate && enrichedLines.length > 0 ? (
            <Card>
              <Text style={{ fontFamily: "Chivo_700Bold", fontSize: 13, color: colors.foreground, marginBottom: 14, letterSpacing: 0.4 }}>
                LINE ITEMS · RETAIL PRICES
              </Text>
              <View style={{ gap: 14 }}>
                {enrichedLines.map((l, i) => (
                  <BomLineItem key={i} line={l} colors={colors} />
                ))}
              </View>
            </Card>
          ) : null}

          {/* Total Cart Winner bar */}
          {supplierTotals.length >= 2 ? (
            <View style={{ borderRadius: colors.radius, overflow: "hidden", borderWidth: 1, borderColor: "#15803d55" }}>
              <View style={{ backgroundColor: "#15803d22", paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, borderBottomColor: "#15803d33" }}>
                <Feather name="shopping-cart" size={14} color="#22c55e" />
                <Text style={{ fontFamily: "Inter_700Bold", color: "#22c55e", fontSize: 11, letterSpacing: 1.2 }}>
                  TOTAL CART COMPARISON
                </Text>
              </View>
              <View style={{ backgroundColor: "#1a1a1a", gap: 1 }}>
                {supplierTotals.map((st, i) => {
                  const isBest = i === 0;
                  const diff = st.total - cheapestSupplier!.total;
                  return (
                    <View
                      key={st.supplier}
                      style={{
                        flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14,
                        backgroundColor: isBest ? "#15803d15" : "transparent",
                        borderBottomWidth: i < supplierTotals.length - 1 ? 1 : 0, borderBottomColor: "#2a2a2a", gap: 10,
                      }}
                    >
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isBest ? "#22c55e" : supplierColor(st.supplier) }} />
                      <Text style={{ fontFamily: "Chivo_700Bold", fontSize: 15, color: isBest ? "#22c55e" : colors.mutedForeground, flex: 1 }}>
                        {supplierLabel(st.supplier)}{isBest ? "  ✓ CHEAPEST" : ""}
                      </Text>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ fontFamily: "Chivo_900Black", fontSize: 20, color: isBest ? "#22c55e" : colors.foreground }}>
                          {formatAUD(st.total)}
                        </Text>
                        {!isBest && diff > 0.005 && (
                          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#ef4444", marginTop: 1 }}>
                            +{formatAUD(diff)} more
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
              {cartSaving > 0.005 && (
                <View style={{ backgroundColor: "#15803d22", paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1, borderTopColor: "#15803d33" }}>
                  <Feather name="trending-down" size={14} color="#22c55e" />
                  <Text style={{ fontFamily: "Inter_700Bold", color: "#22c55e", fontSize: 12 }}>
                    Buy from {supplierLabel(cheapestSupplier!.supplier)} and save {formatAUD(cartSaving)} on materials
                  </Text>
                </View>
              )}
            </View>
          ) : null}

        </View>
      </ScrollView>
    </View>
  );
}
