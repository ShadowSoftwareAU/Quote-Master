import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import {
  getListQuotesQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetProfileSettingsQueryKey,
  getListTradeTemplatePresetsQueryKey,
  getListTradeTemplatesQueryKey,
  useCreateQuote,
  useListCustomers,
  useGetProfileSettings,
  useListTradeTemplatePresets,
  useListTradeTemplates,
  useListTradeCatalogue,
  type TradeTemplatePreset,
  type TradeTemplate,
} from "@workspace/api-client-react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Button,
  Card,
  LabeledInput,
  TextInputStyled,
} from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { useProfileAccess } from "@/lib/access";

type LineItemDraft = {
  id: number;
  description: string;
  quantity: string;
  unit: string;
  unitType: string;
  unitCost: string;
  markupPercentage: string;
  wastagePercentage: string;
  isBulkItem: boolean;
  saveToMyPresets: boolean;
};

let nextLineItemId = 1;
const GENERIC_QUOTE_SPEC = {
  lengthM: 1,
  widthM: 1,
  heightM: 0,
  boardWidthMm: 90,
  joistSpacingMm: 450,
  bearerSpacingMm: 1800,
  postSpacingMm: 1800,
  wastageFactor: 1,
};

function lineTotal(item: LineItemDraft) {
  const quantity = effectiveQuantity(item);
  const unitCost = Number(item.unitCost) || 0;
  const markup = Number(item.markupPercentage) || 0;
  return Math.round(quantity * unitCost * (1 + markup / 100) * 100) / 100;
}

function effectiveQuantity(item: LineItemDraft) {
  const quantity = Number(item.quantity) || 0;
  const wastage = Number(item.wastagePercentage) || 0;
  const withWastage = quantity * (1 + wastage / 100);
  if (item.isBulkItem) return Math.ceil(withWastage);
  return Math.round((withWastage + Number.EPSILON) * 1000) / 1000;
}

function lineCost(item: LineItemDraft) {
  return Math.round(effectiveQuantity(item) * (Number(item.unitCost) || 0) * 100) / 100;
}

function normaliseTradeType(tradeType: string | null | undefined) {
  const normalised = tradeType?.trim().toLowerCase() ?? "";
  if (["carpenter", "carpentry", "decking"].includes(normalised)) {
    return "carpenter / joiner";
  }
  return normalised;
}

const UNIT_TYPES = [
  { value: "item", label: "Item" },
  { value: "lm", label: "Linear metre" },
  { value: "sqm", label: "Square metre" },
  { value: "m3", label: "Cubic metre" },
  { value: "box", label: "Box" },
] as const;

const UNITS = ["each", "metre", "linear metre", "square metre", "cubic metre", "pack", "box", "bag", "sheet"];

function unitOptions(currentUnit: string) {
  return Array.from(new Set([...UNITS, currentUnit].filter(Boolean)));
}

function validTemplate(template: TradeTemplate) {
  return Array.isArray(template?.defaultLineItems) && template.defaultLineItems.length > 0 && template.defaultLineItems.every((item) =>
    typeof item?.description === "string" && item.description.trim().length > 0
    && Number.isFinite(item.quantity) && item.quantity > 0
    && typeof item.unit === "string" && item.unit.trim().length > 0
    && Number.isFinite(item.unitCost) && item.unitCost >= 0
    && Number.isFinite(item.markupPercentage) && item.markupPercentage >= 0 && item.markupPercentage <= 1000
    && Number.isFinite(item.wastagePercentage) && item.wastagePercentage >= 0 && item.wastagePercentage <= 100
    && UNIT_TYPES.some((unitType) => unitType.value === item.unitType)
    && typeof item.isBulkItem === "boolean"
  );
}

function currency(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(value);
}

export default function NewQuoteRoute() {
  const { isSubcontractor } = useProfileAccess();
  if (isSubcontractor) return <Redirect href="/quotes" />;
  return <NewQuoteScreen />;
}

function NewQuoteScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { userId, isLoaded, isSignedIn } = useAuth();
  const params = useLocalSearchParams<{
    spec?: string;
    labourHours?: string;
    labourRate?: string;
  }>();
  const qc = useQueryClient();
  const { data: customers } = useListCustomers();
  const {
    data: profile,
    isLoading: profileLoading,
    error: profileError,
  } = useGetProfileSettings({
    query: {
      retry: false,
      enabled: isLoaded && isSignedIn,
      queryKey: [...getGetProfileSettingsQueryKey(), userId],
    },
  });
  const profileTradeTypes = profile
    ? profile.tradeTypes?.length > 0
      ? profile.tradeTypes
      : [profile.tradeType]
    : [];
  const [selectedTradeType, setSelectedTradeType] = useState("");
  const activeTradeType = selectedTradeType || profileTradeTypes[0] || "Trade";
  const { data: tradeCatalogue } = useListTradeCatalogue();
  const activeTradeCatalogueEntry = tradeCatalogue?.find(
    (entry) =>
      normaliseTradeType(entry.value) === normaliseTradeType(activeTradeType),
  );
  const {
    data: templates,
    isLoading: templatesLoading,
    error: templatesError,
  } = useListTradeTemplates({
    query: {
      retry: false,
      queryKey: getListTradeTemplatesQueryKey(),
      enabled: isLoaded && isSignedIn,
    },
  });
  const { data: personalPresets, error: presetsError } =
    useListTradeTemplatePresets(
      { tradeType: activeTradeType },
      {
        query: {
          retry: false,
          queryKey: [
            ...getListTradeTemplatePresetsQueryKey({
              tradeType: activeTradeType,
            }),
            userId,
          ],
          enabled:
            isLoaded &&
            isSignedIn &&
            activeTradeType !== "Trade" &&
            profileTradeTypes.includes(activeTradeType),
        },
      },
    );
  const createMut = useCreateQuote();

  const spec = useMemo(() => {
    try {
      return params.spec
        ? { ...GENERIC_QUOTE_SPEC, ...JSON.parse(params.spec) }
        : GENERIC_QUOTE_SPEC;
    } catch {
      return GENERIC_QUOTE_SPEC;
    }
  }, [params.spec]);

  const [title, setTitle] = useState("");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [siteAddress, setSiteAddress] = useState("");
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("custom");

  useEffect(() => {
    if (
      profileTradeTypes.length > 0 &&
      !profileTradeTypes.includes(selectedTradeType)
    ) {
      setSelectedTradeType(profileTradeTypes[0]);
    }
  }, [profileTradeTypes.join("|"), selectedTradeType]);

  const additionalSubtotal = useMemo(
    () => lineItems.reduce((sum, item) => sum + lineTotal(item), 0),
    [lineItems],
  );
  const additionalGst = Math.round(additionalSubtotal * 0.1 * 100) / 100;
  const additionalTotal = additionalSubtotal + additionalGst;

  function addLineItem() {
    setLineItems((items) => [
      ...items,
      {
        id: nextLineItemId++,
        description: "",
        quantity: "1",
        unit: "each",
        unitType: "item",
        unitCost: "0",
        markupPercentage: "0",
        wastagePercentage: "0",
        isBulkItem: false,
        saveToMyPresets: false,
      },
    ]);
  }

  function addScopeItem(description: string) {
    setLineItems((items) => [
      ...items,
      {
        id: nextLineItemId++,
        description,
        quantity: "1",
        unit: "each",
        unitType: "item",
        unitCost: "0",
        markupPercentage: "0",
        wastagePercentage: "0",
        isBulkItem: false,
        saveToMyPresets: false,
      },
    ]);
  }

  function applyTradeChange(tradeType: string) {
    setLineItems([]);
    setSelectedTemplateId("custom");
    setSelectedTradeType(tradeType);
  }

  function changeTrade(tradeType: string) {
    if (tradeType === activeTradeType) return;
    if (lineItems.length === 0) {
      applyTradeChange(tradeType);
      return;
    }
    Alert.alert(
      "Change quote trade?",
      "Changing trade will clear the current quote items.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear and change",
          style: "destructive",
          onPress: () => applyTradeChange(tradeType),
        },
      ],
    );
  }

  function updateLineItem(
    id: number,
    field: Exclude<keyof LineItemDraft, "id">,
    value: string | boolean,
  ) {
    setLineItems((items) => items.map((item) =>
      item.id === id ? { ...item, [field]: value } : item,
    ));
  }

  const matchingTemplates = useMemo(
    () => (templates ?? []).filter((template) =>
      activeTradeType !== "Trade"
      && normaliseTradeType(template.tradeType) === normaliseTradeType(activeTradeType),
    ),
    [activeTradeType, templates],
  );

  function applyTemplate(templateId: string) {
    setSelectedTemplateId(templateId);
    if (templateId === "custom") {
      setLineItems([]);
      return;
    }
    const template = matchingTemplates.find((entry) => String(entry.id) === templateId);
    if (!template || !validTemplate(template)) {
      Alert.alert("Template unavailable", "This template has invalid line data. Start with custom lines instead.");
      setSelectedTemplateId("custom");
      setLineItems([]);
      return;
    }
    setLineItems(template.defaultLineItems.map((item) => ({
      id: nextLineItemId++,
      description: item.description,
      quantity: String(item.quantity),
      unit: item.unit,
      unitType: item.unitType,
      unitCost: String(item.unitCost),
      markupPercentage: String(item.markupPercentage),
      wastagePercentage: String(item.wastagePercentage),
      isBulkItem: item.isBulkItem,
      saveToMyPresets: false,
    })));
  }

  function addPresetItem(preset: TradeTemplatePreset) {
    setLineItems((items) => [
      ...items,
      {
        id: nextLineItemId++,
        description: preset.description,
        quantity: String(preset.quantity),
        unit: preset.unit ?? "each",
        unitType: preset.unitType ?? "item",
        unitCost: String(preset.unitCost),
        markupPercentage: String(preset.markupPercentage),
        wastagePercentage: String(preset.wastagePercentage ?? 0),
        isBulkItem: preset.isBulkItem ?? false,
        saveToMyPresets: false,
      },
    ]);
  }

  function save() {
    if (!title.trim()) {
      Alert.alert("Need a title", "Give the quote a name.");
      return;
    }
    if (!customerId) {
      Alert.alert("Pick a client", "Who's this quote for?");
      return;
    }
    if (lineItems.some((item) =>
      !item.description.trim()
      || Number(item.quantity) <= 0
      || Number(item.unitCost) < 0
      || Number(item.markupPercentage) < 0
    )) {
      Alert.alert(
        "Check additional items",
        "Each item needs a description, a quantity above zero, and non-negative cost and mark-up values.",
      );
      return;
    }
    createMut.mutate(
      {
        data: {
          title,
          customerId,
           tradeType: activeTradeType,
          siteAddress: siteAddress || undefined,
          lengthM: spec.lengthM,
          widthM: spec.widthM,
          heightM: spec.heightM,
          boardWidthMm: spec.boardWidthMm,
          joistSpacingMm: spec.joistSpacingMm,
          bearerSpacingMm: spec.bearerSpacingMm,
          postSpacingMm: spec.postSpacingMm,
          wastageFactor: spec.wastageFactor,
          labourHours: Number(params.labourHours ?? 0),
          labourRate: Number(params.labourRate ?? 85),
          lineItems: lineItems.map((item) => ({
            description: item.description.trim(),
            quantity: Number(item.quantity),
            unitCost: Number(item.unitCost),
            markupPercentage: Number(item.markupPercentage),
            unit: item.unit,
            unitType: item.unitType as "sqm" | "lm" | "m3" | "item" | "box",
            wastagePercentage: Number(item.wastagePercentage),
            isBulkItem: item.isBulkItem,
            saveToMyPresets: item.saveToMyPresets,
          })),
        },
      },
      {
        onSuccess: (q) => {
          qc.invalidateQueries({ queryKey: getListQuotesQueryKey() });
          qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          qc.invalidateQueries({
            queryKey: getListTradeTemplatePresetsQueryKey(),
          });
          router.replace(`/quote/${q.id}`);
        },
        onError: (err: unknown) => {
          Alert.alert("Couldn't save", String(err));
        },
      },
    );
  }

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <FlatList
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 80,
          gap: 14,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        data={lineItems}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={(
          <View style={{ gap: 14 }}>
      <Card>
        <Text
          style={{
            fontFamily: "Inter_700Bold",
            fontSize: 11,
            letterSpacing: 1.4,
            color: colors.mutedForeground,
            marginBottom: 4,
          }}
        >
          DECK
        </Text>
        <Text
          style={{
            fontFamily: "Chivo_700Bold",
            fontSize: 18,
            color: colors.foreground,
          }}
        >
          {spec.lengthM}m × {spec.widthM}m
        </Text>
      </Card>

      <LabeledInput label="Quote title">
        <TextInputStyled
          value={title}
          onChangeText={setTitle}
          placeholder="Backyard merbau deck"
        />
      </LabeledInput>

      <LabeledInput label="Site address">
        <TextInputStyled
          value={siteAddress}
          onChangeText={setSiteAddress}
          placeholder="12 Smith St, Newcastle"
        />
      </LabeledInput>

      <View>
        <Text
          style={{
            fontFamily: "Inter_700Bold",
            fontSize: 10,
            letterSpacing: 1.2,
            color: colors.mutedForeground,
            marginBottom: 8,
          }}
        >
          CLIENT
        </Text>
        <View style={{ gap: 8 }}>
          {customers?.length ? (
            customers.map((c) => {
              const active = c.id === customerId;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setCustomerId(c.id)}
                  style={({ pressed }) => ({
                    padding: 14,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active ? colors.primary : colors.card,
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Text
                    style={{
                      fontFamily: "Chivo_700Bold",
                      fontSize: 15,
                      color: active ? "#fff" : colors.foreground,
                    }}
                  >
                    {c.name}
                  </Text>
                  {c.company ? (
                    <Text
                      style={{
                        fontFamily: "Inter_500Medium",
                        fontSize: 12,
                        color: active ? "rgba(255,255,255,0.85)" : colors.mutedForeground,
                        marginTop: 2,
                      }}
                    >
                      {c.company}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })
          ) : (
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: "Inter_500Medium",
              }}
            >
              Add a client first from the Clients tab.
            </Text>
          )}
        </View>
      </View>
      {profileTradeTypes.length > 1 ? (
        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 1.2, color: colors.mutedForeground }}>
            QUOTE TRADE
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {profileTradeTypes.map((tradeType) => {
              const selected = tradeType === activeTradeType;
              return (
                <Pressable
                  key={tradeType}
                  onPress={() => changeTrade(tradeType)}
                  style={{ backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border, borderRadius: colors.radius, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11 }}
                >
                  <Text style={{ color: selected ? colors.primaryForeground : colors.foreground, fontFamily: "Inter_700Bold", fontSize: 12 }}>
                    {tradeType.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
      {activeTradeCatalogueEntry ? (
        <View style={{ backgroundColor: colors.card, borderColor: colors.primary + "55", borderRadius: colors.radius, borderWidth: 2, gap: 10, padding: 14 }}>
          <Text style={{ color: colors.foreground, fontFamily: "Chivo_700Bold", fontSize: 15 }}>
            {activeTradeType.toUpperCase()} QUOTING OPTIONS
          </Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
            Tap work items to add them to this quote.
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {activeTradeCatalogueEntry.quotingFunctions.map((item) => (
              <Pressable
                key={item}
                onPress={() => addScopeItem(item)}
                style={{ alignItems: "center", backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 10, paddingVertical: 9 }}
              >
                <Feather color={colors.primary} name="plus" size={14} />
                <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 11 }}>{item}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 11, lineHeight: 16 }}>
            Common parameters: {activeTradeCatalogueEntry.quotingParameters.join(", ")}
          </Text>
        </View>
      ) : null}
      <View style={{ gap: 8 }}>
        <Text style={{ fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 1.2, color: colors.mutedForeground }}>
          SAVED TRADE TEMPLATE
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: selectedTemplateId === "custom" }}
            onPress={() => applyTemplate("custom")}
            style={{
              borderWidth: 1,
              borderColor: selectedTemplateId === "custom" ? colors.primary : colors.border,
              backgroundColor: selectedTemplateId === "custom" ? colors.primary : colors.card,
              borderRadius: colors.radius,
              paddingHorizontal: 14,
              paddingVertical: 11,
            }}
          >
            <Text style={{ color: selectedTemplateId === "custom" ? "#fff" : colors.foreground, fontFamily: "Inter_700Bold", fontSize: 12 }}>
              CUSTOM LINES
            </Text>
          </Pressable>
          {matchingTemplates.map((template) => {
            const valid = validTemplate(template);
            const selected = selectedTemplateId === String(template.id);
            return (
              <Pressable
                key={template.id}
                accessibilityRole="radio"
                accessibilityLabel={`${template.name}${valid ? "" : ", unavailable"}`}
                accessibilityState={{ selected, disabled: !valid }}
                disabled={!valid}
                onPress={() => applyTemplate(String(template.id))}
                style={{
                  borderWidth: 1,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primary : colors.card,
                  borderRadius: colors.radius,
                  paddingHorizontal: 14,
                  paddingVertical: 11,
                  opacity: valid ? 1 : 0.45,
                }}
              >
                <Text style={{ color: selected ? "#fff" : colors.foreground, fontFamily: "Inter_700Bold", fontSize: 12 }}>
                  {template.name.toUpperCase()}{valid ? "" : " (UNAVAILABLE)"}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {profileError || templatesError ? (
          <Text style={{ color: "#b45309", fontFamily: "Inter_500Medium", fontSize: 12 }}>
            Saved templates are unavailable. You can continue with custom lines.
          </Text>
        ) : profileLoading || templatesLoading ? (
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
            Loading templates for {activeTradeType}…
          </Text>
        ) : matchingTemplates.length === 0 ? (
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
            No saved templates match {activeTradeType}. Custom lines are ready.
          </Text>
        ) : (
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
            Choosing a template replaces the current additional lines.
          </Text>
        )}
      </View>
          {personalPresets?.length ? (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 1.2, color: colors.primary }}>
                    MY QUICK-ADD PRESETS
                  </Text>
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: colors.mutedForeground, marginTop: 3 }}>
                    Saved for {activeTradeType}
                  </Text>
                </View>
                <Text style={{ fontFamily: "Inter_700Bold", fontSize: 12, color: colors.mutedForeground }}>
                  {personalPresets.length}
                </Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {personalPresets.map((preset) => (
                  <Pressable
                    key={preset.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${preset.description}`}
                    onPress={() => addPresetItem(preset)}
                    style={({ pressed }) => ({
                      borderWidth: 1,
                      borderColor: colors.primary + "66",
                      backgroundColor: colors.primary + "12",
                      borderRadius: colors.radius,
                      paddingHorizontal: 13,
                      paddingVertical: 10,
                      opacity: pressed ? 0.65 : 1,
                    })}
                  >
                    <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 12 }}>
                      + {preset.description}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : presetsError ? (
            <Text style={{ color: "#b45309", fontFamily: "Inter_500Medium", fontSize: 12 }}>
              Your personal presets are unavailable. You can still add custom items.
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Chivo_700Bold", fontSize: 18, color: colors.foreground }}>
                Additional line items
              </Text>
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: colors.mutedForeground, marginTop: 3 }}>
                Add hire, permits, disposal, or other costs.
              </Text>
            </View>
            <Button label="Add item" icon="plus" onPress={addLineItem} />
          </View>
          {lineItems.length === 0 ? (
            <Card>
              <Text style={{ textAlign: "center", color: colors.mutedForeground, fontFamily: "Inter_500Medium" }}>
                No additional items added.
              </Text>
            </Card>
          ) : null}
          </View>
        )}
        renderItem={({ item, index }) => (
          <Card>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 1.2, color: colors.mutedForeground }}>
              ITEM {index + 1}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove item ${index + 1}`}
              onPress={() => setLineItems((items) => items.filter((entry) => entry.id !== item.id))}
              style={({ pressed }) => ({ padding: 8, opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={{ color: colors.destructive, fontFamily: "Inter_700Bold" }}>Remove</Text>
            </Pressable>
          </View>
          <View style={{ gap: 12 }}>
            <LabeledInput label="Description">
              <TextInputStyled
                value={item.description}
                onChangeText={(value) => updateLineItem(item.id, "description", value)}
                placeholder="Skip bin hire"
              />
            </LabeledInput>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <LabeledInput label="Quantity">
                  <TextInputStyled
                    value={item.quantity}
                    onChangeText={(value) => updateLineItem(item.id, "quantity", value)}
                    keyboardType="decimal-pad"
                  />
                </LabeledInput>
              </View>
              <View style={{ flex: 1 }}>
                <LabeledInput label="Unit cost">
                  <TextInputStyled
                    value={item.unitCost}
                    onChangeText={(value) => updateLineItem(item.id, "unitCost", value)}
                    keyboardType="decimal-pad"
                  />
                </LabeledInput>
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <LabeledInput label="Mark-up %">
                  <TextInputStyled
                    value={item.markupPercentage}
                    onChangeText={(value) => updateLineItem(item.id, "markupPercentage", value)}
                    keyboardType="decimal-pad"
                  />
                </LabeledInput>
              </View>
              <View style={{ flex: 1, paddingBottom: 11 }}>
                <Text style={{ fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 1.2, color: colors.mutedForeground }}>
                  LINE TOTAL
                </Text>
                <Text style={{ fontFamily: "Chivo_700Bold", fontSize: 18, color: colors.foreground, marginTop: 5 }}>
                  {currency(lineTotal(item))}
                </Text>
              </View>
            </View>
            <View style={{ gap: 10 }}>
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 1.2, color: colors.mutedForeground }}>
                UNIT
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {unitOptions(item.unit).map((unit) => {
                  const active = item.unit === unit;
                  return (
                    <Pressable
                      key={unit}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      onPress={() => updateLineItem(item.id, "unit", unit)}
                      style={{
                        borderWidth: 1,
                        borderColor: active ? colors.primary : colors.border,
                        backgroundColor: active ? colors.primary : colors.card,
                        borderRadius: colors.radius,
                        paddingHorizontal: 11,
                        paddingVertical: 9,
                      }}
                    >
                      <Text style={{ color: active ? "#fff" : colors.foreground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                        {unit}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
            <View style={{ gap: 10 }}>
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 1.2, color: colors.mutedForeground }}>
                UNIT TYPE
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {UNIT_TYPES.map((unitType) => {
                  const active = item.unitType === unitType.value;
                  return (
                    <Pressable
                      key={unitType.value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      onPress={() => updateLineItem(item.id, "unitType", unitType.value)}
                      style={{
                        borderWidth: 1,
                        borderColor: active ? colors.primary : colors.border,
                        backgroundColor: active ? colors.primary : colors.card,
                        borderRadius: colors.radius,
                        paddingHorizontal: 11,
                        paddingVertical: 9,
                      }}
                    >
                      <Text style={{ color: active ? "#fff" : colors.foreground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                        {unitType.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <LabeledInput label="Wastage %">
                  <TextInputStyled
                    value={item.wastagePercentage}
                    onChangeText={(value) => updateLineItem(item.id, "wastagePercentage", value)}
                    keyboardType="decimal-pad"
                  />
                </LabeledInput>
              </View>
              <Pressable
                accessibilityRole="switch"
                accessibilityLabel="Round up to full boxes or bulk units"
                accessibilityState={{ checked: item.isBulkItem }}
                onPress={() => updateLineItem(item.id, "isBulkItem", !item.isBulkItem)}
                style={{
                  flex: 1,
                  minHeight: 52,
                  borderWidth: 1,
                  borderColor: item.isBulkItem ? colors.primary : colors.border,
                  backgroundColor: item.isBulkItem ? colors.primary : colors.card,
                  borderRadius: colors.radius,
                  paddingHorizontal: 12,
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: item.isBulkItem ? "#fff" : colors.foreground, fontFamily: "Inter_700Bold", fontSize: 11 }}>
                  {item.isBulkItem ? "FULL BOX ROUNDING ON" : "ROUND TO 3 DECIMALS"}
                </Text>
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel="Save to My Presets"
              accessibilityState={{ checked: item.saveToMyPresets }}
              onPress={() => updateLineItem(item.id, "saveToMyPresets", !item.saveToMyPresets)}
              style={{
                minHeight: 52,
                borderWidth: 1,
                borderColor: item.saveToMyPresets ? colors.primary : colors.border,
                backgroundColor: item.saveToMyPresets ? colors.primary + "18" : colors.card,
                borderRadius: colors.radius,
                paddingHorizontal: 12,
                justifyContent: "center",
              }}
            >
              <Text style={{ color: item.saveToMyPresets ? colors.primary : colors.foreground, fontFamily: "Inter_700Bold", fontSize: 11 }}>
                {item.saveToMyPresets ? "SAVE TO MY PRESETS ON" : "SAVE TO MY PRESETS"}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 11, marginTop: 3 }}>
                Reuse this item on future {profile?.tradeType || "trade"} quotes.
              </Text>
            </Pressable>
            <View style={{ gap: 4, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }}>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                Effective quantity: <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold" }}>{effectiveQuantity(item).toFixed(3)} {item.unit}</Text>
              </Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
                Cost {currency(lineCost(item))} · Margin <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold" }}>{currency(lineTotal(item) - lineCost(item))}</Text>
              </Text>
            </View>
          </View>
          </Card>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListFooterComponent={(
          <View style={{ gap: 14, marginTop: lineItems.length ? 14 : 0 }}>
          <Card>
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium" }}>Effective cost</Text>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold" }}>
                  {currency(lineItems.reduce((sum, item) => sum + lineCost(item), 0))}
                </Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium" }}>Additional subtotal</Text>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold" }}>{currency(additionalSubtotal)}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium" }}>Margin</Text>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold" }}>
                  {currency(additionalSubtotal - lineItems.reduce((sum, item) => sum + lineCost(item), 0))}
                </Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium" }}>GST (10%)</Text>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold" }}>{currency(additionalGst)}</Text>
              </View>
              <View style={{ height: 1, backgroundColor: colors.border }} />
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.foreground, fontFamily: "Chivo_700Bold", fontSize: 16 }}>Additional total</Text>
                <Text style={{ color: colors.primary, fontFamily: "Chivo_700Bold", fontSize: 18 }}>{currency(additionalTotal)}</Text>
              </View>
            </View>
          </Card>
      <Button
        label="Save quote"
        icon="save"
        onPress={save}
        loading={createMut.isPending}
      />
          </View>
        )}
      />
    </KeyboardAvoidingView>
  );
}
