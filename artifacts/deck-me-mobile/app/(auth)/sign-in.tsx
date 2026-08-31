import { useSignIn } from "@clerk/expo";
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

export default function SignInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn, errors, fetchStatus } = useSignIn();
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  const busy = fetchStatus === "fetching";
  const needsCode = signIn.status === "needs_client_trust";
  const topPadding = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  async function finalize() {
    await signIn.finalize({
      navigate: ({ session, decorateUrl }) => {
        if (session?.currentTask) {
          Alert.alert("More information required", "Please finish the account task before continuing.");
          return;
        }
        router.replace(decorateUrl("/") as Href);
      },
    });
  }

  async function submit() {
    const { error } = await signIn.password({ emailAddress, password });
    if (error) return;

    if (signIn.status === "complete") {
      await finalize();
      return;
    }

    if (signIn.status === "needs_client_trust") {
      const emailFactor = signIn.supportedSecondFactors.find(
        (factor) => factor.strategy === "email_code",
      );
      if (emailFactor) {
        await signIn.mfa.sendEmailCode();
        return;
      }
    }

    Alert.alert(
      "Additional verification required",
      "This account requires a verification method that is not available on this device.",
    );
  }

  async function verify() {
    await signIn.mfa.verifyEmailCode({ code });
    if (signIn.status === "complete") {
      await finalize();
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ backgroundColor: colors.sidebar, paddingTop: topPadding + 28 }}>
        <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Feather name="tool" size={22} color={colors.primary} />
            <Text style={{ fontFamily: "Inter_700Bold", color: colors.primary, fontSize: 12, letterSpacing: 1.5 }}>
              DECK ME
            </Text>
          </View>
          <Text style={{ fontFamily: "Chivo_900Black", color: colors.primaryForeground, fontSize: 34, marginTop: 18 }}>
            {needsCode ? "CHECK YOUR EMAIL" : "BACK ON THE TOOLS"}
          </Text>
          <Text style={{ fontFamily: "Inter_400Regular", color: colors.mutedForeground, fontSize: 14, marginTop: 8 }}>
            {needsCode ? "Enter the verification code Clerk sent you." : "Sign in to open your quotes, clients and jobs."}
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
            <AuthButton label="VERIFY" disabled={!code || busy} onPress={verify} />
            <Pressable onPress={() => signIn.reset()} style={{ padding: 12, alignItems: "center" }}>
              <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold" }}>START OVER</Text>
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
            {errors.fields.identifier ? <Text style={{ color: colors.destructive }}>{errors.fields.identifier.message}</Text> : null}
            <Text style={{ fontFamily: "Inter_700Bold", color: colors.foreground, fontSize: 12, marginTop: 8 }}>PASSWORD</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              autoComplete="current-password"
              secureTextEntry
              placeholder="Your password"
              placeholderTextColor={colors.mutedForeground}
              style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: colors.radius, color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 16, padding: 14 }}
            />
            {errors.fields.password ? <Text style={{ color: colors.destructive }}>{errors.fields.password.message}</Text> : null}
            <AuthButton label={busy ? "SIGNING IN…" : "SIGN IN"} disabled={!emailAddress || !password || busy} onPress={submit} />
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 5, marginTop: 12 }}>
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>New to Deck Me?</Text>
              <Link href="/(auth)/sign-up" asChild>
                <Pressable><Text style={{ color: colors.primary, fontFamily: "Inter_700Bold" }}>Create account</Text></Pressable>
              </Link>
            </View>
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