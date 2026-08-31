import {
  Chivo_400Regular,
  Chivo_700Bold,
  Chivo_900Black,
} from "@expo-google-fonts/chivo";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import {
  ClerkLoaded,
  ClerkProvider,
  useAuth,
  useUser,
} from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  setAuthTokenGetter,
  setBaseUrl,
  useGetProfileSettings,
  getGetProfileSettingsQueryKey,
} from "@workspace/api-client-react";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { API_BASE_URL } from "@/constants/api";
import { Button, LabeledInput } from "@/components/ui";
import { useColors } from "@/hooks/useColors";

SplashScreen.preventAutoHideAsync();

function requireEnvironmentValue(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

const publishableKey = requireEnvironmentValue(
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
  "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
);
const proxyUrl = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;

setBaseUrl(API_BASE_URL);

const queryClient = new QueryClient();

function ClerkApiClientBridge({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn } = useAuth();
  const [configuredForSignedIn, setConfiguredForSignedIn] =
    useState<boolean | null>(null);

  useEffect(() => {
    if (!isSignedIn) {
      setAuthTokenGetter(null);
      setConfiguredForSignedIn(false);
      return () => setConfiguredForSignedIn(null);
    }

    setAuthTokenGetter(() => getToken());
    setConfiguredForSignedIn(true);
    return () => {
      setAuthTokenGetter(null);
      setConfiguredForSignedIn(null);
    };
  }, [getToken, isSignedIn]);

  if (configuredForSignedIn !== Boolean(isSignedIn)) return null;
  return <>{children}</>;
}

function ClerkQueryClientCacheInvalidator() {
  const { user } = useUser();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const userId = user?.id ?? null;
    if (
      previousUserId.current !== undefined &&
      previousUserId.current !== userId
    ) {
      queryClient.clear();
    }
    previousUserId.current = userId;
  }, [user?.id]);

  return null;
}

function RootStack() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="quote/[id]"
        options={{
          title: "Quote",
          headerStyle: { backgroundColor: "#1a1e26" },
          headerTintColor: "#ffffff",
          headerTitleStyle: { fontFamily: "Chivo_700Bold" },
        }}
      />
      <Stack.Screen
        name="quote/new"
        options={{
          title: "Save Quote",
          presentation: "modal",
          headerStyle: { backgroundColor: "#1a1e26" },
          headerTintColor: "#ffffff",
          headerTitleStyle: { fontFamily: "Chivo_700Bold" },
        }}
      />
    </Stack>
  );
}

function RootLayoutNav() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const colors = useColors();
  const isAuthRoute = segments[0] === "(auth)";
  const isOnboardingRoute = isAuthRoute && segments[1] === "onboarding";

  const { data: profile, isLoading: isProfileLoading, error: profileError, refetch } = useGetProfileSettings({
    query: {
      enabled: isLoaded && isSignedIn,
      retry: false,
      queryKey: [...getGetProfileSettingsQueryKey(), userId],
    }
  });

  const is404 = profileError && typeof profileError === "object" && "status" in profileError && profileError.status === 404;
  const isOtherError = profileError && !is404;
  const redirectTarget =
    isLoaded && !isSignedIn && (!isAuthRoute || isOnboardingRoute)
      ? "/sign-in"
      : isLoaded && isSignedIn && is404 && !isOnboardingRoute
        ? "/(auth)/onboarding"
        : isLoaded && isSignedIn && profile && isAuthRoute
          ? "/"
          : null;

  useEffect(() => {
    if (redirectTarget) router.replace(redirectTarget);
  }, [redirectTarget, router]);

  if (isLoaded && isSignedIn && isProfileLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", gap: 16 }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ fontFamily: "Inter_700Bold", color: colors.mutedForeground, letterSpacing: 2, fontSize: 12 }}>LOADING WORKSPACE</Text>
      </View>
    );
  }

  if (isLoaded && isSignedIn && isOtherError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}>
        <Text style={{ fontFamily: "Chivo_900Black", color: colors.foreground, fontSize: 32, textAlign: "center" }}>AH, BUGGER</Text>
        <Text style={{ fontFamily: "Inter_500Medium", color: colors.mutedForeground, fontSize: 16, textAlign: "center" }}>
          We couldn't connect to the server to grab your profile.
        </Text>
        <Button label="TRY AGAIN" onPress={() => refetch()} style={{ marginTop: 8 }} />
      </View>
    );
  }

  if (!redirectTarget) return <RootStack />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <RootStack />
      <View
        accessibilityLabel="Loading"
        style={{
          ...StyleSheet.absoluteFillObject,
          alignItems: "center",
          backgroundColor: colors.background,
          justifyContent: "center",
          zIndex: 10,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Chivo_400Regular,
    Chivo_700Bold,
    Chivo_900Black,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      tokenCache={tokenCache}
      proxyUrl={proxyUrl}
    >
      <ClerkLoaded>
        <SafeAreaProvider>
          <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
              <ClerkApiClientBridge>
                <ClerkQueryClientCacheInvalidator />
                <GestureHandlerRootView style={{ flex: 1 }}>
                  <KeyboardProvider>
                    <RootLayoutNav />
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </ClerkApiClientBridge>
            </QueryClientProvider>
          </ErrorBoundary>
        </SafeAreaProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
