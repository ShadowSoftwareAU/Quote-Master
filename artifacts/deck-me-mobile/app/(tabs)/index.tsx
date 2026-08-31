import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StripedBar } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { useProfileAccess } from "@/lib/access";

// ─── Types ────────────────────────────────────────────────────────────────

interface Tile {
  id: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  subtitle: string;
  route: string;
  accent?: boolean;
  sensitive?: boolean; // tiles that expose financial data
}

const TILES: Tile[] = [
  {
    id: "calculator",
    icon: "grid",
    title: "CALCULATE",
    subtitle: "Quote up a deck",
    route: "/calculator",
    accent: true,
  },
  {
    id: "jobs",
    icon: "calendar",
    title: "JOBS",
    subtitle: "Active work & site photos",
    route: "/bookings",
  },
  {
    id: "quotes",
    icon: "file-text",
    title: "QUOTES",
    subtitle: "Pending & sent quotes",
    route: "/quotes",
    sensitive: true,
  },
  {
    id: "clients",
    icon: "users",
    title: "CLIENTS",
    subtitle: "Customer records",
    route: "/customers",
  },
];

// ─── Tile component ───────────────────────────────────────────────────────

function PrivacyTile({
  tile,
  colors,
  onPress,
  delay,
}: {
  tile: Tile;
  colors: ReturnType<typeof useColors>;
  onPress: () => void;
  delay: number;
}) {
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        delay,
        useNativeDriver: true,
        damping: 14,
        stiffness: 180,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ flex: 1, opacity, transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          flex: 1,
          backgroundColor: tile.accent
            ? pressed ? "#e06900" : colors.primary
            : pressed ? "#2a2a2a" : "#1e1e1e",
          borderRadius: 14,
          padding: 22,
          borderWidth: tile.accent ? 0 : 1,
          borderColor: "#2e2e2e",
          gap: 12,
          minHeight: 140,
          justifyContent: "space-between",
        })}
      >
        {/* Icon + lock badge */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 10,
              backgroundColor: tile.accent ? "rgba(255,255,255,0.2)" : colors.primary + "22",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather
              name={tile.icon}
              size={24}
              color={tile.accent ? "#fff" : colors.primary}
            />
          </View>
          {tile.sensitive && (
            <View
              style={{
                backgroundColor: "#000",
                borderRadius: 6,
                paddingHorizontal: 6,
                paddingVertical: 3,
                flexDirection: "row",
                alignItems: "center",
                gap: 3,
              }}
            >
              <Feather name="eye-off" size={9} color="#888" />
              <Text style={{ fontFamily: "Inter_600SemiBold", color: "#888", fontSize: 9, letterSpacing: 0.5 }}>
                $ HIDDEN
              </Text>
            </View>
          )}
        </View>

        {/* Text */}
        <View>
          <Text
            style={{
              fontFamily: "Chivo_900Black",
              fontSize: 22,
              color: tile.accent ? "#fff" : colors.foreground,
              letterSpacing: 0.5,
            }}
          >
            {tile.title}
          </Text>
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 13,
              color: tile.accent ? "rgba(255,255,255,0.7)" : colors.mutedForeground,
              marginTop: 3,
            }}
          >
            {tile.subtitle}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────

export default function HomeScreen() {
  const colors = useColors();
  const { isSubcontractor } = useProfileAccess();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "MORNING" : hour < 17 ? "ARVO" : "EVENING";

  const handleTile = useCallback((route: string) => {
    router.push(route as any);
  }, []);

  useEffect(() => {
    if (isSubcontractor) router.replace("/quotes");
  }, [isSubcontractor, router]);

  if (isSubcontractor) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ backgroundColor: colors.sidebar, paddingTop: topPad }}>
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 20,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{
                width: 38,
                height: 38,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 5,
              }}
            >
              <Feather name="tool" size={20} color="#fff" />
            </View>
            <View>
              <Text
                style={{
                  fontFamily: "Chivo_900Black",
                  color: "#fff",
                  fontSize: 22,
                  letterSpacing: 1,
                }}
              >
                QUOTE MASTER
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  color: colors.mutedForeground,
                  fontSize: 11,
                  letterSpacing: 0.5,
                }}
              >
                GOOD {greeting}
              </Text>
            </View>
          </View>

          {/* Privacy indicator & Profile */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                backgroundColor: "#1a1a1a",
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderWidth: 1,
                borderColor: "#2e2e2e",
              }}
            >
              <Feather name="shield" size={12} color="#22c55e" />
              <Text
                style={{
                  fontFamily: "Inter_700Bold",
                  color: "#22c55e",
                  fontSize: 10,
                  letterSpacing: 0.8,
                }}
              >
                PRIVATE
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Open profile settings"
              accessibilityRole="button"
              onPress={() => router.push("/settings/profile")}
              style={({ pressed }) => ({
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: pressed ? "#2e2e2e" : "#1a1a1a",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: "#2e2e2e",
              })}
            >
              <Feather name="user" size={14} color={colors.mutedForeground} />
            </Pressable>
          </View>
        </View>
        <StripedBar height={6} />
      </View>

      {/* Body */}
      <View style={{ flex: 1, padding: 20, gap: 16 }}>
        {/* Eyebrow */}
        <View>
          <Text
            style={{
              fontFamily: "Inter_700Bold",
              color: colors.mutedForeground,
              fontSize: 11,
              letterSpacing: 1.4,
              marginBottom: 4,
            }}
          >
            TAP TO OPEN SECTION
          </Text>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              color: colors.mutedForeground,
              fontSize: 13,
            }}
          >
            Financial data is hidden until you tap through
          </Text>
        </View>

        {/* 2×2 tile grid */}
        <View style={{ flex: 1, gap: 12 }}>
          <View style={{ flex: 1, flexDirection: "row", gap: 12 }}>
            <PrivacyTile tile={TILES[0]} colors={colors} onPress={() => handleTile(TILES[0].route)} delay={0} />
            <PrivacyTile tile={TILES[1]} colors={colors} onPress={() => handleTile(TILES[1].route)} delay={60} />
          </View>
          <View style={{ flex: 1, flexDirection: "row", gap: 12 }}>
            <PrivacyTile tile={TILES[2]} colors={colors} onPress={() => handleTile(TILES[2].route)} delay={120} />
            <PrivacyTile tile={TILES[3]} colors={colors} onPress={() => handleTile(TILES[3].route)} delay={180} />
          </View>
        </View>

        {/* Footer note */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingBottom: insets.bottom + 8,
          }}
        >
          <Feather name="eye-off" size={13} color={colors.mutedForeground} />
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              color: colors.mutedForeground,
              fontSize: 12,
            }}
          >
            Quotes show{" "}
            <Text style={{ fontFamily: "Inter_700Bold", color: colors.foreground }}>
              retail prices only
            </Text>
            {" "}— trade costs stay on the web dashboard
          </Text>
        </View>
      </View>
    </View>
  );
}
