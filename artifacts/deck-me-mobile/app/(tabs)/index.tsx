import { Feather } from "@expo/vector-icons";
import { useGetDashboardSummary } from "@workspace/api-client-react";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Circle, G, Path, Svg, Text as SvgText } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Card,
  ScreenHeader,
  StatusBadge,
  StripedBar,
  formatAUD,
} from "@/components/ui";
import { useColors } from "@/hooks/useColors";

// ─── Donut chart helpers ───────────────────────────────────────────────────

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutSlicePath(
  cx: number,
  cy: number,
  outer: number,
  inner: number,
  startDeg: number,
  endDeg: number
): string {
  const span = endDeg - startDeg;
  if (span >= 360) {
    // full circle — two halves
    const m1 = polarToCartesian(cx, cy, outer, startDeg);
    const m2 = polarToCartesian(cx, cy, outer, startDeg + 180);
    const i1 = polarToCartesian(cx, cy, inner, startDeg);
    const i2 = polarToCartesian(cx, cy, inner, startDeg + 180);
    return [
      `M ${m1.x} ${m1.y}`,
      `A ${outer} ${outer} 0 1 1 ${m2.x} ${m2.y}`,
      `A ${outer} ${outer} 0 1 1 ${m1.x} ${m1.y}`,
      `M ${i1.x} ${i1.y}`,
      `A ${inner} ${inner} 0 1 0 ${i2.x} ${i2.y}`,
      `A ${inner} ${inner} 0 1 0 ${i1.x} ${i1.y}`,
      "Z",
    ].join(" ");
  }
  const largeArc = span > 180 ? 1 : 0;
  const os = polarToCartesian(cx, cy, outer, startDeg);
  const oe = polarToCartesian(cx, cy, outer, endDeg);
  const ie = polarToCartesian(cx, cy, inner, endDeg);
  const is_ = polarToCartesian(cx, cy, inner, startDeg);
  return [
    `M ${os.x} ${os.y}`,
    `A ${outer} ${outer} 0 ${largeArc} 1 ${oe.x} ${oe.y}`,
    `L ${ie.x} ${ie.y}`,
    `A ${inner} ${inner} 0 ${largeArc} 0 ${is_.x} ${is_.y}`,
    "Z",
  ].join(" ");
}

interface DonutSlice {
  value: number;
  color: string;
  label: string;
}

function DonutChart({ slices, size = 220 }: { slices: DonutSlice[]; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.42;
  const innerR = size * 0.27;
  const total = slices.reduce((s, sl) => s + sl.value, 0);

  if (total === 0) {
    return (
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={outerR} fill="#2a2a2a" />
        <Circle cx={cx} cy={cy} r={innerR} fill="#1a1a1a" />
        <SvgText
          x={cx}
          y={cy - 8}
          textAnchor="middle"
          fill="#666"
          fontSize={12}
          fontFamily="Inter_500Medium"
        >
          no data
        </SvgText>
        <SvgText
          x={cx}
          y={cy + 12}
          textAnchor="middle"
          fill="#666"
          fontSize={11}
          fontFamily="Inter_500Medium"
        >
          yet
        </SvgText>
      </Svg>
    );
  }

  let currentDeg = 0;
  const paths = slices.map((sl) => {
    const span = (sl.value / total) * 360;
    const start = currentDeg;
    currentDeg += span + (span > 0 ? 1.5 : 0); // small gap between slices
    return { ...sl, start, span };
  });

  return (
    <Svg width={size} height={size}>
      <G>
        {paths.map((sl, i) =>
          sl.span > 0 ? (
            <Path
              key={i}
              d={donutSlicePath(cx, cy, outerR, innerR, sl.start, sl.start + sl.span)}
              fill={sl.color}
            />
          ) : null
        )}
      </G>
      <Circle cx={cx} cy={cy} r={innerR} fill="#1a1a1a" />
      <SvgText
        x={cx}
        y={cy - 10}
        textAnchor="middle"
        fill="#fff"
        fontSize={26}
        fontFamily="Chivo_900Black"
      >
        {total}
      </SvgText>
      <SvgText
        x={cx}
        y={cy + 10}
        textAnchor="middle"
        fill="#888"
        fontSize={10}
        fontFamily="Inter_500Medium"
      >
        ACTIVE
      </SvgText>
    </Svg>
  );
}

// ─── Quick action button ───────────────────────────────────────────────────

function QuickAction({
  icon,
  label,
  onPress,
  accent,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
  accent?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: accent
          ? pressed ? "#e06900" : colors.primary
          : pressed ? "#2e2e2e" : "#242424",
        borderRadius: 10,
        paddingVertical: 18,
        alignItems: "center",
        gap: 8,
        borderWidth: accent ? 0 : 1,
        borderColor: "#333",
      })}
    >
      <Feather name={icon} size={24} color={accent ? "#fff" : colors.primary} />
      <Text
        style={{
          fontFamily: "Chivo_700Bold",
          fontSize: 12,
          color: accent ? "#fff" : colors.foreground,
          letterSpacing: 0.5,
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data, isLoading, refetch, isRefetching } = useGetDashboardSummary();

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const todayJob = data?.upcomingBookings?.[0] ?? null;

  const CHART_COLORS = {
    jobs: "#ff7a00",
    quotes: "#4895ef",
    won: "#22d3a0",
  };

  const slices: DonutSlice[] = [
    {
      value: data?.upcomingBookingCount ?? 0,
      color: CHART_COLORS.jobs,
      label: "Active Jobs",
    },
    {
      value: data?.activeQuoteCount ?? 0,
      color: CHART_COLORS.quotes,
      label: "Pending Quotes",
    },
    {
      value: data?.acceptedQuoteCount ?? 0,
      color: CHART_COLORS.won,
      label: "Jobs Won",
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header bar */}
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
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
      >
        <ScreenHeader eyebrow="At a Glance" title="Dashboard" />

        {isLoading ? (
          <ActivityIndicator
            color={colors.primary}
            style={{ marginTop: 40 }}
          />
        ) : data ? (
          <>
            {/* ── 1. Pie / Donut Chart ─────────────────────────────── */}
            <View
              style={{
                marginHorizontal: 20,
                backgroundColor: "#1a1a1a",
                borderRadius: 14,
                paddingVertical: 24,
                paddingHorizontal: 16,
                borderWidth: 1,
                borderColor: "#2a2a2a",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  color: colors.primary,
                  fontSize: 11,
                  letterSpacing: 1.4,
                  marginBottom: 16,
                }}
              >
                BUSINESS OVERVIEW
              </Text>

              <DonutChart slices={slices} size={220} />

              {/* Legend */}
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  gap: 12,
                  marginTop: 20,
                }}
              >
                {slices.map((sl) => (
                  <View
                    key={sl.label}
                    style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                  >
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        backgroundColor: sl.color,
                      }}
                    />
                    <Text
                      style={{
                        fontFamily: "Inter_500Medium",
                        color: colors.mutedForeground,
                        fontSize: 12,
                      }}
                    >
                      {sl.label}
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Chivo_700Bold",
                        color: "#fff",
                        fontSize: 12,
                      }}
                    >
                      {sl.value}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Pipeline value */}
              {data.totalQuoteValue > 0 && (
                <View
                  style={{
                    marginTop: 16,
                    paddingTop: 16,
                    borderTopWidth: 1,
                    borderTopColor: "#2a2a2a",
                    width: "100%",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Inter_500Medium",
                      color: colors.mutedForeground,
                      fontSize: 11,
                      letterSpacing: 1,
                    }}
                  >
                    PIPELINE VALUE
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Chivo_900Black",
                      color: colors.primary,
                      fontSize: 28,
                      marginTop: 2,
                    }}
                  >
                    {formatAUD(data.totalQuoteValue)}
                  </Text>
                </View>
              )}
            </View>

            {/* ── 2. Today's Site Card ─────────────────────────────── */}
            <View style={{ marginHorizontal: 20, marginTop: 20 }}>
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  color: colors.primary,
                  fontSize: 11,
                  letterSpacing: 1.4,
                  marginBottom: 10,
                }}
              >
                TODAY'S SITE
              </Text>

              {todayJob ? (
                <Card>
                  <View style={{ gap: 10 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                      }}
                    >
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text
                          style={{
                            fontFamily: "Chivo_900Black",
                            fontSize: 18,
                            color: colors.foreground,
                            letterSpacing: 0.2,
                          }}
                        >
                          {todayJob.title}
                        </Text>
                        <Text
                          style={{
                            fontFamily: "Inter_500Medium",
                            fontSize: 12,
                            color: colors.mutedForeground,
                            marginTop: 3,
                          }}
                        >
                          {new Date(todayJob.startAt).toLocaleString("en-AU", {
                            weekday: "short",
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {todayJob.endAt
                            ? ` – ${new Date(todayJob.endAt).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}`
                            : ""}
                        </Text>
                        {"address" in todayJob && todayJob.address ? (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 4,
                              marginTop: 4,
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
                                fontSize: 12,
                                color: colors.mutedForeground,
                              }}
                            >
                              {String(todayJob.address)}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <StatusBadge status={todayJob.status} />
                    </View>

                    {/* Photos button inside card */}
                    <Pressable
                      onPress={() => router.push("/bookings")}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        backgroundColor: pressed ? "#2e2e2e" : "#242424",
                        borderRadius: 8,
                        paddingVertical: 10,
                        paddingHorizontal: 14,
                        alignSelf: "flex-start",
                        borderWidth: 1,
                        borderColor: "#333",
                      })}
                    >
                      <Feather name="camera" size={15} color={colors.primary} />
                      <Text
                        style={{
                          fontFamily: "Chivo_700Bold",
                          fontSize: 13,
                          color: colors.foreground,
                          letterSpacing: 0.3,
                        }}
                      >
                        SITE PHOTOS
                      </Text>
                    </Pressable>
                  </View>
                </Card>
              ) : (
                <Card>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <Feather
                      name="sun"
                      size={18}
                      color={colors.mutedForeground}
                    />
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontFamily: "Inter_500Medium",
                        fontSize: 14,
                      }}
                    >
                      Nothing booked. Enjoy the arvo.
                    </Text>
                  </View>
                </Card>
              )}
            </View>

            {/* ── 3. Quick Actions ─────────────────────────────────── */}
            <View style={{ marginHorizontal: 20, marginTop: 20 }}>
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  color: colors.primary,
                  fontSize: 11,
                  letterSpacing: 1.4,
                  marginBottom: 10,
                }}
              >
                QUICK ACTIONS
              </Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <QuickAction
                  icon="file-plus"
                  label={"+ NEW\nQUOTE"}
                  onPress={() => router.push("/calculator")}
                  accent
                />
                <QuickAction
                  icon="layers"
                  label={"MATERIALS\nLIST"}
                  onPress={() => router.push("/materials")}
                />
              </View>
            </View>

            {/* ── Upcoming jobs (compact) ──────────────────────────── */}
            {data.upcomingBookings.length > 1 && (
              <View style={{ marginHorizontal: 20, marginTop: 24 }}>
                <Text
                  style={{
                    fontFamily: "Chivo_700Bold",
                    color: colors.foreground,
                    fontSize: 16,
                    marginBottom: 10,
                    letterSpacing: 0.2,
                  }}
                >
                  UPCOMING JOBS
                </Text>
                <View style={{ gap: 8 }}>
                  {data.upcomingBookings.slice(1).map((b) => (
                    <Card key={b.id}>
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <View style={{ flex: 1, marginRight: 10 }}>
                          <Text
                            style={{
                              fontFamily: "Chivo_700Bold",
                              fontSize: 14,
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
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
