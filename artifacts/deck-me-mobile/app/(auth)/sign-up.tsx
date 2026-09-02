import { useSignUp } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import { Link, type Href, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StripedBar } from "@/components/ui";
import { useColors } from "@/hooks/useColors";

export default function SignUpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signUp, errors, fetchStatus } = useSignUp();
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  const busy = fetchStatus === "fetching";
  const needsCode =
    signUp.status === "missing_requirements" &&
    signUp.unverifiedFields.includes("email_address") &&
    signUp.missingFields.length === 0;
  const topPadding = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  async function submit() {
    const { error } = await signUp.password({ emailAddress, password });
    if (!error) {
      await signUp.verifications.sendEmailCode();
    }
  }

  async function verify() {
    await signUp.verifications.verifyEmailCode({ code });
    if (signUp.status !== "complete") {
      Alert.alert("Verification incomplete", "Check the code and try again.");
      return;
    }

    await signUp.finalize({
      navigate: ({ session, decorateUrl }) => {
        if (session?.currentTask) {
          Alert.alert("More information required", "Please finish the account task before continuing.");
          return;
        }
        router.replace(decorateUrl("/") as Href);
      },
    });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ backgroundColor: colors.sidebar, paddingTop: topPadding + 28 }}>
        <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Feather name="tool" size={22} color={colors.primary} />
            <Text style={{ fontFamily: "Inter_700Bold", color: colors.primary, fontSize: 12, letterSpacing: 1.5 }}>
              QUOTE MASTER
            </Text>
          </View>
          <Text style={{ fontFamily: "Chivo_900Black", color: colors.primaryForeground, fontSize: 34, marginTop: 18 }}>
            {needsCode ? "VERIFY YOUR EMAIL" : "JOIN THE CREW"}
          </Text>
          <Text style={{ fontFamily: "Inter_400Regular", color: colors.mutedForeground, fontSize: 14, marginTop: 8 }}>
            {needsCode ? "Enter the code Clerk sent to your inbox." : "Create a secure account for your Quote Master workspace."}
          </Text>
        </View>
        <StripedBar height={6} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 32, gap: 10 }}
      >
        {needsCode ? (
          <>
            <Text style={{ fontFamily: "Inter_700Bold", color: colors.foreground, fontSize: 12 }}>VERIFICATION CODE</Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              placeholder="123456"
              placeholderTextColor={colors.mutedForeground}
              style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: colors.radius, color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 16, padding: 14 }}
            />
            {errors.fields.code ? <Text style={{ color: colors.destructive }}>{errors.fields.code.message}</Text> : null}
            <AuthButton label={busy ? "VERIFYING…" : "VERIFY & CONTINUE"} disabled={!code || busy} onPress={verify} />
            <Pressable disabled={busy} onPress={() => signUp.verifications.sendEmailCode()} style={{ padding: 12, alignItems: "center" }}>
              <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold" }}>SEND A NEW CODE</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={{ fontFamily: "Inter_700Bold", color: colors.foreground, fontSize: 12 }}>EMAIL ADDRESS</Text>
            <TextInput
              value={emailAddress}
              onChangeText={setEmailAddress}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@company.com"
              placeholderTextColor={colors.mutedForeground}
              style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: colors.radius, color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 16, padding: 14 }}
            />
            {errors.fields.emailAddress ? <Text style={{ color: colors.destructive }}>{errors.fields.emailAddress.message}</Text> : null}
            <Text style={{ fontFamily: "Inter_700Bold", color: colors.foreground, fontSize: 12, marginTop: 8 }}>PASSWORD</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              autoComplete="new-password"
              secureTextEntry
              placeholder="Create a password"
              placeholderTextColor={colors.mutedForeground}
              style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: colors.radius, color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 16, padding: 14 }}
            />
            {errors.fields.password ? <Text style={{ color: colors.destructive }}>{errors.fields.password.message}</Text> : null}
            <AuthButton label={busy ? "CREATING…" : "CREATE ACCOUNT"} disabled={!emailAddress || !password || busy} onPress={submit} />
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 5, marginTop: 12 }}>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>Already have an account?</Text>
              <Link href="/(auth)/sign-in" asChild>
                <Pressable><Text style={{ color: colors.primary, fontFamily: "Inter_700Bold" }}>Sign in</Text></Pressable>
              </Link>
            </View>
            <View nativeID="clerk-captcha" />
          </>
        )}
      </ScrollView>
    </View>
  );

  function AuthButton({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
    return (
      <Pressable
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => ({
          alignItems: "center",
          backgroundColor: colors.primary,
          borderRadius: colors.radius,
          marginTop: 14,
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
          paddingVertical: 15,
        })}
      >
        <Text style={{ color: colors.primaryForeground, fontFamily: "Inter_700Bold", letterSpacing: 1 }}>{label}</Text>
      </Pressable>
    );
  }
}