import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  ActivityIndicator
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetProfileSettings,
  useUpdateProfileSettings,
  useSeedDemoData,
  getGetProfileSettingsQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetPnlReportQueryKey,
  getListCustomersQueryKey,
  getListMaterialsQueryKey,
  getListQuotesQueryKey,
  getListMasterProjectsQueryKey,
  type BusinessRole,
} from "@workspace/api-client-react";

import { StripedBar, TextInputStyled, Button } from "@/components/ui";
import { useColors } from "@/hooks/useColors";

export default function ProfileSettingsScreen() {
  const colors = useColors();
  const { userId, isLoaded, isSignedIn } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const profileQueryKey = [...getGetProfileSettingsQueryKey(), userId];
  const { data: profile, isLoading: isProfileLoading, error, refetch } = useGetProfileSettings({
    query: {
      enabled: isLoaded && isSignedIn,
      retry: false,
      queryKey: profileQueryKey,
    }
  });

  const updateProfile = useUpdateProfileSettings();
  const seedDemoData = useSeedDemoData();

  const [role, setRole] = useState<BusinessRole | "">("");
  const [tradeType, setTradeType] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (profile && !isInitialized) {
      setRole(profile.role);
      setTradeType(profile.tradeType);
      setLicenseNumber(profile.licenseNumber || "");
      setIsInitialized(true);
    }
  }, [profile, isInitialized]);

  const busy = updateProfile.isPending;
  const topPadding = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  function validate() {
    const newErrors: Record<string, string> = {};
    if (!role) newErrors.role = "Please select a system role.";
    if (tradeType.trim().length < 2) newErrors.tradeType = "Trade type must be at least 2 characters.";
    if (licenseNumber && !/^[A-Za-z0-9 ./-]+$/.test(licenseNumber)) newErrors.licenseNumber = "Invalid characters in licence number.";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function submit() {
    if (!validate()) return;
    
    updateProfile.mutate({
      data: {
        role: role as BusinessRole,
        tradeType: tradeType.trim(),
        licenseNumber: licenseNumber.trim() || null,
      }
    }, {
      onSuccess: (updatedProfile) => {
        queryClient.setQueryData(profileQueryKey, updatedProfile);
        queryClient.invalidateQueries({ queryKey: getListMasterProjectsQueryKey() });
        setRole(updatedProfile.role);
        setTradeType(updatedProfile.tradeType);
        setLicenseNumber(updatedProfile.licenseNumber || "");
        Alert.alert("Profile Saved", "Your settings have been successfully updated.");
      },
      onError: (err: any) => {
        Alert.alert("Could not save profile", err?.message || "Please check your inputs and try again.");
      }
    });
  }

  function seedPresentationData() {
    seedDemoData.mutate({ data: {} }, {
      onSuccess: (result) => {
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getListMaterialsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getListQuotesQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getListMasterProjectsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetPnlReportQueryKey() }),
        ]);
        Alert.alert(
          "Demo Data Ready",
          `Created ${result.counts.customers} customers, ${result.counts.materials} materials, ${result.counts.quotes} quotes, and a Master Project.`,
        );
      },
      onError: (err: unknown) => {
        const apiError = err as { status?: number; message?: string };
        Alert.alert(
          apiError.status === 409 ? "Demo Data Already Exists" : "Could Not Seed Demo Data",
          apiError.status === 409
            ? "This Owner workspace has already been prepared for the presentation."
            : apiError.message || "Please try again.",
        );
      },
    });
  }

  if (isProfileLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}>
        <Text style={{ fontFamily: "Chivo_900Black", color: colors.foreground, fontSize: 32, textAlign: "center" }}>AH, BUGGER</Text>
        <Text style={{ fontFamily: "Inter_500Medium", color: colors.mutedForeground, fontSize: 16, textAlign: "center" }}>
          We couldn't connect to the server to grab your profile settings.
        </Text>
        <Button label="TRY AGAIN" onPress={() => refetch()} style={{ marginTop: 8 }} />
      </View>
    );
  }

  const isDirty = tradeType !== profile?.tradeType || licenseNumber !== (profile?.licenseNumber || "");

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 32, gap: 24 }}
      >
        <View style={{ gap: 6, backgroundColor: colors.card, padding: 16, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontFamily: "Chivo_900Black", fontSize: 16, color: colors.foreground, marginBottom: 8 }}>BUSINESS PROFILE</Text>
          <View style={{ gap: 4 }}>
             <Text style={{ fontFamily: "Inter_700Bold", color: colors.mutedForeground, fontSize: 10, letterSpacing: 1 }}>BUSINESS NAME</Text>
             <Text style={{ fontFamily: "Inter_500Medium", color: colors.foreground, fontSize: 14 }}>{profile?.businessName || "Not set"}</Text>
          </View>
          <View style={{ gap: 4, marginTop: 8 }}>
             <Text style={{ fontFamily: "Inter_700Bold", color: colors.mutedForeground, fontSize: 10, letterSpacing: 1 }}>PHONE NUMBER</Text>
             <Text style={{ fontFamily: "Inter_500Medium", color: colors.foreground, fontSize: 14 }}>{profile?.phoneNumber || "Not set"}</Text>
          </View>
        </View>

        <View style={{ gap: 16 }}>
          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: "Inter_700Bold", color: colors.foreground, fontSize: 12 }}>SYSTEM ROLE</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {["Owner", "Employee", "Subcontractor"].map((r) => (
                <Pressable
                  key={r}
                  disabled
                  style={{
                    flex: 1,
                    minWidth: 100,
                    backgroundColor: role === r ? colors.primary : colors.card,
                    borderColor: role === r ? colors.primary : colors.border,
                    borderWidth: 1,
                    borderRadius: colors.radius,
                    paddingVertical: 12,
                    alignItems: "center"
                    , opacity: role === r ? 1 : 0.55
                  }}
                >
                  <Text style={{ fontFamily: "Inter_700Bold", fontSize: 12, color: role === r ? "#fff" : colors.foreground }}>
                    {r.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>
            {errors.role ? <Text style={{ color: colors.destructive, fontSize: 12, fontFamily: "Inter_500Medium" }}>{errors.role}</Text> : null}
            <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_500Medium" }}>
              An Owner manages role changes from Team Management.
            </Text>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: "Inter_700Bold", color: colors.foreground, fontSize: 12 }}>PRIMARY TRADE TYPE</Text>
            <TextInputStyled
              value={tradeType}
              onChangeText={(text) => { setTradeType(text); setErrors(prev => ({...prev, tradeType: ""})) }}
              placeholder="e.g. Carpenter, Landscaper"
            />
            {errors.tradeType ? <Text style={{ color: colors.destructive, fontSize: 12, fontFamily: "Inter_500Medium" }}>{errors.tradeType}</Text> : null}
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: "Inter_700Bold", color: colors.foreground, fontSize: 12 }}>BUILDER / CONTRACTOR LICENCE NUMBER</Text>
            <TextInputStyled
              value={licenseNumber}
              onChangeText={(text) => { setLicenseNumber(text); setErrors(prev => ({...prev, licenseNumber: ""})) }}
              placeholder="Optional"
            />
            {errors.licenseNumber ? <Text style={{ color: colors.destructive, fontSize: 12, fontFamily: "Inter_500Medium" }}>{errors.licenseNumber}</Text> : null}
            <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular" }}>
              Licence details are used to ensure quotes conform to Australian Building Codes and regulations.
            </Text>
          </View>
        </View>

        <Pressable
          disabled={busy || !isDirty}
          onPress={submit}
          style={({ pressed }) => ({
            alignItems: "center",
            backgroundColor: colors.primary,
            borderRadius: colors.radius,
            marginTop: 14,
            opacity: busy || !isDirty ? 0.45 : pressed ? 0.75 : 1,
            paddingVertical: 15,
          })}
        >
          <Text style={{ color: colors.primaryForeground, fontFamily: "Inter_700Bold", letterSpacing: 1 }}>
            {busy ? "SAVING…" : "SAVE PROFILE"}
          </Text>
        </Pressable>

        {profile?.role === "Owner" ? (
          <View
            style={{
              backgroundColor: colors.card,
              borderColor: colors.primary,
              borderRadius: colors.radius,
              borderStyle: "dashed",
              borderWidth: 1,
              gap: 10,
              padding: 16,
            }}
          >
            <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
              <Feather color={colors.primary} name="database" size={18} />
              <Text style={{ color: colors.foreground, fontFamily: "Chivo_900Black", fontSize: 16 }}>
                TEMPORARY DEMO SETUP
              </Text>
            </View>
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 }}>
              Development only. Creates presentation customers, materials, quotes, and one Master Project for this Owner workspace.
            </Text>
            <Pressable
              disabled={seedDemoData.isPending}
              onPress={seedPresentationData}
              style={({ pressed }) => ({
                alignItems: "center",
                backgroundColor: colors.primary,
                borderRadius: colors.radius,
                opacity: seedDemoData.isPending ? 0.45 : pressed ? 0.75 : 1,
                paddingVertical: 14,
              })}
            >
              <Text style={{ color: colors.primaryForeground, fontFamily: "Inter_700Bold", letterSpacing: 1 }}>
                {seedDemoData.isPending ? "SEEDING DEMO DATA…" : "SEED DEMO DATA"}
              </Text>
            </Pressable>
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11 }}>
              This action can only run once and is not available in production.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}