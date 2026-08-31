import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from "react-native";

import { useColors } from "@/hooks/useColors";

export function formatAUD(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "$0.00";
  return n.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  });
}

export function ScreenHeader({
  eyebrow,
  title,
  trailing,
}: {
  eyebrow?: string;
  title: string;
  trailing?: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        {eyebrow ? (
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              color: colors.primary,
              fontSize: 11,
              letterSpacing: 1.4,
              marginBottom: 4,
            }}
          >
            {eyebrow.toUpperCase()}
          </Text>
        ) : null}
        <Text
          style={{
            fontFamily: "Chivo_900Black",
            color: colors.foreground,
            fontSize: 32,
            letterSpacing: -0.5,
          }}
        >
          {title}
        </Text>
      </View>
      {trailing}
    </View>
  );
}

export function StripedBar({ height = 8 }: { height?: number }) {
  return (
    <View
      style={{
        height,
        backgroundColor: "#ff7a00",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <View
        style={{
          position: "absolute",
          inset: 0,
          flexDirection: "row",
        }}
      >
        {Array.from({ length: 40 }).map((_, i) => (
          <View
            key={i}
            style={{
              width: 14,
              height: "200%",
              backgroundColor: i % 2 === 0 ? "#1a1e26" : "transparent",
              transform: [{ rotate: "-25deg" }, { translateY: -6 }],
              marginLeft: -2,
            }}
          />
        ))}
      </View>
    </View>
  );
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const colors = useColors();
  const inner = (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: colors.radius,
          padding: 16,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
  if (!onPress) return inner;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {inner}
    </Pressable>
  );
}

export function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: accent ? colors.primary : colors.card,
        borderWidth: 1,
        borderColor: accent ? colors.primary : colors.border,
        borderRadius: colors.radius,
        padding: 14,
        minHeight: 92,
        justifyContent: "space-between",
      }}
    >
      <Text
        style={{
          fontFamily: "Inter_700Bold",
          fontSize: 10,
          letterSpacing: 1.4,
          color: accent ? "#fff" : colors.mutedForeground,
        }}
      >
        {label.toUpperCase()}
      </Text>
      <Text
        style={{
          fontFamily: "Chivo_900Black",
          fontSize: 26,
          color: accent ? "#fff" : colors.foreground,
          letterSpacing: -0.5,
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const colors = useColors();
  const map: Record<string, { bg: string; fg: string }> = {
    draft: { bg: colors.muted, fg: colors.mutedForeground },
    sent: { bg: "#1d4ed8", fg: "#fff" },
    accepted: { bg: "#15803d", fg: "#fff" },
    rejected: { bg: colors.destructive, fg: "#fff" },
    scheduled: { bg: colors.primary, fg: "#fff" },
    in_progress: { bg: "#1d4ed8", fg: "#fff" },
    completed: { bg: "#15803d", fg: "#fff" },
    cancelled: { bg: colors.muted, fg: colors.mutedForeground },
  };
  const s = map[status] ?? { bg: colors.muted, fg: colors.mutedForeground };
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        backgroundColor: s.bg,
        borderRadius: 2,
        alignSelf: "flex-start",
      }}
    >
      <Text
        style={{
          fontFamily: "Inter_700Bold",
          fontSize: 9,
          color: s.fg,
          letterSpacing: 1,
        }}
      >
        {status.replace("_", " ").toUpperCase()}
      </Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  icon,
  variant = "primary",
  loading,
  disabled,
  small,
  style,
}: {
  label: string;
  onPress?: () => void;
  icon?: React.ComponentProps<typeof Feather>["name"];
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const bg = {
    primary: colors.primary,
    secondary: colors.sidebar,
    ghost: "transparent",
    destructive: colors.destructive,
  }[variant];
  const fg = variant === "ghost" ? colors.foreground : "#fff";
  const borderColor =
    variant === "ghost" ? colors.border : "transparent";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderWidth: variant === "ghost" ? 1 : 0,
          borderColor,
          paddingHorizontal: small ? 12 : 18,
          paddingVertical: small ? 8 : 14,
          borderRadius: colors.radius,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: pressed ? 0.8 : disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Feather name={icon} size={small ? 14 : 18} color={fg} /> : null}
          <Text
            style={{
              fontFamily: "Inter_700Bold",
              color: fg,
              fontSize: small ? 12 : 14,
              letterSpacing: 0.8,
            }}
          >
            {label.toUpperCase()}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <Text
      style={{
        fontFamily: "Inter_700Bold",
        fontSize: 11,
        letterSpacing: 1.5,
        color: colors.mutedForeground,
        marginTop: 24,
        marginBottom: 10,
      }}
    >
      {String(children).toUpperCase()}
    </Text>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
}) {
  const colors = useColors();
  return (
    <View style={{ alignItems: "center", paddingVertical: 48, gap: 14 }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.muted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Feather name={icon} size={28} color={colors.mutedForeground} />
      </View>
      <Text
        style={{
          fontFamily: "Chivo_700Bold",
          fontSize: 18,
          color: colors.foreground,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontFamily: "Inter_400Regular",
          fontSize: 14,
          color: colors.mutedForeground,
          textAlign: "center",
          paddingHorizontal: 32,
        }}
      >
        {body}
      </Text>
      {action ? (
        <Button label={action.label} onPress={action.onPress} icon="plus" />
      ) : null}
    </View>
  );
}

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  const colors = useColors();
  return (
    <View
      accessibilityLabel="Loading"
      style={{ padding: 20, gap: 10 }}
    >
      {Array.from({ length: rows }).map((_, index) => (
        <View
          key={index}
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius,
            borderWidth: 1,
            padding: 16,
            gap: 10,
          }}
        >
          <View
            style={{
              backgroundColor: colors.muted,
              borderRadius: 4,
              height: 16,
              width: `${62 + index * 8}%`,
            }}
          />
          <View
            style={{
              backgroundColor: colors.muted,
              borderRadius: 4,
              height: 12,
              width: "44%",
            }}
          />
          <View
            style={{
              backgroundColor: colors.muted,
              borderRadius: 4,
              height: 12,
              width: "28%",
            }}
          />
        </View>
      ))}
    </View>
  );
}

export function LabeledInput({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return (
    <View style={[{ flex: 1, gap: 6 }, style]}>
      <Text
        style={{
          fontFamily: "Inter_700Bold",
          fontSize: 10,
          letterSpacing: 1.2,
          color: colors.mutedForeground,
        }}
      >
        {label.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

export function TextInputStyled({
  ...props
}: React.ComponentProps<typeof import("react-native").TextInput>) {
  const colors = useColors();
  const TI = require("react-native").TextInput;
  return (
    <TI
      placeholderTextColor={colors.mutedForeground}
      {...props}
      style={[
        {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: colors.radius,
          paddingHorizontal: 12,
          paddingVertical: 12,
          fontSize: 16,
          fontFamily: "Inter_500Medium",
          color: colors.foreground,
          backgroundColor: colors.card,
        } as TextStyle,
        props.style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
});
