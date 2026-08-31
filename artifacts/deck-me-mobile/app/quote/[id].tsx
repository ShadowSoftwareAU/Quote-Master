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
  useRegenerateQuotePortalToken,
  useSetQuoteStatus,
} from "@workspace/api-client-react";
import { useAuth } from "@clerk/expo";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";

import { Button, Card, StatusBadge, formatAUD } from "@/components/ui";
import { API_BASE_URL, WEB_BASE_URL } from "@/constants/api";
import { useColors } from "@/hooks/useColors";
import { useProfileAccess } from "@/lib/access";

const STATUSES = ["draft", "sent", "accepted", "rejected"];

export default function QuoteDetailRoute() {
  return <QuoteDetail />;
}

function QuoteDetail() {
  const colors = useColors();
  const { isAssignedWorker } = useProfileAccess();
  const { getToken } = useAuth();
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const qc = useQueryClient();
  const { data, isLoading } = useGetQuote(id, {
    query: { enabled: !Number.isNaN(id), queryKey: getGetQuoteQueryKey(id) },
  });
  const statusMut = useSetQuoteStatus();
  const deleteMut = useDeleteQuote();
  const portalTokenMut = useRegenerateQuotePortalToken();
  const linkedMasterProjectId = data?.masterProjectId;
  const [isSharingPortalLink, setIsSharingPortalLink] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  async function sharePortalLink() {
    setIsSharingPortalLink(true);
    try {
      const portalToken =
        data?.portalToken ??
        (await portalTokenMut.mutateAsync({ id })).portalToken;
      await Share.share({
        message: `${WEB_BASE_URL}/quote/${portalToken}`,
        title: data?.title ?? "Client quote portal",
      });
    } finally {
      setIsSharingPortalLink(false);
    }
  }

  async function downloadPdf() {
    setIsDownloadingPdf(true);
    let temporaryUri: string | null = null;
    try {
      const authToken = await getToken();
      if (!authToken) {
        throw new Error("You must be signed in to download a quote PDF.");
      }
      const directory =
        FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!directory) throw new Error("Temporary file storage is unavailable.");
      const result = await FileSystem.downloadAsync(
        `${API_BASE_URL}/api/quotes/${id}/pdf`,
        `${directory}quote-${id}.pdf`,
        { headers: { Authorization: `Bearer ${authToken}` } },
      );
      if (result.status < 200 || result.status >= 300) {
        throw new Error(`PDF request failed with status ${result.status}.`);
      }
      temporaryUri = result.uri;
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("PDF downloaded", "The PDF was saved to this device.");
        temporaryUri = null;
        return;
      }
      await Sharing.shareAsync(result.uri, {
        mimeType: "application/pdf",
        dialogTitle: "Share quote PDF",
        UTI: "com.adobe.pdf",
      });
    } finally {
      if (temporaryUri) {
        await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(
          () => undefined,
        );
      }
      setIsDownloadingPdf(false);
    }
  }

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
                qc.invalidateQueries({
                  queryKey: getListMasterProjectsQueryKey(),
                });
                if (linkedMasterProjectId) {
                  qc.invalidateQueries({
                    queryKey: getGetMasterProjectQueryKey(
                      linkedMasterProjectId,
                    ),
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
      {!isAssignedWorker && (
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
      )}

      {!isAssignedWorker && (
        <View style={{ gap: 8 }}>
          <Pressable
            disabled={isSharingPortalLink}
            onPress={() =>
              sharePortalLink().catch(() =>
                Alert.alert("Could not share portal link", "Please try again."),
              )
            }
            style={[
              styles.actionButton,
              {
                backgroundColor: colors.primary,
                opacity: isSharingPortalLink ? 0.6 : 1,
              },
            ]}
          >
            <Feather name="link" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>
              {isSharingPortalLink ? "PREPARING LINK..." : "SHARE PORTAL LINK"}
            </Text>
          </Pressable>
          <Pressable
            disabled={isDownloadingPdf}
            onPress={() =>
              downloadPdf().catch(() =>
                Alert.alert("Could not download PDF", "Please try again."),
              )
            }
            style={[
              styles.actionButton,
              {
                borderColor: colors.border,
                borderWidth: 1,
                opacity: isDownloadingPdf ? 0.6 : 1,
              },
            ]}
          >
            <Feather name="download" size={16} color={colors.foreground} />
            <Text
              style={[styles.actionButtonText, { color: colors.foreground }]}
            >
              {isDownloadingPdf ? "PREPARING PDF..." : "DOWNLOAD / SHARE PDF"}
            </Text>
          </Pressable>
        </View>
      )}

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
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
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

      {!isAssignedWorker && (
        <Button
          label="Delete quote"
          icon="trash-2"
          variant="destructive"
          onPress={confirmDelete}
          loading={deleteMut.isPending}
        />
      )}
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

const styles = {
  actionButton: {
    borderRadius: 8,
    padding: 14,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    flexDirection: "row" as const,
    gap: 8,
  },
  actionButtonText: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    letterSpacing: 0.5,
  },
};
