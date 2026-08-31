import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { Redirect, Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useProfileAccess } from "@/lib/access";

export default function TabLayout() {
  const { isSignedIn } = useAuth();
  const colors = useColors();
  const { isSubcontractor } = useProfileAccess();
  const isWeb = Platform.OS === "web";
  const insets = useSafeAreaInsets();

  if (!isSignedIn) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarLabelStyle: {
          fontFamily: "Inter_600SemiBold",
          fontSize: 10,
          letterSpacing: 0.4,
        },
        tabBarStyle: {
          position: "absolute",
          backgroundColor: colors.sidebar,
          borderTopWidth: 1,
          borderTopColor: "#000",
          elevation: 0,
            height: isWeb ? 84 : 64 + insets.bottom,
            paddingBottom: isWeb ? 0 : insets.bottom,
        },
        tabBarBackground: () => (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: colors.sidebar },
            ]}
          />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "HOME",
          tabBarIcon: ({ color }) => (
            <Feather name="home" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calculator"
        options={{
          href: isSubcontractor ? null : "/calculator",
          title: "CALC",
          tabBarIcon: ({ color }) => (
            <Feather name="grid" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="quotes"
        options={{
          title: "QUOTES",
          tabBarIcon: ({ color }) => (
            <Feather name="file-text" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "JOBS",
          tabBarIcon: ({ color }) => (
            <Feather name="calendar" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="materials"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          href: isSubcontractor ? null : "/customers",
          title: "CLIENTS",
          tabBarIcon: ({ color }) => (
            <Feather name="users" size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
