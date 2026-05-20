import { Feather } from "@expo/vector-icons";
import { useGetDashboardSummary } from "@workspace/api-client-react";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Card,
  ScreenHeader,
  StatTile,
  StatusBadge,
  StripedBar,
  formatAUD,
} from "@/components/ui";
import { useColors } from "@/hooks/useColors";

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data, isLoading, refetch, isRefetching } = useGetDashboardSummary();

  const topPad =
    Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ backgroundColor: colors.sidebar, paddingTop: topPad }}>
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 20,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              backgroundColor: colors.primary,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 4,
            }}
          >
            <Feather name="tool" size={20} color="#fff" />
          </View>
          <Text
            style={{
              fontFamily: "Chivo_900Black",
              color: "#fff",
              fontSize: 22,
              letterSpacing: 1,
            }}
          >
            DECK ME
          </Text>
        </View>
        <StripedBar height={6} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + 100,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
      >
        <ScreenHeader eyebrow="G'day" title="Today's job" />

        {isLoading ? (
          <ActivityIndicator
            color={colors.primary}
            style={{ marginTop: 40 }}
          />
        ) : data ? (
          <>
            <View style={{ paddingHorizontal: 20, gap: 10 }}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <StatTile
                  label="Pipeline"
                  value={formatAUD(data.totalQuoteValue)}
                  accent
                />
                <StatTile label="Active" value={String(data.activeQuoteCount)} />
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <StatTile
                  label="Accepted"
                  value={String(data.acceptedQuoteCount)}
                />
                <StatTile
                  label="Upcoming jobs"
                  value={String(data.upcomingBookingCount)}
                />
                <StatTile
                  label="Clients"
                  value={String(data.customerCount)}
                />
              </View>
            </View>

            <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
              <Text
                style={{
                  fontFamily: "Chivo_700Bold",
                  color: colors.foreground,
                  fontSize: 18,
                  marginBottom: 12,
                  letterSpacing: 0.2,
                }}
              >
                RECENT QUOTES
              </Text>
              {data.recentQuotes.length === 0 ? (
                <Card>
                  <Text
                    style={{
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                    }}
                  >
                    No quotes yet. Hit the Calc tab to size your first job.
                  </Text>
                </Card>
              ) : (
                <View style={{ gap: 8 }}>
                  {data.recentQuotes.map((q) => (
                    <Card
                      key={q.id}
                      onPress={() => router.push(`/quote/${q.id}`)}
                    >
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
                              fontSize: 15,
                              color: colors.foreground,
                            }}
                          >
                            {q.title}
                          </Text>
                          <Text
                            style={{
                              fontFamily: "Inter_500Medium",
                              fontSize: 12,
                              color: colors.mutedForeground,
                              marginTop: 2,
                            }}
                          >
                            {q.customerName ?? "—"} · {q.lengthM}×{q.widthM}m
                          </Text>
                        </View>
                        <View style={{ alignItems: "flex-end", gap: 4 }}>
                          <Text
                            style={{
                              fontFamily: "Chivo_900Black",
                              fontSize: 17,
                              color: colors.primary,
                            }}
                          >
                            {formatAUD(q.total)}
                          </Text>
                          <StatusBadge status={q.status} />
                        </View>
                      </View>
                    </Card>
                  ))}
                </View>
              )}
            </View>

            <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
              <Text
                style={{
                  fontFamily: "Chivo_700Bold",
                  color: colors.foreground,
                  fontSize: 18,
                  marginBottom: 12,
                  letterSpacing: 0.2,
                }}
              >
                UPCOMING JOBS
              </Text>
              {data.upcomingBookings.length === 0 ? (
                <Card>
                  <Text
                    style={{
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                    }}
                  >
                    Nothing booked in. Go put some pegs in the ground.
                  </Text>
                </Card>
              ) : (
                <View style={{ gap: 8 }}>
                  {data.upcomingBookings.map((b) => (
                    <Card key={b.id}>
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
                              fontSize: 15,
                              color: colors.foreground,
                            }}
                          >
                            {b.title}
                          </Text>
                          <Text
                            style={{
                              fontFamily: "Inter_500Medium",
                              fontSize: 12,
                              color: colors.mutedForeground,
                              marginTop: 2,
                            }}
                          >
                            {new Date(b.startAt).toLocaleString("en-AU", {
                              weekday: "short",
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Text>
                        </View>
                        <StatusBadge status={b.status} />
                      </View>
                    </Card>
                  ))}
                </View>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
