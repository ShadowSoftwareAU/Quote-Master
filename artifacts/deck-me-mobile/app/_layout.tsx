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
} from "@workspace/api-client-react";
import { Redirect, Stack, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { API_BASE_URL } from "@/constants/api";

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

function ClerkApiClientBridge() {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isSignedIn) {
      setAuthTokenGetter(null);
      return;
    }

    setAuthTokenGetter(() => getToken());
    return () => setAuthTokenGetter(null);
  }, [getToken, isSignedIn]);

  return null;
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

function RootLayoutNav() {
  const { isSignedIn } = useAuth();
  const segments = useSegments();
  const isAuthRoute = segments[0] === "(auth)";

  return (
    <>
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
      {!isSignedIn && !isAuthRoute ? <Redirect href="/sign-in" /> : null}
      {isSignedIn && isAuthRoute ? <Redirect href="/" /> : null}
    </>
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
              <ClerkApiClientBridge />
              <ClerkQueryClientCacheInvalidator />
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <RootLayoutNav />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </QueryClientProvider>
          </ErrorBoundary>
        </SafeAreaProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
