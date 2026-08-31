import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetMasterProjectQueryKey,
  getListMasterProjectsQueryKey,
  getListQuotesQueryKey,
  useDeleteMasterProject,
  useGetMasterProject,
  useListQuotes,
  useRegenerateMasterProjectPortalToken,
  useRevokeMasterProjectPortalToken,
  useSetMasterProjectQuotes,
  useUpdateMasterProject,
} from "@workspace/api-client-react";
import { Card, formatAUD, ScreenHeader } from "@/components/ui";
import { useColors } from "@/hooks/useColors";
import { useProfileAccess } from "@/lib/access";

export default function MasterProjectDetailScreen() {
  const colors = useColors();
  const { isMasterBuilder } = useProfileAccess();
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const queryClient = useQueryClient();
  const { data: project } = useGetMasterProject(id, {
    query: { enabled: isMasterBuilder && Number.isInteger(id), queryKey: getGetMasterProjectQueryKey(id), retry: false },
  });
  const { data: quotes } = useListQuotes({
    query: { enabled: isMasterBuilder, queryKey: getListQuotesQueryKey() },
  });
  const [selected, setSelected] = useState<number[]>([]);
  const [margin, setMargin] = useState("0");
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  useEffect(() => {
    if (!project) return;
    setSelected(project.quotes.map((quote) => quote.id));
    setMargin(String(project.builderMarginPct));
  }, [project]);
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetMasterProjectQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getListMasterProjectsQueryKey() });
  };
  const setQuotes = useSetMasterProjectQuotes({ mutation: { onSuccess: () => {
    refresh();
    queryClient.invalidateQueries({ queryKey: getListQuotesQueryKey() });
  } } });
  const update = useUpdateMasterProject({ mutation: { onSuccess: refresh } });
  const remove = useDeleteMasterProject();
  const token = useRegenerateMasterProjectPortalToken();
  const revoke = useRevokeMasterProjectPortalToken();

  if (!isMasterBuilder) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={[styles.title, { color: colors.foreground }]}>UPGRADE REQUIRED</Text><Text style={{ color: colors.mutedForeground }}>Master Builder access is required to manage this project.</Text></View>;
  }
  if (!project) return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={{ color: colors.mutedForeground }}>Loading proposal...</Text></View>;
  const available = quotes?.filter((quote) => quote.customerId === project.customerId && (quote.masterProjectId === null || quote.masterProjectId === id)) ?? [];

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <ScreenHeader eyebrow={project.customerName ?? "Customer"} title={project.title} />
      <Card>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>TOTAL INC GST</Text>
        <Text style={[styles.bigTotal, { color: colors.foreground }]}>{formatAUD(project.total)}</Text>
        <Text style={{ color: colors.mutedForeground }}>
          Materials {formatAUD(project.materialsSubtotal)} · Labour {formatAUD(project.labourSubtotal)} · GST {formatAUD(project.gst)}
        </Text>
      </Card>
      <Card>
        <Text style={[styles.title, { color: colors.foreground }]}>SELECT TRADE QUOTES</Text>
        {available.map((quote) => {
          const active = selected.includes(quote.id);
          return <Pressable key={quote.id} onPress={() => setSelected((current) => active ? current.filter((value) => value !== quote.id) : [...current, quote.id])} style={[styles.quoteRow, { borderColor: active ? colors.primary : colors.border }]}>
            <View style={{ flex: 1 }}><Text style={[styles.quoteTitle, { color: colors.foreground }]}>{active ? "✓ " : ""}{quote.title}</Text><Text style={{ color: colors.mutedForeground }}>{quote.tradeType?.trim() || "Other trade"}</Text></View><Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold" }}>{formatAUD(quote.total)}</Text>
          </Pressable>;
        })}
        <Pressable style={[styles.button, { backgroundColor: colors.primary }]} onPress={() => setQuotes.mutate({ id, data: { quoteIds: selected } })}><Text style={styles.buttonText}>UPDATE PROJECT QUOTES</Text></Pressable>
      </Card>
      <Card>
        <Text style={[styles.title, { color: colors.foreground }]}>BUILDER MARGIN</Text>
        <TextInput keyboardType="decimal-pad" value={margin} onChangeText={setMargin} style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} />
        <Pressable style={[styles.button, { backgroundColor: colors.primary }]} onPress={() => update.mutate({ id, data: { builderMarginPct: Number(margin) } })}><Text style={styles.buttonText}>APPLY MARGIN</Text></Pressable>
      </Card>
      {project.tradeGroups.map((group) => <Card key={group.tradeType}>
        <Text style={[styles.title, { color: colors.foreground }]}>{group.label.toUpperCase()}</Text>
        {group.quotes.map((quote) => <View key={quote.id} style={styles.groupQuote}><View style={styles.row}><Text style={[styles.quoteTitle, { color: colors.foreground }]}>{quote.title}</Text><Text style={{ color: colors.foreground }}>{formatAUD(quote.total)}</Text></View>{quote.lineItems.map((line) => <View key={line.id} style={styles.row}><Text style={{ color: colors.mutedForeground, flex: 1 }}>{line.description} · {line.quantity} {line.unit}</Text><Text style={{ color: colors.foreground }}>{formatAUD(line.lineTotal)}</Text></View>)}</View>)}
      </Card>)}
      <Card>
        <Text style={[styles.title, { color: colors.foreground }]}>CLIENT PORTAL</Text>
        <Pressable style={[styles.button, { backgroundColor: colors.primary }]} onPress={async () => {
          const result = await token.mutateAsync({ id });
          setIssuedToken(result.portalToken);
          refresh();
          const domain = process.env.EXPO_PUBLIC_DOMAIN;
          const path = `/master-project/${result.portalToken}`;
          await Share.share({ message: domain ? `https://${domain}${path}` : path, title: project.title });
        }}><Text style={styles.buttonText}>SHARE SECURE PROPOSAL</Text></Pressable>
        <Pressable disabled={!project.hasActivePortalLink} style={[styles.outlineButton, { borderColor: colors.border, opacity: project.hasActivePortalLink ? 1 : 0.5 }]} onPress={() => revoke.mutate({ id }, { onSuccess: () => { setIssuedToken(null); refresh(); Alert.alert("Link revoked"); } })}><Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold" }}>REVOKE LINK</Text></Pressable>
      </Card>
      <Pressable style={[styles.dangerButton, { borderColor: colors.destructive }]} onPress={() => Alert.alert("Delete Master Project?", "Linked quotes will remain.", [{ text: "Cancel" }, { text: "Delete", style: "destructive", onPress: () => remove.mutate({ id }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListMasterProjectsQueryKey() }); router.replace("/projects"); } }) }])}><Text style={{ color: colors.destructive, fontFamily: "Inter_700Bold" }}>DELETE MASTER PROJECT</Text></Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16, paddingBottom: 60 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 30, gap: 10 },
  title: { fontFamily: "Chivo_900Black", fontSize: 18, marginBottom: 12 },
  label: { fontFamily: "Inter_700Bold", letterSpacing: 1.4, fontSize: 10 },
  bigTotal: { fontFamily: "Chivo_900Black", fontSize: 34, marginVertical: 6 },
  quoteRow: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 10 },
  quoteTitle: { fontFamily: "Inter_700Bold", flex: 1 },
  input: { borderWidth: 1, borderRadius: 8, height: 48, paddingHorizontal: 12 },
  button: { borderRadius: 8, padding: 15, alignItems: "center", marginTop: 10 },
  buttonText: { color: "#fff", fontFamily: "Inter_700Bold" },
  outlineButton: { borderWidth: 1, borderRadius: 8, padding: 15, alignItems: "center", marginTop: 10 },
  dangerButton: { borderWidth: 1, borderRadius: 8, padding: 15, alignItems: "center" },
  groupQuote: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#999", paddingVertical: 12, gap: 6 },
  row: { flexDirection: "row", gap: 12, justifyContent: "space-between" },
});