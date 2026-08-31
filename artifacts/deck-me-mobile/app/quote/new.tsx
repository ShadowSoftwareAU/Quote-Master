import { useQueryClient } from "@tanstack/react-query";
import {
  getListQuotesQueryKey,
  getGetDashboardSummaryQueryKey,
  useCreateQuote,
  useListCustomers,
} from "@workspace/api-client-react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
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
  unitCost: string;
  markupPercentage: string;
};

let nextLineItemId = 1;

function lineTotal(item: LineItemDraft) {
  const quantity = Number(item.quantity) || 0;
  const unitCost = Number(item.unitCost) || 0;
  const markup = Number(item.markupPercentage) || 0;
  return Math.round(quantity * unitCost * (1 + markup / 100) * 100) / 100;
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
  const params = useLocalSearchParams<{
    spec?: string;
    labourHours?: string;
    labourRate?: string;
  }>();
  const qc = useQueryClient();
  const { data: customers } = useListCustomers();
  const createMut = useCreateQuote();

  const spec = useMemo(() => {
    try {
      return params.spec ? JSON.parse(params.spec) : {};
    } catch {
      return {};
    }
  }, [params.spec]);

  const [title, setTitle] = useState("");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [siteAddress, setSiteAddress] = useState("");
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([]);

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
        unitCost: "0",
        markupPercentage: "0",
      },
    ]);
  }

  function updateLineItem(id: number, field: Exclude<keyof LineItemDraft, "id">, value: string) {
    setLineItems((items) => items.map((item) =>
      item.id === id ? { ...item, [field]: value } : item,
    ));
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
            unit: "each",
          })),
        },
      },
      {
        onSuccess: (q) => {
          qc.invalidateQueries({ queryKey: getListQuotesQueryKey() });
          qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
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
          </View>
          </Card>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListFooterComponent={(
          <View style={{ gap: 14, marginTop: lineItems.length ? 14 : 0 }}>
          <Card>
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium" }}>Additional subtotal</Text>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold" }}>{currency(additionalSubtotal)}</Text>
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
