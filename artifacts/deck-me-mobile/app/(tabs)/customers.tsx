import { Feather } from "@expo/vector-icons";
import {
  getListCustomersQueryKey,
  useCreateCustomer,
  useDeleteCustomer,
  useListCustomers,
  useUpdateCustomer,
  type Customer,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Button,
  Card,
  EmptyState,
  LabeledInput,
  StripedBar,
  TextInputStyled,
} from "@/components/ui";
import { useColors } from "@/hooks/useColors";

export default function CustomersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data, isLoading, refetch, isRefetching } = useListCustomers();
  const createMut = useCreateCustomer();
  const updateMut = useUpdateCustomer();
  const deleteMut = useDeleteCustomer();

  const [editing, setEditing] = useState<Customer | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    company: "",
    phone: "",
    email: "",
    address: "",
  });

  const topPad =
    Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  function openCreate() {
    setEditing(null);
    setForm({ name: "", company: "", phone: "", email: "", address: "" });
    setModalOpen(true);
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setForm({
      name: c.name,
      company: c.company ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      address: c.address ?? "",
    });
    setModalOpen(true);
  }

  function invalidate() {
    qc.invalidateQueries({ queryKey: getListCustomersQueryKey() });
  }

  function save() {
    if (!form.name.trim()) {
      Alert.alert("Need a name", "What do they go by?");
      return;
    }
    const payload = {
      name: form.name,
      company: form.company || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      address: form.address || undefined,
    };
    if (editing) {
      updateMut.mutate(
        { id: editing.id, data: payload },
        {
          onSuccess: () => {
            invalidate();
            setModalOpen(false);
          },
        },
      );
    } else {
      createMut.mutate(
        { data: payload },
        {
          onSuccess: () => {
            invalidate();
            setModalOpen(false);
          },
        },
      );
    }
  }

  function confirmDelete(c: Customer) {
    Alert.alert("Delete client?", `Remove ${c.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteMut.mutate(
            { id: c.id },
            { onSuccess: invalidate },
          );
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ backgroundColor: colors.sidebar, paddingTop: topPad }}>
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 16,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <View>
            <Text
              style={{
                fontFamily: "Inter_700Bold",
                color: colors.primary,
                fontSize: 11,
                letterSpacing: 1.4,
              }}
            >
              WHO YOU'RE BUILDING FOR
            </Text>
            <Text
              style={{
                fontFamily: "Chivo_900Black",
                color: "#fff",
                fontSize: 28,
                letterSpacing: -0.5,
                marginTop: 4,
              }}
            >
              CLIENTS
            </Text>
          </View>
          <Pressable
            onPress={openCreate}
            style={({ pressed }) => ({
              backgroundColor: colors.primary,
              padding: 12,
              borderRadius: 4,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Feather name="plus" size={20} color="#fff" />
          </Pressable>
        </View>
        <StripedBar height={6} />
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon="users"
          title="No clients yet"
          body="Add your first client to get a quote out the door."
          action={{ label: "Add client", onPress: openCreate }}
        />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(c) => String(c.id)}
          refreshing={isRefetching}
          onRefresh={refetch}
          contentContainerStyle={{
            padding: 20,
            paddingBottom: insets.bottom + 100,
            gap: 10,
          }}
          renderItem={({ item }) => (
            <Card onPress={() => openEdit(item)}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: "Chivo_700Bold",
                      fontSize: 16,
                      color: colors.foreground,
                    }}
                  >
                    {item.name}
                  </Text>
                  {item.company ? (
                    <Text
                      style={{
                        fontFamily: "Inter_500Medium",
                        fontSize: 12,
                        color: colors.mutedForeground,
                        marginTop: 2,
                      }}
                    >
                      {item.company}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
                    {item.phone ? (
                      <Text
                        style={{
                          fontFamily: "Inter_500Medium",
                          fontSize: 12,
                          color: colors.foreground,
                        }}
                      >
                        {item.phone}
                      </Text>
                    ) : null}
                    {item.email ? (
                      <Text
                        style={{
                          fontFamily: "Inter_500Medium",
                          fontSize: 12,
                          color: colors.mutedForeground,
                        }}
                      >
                        {item.email}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <Pressable
                  onPress={() => confirmDelete(item)}
                  hitSlop={10}
                  style={({ pressed }) => ({
                    padding: 8,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Feather name="trash-2" size={18} color={colors.mutedForeground} />
                </Pressable>
              </View>
            </Card>
          )}
        />
      )}

      <Modal
        visible={modalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: colors.background,
            paddingTop: Platform.OS === "web" ? 24 : 0,
          }}
        >
          <View
            style={{
              padding: 20,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Pressable onPress={() => setModalOpen(false)}>
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  color: colors.mutedForeground,
                  fontSize: 14,
                }}
              >
                CANCEL
              </Text>
            </Pressable>
            <Text
              style={{
                fontFamily: "Chivo_700Bold",
                fontSize: 16,
                color: colors.foreground,
              }}
            >
              {editing ? "EDIT CLIENT" : "NEW CLIENT"}
            </Text>
            <Pressable onPress={save}>
              <Text
                style={{
                  fontFamily: "Inter_700Bold",
                  color: colors.primary,
                  fontSize: 14,
                }}
              >
                SAVE
              </Text>
            </Pressable>
          </View>
          <View style={{ padding: 20, gap: 14 }}>
            <LabeledInput label="Name">
              <TextInputStyled
                value={form.name}
                onChangeText={(t: string) => setForm({ ...form, name: t })}
                placeholder="Dave Patterson"
              />
            </LabeledInput>
            <LabeledInput label="Company">
              <TextInputStyled
                value={form.company}
                onChangeText={(t: string) => setForm({ ...form, company: t })}
                placeholder="Patterson Builds"
              />
            </LabeledInput>
            <LabeledInput label="Phone">
              <TextInputStyled
                value={form.phone}
                onChangeText={(t: string) => setForm({ ...form, phone: t })}
                keyboardType="phone-pad"
                placeholder="0412 345 678"
              />
            </LabeledInput>
            <LabeledInput label="Email">
              <TextInputStyled
                value={form.email}
                onChangeText={(t: string) => setForm({ ...form, email: t })}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="dave@example.com"
              />
            </LabeledInput>
            <LabeledInput label="Site address">
              <TextInputStyled
                value={form.address}
                onChangeText={(t: string) => setForm({ ...form, address: t })}
                placeholder="12 Smith St, Newcastle"
              />
            </LabeledInput>
            <Button
              label={editing ? "Save changes" : "Add client"}
              icon="check"
              onPress={save}
              loading={createMut.isPending || updateMut.isPending}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
