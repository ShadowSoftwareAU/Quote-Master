import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListMasterProjectsQueryKey,
  getListCustomersQueryKey,
  useCreateMasterProject,
  useListCustomers,
  useListMasterProjects,
} from "@workspace/api-client-react";
import { Card, formatAUD, ScreenHeader } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { useProfileAccess } from "@/lib/access";

export default function MasterProjectsScreen() {
  const colors = useColors();
  const { isMasterBuilder } = useProfileAccess();
  const queryClient = useQueryClient();
  const { data: projects, isLoading } = useListMasterProjects({
    query: { enabled: isMasterBuilder, queryKey: getListMasterProjectsQueryKey(), retry: false },
  });
  const { data: customers } = useListCustomers({
    query: { enabled: isMasterBuilder, queryKey: getListCustomersQueryKey() },
  });
  const create = useCreateMasterProject({
    mutation: {
      onSuccess: (project) => {
        queryClient.invalidateQueries({ queryKey: getListMasterProjectsQueryKey() });
        router.push(`/projects/${project.id}`);
      },
    },
  });
  const [title, setTitle] = useState("");
  const [customerId, setCustomerId] = useState<number | null>(null);

  if (!isMasterBuilder) {
    return (
      <View style={[styles.locked, { backgroundColor: colors.background }]}>
        <Text style={[styles.lockTitle, { color: colors.foreground }]}>UPGRADE REQUIRED</Text>
        <Text style={[styles.lockText, { color: colors.mutedForeground }]}>
          Combined Master Proposals are available to Owner accounts with Master Builder access.
          Standard quotes remain available.
        </Text>
        <View style={[styles.disabledButton, { borderColor: colors.border }]}>
          <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_700Bold" }}>
            CREATE COMBINED PROJECT · LOCKED
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <ScreenHeader eyebrow="Master Builder" title="Master Proposals" />
      <Card>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>CREATE COMBINED PROJECT</Text>
        <TextInput
          accessibilityLabel="Project title"
          placeholder="Project title"
          placeholderTextColor={colors.mutedForeground}
          value={title}
          onChangeText={setTitle}
          style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
        />
        <Text style={[styles.label, { color: colors.mutedForeground }]}>CUSTOMER</Text>
        <View style={styles.customerList}>
          {customers?.map((customer) => (
            <Pressable
              key={customer.id}
              onPress={() => setCustomerId(customer.id)}
              style={[
                styles.customerChip,
                {
                  borderColor: customerId === customer.id ? colors.primary : colors.border,
                  backgroundColor: customerId === customer.id ? colors.primary : colors.card,
                },
              ]}
            >
              <Text
                style={{
                  color: customerId === customer.id ? "#fff" : colors.foreground,
                  fontFamily: "Inter_600SemiBold",
                }}
              >
                {customer.name}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          disabled={!title.trim() || !customerId || create.isPending}
          onPress={() => {
            if (!customerId) return;
            create.mutate(
              { data: { title: title.trim(), customerId, builderMarginPct: 0 } },
              { onError: () => Alert.alert("Could not create project", "Please try again.") },
            );
          }}
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.primaryButtonText}>CREATE MASTER PROPOSAL</Text>
        </Pressable>
      </Card>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>YOUR PROJECTS</Text>
      {isLoading ? <Text style={{ color: colors.mutedForeground }}>Loading...</Text> : null}
      {projects?.map((project) => (
        <Card key={project.id} onPress={() => router.push(`/projects/${project.id}`)}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.projectTitle, { color: colors.foreground }]}>{project.title}</Text>
              <Text style={{ color: colors.mutedForeground }}>
                {project.customerName} · {project.quoteCount} trade quote{project.quoteCount === 1 ? "" : "s"}
              </Text>
            </View>
            <Text style={[styles.total, { color: colors.foreground }]}>{formatAUD(project.total)}</Text>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16, paddingBottom: 60 },
  locked: { flex: 1, justifyContent: "center", padding: 32, alignItems: "center" },
  lockTitle: { fontFamily: "Chivo_900Black", fontSize: 28, textAlign: "center" },
  lockText: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 12 },
  disabledButton: { marginTop: 24, borderWidth: 1, borderRadius: 8, padding: 16 },
  sectionTitle: { fontFamily: "Chivo_900Black", fontSize: 16, marginBottom: 10 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, height: 48, fontFamily: "Inter_400Regular" },
  label: { fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 1.2, marginTop: 14, marginBottom: 8 },
  customerList: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  customerChip: { borderWidth: 1, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 12 },
  primaryButton: { padding: 15, borderRadius: 8, alignItems: "center", marginTop: 16 },
  primaryButtonText: { color: "#fff", fontFamily: "Inter_700Bold" },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  projectTitle: { fontFamily: "Chivo_700Bold", fontSize: 18 },
  total: { fontFamily: "Chivo_900Black", fontSize: 17 },
});