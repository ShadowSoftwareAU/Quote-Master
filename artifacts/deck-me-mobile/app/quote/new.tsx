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
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import {
  Button,
  Card,
  LabeledInput,
  TextInputStyled,
} from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { useProfileAccess } from "@/lib/access";

export default function NewQuoteRoute() {
  const { isSubcontractor } = useProfileAccess();
  if (isSubcontractor) return <Redirect href="/quotes" />;
  return <NewQuoteScreen />;
}

function NewQuoteScreen() {
  const colors = useColors();
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

  function save() {
    if (!title.trim()) {
      Alert.alert("Need a title", "Give the quote a name.");
      return;
    }
    if (!customerId) {
      Alert.alert("Pick a client", "Who's this quote for?");
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
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, gap: 14 }}
      keyboardShouldPersistTaps="handled"
    >
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

      <Button
        label="Save quote"
        icon="save"
        onPress={save}
        loading={createMut.isPending}
      />
    </ScrollView>
  );
}
