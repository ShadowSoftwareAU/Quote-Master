import { getListQuotesQueryKey, useListQuotes } from "@workspace/api-client-react";
import { useUser } from "@clerk/expo";
import { router } from "expo-router";
import React from "react";
import {
  FlatList,
  Platform,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Card,
  EmptyState,
  LoadingSkeleton,
  ScreenHeader,
  StatusBadge,
  StripedBar,
  formatAUD,
} from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { useProfileAccess, visibleToProfile } from "@/lib/access";

export default function QuotesScreen() {
  const colors = useColors();
  const { user } = useUser();
  const access = useProfileAccess();
  const insets = useSafeAreaInsets();
  const { data, isLoading, refetch, isRefetching } = useListQuotes({
    query: {
      queryKey: getListQuotesQueryKey(),
      refetchInterval: access.isAssignedWorker ? 10_000 : false,
    },
  });
  const visibleQuotes = visibleToProfile(data, {
    ...access,
    identity: { userId: user?.id, email: user?.primaryEmailAddress?.emailAddress },
  });
  const topPad =
    Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ backgroundColor: colors.sidebar, paddingTop: topPad }}>
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 16,
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
            ON THE BOOKS
          </Text>
          <Text
            style={{
              fontFamily: "Chivo_900Black",
              color: "#fff",
              fontSize: 28,
              letterSpacing: -0.5,
              marginTop: 4,
            }}
          >
            QUOTES
          </Text>
        </View>
        <StripedBar height={6} />
      </View>

      {isLoading ? (
        <LoadingSkeleton rows={4} />
      ) : visibleQuotes.length === 0 ? (
        <EmptyState
          icon="file-text"
          title="No quotes yet"
          body="Open the Calc tab to size a job and save it as a quote."
          action={access.isAssignedWorker ? undefined : { label: "New quote", onPress: () => router.push("/calculator") }}
        />
      ) : (
        <FlatList
           data={visibleQuotes}
          keyExtractor={(item) => String(item.id)}
          refreshing={isRefetching}
          onRefresh={refetch}
          contentContainerStyle={{
            padding: 20,
            paddingBottom: insets.bottom + 100,
            gap: 10,
          }}
          renderItem={({ item }) => (
            <Card onPress={() => router.push(`/quote/${item.id}`)}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text
                    style={{
                      fontFamily: "Chivo_700Bold",
                      fontSize: 16,
                      color: colors.foreground,
                    }}
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Inter_500Medium",
                      fontSize: 12,
                      color: colors.mutedForeground,
                      marginTop: 2,
                    }}
                  >
                    {item.customerName ?? "—"} · {item.lengthM}×{item.widthM}m
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  <Text
                    style={{
                      fontFamily: "Chivo_900Black",
                      fontSize: 18,
                      color: colors.primary,
                    }}
                  >
                    {formatAUD(item.total)}
                  </Text>
                  <StatusBadge status={item.status} />
                </View>
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}
