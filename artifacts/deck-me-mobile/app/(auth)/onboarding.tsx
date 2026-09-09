import { Feather } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateOnboardingProfile,
  getGetProfileSettingsQueryKey,
  useListTradeCatalogue,
  type BusinessRole,
} from "@workspace/api-client-react";

import { StripedBar, TextInputStyled } from "@/components/ui";
import { useColors } from "@/hooks/useColors";

type OnboardingDraft = {
  businessName: string;
  phoneNumber: string;
  role: BusinessRole | "";
  tradeTypes: string[];
  licenseNumber: string;
};

const EMPTY_DRAFT: OnboardingDraft = {
  businessName: "",
  phoneNumber: "",
  role: "",
  tradeTypes: [],
  licenseNumber: "",
};

export default function OnboardingScreen() {
  const colors = useColors();
  const { userId } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const createProfile = useCreateOnboardingProfile();
  const { data: tradeCatalogue } = useListTradeCatalogue();
  const draftQueryKey = ["onboardingDraft", userId] as const;

  const [draft, setDraft] = useState<OnboardingDraft>(
    () => queryClient.getQueryData<OnboardingDraft>(draftQueryKey) ?? EMPTY_DRAFT,
  );
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  const busy = createProfile.isPending;
  const topPadding = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  function updateDraft<K extends keyof OnboardingDraft>(
    field: K,
    value: OnboardingDraft[K],
  ) {
    setDraft((current) => {
      const next = { ...current, [field]: value };
      queryClient.setQueryData(draftQueryKey, next);
      return next;
    });
    setErrors((current) => ({ ...current, [field]: "" }));
  }

  function validate() {
    const newErrors: Record<string, string> = {};
    if (draft.businessName.trim().length < 2) newErrors.businessName = "Business name must be at least 2 characters.";
    if (!/^\+?[0-9 ()-]+$/.test(draft.phoneNumber) || draft.phoneNumber.trim().length < 8) newErrors.phoneNumber = "Enter a valid phone number.";
    if (!draft.role) newErrors.role = "Please select a system role.";
    if (draft.tradeTypes.length === 0) newErrors.tradeTypes = "Select at least one trade.";
    if (draft.tradeTypes.length > 3) newErrors.tradeTypes = "Select up to three trades.";
    if (draft.licenseNumber && !/^[A-Za-z0-9 ./-]+$/.test(draft.licenseNumber)) newErrors.licenseNumber = "Invalid characters in licence number.";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function submit() {
    if (!validate()) return;
    
    createProfile.mutate({
      data: {
        businessName: draft.businessName.trim(),
        phoneNumber: draft.phoneNumber.trim(),
        role: draft.role as BusinessRole,
        tradeType: draft.tradeTypes[0],
        tradeTypes: draft.tradeTypes,
        licenseNumber: draft.licenseNumber.trim() || null,
      }
    }, {
      onSuccess: (profile) => {
        queryClient.setQueryData(
          [...getGetProfileSettingsQueryKey(), userId],
          profile,
        );
        queryClient.removeQueries({ queryKey: draftQueryKey, exact: true });
        router.replace("/");
      },
      onError: (err: any) => {
        Alert.alert("Could not save profile", err?.message || "Please check your inputs and try again.");
      }
    });
  }

  function toggleTrade(tradeType: string) {
    if (draft.tradeTypes.includes(tradeType)) {
      updateDraft(
        "tradeTypes",
        draft.tradeTypes.filter((value) => value !== tradeType),
      );
      return;
    }
    if (draft.tradeTypes.length >= 3) {
      setErrors((current) => ({
        ...current,
        tradeTypes: "Remove a trade before adding another.",
      }));
      return;
    }
    updateDraft("tradeTypes", [...draft.tradeTypes, tradeType]);
  }

  function makePrimary(tradeType: string) {
    updateDraft("tradeTypes", [
      tradeType,
      ...draft.tradeTypes.filter((value) => value !== tradeType),
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ backgroundColor: colors.sidebar, paddingTop: topPadding + 28 }}>
        <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Feather name="tool" size={22} color={colors.primary} />
            <Text style={{ fontFamily: "Inter_700Bold", color: colors.primary, fontSize: 12, letterSpacing: 1.5 }}>
              WELCOME
            </Text>
          </View>
          <Text style={{ fontFamily: "Chivo_900Black", color: colors.primaryForeground, fontSize: 34, marginTop: 18 }}>
            JOIN THE CREW
          </Text>
          <Text style={{ fontFamily: "Inter_400Regular", color: colors.mutedForeground, fontSize: 14, marginTop: 8 }}>
            Let's get your details set up so you can start quoting jobs.
          </Text>
        </View>
        <StripedBar height={6} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 32, gap: 16 }}
      >
        <View style={{ gap: 6 }}>
          <Text style={{ fontFamily: "Inter_700Bold", color: colors.foreground, fontSize: 12 }}>BUSINESS NAME</Text>
          <TextInputStyled
            value={draft.businessName}
            onChangeText={(text) => updateDraft("businessName", text)}
              placeholder="Quote Master Pty Ltd"
          />
          {errors.businessName ? <Text style={{ color: colors.destructive, fontSize: 12, fontFamily: "Inter_500Medium" }}>{errors.businessName}</Text> : null}
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ fontFamily: "Inter_700Bold", color: colors.foreground, fontSize: 12 }}>PHONE NUMBER</Text>
          <TextInputStyled
            value={draft.phoneNumber}
            onChangeText={(text) => updateDraft("phoneNumber", text)}
            keyboardType="phone-pad"
            placeholder="0400 000 000"
          />
          {errors.phoneNumber ? <Text style={{ color: colors.destructive, fontSize: 12, fontFamily: "Inter_500Medium" }}>{errors.phoneNumber}</Text> : null}
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ fontFamily: "Inter_700Bold", color: colors.foreground, fontSize: 12 }}>SYSTEM ROLE</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {["Owner", "Employee", "Subcontractor"].map((r) => (
              <Pressable
                key={r}
                onPress={() => updateDraft("role", r as BusinessRole)}
                style={{
                  flex: 1,
                  minWidth: 100,
                  backgroundColor: draft.role === r ? colors.primary : colors.card,
                  borderColor: draft.role === r ? colors.primary : colors.border,
                  borderWidth: 1,
                  borderRadius: colors.radius,
                  paddingVertical: 12,
                  alignItems: "center"
                }}
              >
                <Text style={{ fontFamily: "Inter_700Bold", fontSize: 12, color: draft.role === r ? "#fff" : colors.foreground }}>
                  {r.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
          {errors.role ? <Text style={{ color: colors.destructive, fontSize: 12, fontFamily: "Inter_500Medium" }}>{errors.role}</Text> : null}
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: "Inter_700Bold", color: colors.foreground, fontSize: 12 }}>TRADE TYPES</Text>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 12 }}>
            Select up to three trades. The first is your primary trade.
          </Text>
          {draft.tradeTypes.map((tradeType, index) => (
            <View key={tradeType} style={{ alignItems: "center", backgroundColor: colors.card, borderColor: index === 0 ? colors.primary : colors.border, borderRadius: colors.radius, borderWidth: 2, flexDirection: "row", justifyContent: "space-between", padding: 12 }}>
              <View>
                <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 13 }}>{tradeType}</Text>
                {index === 0 ? <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 10, marginTop: 2 }}>PRIMARY</Text> : null}
              </View>
              {index > 0 ? (
                <Pressable onPress={() => makePrimary(tradeType)} style={{ padding: 8 }}>
                  <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 11 }}>MAKE PRIMARY</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {tradeCatalogue?.map((entry) => {
              const selected = draft.tradeTypes.includes(entry.value);
              return (
                <Pressable
                  key={entry.value}
                  onPress={() => toggleTrade(entry.value)}
                  style={{ alignItems: "center", backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border, borderRadius: colors.radius, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 10, paddingVertical: 9 }}
                >
                  <Feather color={selected ? colors.primaryForeground : colors.mutedForeground} name={selected ? "check" : "plus"} size={14} />
                  <Text style={{ color: selected ? colors.primaryForeground : colors.foreground, fontFamily: "Inter_700Bold", fontSize: 11 }}>{entry.value}</Text>
                </Pressable>
              );
            })}
          </View>
          {errors.tradeTypes ? <Text style={{ color: colors.destructive, fontSize: 12, fontFamily: "Inter_500Medium" }}>{errors.tradeTypes}</Text> : null}
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ fontFamily: "Inter_700Bold", color: colors.foreground, fontSize: 12 }}>BUILDER / CONTRACTOR LICENSE NUMBER</Text>
          <TextInputStyled
            value={draft.licenseNumber}
            onChangeText={(text) => updateDraft("licenseNumber", text)}
            placeholder="Optional"
          />
          {errors.licenseNumber ? <Text style={{ color: colors.destructive, fontSize: 12, fontFamily: "Inter_500Medium" }}>{errors.licenseNumber}</Text> : null}
          <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular" }}>
            License details are used to ensure quotes conform to Australian Building Codes and regulations.
          </Text>
        </View>

        <Pressable
          disabled={busy}
          onPress={submit}
          style={({ pressed }) => ({
            alignItems: "center",
            backgroundColor: colors.primary,
            borderRadius: colors.radius,
            marginTop: 14,
            opacity: busy ? 0.45 : pressed ? 0.75 : 1,
            paddingVertical: 15,
          })}
        >
          <Text style={{ color: colors.primaryForeground, fontFamily: "Inter_700Bold", letterSpacing: 1 }}>
            {busy ? "SAVING…" : "SAVE PROFILE"}
          </Text>
        </Pressable>

      </ScrollView>
    </View>
  );
}