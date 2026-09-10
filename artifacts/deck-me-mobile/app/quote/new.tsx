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
  useEstimateDeck,
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
import {
  PARAMETRIC_ENGINE_VERSION,
  calculateTemplateBom,
  createCustomParameterDefinition,
  defaultParameterValues,
  hasParametricDefinition,
  sanitiseParameterValues,
  STANDARD_DIMENSION_FALLBACK,
  type CustomParameterDefinition,
  type ParameterDefinition,
} from "@workspace/parametric-quotes";

import {
  normaliseTradeKey,
  applyTradeRules,
  defaultTradeInputs,
  getTradeCalculator,
  mapTradeDimensionsToQuote,
} from "@/components/calculator/trade-calculators";

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
  isManualQuantity: boolean;
  lineKey?: string;
  bomRuleId?: string;
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

const UNITS = ["each", "metre", "linear metre", "square metre", "cubic metre", "litre", "pack", "box", "bag", "sheet"];

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
  const activeTradeCalculator = getTradeCalculator(activeTradeType);
  const deckQuote = normaliseTradeType(activeTradeType) === "carpenter / joiner";
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
  const estimate = useEstimateDeck();

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
  const [parameterValues, setParameterValues] = useState<Record<string, number>>({});
  const [customParameterDefinitions, setCustomParameterDefinitions] = useState<CustomParameterDefinition[]>([]);
  const [tradeDimensions, setTradeDimensions] = useState<Record<string, number>>({});
  const calculationDimensions = useMemo(
    () => ({
      ...defaultTradeInputs(activeTradeCalculator),
      ...tradeDimensions,
    }),
    [activeTradeCalculator, tradeDimensions],
  );
  const quoteSpec = useMemo(
    () =>
      activeTradeCalculator
        ? {
            ...spec,
            ...mapTradeDimensionsToQuote(
              activeTradeType,
              calculationDimensions,
              spec,
            ),
          }
        : spec,
    [activeTradeCalculator, activeTradeType, calculationDimensions, spec],
  );

  useEffect(() => {
    if (
      profileTradeTypes.length > 0 &&
      !profileTradeTypes.includes(selectedTradeType)
    ) {
      setSelectedTradeType(profileTradeTypes[0]);
    }
  }, [profileTradeTypes.join("|"), selectedTradeType]);

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
        isManualQuantity: true,
      },
    ]);
  }

  function addCustomVariable() {
    setCustomParameterDefinitions((items) => {
      const used = new Set(items.map((item) => item.id));
      let ordinal = items.length + 1;
      let definition = createCustomParameterDefinition(ordinal);
      while (used.has(definition.id)) {
        ordinal += 1;
        definition = createCustomParameterDefinition(ordinal);
      }
      return [...items, definition];
    });
  }

  function updateCustomVariable(id: string, field: "label" | "unit" | "value", value: string) {
    if (field === "value") {
      setParameterValues((values) => ({ ...values, [id]: Math.max(0, Number(value) || 0) }));
      return;
    }
    setCustomParameterDefinitions((items) => items.map((item) => item.id === id ? { ...item, [field]: value } : item));
  }

  function removeCustomVariable(id: string) {
    setCustomParameterDefinitions((items) => items.filter((item) => item.id !== id));
    setParameterValues((values) => {
      const next = { ...values };
      delete next[id];
      return next;
    });
  }

  function addScopeItem(description: string) {
    let quantity = "1";
    let unit = "each";
    let unitType = "item";
    let isManualQuantity = true;

    const match = applyTradeRules(
      description,
      calculationDimensions,
      activeTradeCalculator,
    );
    if (match) {
      quantity = String(match.quantity);
      unit = match.unit;
      unitType = match.unitType;
      isManualQuantity = false;
    }

    setLineItems((items) => [
      ...items,
      {
        id: nextLineItemId++,
        description,
        quantity,
        unit,
        unitType,
        unitCost: "0",
        markupPercentage: "0",
        wastagePercentage: "0",
        isBulkItem: false,
        saveToMyPresets: false,
        isManualQuantity,
      },
    ]);
  }

  function applyTradeChange(tradeType: string) {
    setLineItems([]);
    setSelectedTemplateId("custom");
    setParameterValues({});
    setCustomParameterDefinitions([]);
    setSelectedTradeType(tradeType);

    setTradeDimensions(
      defaultTradeInputs(getTradeCalculator(tradeType)),
    );
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
    setLineItems((items) => items.map((item) => {
      if (item.id !== id) return item;
      if (
        item.lineKey &&
        item.bomRuleId &&
        field !== "quantity" &&
        field !== "unitCost" &&
        field !== "markupPercentage"
      ) {
        return item;
      }
      const nextItem = { ...item, [field]: value };

      if (field === "quantity") {
        nextItem.isManualQuantity = true;
      } else if (field === "description" && !nextItem.isManualQuantity && !nextItem.bomRuleId) {
        const match = applyTradeRules(
          nextItem.description,
          calculationDimensions,
          activeTradeCalculator,
        );
        if (match) {
          nextItem.quantity = String(match.quantity);
          nextItem.unit = match.unit;
          nextItem.unitType = match.unitType;
        } else {
          nextItem.isManualQuantity = true;
        }
      }

      return nextItem;
    }));
  }

  function handleRestoreAutoQuantity(id: number) {
    setLineItems((items) => items.map((item) => {
      if (item.id !== id) return item;
      if (item.bomRuleId) {
        const calculated = calculatedBom.find((entry) => entry.lineKey === item.lineKey && entry.bomRuleId === item.bomRuleId);
        return calculated ? { ...item, quantity: String(calculated.quantity), isManualQuantity: false } : item;
      }
      const match = applyTradeRules(
        item.description,
        calculationDimensions,
        activeTradeCalculator,
      );
      if (match) {
        return { ...item, quantity: String(match.quantity), unit: match.unit, unitType: match.unitType, isManualQuantity: false };
      }
      return item;
    }));
  }

  function handleSetTradeDimension(id: string, value: string) {
    const next = {
      ...calculationDimensions,
      [id]: Math.max(0, parseFloat(value) || 0),
    };
    setTradeDimensions(next);
    setLineItems((items) =>
      items.map((item) => {
        if (item.isManualQuantity) return item;
        const match = applyTradeRules(
          item.description,
          next,
          activeTradeCalculator,
        );
        if (match) {
          return { ...item, quantity: String(match.quantity), unit: match.unit, unitType: match.unitType };
        }
        return { ...item, isManualQuantity: true };
      }),
    );
  }

  const matchingTemplates = useMemo(
    () => (templates ?? []).filter((template) =>
      activeTradeType !== "Trade"
      && normaliseTradeType(template.tradeType) === normaliseTradeType(activeTradeType),
    ),
    [activeTradeType, templates],
  );
  const selectedTemplate = useMemo(
    () => matchingTemplates.find((entry) => String(entry.id) === selectedTemplateId),
    [matchingTemplates, selectedTemplateId],
  );
  const parametricTemplate = selectedTemplate && hasParametricDefinition(selectedTemplate as any)
    ? selectedTemplate
    : null;
  const templateDefinitions = parametricTemplate?.parameterDefinitions as ParameterDefinition[] | null | undefined;
  const displayedDefinitions = templateDefinitions?.length
    ? [...templateDefinitions, ...customParameterDefinitions]
    : selectedTemplateId !== "custom" && selectedTemplate
      ? STANDARD_DIMENSION_FALLBACK
      : customParameterDefinitions;
  const calculatedBom = useMemo(
    () => parametricTemplate ? calculateTemplateBom(parametricTemplate.bomRules as any, parameterValues) : [],
    [parametricTemplate, parameterValues],
  );
  const parametricSelected = Boolean(parametricTemplate);
  const labourHours = quoteSpec.labourHours ?? Number(params.labourHours ?? 0);
  const labourRate = quoteSpec.labourRate ?? Number(params.labourRate ?? 85);
  const lineItemsSubtotal = useMemo(
    () => lineItems.reduce((sum, item) => sum + lineTotal(item), 0),
    [lineItems],
  );
  const previewLabourCost = Math.round(labourHours * labourRate * 100) / 100;
  const quoteSubtotal =
    (parametricSelected ? 0 : (estimate.data?.materialsSubtotal ?? 0)) +
    previewLabourCost +
    lineItemsSubtotal;
  const quoteGst = Math.round(quoteSubtotal * 0.1 * 100) / 100;
  const quoteTotal = Math.round((quoteSubtotal + quoteGst) * 100) / 100;

  useEffect(() => {
    if (!deckQuote || parametricSelected) return;
    estimate.mutate({
      data: {
        ...quoteSpec,
        labourHours,
        labourRate,
      },
    });
  }, [deckQuote, parametricSelected, quoteSpec, labourHours, labourRate]);

  function applyTemplate(templateId: string) {
    setSelectedTemplateId(templateId);
    setCustomParameterDefinitions([]);
    if (templateId === "custom") {
      setParameterValues({});
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
    const parametric = hasParametricDefinition(template as any);
    const definitions = parametric ? template.parameterDefinitions ?? [] : STANDARD_DIMENSION_FALLBACK;
    const values = defaultParameterValues(definitions);
    setParameterValues(values);
    const calculated = parametric ? calculateTemplateBom(template.bomRules as any, values) : [];
    setLineItems(template.defaultLineItems.map((item) => {
      let quantity = String(item.quantity);
      let unit = item.unit;
      let unitType = item.unitType;
      let isManualQuantity = true;

      const rule = calculated.find((entry) => entry.lineKey === item.lineKey);
      if (rule) {
        quantity = String(rule.quantity);
        unit = item.unit;
        unitType = item.unitType;
        isManualQuantity = false;
      }

      return {
        id: nextLineItemId++,
        description: item.description,
        quantity,
        unit,
        unitType,
        unitCost: String(item.unitCost),
        markupPercentage: String(item.markupPercentage),
        wastagePercentage: String(item.wastagePercentage),
        isBulkItem: item.isBulkItem,
        saveToMyPresets: false,
        isManualQuantity,
        lineKey: item.lineKey,
        bomRuleId: rule?.bomRuleId,
      };
    }));
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
        isManualQuantity: true,
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
      || (item.isManualQuantity && Number(item.quantity) <= 0)
      || Number(item.unitCost) < 0
      || Number(item.markupPercentage) < 0
    )) {
      Alert.alert(
        "Check additional items",
        "Each item needs a description, a quantity above zero, and non-negative cost and mark-up values.",
      );
      return;
    }
    if (selectedTemplateId === "custom" && customParameterDefinitions.some((definition) =>
      !definition.id.trim() ||
      !definition.label.trim() ||
      !definition.unit.trim() ||
      !Number.isFinite(parameterValues[definition.id]) ||
      parameterValues[definition.id] < (definition.minimum ?? 0) ||
      (definition.maximum !== undefined && parameterValues[definition.id] > definition.maximum)
    )) {
      Alert.alert("Check custom variables", "Each variable needs a label, unit and valid numeric value.");
      return;
    }
    createMut.mutate(
      {
        data: {
          title,
          customerId,
          tradeType: activeTradeType,
          siteAddress: siteAddress || undefined,
          ...(parametricTemplate && parametricTemplate.id > 0 ? {
            templateId: parametricTemplate.id,
            templateSlug: parametricTemplate.slug,
            templateRevision: parametricTemplate.templateRevision!,
          } : {}),
          engineVersion: parametricTemplate ? PARAMETRIC_ENGINE_VERSION : undefined,
          ...(parametricTemplate
            ? { parameterValues }
            : selectedTemplateId === "custom" &&
                customParameterDefinitions.length > 0
              ? {
                  parameterValues,
                  customParameterDefinitions,
                }
              : {}),
          lengthM: quoteSpec.lengthM,
          widthM: quoteSpec.widthM,
          heightM: quoteSpec.heightM,
          boardWidthMm: quoteSpec.boardWidthMm,
          joistSpacingMm: quoteSpec.joistSpacingMm,
          bearerSpacingMm: quoteSpec.bearerSpacingMm,
          postSpacingMm: quoteSpec.postSpacingMm,
          wastageFactor: quoteSpec.wastageFactor,
          labourHours: quoteSpec.labourHours ?? Number(params.labourHours ?? 0),
          labourRate: quoteSpec.labourRate ?? Number(params.labourRate ?? 85),
          gapSpacingMm: spec.gapSpacingMm,
          deckBoardType: spec.deckBoardType,
          subframeType: spec.subframeType,
          fastenerType: spec.fastenerType,
          fasciaType: spec.fasciaType,
          includeHandrails: spec.includeHandrails,
          handrailHeightMm: spec.handrailHeightMm,
          balustradeType: spec.balustradeType,
          timberGapMm: spec.timberGapMm,
          wireSpacingMm: spec.wireSpacingMm,
          includeStairs: spec.includeStairs,
          stairFlights: spec.stairFlights,
          includeFencing: spec.includeFencing,
          fencingSides: spec.fencingSides,
          fencingHeightM: spec.fencingHeightM,
          fencingWidthM: spec.fencingWidthM,
          includeAwning: spec.includeAwning,
          awningWidthM: spec.awningWidthM,
          awningLengthM: spec.awningLengthM,
          lineItems: lineItems
            .filter((item) => item.isManualQuantity || Number(item.quantity) > 0)
            .map((item) => ({
            lineKey: item.lineKey,
            bomRuleId: item.bomRuleId as any,
            isManualQuantity: item.isManualQuantity,
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
      {activeTradeCalculator && !parametricTemplate ? (
        <Card>
          <Text
            style={{
              fontFamily: "Inter_700Bold",
              fontSize: 11,
              letterSpacing: 1.4,
              color: colors.mutedForeground,
              marginBottom: 10,
            }}
          >
            {(activeTradeCalculator.heading ?? "Job Dimensions").toUpperCase()}
          </Text>
          <View style={{ gap: 12 }}>
            {activeTradeCalculator.inputs.map((input) => (
              <View key={input.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: colors.foreground }}>
                  {input.label} <Text style={{ color: colors.mutedForeground }}>({input.unit})</Text>
                </Text>
                <TextInputStyled
                  style={{ width: 100, height: 40, paddingVertical: 0, textAlign: "right" }}
                  keyboardType="decimal-pad"
                  value={String(calculationDimensions[input.id] ?? "")}
                  onChangeText={(val) => handleSetTradeDimension(input.id, val)}
                />
              </View>
            ))}
          </View>

          <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 }}>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 1.2, color: colors.primary, marginBottom: 4 }}>
              CALCULATED OUTPUT
            </Text>
            {activeTradeCalculator.outputs(calculationDimensions).map((out, i) => (
              <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
                <View>
                  <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: colors.foreground }}>{out.label}</Text>
                  {out.note ? <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground }}>{out.note}</Text> : null}
                </View>
                <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: colors.foreground }}>
                  {out.value.toLocaleString("en-AU", { maximumFractionDigits: 3 })} <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 11 }}>{out.unit}</Text>
                </Text>
              </View>
            ))}
          </View>
        </Card>
      ) : deckQuote ? (
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
      ) : (
        <Card>
          <Text
            style={{
              color: colors.foreground,
              fontFamily: "Chivo_700Bold",
              fontSize: 16,
            }}
          >
            {activeTradeType.toUpperCase()} QUOTE
          </Text>
          <Text
            style={{
              color: colors.mutedForeground,
              fontFamily: "Inter_500Medium",
              fontSize: 12,
              lineHeight: 18,
              marginTop: 6,
            }}
          >
            Add work items below and enter the measured quantity for this job.
          </Text>
        </Card>
      )}

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
      {displayedDefinitions.length > 0 || selectedTemplateId === "custom" ? (
        <Card>
          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 1.4, color: colors.mutedForeground, marginBottom: 10 }}>
            TEMPLATE INPUTS
          </Text>
          <View style={{ gap: 12 }}>
            {displayedDefinitions.map((definition) => {
              const isCustom = customParameterDefinitions.some((item) => item.id === definition.id);
              const value = parameterValues[definition.id] ?? definition.defaultValue;
              return (
                <View key={definition.id} style={{ gap: 6 }}>
                  {isCustom ? (
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TextInputStyled
                        value={definition.label}
                        onChangeText={(value) => updateCustomVariable(definition.id, "label", value)}
                        placeholder="Variable label"
                        style={{ flex: 1 }}
                      />
                      <TextInputStyled
                        value={definition.unit}
                        onChangeText={(value) => updateCustomVariable(definition.id, "unit", value)}
                        placeholder="Unit"
                        style={{ width: 82 }}
                      />
                      <Pressable accessibilityRole="button" accessibilityLabel="Remove custom variable" onPress={() => removeCustomVariable(definition.id)} style={{ justifyContent: "center", padding: 8 }}>
                        <Feather name="trash-2" size={16} color={colors.destructive} />
                      </Pressable>
                    </View>
                  ) : (
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: colors.foreground }}>
                      {definition.label} <Text style={{ color: colors.mutedForeground }}>({definition.unit})</Text>
                    </Text>
                  )}
                  <TextInputStyled
                    value={String(value)}
                    onChangeText={(raw) => {
                      const parsed = Number(raw);
                      const minimum = definition.minimum ?? 0;
                      const maximum = definition.maximum ?? Number.MAX_SAFE_INTEGER;
                      setParameterValues((values) => ({
                        ...values,
                        [definition.id]: Number.isFinite(parsed)
                          ? Math.min(maximum, Math.max(minimum, parsed))
                          : minimum,
                      }));
                      if (parametricTemplate) {
                        const nextValues = sanitiseParameterValues(parametricTemplate.parameterDefinitions ?? [], { ...parameterValues, [definition.id]: raw });
                        const nextBom = calculateTemplateBom(parametricTemplate.bomRules as any, nextValues);
                        setLineItems((items) => items.map((item) => {
                          if (item.isManualQuantity || !item.bomRuleId) return item;
                          const next = nextBom.find((entry) => entry.lineKey === item.lineKey && entry.bomRuleId === item.bomRuleId);
                          return next ? { ...item, quantity: String(next.quantity) } : item;
                        }));
                      }
                    }}
                    keyboardType="decimal-pad"
                  />
                </View>
              );
            })}
          </View>
          {parametricTemplate ? (
            <View style={{ marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 }}>
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 1.2, color: colors.primary }}>CALCULATED OUTPUTS & ASSUMPTIONS</Text>
              {calculatedBom.map((output) => (
                <View key={output.lineKey} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>{output.lineKey}</Text>
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 12 }}>{output.quantity}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <Button label="Add variable" icon="plus" onPress={addCustomVariable} />
        </Card>
      ) : null}
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
              {item.lineKey && item.bomRuleId ? (
                <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, padding: 12 }}>
                  <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium" }}>
                    {item.description} · Template-owned
                  </Text>
                </View>
              ) : (
                <TextInputStyled
                  value={item.description}
                  onChangeText={(value) => updateLineItem(item.id, "description", value)}
                  placeholder="Skip bin hire"
                />
              )}
            </LabeledInput>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 1.2, color: colors.mutedForeground, marginBottom: 6 }}>
                    QUANTITY
                  </Text>
                  {item.isManualQuantity && (item.bomRuleId
                    ? calculatedBom.some((entry) => entry.lineKey === item.lineKey && entry.bomRuleId === item.bomRuleId)
                    : applyTradeRules(item.description, calculationDimensions, activeTradeCalculator)) ? (
                    <Pressable
                      accessibilityLabel="Use calculated quantity"
                      accessibilityRole="button"
                      hitSlop={10}
                      onPress={() => handleRestoreAutoQuantity(item.id)}
                      style={{ alignItems: "center", flexDirection: "row", gap: 4, marginBottom: 4, padding: 2 }}
                    >
                      <Feather name="refresh-cw" size={12} color={colors.primary} />
                      <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 9 }}>
                        USE AUTO
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                <TextInputStyled
                  value={item.quantity}
                  onChangeText={(value) => updateLineItem(item.id, "quantity", value)}
                  keyboardType="decimal-pad"
                  style={!item.isManualQuantity ? { backgroundColor: colors.primary + "10", borderColor: colors.primary + "33" } : undefined}
                />
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
              {item.lineKey && item.bomRuleId ? (
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_700Bold", fontSize: 11 }}>
                  {item.unit} · TEMPLATE-OWNED
                </Text>
              ) : (
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
              )}
            </View>
            <View style={{ gap: 10 }}>
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 1.2, color: colors.mutedForeground }}>
                UNIT TYPE
              </Text>
              {item.lineKey && item.bomRuleId ? (
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_700Bold", fontSize: 11 }}>
                  {item.unitType} · TEMPLATE-OWNED
                </Text>
              ) : (
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
              )}
            </View>
            {parametricTemplate && item.lineKey && item.bomRuleId ? (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, padding: 12 }}>
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_700Bold", fontSize: 11 }}>
                    WASTAGE {item.wastagePercentage}% · TEMPLATE-OWNED
                  </Text>
                </View>
                <View style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, padding: 12 }}>
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_700Bold", fontSize: 11 }}>
                    {item.isBulkItem ? "FULL-UNIT ROUNDING" : "NO BULK ROUNDING"} · TEMPLATE-OWNED
                  </Text>
                </View>
              </View>
            ) : (
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
            )}
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
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium" }}>Subtotal</Text>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold" }}>{currency(quoteSubtotal)}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium" }}>Margin</Text>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold" }}>
                  {currency(lineItemsSubtotal - lineItems.reduce((sum, item) => sum + lineCost(item), 0))}
                </Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium" }}>GST (10%)</Text>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold" }}>{currency(quoteGst)}</Text>
              </View>
              <View style={{ height: 1, backgroundColor: colors.border }} />
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.foreground, fontFamily: "Chivo_700Bold", fontSize: 16 }}>Total</Text>
                <Text style={{ color: colors.primary, fontFamily: "Chivo_700Bold", fontSize: 18 }}>{currency(quoteTotal)}</Text>
              </View>
            </View>
          </Card>
      <Button
        label="Save quote"
        icon="save"
        onPress={save}
        loading={createMut.isPending}
        disabled={deckQuote && !parametricSelected && !estimate.data}
      />
          </View>
        )}
      />
    </KeyboardAvoidingView>
  );
}
