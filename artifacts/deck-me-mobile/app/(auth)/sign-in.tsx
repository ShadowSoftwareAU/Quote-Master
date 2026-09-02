import { useSignIn, useSSO } from "@clerk/expo";
import { Feather, FontAwesome } from "@expo/vector-icons";
import * as AuthSession from "expo-auth-session";
import { Link, type Href, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useState } from "react";
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

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn, errors, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [socialProvider, setSocialProvider] = useState<"google" | "apple" | null>(null);

  const busy = fetchStatus === "fetching" || socialProvider !== null;
  const needsCode = signIn.status === "needs_client_trust";
  const topPadding = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  const signInWithSocial = useCallback(async (provider: "google" | "apple") => {
    setSocialProvider(provider);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: provider === "google" ? "oauth_google" : "oauth_apple",
        redirectUrl: AuthSession.makeRedirectUri({
          scheme: "deck-me-mobile",
          path: "sso-callback",
        }),
      });

      if (!createdSessionId || !setActive) {
        Alert.alert(
          "More information required",
          "Clerk needs more account information before this sign-in can finish. Please use email sign-in for now.",
        );
        return;
      }

      await setActive({
        session: createdSessionId,
        navigate: ({ session, decorateUrl }) => {
          if (session?.currentTask) {
            Alert.alert("More information required", "Please finish the account task before continuing.");
            return;
          }
          router.replace(decorateUrl("/") as Href);
        },
      });
    } catch (error) {
      const clerkMessage =
        error && typeof error === "object" && "errors" in error && Array.isArray(error.errors)
          ? error.errors
              .map((item) =>
                item && typeof item === "object" && "longMessage" in item
                  ? String(item.longMessage)
                  : null,
              )
              .filter(Boolean)
              .join("\n")
          : "";
      Alert.alert(
        `Could not sign in with ${provider === "google" ? "Google" : "Apple"}`,
        clerkMessage || "This provider may not be enabled in the connected Clerk instance. Please try email sign-in.",
      );
    } finally {
      setSocialProvider(null);
    }
  }, [router, startSSOFlow]);

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
              QUOTE MASTER
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
            <SocialButton
              provider="google"
              label={socialProvider === "google" ? "CONNECTING…" : "CONTINUE WITH GOOGLE"}
              disabled={busy}
              onPress={() => signInWithSocial("google")}
            />
            <SocialButton
              provider="apple"
              label={socialProvider === "apple" ? "CONNECTING…" : "CONTINUE WITH APPLE"}
              disabled={busy}
              onPress={() => signInWithSocial("apple")}
            />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 10 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>OR</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            </View>
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
              <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>New to Quote Master?</Text>
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

  function SocialButton({
    provider,
    label,
    disabled,
    onPress,
  }: {
    provider: "google" | "apple";
    label: string;
    disabled: boolean;
    onPress: () => void;
  }) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Continue with ${provider === "google" ? "Google" : "Apple"}`}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => ({
          alignItems: "center",
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          borderWidth: 1,
          flexDirection: "row",
          gap: 12,
          justifyContent: "center",
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
          paddingVertical: 14,
        })}
      >
        <FontAwesome
          name={provider === "google" ? "google" : "apple"}
          size={18}
          color={colors.foreground}
        />
        <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", letterSpacing: 0.5 }}>
          {label}
        </Text>
      </Pressable>
    );
  }
}
