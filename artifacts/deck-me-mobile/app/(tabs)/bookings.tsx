import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListBookings,
  useAddBookingPhoto,
  useRemoveBookingPhoto,
  useListTeamMembers,
  useListJobAssignments,
  useClockOn,
  useClockOff,
  getListBookingsQueryKey,
  customFetch,
} from "@workspace/api-client-react";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Card, EmptyState, StatusBadge, StripedBar } from "@/components/ui";
import { useColors } from "@/hooks/useColors";

async function requestUploadUrl(file: { name: string; size: number; type: string }): Promise<{ uploadURL: string; objectPath: string }> {
  return customFetch<{ uploadURL: string; objectPath: string }>(
    "/api/storage/uploads/request-url",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: file.name,
        size: file.size,
        contentType: file.type,
      }),
      responseType: "json",
    },
  );
}

async function uploadToPresigned(uploadURL: string, uri: string, contentType: string): Promise<void> {
  const res = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: { uri } as any,
  });
  if (!res.ok) throw new Error("Upload failed");
}

type AnyBooking = Record<string, unknown>;

export default function BookingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data, isLoading, refetch, isRefetching } = useListBookings();
  const { data: teamMembers } = useListTeamMembers();
  const addPhoto = useAddBookingPhoto();
  const removePhoto = useRemoveBookingPhoto();
  const clockOn = useClockOn();
  const clockOff = useClockOff();

  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [clockBookingId, setClockBookingId] = useState<number | null>(null);
  const [clockLoading, setClockLoading] = useState(false);

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const selectedBooking = data?.find(b => b.id === selectedBookingId) as AnyBooking | undefined;
  const photos: string[] = (selectedBooking?.photos as string[]) ?? [];
  const clockBooking = data?.find(b => b.id === clockBookingId) as AnyBooking | undefined;

  async function pickAndUpload(source: "camera" | "library") {
    if (!selectedBookingId) return;

    let result: ImagePicker.ImagePickerResult;
    if (source === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Camera access needed", "Allow camera access in your device settings.");
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.85,
        allowsEditing: false,
      });
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Photo library access needed", "Allow photo access in your device settings.");
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.85,
        allowsMultipleSelection: true,
        selectionLimit: 10,
      });
    }

    if (result.canceled || !result.assets?.length) return;

    setUploading(true);
    try {
      for (const asset of result.assets) {
        const ext = asset.uri.split(".").pop() ?? "jpg";
        const contentType = `image/${ext === "jpg" ? "jpeg" : ext}`;
        const { uploadURL, objectPath } = await requestUploadUrl({
          name: asset.fileName ?? `photo_${Date.now()}.${ext}`,
          size: asset.fileSize ?? 0,
          type: contentType,
        });
        await uploadToPresigned(uploadURL, asset.uri, contentType);
        await addPhoto.mutateAsync({ id: selectedBookingId, data: { objectPath } });
      }
      qc.invalidateQueries({ queryKey: getListBookingsQueryKey() });
    } catch (e) {
      Alert.alert("Upload failed", "Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleRemovePhoto(objectPath: string) {
    if (!selectedBookingId) return;
    Alert.alert("Remove photo?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          removePhoto.mutate({ id: selectedBookingId, data: { objectPath } }, {
            onSuccess: () => qc.invalidateQueries({ queryKey: getListBookingsQueryKey() }),
          });
        },
      },
    ]);
  }

  async function handleClockAction(memberId: number, action: "on" | "off") {
    if (!clockBookingId) return;
    setClockLoading(true);
    try {
      if (action === "on") {
        await clockOn.mutateAsync({ data: { teamMemberId: memberId, jobId: clockBookingId } });
        Alert.alert("Clocked On", "Time tracking started.");
      } else {
        await clockOff.mutateAsync({ data: { teamMemberId: memberId, jobId: clockBookingId } });
        Alert.alert("Clocked Off", "Time entry saved.");
      }
      setClockBookingId(null);
    } catch (err: any) {
      const msg = err?.message ?? "Something went wrong";
      Alert.alert("Error", msg.includes("Already clocked on") ? "Already clocked on for this job." : msg.includes("No open") ? "Not currently clocked on for this job." : msg);
    } finally {
      setClockLoading(false);
    }
  }

  const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "";
  const apiBase = domain ? `https://${domain}` : "";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ backgroundColor: colors.sidebar, paddingTop: topPad }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 }}>
          <Text style={{ fontFamily: "Inter_700Bold", color: colors.primary, fontSize: 11, letterSpacing: 1.4 }}>
            ON THE TOOLS
          </Text>
          <Text style={{ fontFamily: "Chivo_900Black", color: "#fff", fontSize: 28, letterSpacing: -0.5, marginTop: 4 }}>
            JOBS
          </Text>
        </View>
        <StripedBar height={6} />
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No jobs booked"
          body="Once a client signs off, book the job from the quote page."
        />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(b) => String(b.id)}
          refreshing={isRefetching}
          onRefresh={refetch}
          contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 100, gap: 10 }}
          renderItem={({ item }) => {
            const bPhotos: string[] = (item as any).photos ?? [];
            const start = new Date(item.startAt);
            const end = new Date(item.endAt);
            return (
              <Card>
                <View style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
                  <View style={{ width: 56, paddingVertical: 10, backgroundColor: colors.primary, borderRadius: 4, alignItems: "center" }}>
                    <Text style={{ fontFamily: "Inter_700Bold", color: "#fff", fontSize: 10, letterSpacing: 1 }}>
                      {start.toLocaleString("en-AU", { month: "short" }).toUpperCase()}
                    </Text>
                    <Text style={{ fontFamily: "Chivo_900Black", color: "#fff", fontSize: 24 }}>
                      {start.getDate()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: "Chivo_700Bold", color: colors.foreground, fontSize: 15 }}>
                      {item.title}
                    </Text>
                    <Text style={{ fontFamily: "Inter_500Medium", color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                      {start.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                      {" – "}
                      {end.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                    {item.siteAddress ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 }}>
                        <Feather name="map-pin" size={11} color={colors.mutedForeground} />
                        <Text style={{ fontFamily: "Inter_500Medium", color: colors.mutedForeground, fontSize: 11 }} numberOfLines={1}>
                          {item.siteAddress}
                        </Text>
                      </View>
                    ) : null}
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                      <StatusBadge status={item.status} />
                    </View>
                    {/* Action buttons */}
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                      <Pressable
                        onPress={() => setSelectedBookingId(item.id)}
                        style={({ pressed }) => ({
                          flex: 1,
                          flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
                          backgroundColor: colors.muted, borderRadius: 4,
                          paddingVertical: 7,
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <Feather name="camera" size={13} color={colors.primary} />
                        <Text style={{ fontFamily: "Inter_700Bold", fontSize: 11, color: colors.primary, letterSpacing: 0.6 }}>
                          {bPhotos.length > 0 ? `PHOTOS (${bPhotos.length})` : "PHOTOS"}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setClockBookingId(item.id)}
                        style={({ pressed }) => ({
                          flex: 1,
                          flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
                          backgroundColor: "#ff7a0015", borderRadius: 4,
                          borderWidth: 1, borderColor: colors.primary,
                          paddingVertical: 7,
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <Feather name="clock" size={13} color={colors.primary} />
                        <Text style={{ fontFamily: "Inter_700Bold", fontSize: 11, color: colors.primary, letterSpacing: 0.6 }}>
                          TIME
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </Card>
            );
          }}
        />
      )}

      {/* Clock-on/off modal */}
      <Modal
        visible={clockBookingId !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setClockBookingId(null)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{
            backgroundColor: colors.sidebar,
            paddingTop: insets.top + 12,
            paddingBottom: 16,
            paddingHorizontal: 20,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <View>
              <Text style={{ fontFamily: "Inter_700Bold", color: colors.primary, fontSize: 11, letterSpacing: 1.4 }}>CLOCK ON / OFF</Text>
              <Text style={{ fontFamily: "Chivo_900Black", color: "#fff", fontSize: 20, marginTop: 2 }}>
                {(clockBooking?.title as string) ?? ""}
              </Text>
            </View>
            <Pressable onPress={() => setClockBookingId(null)} style={{ padding: 8 }}>
              <Feather name="x" size={24} color="#fff" />
            </Pressable>
          </View>
          <StripedBar height={4} />

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
            <Text style={{ fontFamily: "Inter_700Bold", color: colors.mutedForeground, fontSize: 11, letterSpacing: 1.2, marginBottom: 16 }}>
              SELECT CREW MEMBER
            </Text>

            {!teamMembers || teamMembers.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Feather name="users" size={36} color={colors.mutedForeground} />
                <Text style={{ fontFamily: "Chivo_700Bold", color: colors.foreground, fontSize: 16, marginTop: 12 }}>
                  No team members
                </Text>
                <Text style={{ fontFamily: "Inter_400Regular", color: colors.mutedForeground, fontSize: 13, marginTop: 4, textAlign: "center" }}>
                  Add team members from the web app first.
                </Text>
              </View>
            ) : (
              teamMembers.filter(m => m.active).map((member) => (
                <View key={member.id} style={{
                  backgroundColor: colors.card,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 14,
                  marginBottom: 10,
                }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <View>
                      <Text style={{ fontFamily: "Chivo_700Bold", color: colors.foreground, fontSize: 15 }}>
                        {member.name}
                      </Text>
                      {member.role && (
                        <Text style={{ fontFamily: "Inter_500Medium", color: colors.mutedForeground, fontSize: 12, marginTop: 2, textTransform: "capitalize" }}>
                          {member.role}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      disabled={clockLoading}
                      onPress={() => handleClockAction(member.id, "on")}
                      style={{
                        flex: 1,
                        backgroundColor: colors.primary,
                        borderRadius: 6,
                        paddingVertical: 10,
                        alignItems: "center",
                        flexDirection: "row",
                        justifyContent: "center",
                        gap: 6,
                        opacity: clockLoading ? 0.5 : 1,
                      }}
                    >
                      <Feather name="play" size={13} color="#fff" />
                      <Text style={{ fontFamily: "Inter_700Bold", color: "#fff", fontSize: 12, letterSpacing: 0.6 }}>
                        CLOCK ON
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={clockLoading}
                      onPress={() => handleClockAction(member.id, "off")}
                      style={{
                        flex: 1,
                        backgroundColor: colors.muted,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: colors.border,
                        paddingVertical: 10,
                        alignItems: "center",
                        flexDirection: "row",
                        justifyContent: "center",
                        gap: 6,
                        opacity: clockLoading ? 0.5 : 1,
                      }}
                    >
                      <Feather name="square" size={13} color={colors.foreground} />
                      <Text style={{ fontFamily: "Inter_700Bold", color: colors.foreground, fontSize: 12, letterSpacing: 0.6 }}>
                        CLOCK OFF
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Photo modal */}
      <Modal
        visible={selectedBookingId !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedBookingId(null)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Header */}
          <View style={{
            backgroundColor: colors.sidebar,
            paddingTop: insets.top + 12,
            paddingBottom: 16,
            paddingHorizontal: 20,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <View>
              <Text style={{ fontFamily: "Inter_700Bold", color: colors.primary, fontSize: 11, letterSpacing: 1.4 }}>SITE PHOTOS</Text>
              <Text style={{ fontFamily: "Chivo_900Black", color: "#fff", fontSize: 22, marginTop: 2 }}>
                {(selectedBooking?.title as string) ?? ""}
              </Text>
            </View>
            <Pressable onPress={() => setSelectedBookingId(null)} style={{ padding: 8 }}>
              <Feather name="x" size={24} color="#fff" />
            </Pressable>
          </View>
          <StripedBar height={4} />

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
            {/* Camera / Library buttons */}
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
              <Button
                label="Take Photo"
                icon="camera"
                onPress={() => pickAndUpload("camera")}
                loading={uploading}
                disabled={uploading}
                style={{ flex: 1 }}
              />
              <Button
                label="Choose Photos"
                icon="image"
                variant="secondary"
                onPress={() => pickAndUpload("library")}
                loading={uploading}
                disabled={uploading}
                style={{ flex: 1 }}
              />
            </View>

            {photos.length === 0 ? (
              <View style={{
                borderWidth: 2,
                borderColor: colors.border,
                borderStyle: "dashed",
                borderRadius: 8,
                alignItems: "center",
                paddingVertical: 48,
                gap: 12,
              }}>
                <View style={{
                  width: 64, height: 64, borderRadius: 32,
                  backgroundColor: colors.muted,
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Feather name="camera-off" size={28} color={colors.mutedForeground} />
                </View>
                <Text style={{ fontFamily: "Chivo_700Bold", fontSize: 16, color: colors.foreground }}>
                  No photos yet
                </Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: colors.mutedForeground, textAlign: "center", paddingHorizontal: 32 }}>
                  Capture before & after shots to document the job
                </Text>
              </View>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {photos.map((path, i) => (
                  <Pressable
                    key={i}
                    onLongPress={() => handleRemovePhoto(path)}
                    style={({ pressed }) => ({
                      width: "31%",
                      aspectRatio: 1,
                      borderRadius: 6,
                      overflow: "hidden",
                      opacity: pressed ? 0.7 : 1,
                      position: "relative",
                    })}
                  >
                    <Image
                      source={{ uri: `${apiBase}/api/storage/objects${path}` }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />
                    <View style={{
                      position: "absolute", bottom: 0, left: 0, right: 0,
                      backgroundColor: "rgba(0,0,0,0.45)", paddingVertical: 3,
                      alignItems: "center",
                    }}>
                      <Text style={{ fontFamily: "Inter_700Bold", fontSize: 8, color: "rgba(255,255,255,0.7)", letterSpacing: 0.5 }}>
                        HOLD TO REMOVE
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
