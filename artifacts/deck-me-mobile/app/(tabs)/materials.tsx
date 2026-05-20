import { Feather } from "@expo/vector-icons";
import { useListMaterials } from "@workspace/api-client-react";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card, EmptyState, StripedBar, formatAUD } from "@/components/ui";
import { useColors } from "@/hooks/useColors";

const SUPPLIER_LABELS: Record<string, string> = {
  bunnings: "Bunnings",
  mitre10: "Mitre 10",
  local: "Local Yard",
  other: "Other",
};

const SUPPLIER_COLORS: Record<string, string> = {
  bunnings: "#d41f1f",
  mitre10: "#007a3d",
  local: "#b45309",
  other: "#6b7280",
};

type GroupedMaterial = {
  name: string;
  unit: string;
  category: string;
  prices: Array<{ supplier: string; unitPrice: number; sku?: string | null }>;
  cheapest: { supplier: string; unitPrice: number } | null;
  mostExpensive: { supplier: string; unitPrice: number } | null;
};

export default function MaterialsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data, isLoading, refetch, isRefetching } = useListMaterials();
  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const grouped = useMemo<GroupedMaterial[]>(() => {
    if (!data) return [];
    const byName: Record<string, GroupedMaterial> = {};
    for (const m of data) {
      const key = m.name.toLowerCase().trim();
      if (!byName[key]) {
        byName[key] = { name: m.name, unit: m.unit, category: m.category, prices: [], cheapest: null, mostExpensive: null };
      }
      byName[key].prices.push({ supplier: m.supplier, unitPrice: m.unitPrice, sku: m.sku });
    }
    for (const g of Object.values(byName)) {
      g.prices.sort((a, b) => a.unitPrice - b.unitPrice);
      if (g.prices.length > 0) {
        g.cheapest = g.prices[0];
        g.mostExpensive = g.prices[g.prices.length - 1];
      }
    }
    return Object.values(byName).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  }, [data]);

  const categories = useMemo(() => {
    const cats = [...new Set(grouped.map(g => g.category))].sort();
    return ["all", ...cats];
  }, [grouped]);

  const filtered = useMemo(() => {
    if (selectedCategory === "all") return grouped;
    return grouped.filter(g => g.category === selectedCategory);
  }, [grouped, selectedCategory]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ backgroundColor: colors.sidebar, paddingTop: topPad }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 }}>
          <Text style={{ fontFamily: "Inter_700Bold", color: colors.primary, fontSize: 11, letterSpacing: 1.4 }}>
            RETAIL PRICES
          </Text>
          <Text style={{ fontFamily: "Chivo_900Black", color: "#fff", fontSize: 28, letterSpacing: -0.5, marginTop: 4 }}>
            MATERIALS
          </Text>
        </View>

        {/* Category filter pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, paddingTop: 8, gap: 8 }}
        >
          {categories.map(cat => {
            const active = selectedCategory === cat;
            return (
              <View
                key={cat}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: 4,
                  backgroundColor: active ? colors.primary : colors.card,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                }}
              >
                <Text
                  onPress={() => setSelectedCategory(cat)}
                  style={{
                    fontFamily: "Inter_700Bold",
                    fontSize: 11,
                    letterSpacing: 1,
                    color: active ? "#fff" : colors.mutedForeground,
                  }}
                >
                  {cat === "all" ? "ALL" : cat.toUpperCase()}
                </Text>
              </View>
            );
          })}
        </ScrollView>
        <StripedBar height={6} />
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="box"
          title="No materials"
          body="Add materials from the web admin to see price comparisons here."
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(g) => g.name}
          refreshing={isRefetching}
          onRefresh={refetch}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100, gap: 10 }}
          renderItem={({ item: g }) => (
            <Card style={{ padding: 14 }}>
              {/* Material name + category */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ fontFamily: "Chivo_700Bold", color: colors.foreground, fontSize: 14, lineHeight: 18 }}>
                    {g.name}
                  </Text>
                  <Text style={{ fontFamily: "Inter_500Medium", color: colors.mutedForeground, fontSize: 11, marginTop: 1 }}>
                    per {g.unit}
                  </Text>
                </View>
                <View style={{
                  backgroundColor: colors.muted,
                  borderRadius: 3,
                  paddingHorizontal: 6,
                  paddingVertical: 3,
                }}>
                  <Text style={{ fontFamily: "Inter_700Bold", fontSize: 9, color: colors.mutedForeground, letterSpacing: 1 }}>
                    {g.category.toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Supplier prices */}
              {g.prices.length === 1 ? (
                /* Single supplier */
                <View style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  backgroundColor: colors.muted + "66",
                  borderRadius: 6,
                  padding: 10,
                }}>
                  <View style={{
                    width: 6, height: 6, borderRadius: 3,
                    backgroundColor: SUPPLIER_COLORS[g.prices[0].supplier] ?? colors.mutedForeground,
                  }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: colors.foreground }}>
                      {SUPPLIER_LABELS[g.prices[0].supplier] ?? g.prices[0].supplier}
                    </Text>
                    {g.prices[0].sku ? (
                      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: colors.mutedForeground }}>
                        {g.prices[0].sku}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={{ fontFamily: "Chivo_900Black", fontSize: 18, color: colors.foreground }}>
                    {formatAUD(g.prices[0].unitPrice)}
                  </Text>
                </View>
              ) : (
                /* Multiple suppliers — price comparison */
                <View style={{ gap: 6 }}>
                  {g.prices.map((p, i) => {
                    const isCheapest = g.cheapest?.supplier === p.supplier && g.prices.length > 1;
                    const saving = g.mostExpensive && g.cheapest && g.mostExpensive.unitPrice !== g.cheapest.unitPrice
                      ? g.mostExpensive.unitPrice - g.cheapest.unitPrice
                      : null;
                    return (
                      <View key={i} style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        backgroundColor: isCheapest ? "#15803d18" : colors.muted + "44",
                        borderRadius: 6,
                        borderWidth: isCheapest ? 1 : 0,
                        borderColor: isCheapest ? "#15803d44" : "transparent",
                        padding: 10,
                      }}>
                        <View style={{
                          width: 6, height: 6, borderRadius: 3,
                          backgroundColor: SUPPLIER_COLORS[p.supplier] ?? colors.mutedForeground,
                        }} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: colors.foreground }}>
                            {SUPPLIER_LABELS[p.supplier] ?? p.supplier}
                            {isCheapest ? " ✓" : ""}
                          </Text>
                          {p.sku ? (
                            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: colors.mutedForeground }}>
                              {p.sku}
                            </Text>
                          ) : null}
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={{
                            fontFamily: "Chivo_900Black",
                            fontSize: 18,
                            color: isCheapest ? "#15803d" : colors.foreground,
                          }}>
                            {formatAUD(p.unitPrice)}
                          </Text>
                          {isCheapest && saving !== null && saving > 0 && (
                            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#15803d" }}>
                              save {formatAUD(saving)}/unit
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </Card>
          )}
        />
      )}
    </View>
  );
}
