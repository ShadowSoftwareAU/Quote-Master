import { Feather } from "@expo/vector-icons";
import { useListBookings } from "@workspace/api-client-react";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Card,
  EmptyState,
  StatusBadge,
  StripedBar,
} from "@/components/ui";
import { useColors } from "@/hooks/useColors";

export default function BookingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data, isLoading, refetch, isRefetching } = useListBookings();
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
            ON THE TOOLS
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
            JOBS
          </Text>
        </View>
        <StripedBar height={6} />
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No jobs booked"
          body="Once a client signs off, book the job from the quote page."
        />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(b) => String(b.id)}
          refreshing={isRefetching}
          onRefresh={refetch}
          contentContainerStyle={{
            padding: 20,
            paddingBottom: insets.bottom + 100,
            gap: 10,
          }}
          renderItem={({ item }) => {
            const start = new Date(item.startAt);
            const end = new Date(item.endAt);
            return (
              <Card>
                <View
                  style={{
                    flexDirection: "row",
                    gap: 14,
                    alignItems: "flex-start",
                  }}
                >
                  <View
                    style={{
                      width: 56,
                      paddingVertical: 10,
                      backgroundColor: colors.primary,
                      borderRadius: 4,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "Inter_700Bold",
                        color: "#fff",
                        fontSize: 10,
                        letterSpacing: 1,
                      }}
                    >
                      {start
                        .toLocaleString("en-AU", { month: "short" })
                        .toUpperCase()}
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Chivo_900Black",
                        color: "#fff",
                        fontSize: 24,
                      }}
                    >
                      {start.getDate()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: "Chivo_700Bold",
                        color: colors.foreground,
                        fontSize: 15,
                      }}
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Inter_500Medium",
                        color: colors.mutedForeground,
                        fontSize: 12,
                        marginTop: 2,
                      }}
                    >
                      {start.toLocaleTimeString("en-AU", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      –{" "}
                      {end.toLocaleTimeString("en-AU", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                    {item.siteAddress ? (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          marginTop: 8,
                        }}
                      >
                        <Feather
                          name="map-pin"
                          size={11}
                          color={colors.mutedForeground}
                        />
                        <Text
                          style={{
                            fontFamily: "Inter_500Medium",
                            color: colors.mutedForeground,
                            fontSize: 11,
                          }}
                          numberOfLines={1}
                        >
                          {item.siteAddress}
                        </Text>
                      </View>
                    ) : null}
                    <View style={{ marginTop: 8 }}>
                      <StatusBadge status={item.status} />
                    </View>
                  </View>
                </View>
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}
