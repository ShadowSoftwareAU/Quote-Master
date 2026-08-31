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
  type BusinessRole,
} from "@workspace/api-client-react";

import { StripedBar, TextInputStyled } from "@/components/ui";
import { useColors } from "@/hooks/useColors";

type OnboardingDraft = {
  businessName: string;
  phoneNumber: string;
  role: BusinessRole | "";
  tradeType: string;
  licenseNumber: string;
};

const EMPTY_DRAFT: OnboardingDraft = {
  businessName: "",
  phoneNumber: "",
  role: "",
  tradeType: "",
  licenseNumber: "",
};

export default function OnboardingScreen() {
  const colors = useColors();
  const { userId } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const createProfile = useCreateOnboardingProfile();
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
    if (draft.tradeType.trim().length < 2) newErrors.tradeType = "Trade type must be at least 2 characters.";
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
        tradeType: draft.tradeType.trim(),
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
            placeholder="Deck Me Pty Ltd"
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

        <View style={{ gap: 6 }}>
          <Text style={{ fontFamily: "Inter_700Bold", color: colors.foreground, fontSize: 12 }}>PRIMARY TRADE TYPE</Text>
          <TextInputStyled
            value={draft.tradeType}
            onChangeText={(text) => updateDraft("tradeType", text)}
            placeholder="e.g. Carpenter, Landscaper"
          />
          {errors.tradeType ? <Text style={{ color: colors.destructive, fontSize: 12, fontFamily: "Inter_500Medium" }}>{errors.tradeType}</Text> : null}
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