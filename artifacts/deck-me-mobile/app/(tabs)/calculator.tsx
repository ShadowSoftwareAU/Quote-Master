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
  supplierPrices: SupplierPrice[]; // sorted cheapest first
  cheapestTotal: number;           // quantity × cheapest price
}

interface SupplierTotal {
  supplier: string;
  total: number;
  coveredLines: number; // how many lines had this supplier
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const SUPPLIER_LABELS: Record<string, string> = {
  bunnings: "Bunnings",
  "bunnings warehouse": "Bunnings",
  mitre10: "Mitre 10",
  "mitre 10": "Mitre 10",
  local: "Local Yard",
  other: "Other",
};

const SUPPLIER_COLORS: Record<string, string> = {
  bunnings: "#d41f1f",
  "bunnings warehouse": "#d41f1f",
  mitre10: "#007a3d",
  "mitre 10": "#007a3d",
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

function BomLineItem({ line, colors }: { line: EnrichedLine; colors: ReturnType<typeof useColors> }) {
  const hasPrices = line.supplierPrices.length > 0;
  const cheapest = line.supplierPrices[0] ?? null;

  return (
    <View
      style={{
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        gap: 8,
      }}
    >
      {/* Name + total */}
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

      {/* Supplier price comparison */}
      {hasPrices ? (
        <View style={{ gap: 4 }}>
          {line.supplierPrices.map((p, i) => {
            const isBest = i === 0 && line.supplierPrices.length > 1;
            const saving = line.supplierPrices.length > 1
              ? (line.supplierPrices[line.supplierPrices.length - 1].unitPrice - cheapest!.unitPrice) * line.quantity
              : null;
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
                {/* Supplier dot */}
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: supplierColor(p.supplier) }} />

                {/* Supplier name */}
                <Text style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 11,
                  color: isBest ? "#22c55e" : colors.mutedForeground,
                  flex: 1,
                }}>
                  {supplierLabel(p.supplier)}{isBest && line.supplierPrices.length > 1 ? " ✓" : ""}
                  {p.sku ? `  ${p.sku}` : ""}
                </Text>

                {/* Unit price */}
                <Text style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 11,
                  color: colors.mutedForeground,
                }}>
                  {formatAUD(p.unitPrice)}/{line.unit}
                </Text>

                {/* Line total at this supplier */}
                <Text style={{
                  fontFamily: "Chivo_700Bold",
                  fontSize: 13,
                  color: isBest ? "#22c55e" : colors.foreground,
                  minWidth: 60,
                  textAlign: "right",
                }}>
                  {formatAUD(p.unitPrice * line.quantity)}
                </Text>
              </View>
            );
          })}
          {/* Per-item saving note */}
          {line.supplierPrices.length > 1 && (() => {
            const saved = (line.supplierPrices[line.supplierPrices.length - 1].unitPrice - cheapest!.unitPrice) * line.quantity;
            if (saved > 0.005) {
              return (
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: "#22c55e", paddingLeft: 2 }}>
                  Save {formatAUD(saved)} on this item buying from {supplierLabel(cheapest!.supplier)}
                </Text>
              );
            }
            return null;
          })()}
        </View>
      ) : (
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: colors.muted + "44",
          borderRadius: 5,
          paddingHorizontal: 10,
          paddingVertical: 6,
        }}>
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

  const [length, setLength] = useState("6");
  const [width, setWidth] = useState("4");
  const [height, setHeight] = useState("0.6");
  const [boardWidth, setBoardWidth] = useState("90");
  const [joistSpacing, setJoistSpacing] = useState("450");
  const [wastage, setWastage] = useState("1.1");
  const [labourHours, setLabourHours] = useState("16");
  const [labourRate, setLabourRate] = useState("85");

  const [estimate, setEstimate] = useState<QuoteEstimate | null>(null);
  const { mutate, isPending } = useEstimateDeck();
  const { data: materials } = useListMaterials();

  const spec = useMemo(
    () => ({
      lengthM: parseNum(length, 6),
      widthM: parseNum(width, 4),
      heightM: parseNum(height, 0.6),
      boardWidthMm: Math.round(parseNum(boardWidth, 90)),
      joistSpacingMm: Math.round(parseNum(joistSpacing, 450)),
      bearerSpacingMm: 1800,
      postSpacingMm: 1800,
      wastageFactor: parseNum(wastage, 1.1),
    }),
    [length, width, height, boardWidth, joistSpacing, wastage],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      mutate({ data: spec }, { onSuccess: (res) => setEstimate(res) });
    }, 350);
    return () => clearTimeout(t);
  }, [spec, mutate]);

  // ── Build material lookup ────────────────────────────────────────────
  const materialById = useMemo(() => {
    if (!materials) return new Map<number, Material>();
    return new Map(materials.map((m) => [m.id, m]));
  }, [materials]);

  const materialsByName = useMemo(() => {
    if (!materials) return new Map<string, Material[]>();
    const map = new Map<string, Material[]>();
    for (const m of materials) {
      const key = m.name.toLowerCase().trim();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return map;
  }, [materials]);

  // ── Enrich BOM lines with supplier prices ───────────────────────────
  const enrichedLines = useMemo<EnrichedLine[]>(() => {
    if (!estimate) return [];
    return estimate.lines.map((l) => {
      // Find the material group (all suppliers for this material)
      let group: Material[] = [];
      if (l.materialId != null) {
        const m = materialById.get(l.materialId);
        if (m) group = materialsByName.get(m.name.toLowerCase().trim()) ?? [];
      }
      if (group.length === 0) {
        // fallback: match by description
        group = materialsByName.get(l.description.toLowerCase().trim()) ?? [];
      }

      // Deduplicate by supplier — keep cheapest per supplier
      const bySupplier = new Map<string, SupplierPrice>();
      for (const m of group) {
        const existing = bySupplier.get(m.supplier);
        if (!existing || m.unitPrice < existing.unitPrice) {
          bySupplier.set(m.supplier, { supplier: m.supplier, unitPrice: m.unitPrice, sku: m.sku ?? null });
        }
      }
      const supplierPrices: SupplierPrice[] = Array.from(bySupplier.values())
        .sort((a, b) => a.unitPrice - b.unitPrice);

      const cheapestTotal = supplierPrices.length > 0
        ? supplierPrices[0].unitPrice * l.quantity
        : l.lineTotal;

      return { ...l, supplierPrices, cheapestTotal };
    });
  }, [estimate, materialById, materialsByName]);

  // ── Total Cart by supplier ───────────────────────────────────────────
  const supplierTotals = useMemo<SupplierTotal[]>(() => {
    if (enrichedLines.length === 0) return [];

    // Collect all unique suppliers
    const supplierSet = new Set<string>();
    for (const line of enrichedLines) {
      for (const p of line.supplierPrices) supplierSet.add(p.supplier);
    }
    if (supplierSet.size < 2) return [];

    return Array.from(supplierSet)
      .map((supplier) => {
        let total = 0;
        let coveredLines = 0;
        for (const line of enrichedLines) {
          const p = line.supplierPrices.find((sp) => sp.supplier === supplier);
          if (p) {
            total += p.unitPrice * line.quantity;
            coveredLines++;
          } else {
            // Use best available price for lines not stocked by this supplier
            total += line.cheapestTotal;
          }
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
  const cartSaving = cheapestSupplier && pricestSupplier
    ? pricestSupplier.total - cheapestSupplier.total
    : 0;

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

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ padding: 20, gap: 16 }}>

          {/* ── Inputs ──────────────────────────────────────────── */}
          <Card>
            <Text style={{ fontFamily: "Chivo_700Bold", fontSize: 14, color: colors.foreground, marginBottom: 12, letterSpacing: 0.4 }}>
              DIMENSIONS (METRES)
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <LabeledInput label="Length">
                <TextInputStyled value={length} onChangeText={setLength} keyboardType="decimal-pad" />
              </LabeledInput>
              <LabeledInput label="Width">
                <TextInputStyled value={width} onChangeText={setWidth} keyboardType="decimal-pad" />
              </LabeledInput>
              <LabeledInput label="Height">
                <TextInputStyled value={height} onChangeText={setHeight} keyboardType="decimal-pad" />
              </LabeledInput>
            </View>
          </Card>

          <Card>
            <Text style={{ fontFamily: "Chivo_700Bold", fontSize: 14, color: colors.foreground, marginBottom: 12, letterSpacing: 0.4 }}>
              FRAMING
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <LabeledInput label="Board (mm)">
                <TextInputStyled value={boardWidth} onChangeText={setBoardWidth} keyboardType="number-pad" />
              </LabeledInput>
              <LabeledInput label="Joists (mm)">
                <TextInputStyled value={joistSpacing} onChangeText={setJoistSpacing} keyboardType="number-pad" />
              </LabeledInput>
              <LabeledInput label="Wastage">
                <TextInputStyled value={wastage} onChangeText={setWastage} keyboardType="decimal-pad" />
              </LabeledInput>
            </View>
          </Card>

          <Card>
            <Text style={{ fontFamily: "Chivo_700Bold", fontSize: 14, color: colors.foreground, marginBottom: 12, letterSpacing: 0.4 }}>
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

          {/* ── Total summary card ──────────────────────────────── */}
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

          {/* ── BOM line items ──────────────────────────────────── */}
          {estimate && enrichedLines.length > 0 ? (
            <Card>
              <Text style={{ fontFamily: "Chivo_700Bold", fontSize: 14, color: colors.foreground, marginBottom: 14, letterSpacing: 0.4 }}>
                LINE ITEMS · RETAIL PRICES
              </Text>
              <View style={{ gap: 14 }}>
                {enrichedLines.map((l, i) => (
                  <BomLineItem
                    key={i}
                    line={l}
                    colors={colors}
                  />
                ))}
              </View>
            </Card>
          ) : null}

          {/* ── Total Cart Winner bar ───────────────────────────── */}
          {supplierTotals.length >= 2 ? (
            <View
              style={{
                borderRadius: colors.radius,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: "#15803d55",
              }}
            >
              {/* Header */}
              <View style={{
                backgroundColor: "#15803d22",
                paddingHorizontal: 16,
                paddingVertical: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                borderBottomWidth: 1,
                borderBottomColor: "#15803d33",
              }}>
                <Feather name="shopping-cart" size={14} color="#22c55e" />
                <Text style={{ fontFamily: "Inter_700Bold", color: "#22c55e", fontSize: 11, letterSpacing: 1.2 }}>
                  TOTAL CART COMPARISON
                </Text>
              </View>

              {/* Supplier rows */}
              <View style={{ backgroundColor: "#1a1a1a", gap: 1 }}>
                {supplierTotals.map((st, i) => {
                  const isBest = i === 0;
                  const diff = st.total - cheapestSupplier!.total;
                  return (
                    <View
                      key={st.supplier}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        backgroundColor: isBest ? "#15803d15" : "transparent",
                        borderBottomWidth: i < supplierTotals.length - 1 ? 1 : 0,
                        borderBottomColor: "#2a2a2a",
                        gap: 10,
                      }}
                    >
                      {/* Dot */}
                      <View style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: isBest ? "#22c55e" : supplierColor(st.supplier),
                      }} />

                      {/* Supplier name */}
                      <Text style={{
                        fontFamily: "Chivo_700Bold",
                        fontSize: 15,
                        color: isBest ? "#22c55e" : colors.mutedForeground,
                        flex: 1,
                      }}>
                        {supplierLabel(st.supplier)}
                        {isBest ? "  ✓ CHEAPEST" : ""}
                      </Text>

                      {/* Price */}
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{
                          fontFamily: "Chivo_900Black",
                          fontSize: 20,
                          color: isBest ? "#22c55e" : colors.foreground,
                        }}>
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

              {/* Saving callout */}
              {cartSaving > 0.005 && (
                <View style={{
                  backgroundColor: "#15803d22",
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  borderTopWidth: 1,
                  borderTopColor: "#15803d33",
                }}>
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
