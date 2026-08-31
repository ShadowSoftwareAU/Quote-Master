import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetQuoteQueryKey,
  getListQuotesQueryKey,
  getGetDashboardSummaryQueryKey,
  getListMasterProjectsQueryKey,
  getGetMasterProjectQueryKey,
  useDeleteQuote,
  useGetQuote,
  useSetQuoteStatus,
} from "@workspace/api-client-react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import {
  Button,
  Card,
  StatusBadge,
  formatAUD,
} from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { useProfileAccess } from "@/lib/access";

const STATUSES = ["draft", "sent", "accepted", "rejected"];

export default function QuoteDetailRoute() {
  const { isSubcontractor } = useProfileAccess();
  if (isSubcontractor) return <Redirect href="/quotes" />;
  return <QuoteDetail />;
}

function QuoteDetail() {
  const colors = useColors();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const qc = useQueryClient();
  const { data, isLoading } = useGetQuote(id, {
    query: { enabled: !Number.isNaN(id), queryKey: getGetQuoteQueryKey(id) },
  });
  const statusMut = useSetQuoteStatus();
  const deleteMut = useDeleteQuote();
  const linkedMasterProjectId = data?.masterProjectId;

  function setStatus(status: string) {
    statusMut.mutate(
      { id, data: { status } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetQuoteQueryKey(id) });
          qc.invalidateQueries({ queryKey: getListQuotesQueryKey() });
          qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          qc.invalidateQueries({ queryKey: getListMasterProjectsQueryKey() });
          if (linkedMasterProjectId) {
            qc.invalidateQueries({
              queryKey: getGetMasterProjectQueryKey(linkedMasterProjectId),
            });
          }
        },
      },
    );
  }

  function confirmDelete() {
    Alert.alert("Delete quote?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteMut.mutate(
            { id },
            {
              onSuccess: () => {
                qc.invalidateQueries({ queryKey: getListQuotesQueryKey() });
                qc.invalidateQueries({
                  queryKey: getGetDashboardSummaryQueryKey(),
                });
                qc.invalidateQueries({ queryKey: getListMasterProjectsQueryKey() });
                if (linkedMasterProjectId) {
                  qc.invalidateQueries({
                    queryKey: getGetMasterProjectQueryKey(linkedMasterProjectId),
                  });
                }
                router.back();
              },
            },
          );
        },
      },
    ]);
  }

  if (isLoading || !data) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 60 }}
    >
      <View>
        <StatusBadge status={data.status} />
        <Text
          style={{
            fontFamily: "Chivo_900Black",
            fontSize: 26,
            color: colors.foreground,
            marginTop: 8,
            letterSpacing: -0.5,
          }}
        >
          {data.title}
        </Text>
        <Text
          style={{
            fontFamily: "Inter_500Medium",
            color: colors.mutedForeground,
            fontSize: 13,
            marginTop: 2,
          }}
        >
          {data.customerName ?? "—"} · {data.lengthM}×{data.widthM}m
        </Text>
      </View>

      <View
        style={{
          backgroundColor: colors.sidebar,
          borderRadius: colors.radius,
          padding: 18,
        }}
      >
        <Text
          style={{
            fontFamily: "Inter_700Bold",
            color: colors.primary,
            fontSize: 11,
            letterSpacing: 1.4,
          }}
        >
          TOTAL INC GST
        </Text>
        <Text
          style={{
            fontFamily: "Chivo_900Black",
            color: "#fff",
            fontSize: 40,
            letterSpacing: -1,
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formatAUD(data.total)}
        </Text>
        <View style={{ marginTop: 12, gap: 6 }}>
          <Row label="Materials" value={formatAUD(data.materialsSubtotal)} />
          <Row label="Labour" value={formatAUD(data.labourCost)} />
          <Row label="GST" value={formatAUD(data.gst)} />
        </View>
      </View>

      <View>
        <Text
          style={{
            fontFamily: "Inter_700Bold",
            fontSize: 11,
            letterSpacing: 1.4,
            color: colors.mutedForeground,
            marginBottom: 8,
          }}
        >
          STATUS
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {STATUSES.map((s) => {
            const active = data.status === s;
            return (
              <Pressable
                key={s}
                onPress={() => setStatus(s)}
                style={({ pressed }) => ({
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 4,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? colors.primary : "transparent",
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    fontFamily: "Inter_700Bold",
                    fontSize: 11,
                    letterSpacing: 1,
                    color: active ? "#fff" : colors.foreground,
                  }}
                >
                  {s.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Card>
        <Text
          style={{
            fontFamily: "Chivo_700Bold",
            fontSize: 14,
            color: colors.foreground,
            marginBottom: 12,
            letterSpacing: 0.4,
          }}
        >
          LINE ITEMS
        </Text>
        {data.lineItems.map((l, i) => (
          <View
            key={l.id}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              paddingBottom: 10,
              marginBottom: 10,
              borderBottomWidth: i === data.lineItems.length - 1 ? 0 : 1,
              borderBottomColor: colors.border,
            }}
          >
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 13,
                  color: colors.foreground,
                }}
              >
                {l.description}
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 11,
                  color: colors.mutedForeground,
                  marginTop: 2,
                }}
              >
                {l.quantity} {l.unit} · {formatAUD(l.unitPrice)}
              </Text>
            </View>
            <Text
              style={{
                fontFamily: "Chivo_700Bold",
                fontSize: 14,
                color: colors.foreground,
              }}
            >
              {formatAUD(l.lineTotal)}
            </Text>
          </View>
        ))}
      </Card>

      {data.siteAddress ? (
        <Card>
          <View
            style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
          >
            <Feather name="map-pin" size={14} color={colors.mutedForeground} />
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 13,
                color: colors.foreground,
              }}
            >
              {data.siteAddress}
            </Text>
          </View>
        </Card>
      ) : null}

      <Button
        label="Delete quote"
        icon="trash-2"
        variant="destructive"
        onPress={confirmDelete}
        loading={deleteMut.isPending}
      />
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
      }}
    >
      <Text
        style={{
          fontFamily: "Inter_500Medium",
          color: "rgba(255,255,255,0.7)",
          fontSize: 13,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: "Inter_700Bold",
          color: "#fff",
          fontSize: 13,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
