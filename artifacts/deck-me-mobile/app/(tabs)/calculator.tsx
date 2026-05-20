import {
  useEstimateDeck,
  type QuoteEstimate,
} from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Button,
  Card,
  LabeledInput,
  ScreenHeader,
  StripedBar,
  TextInputStyled,
  formatAUD,
} from "@/components/ui";
import { useColors } from "@/hooks/useColors";

function parseNum(s: string, fallback: number): number {
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export default function CalculatorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad =
    Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;

  const [length, setLength] = useState("6");
  const [width, setWidth] = useState("4");
  const [height, setHeight] = useState("0.6");
  const [boardWidth, setBoardWidth] = useState("90");
  const [joistSpacing, setJoistSpacing] = useState("450");
  const [wastage, setWastage] = useState("1.1");
  const [labourHours, setLabourHours] = useState("16");
  const [labourRate, setLabourRate] = useState("85");

  const [estimate, setEstimate] = useState<QuoteEstimate | null>(null);
  const { mutate, isPending } = useEstimateDeck();

  const spec = useMemo(
    () => ({
      lengthM: parseNum(length, 6),
      widthM: parseNum(width, 4),
      heightM: parseNum(height, 0.6),
      boardWidthMm: Math.round(parseNum(boardWidth, 90)),
      joistSpacingMm: Math.round(parseNum(joistSpacing, 450)),
      bearerSpacingMm: 1800,
      postSpacingMm: 1800,
      wastageFactor: parseNum(wastage, 1.1),
    }),
    [length, width, height, boardWidth, joistSpacing, wastage],
  );

  useEffect(() => {
    const t = setTimeout(() => {
      mutate(
        { data: spec },
        { onSuccess: (res) => setEstimate(res) },
      );
    }, 350);
    return () => clearTimeout(t);
  }, [spec, mutate]);

  const labour = parseNum(labourHours, 0) * parseNum(labourRate, 0);
  const subtotal = estimate?.materialsSubtotal ?? 0;
  const exGst = subtotal + labour;
  const gst = Math.round(exGst * 0.1 * 100) / 100;
  const total = Math.round((exGst + gst) * 100) / 100;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ backgroundColor: colors.sidebar, paddingTop: topPad }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 }}>
          <Text
            style={{
              fontFamily: "Inter_700Bold",
              color: colors.primary,
              fontSize: 11,
              letterSpacing: 1.4,
            }}
          >
            BILL OF MATERIALS
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
            QUOTE UP A DECK
          </Text>
        </View>
        <StripedBar height={6} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + 100,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ padding: 20, gap: 16 }}>
          <Card>
            <Text
              style={{
                fontFamily: "Chivo_700Bold",
                fontSize: 14,
                color: colors.foreground,
                marginBottom: 12,
                letterSpacing: 0.4,
              }}
            >
              DIMENSIONS (METRES)
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <LabeledInput label="Length">
                <TextInputStyled
                  value={length}
                  onChangeText={setLength}
                  keyboardType="decimal-pad"
                />
              </LabeledInput>
              <LabeledInput label="Width">
                <TextInputStyled
                  value={width}
                  onChangeText={setWidth}
                  keyboardType="decimal-pad"
                />
              </LabeledInput>
              <LabeledInput label="Height">
                <TextInputStyled
                  value={height}
                  onChangeText={setHeight}
                  keyboardType="decimal-pad"
                />
              </LabeledInput>
            </View>
          </Card>

          <Card>
            <Text
              style={{
                fontFamily: "Chivo_700Bold",
                fontSize: 14,
                color: colors.foreground,
                marginBottom: 12,
                letterSpacing: 0.4,
              }}
            >
              FRAMING
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <LabeledInput label="Board (mm)">
                <TextInputStyled
                  value={boardWidth}
                  onChangeText={setBoardWidth}
                  keyboardType="number-pad"
                />
              </LabeledInput>
              <LabeledInput label="Joists (mm)">
                <TextInputStyled
                  value={joistSpacing}
                  onChangeText={setJoistSpacing}
                  keyboardType="number-pad"
                />
              </LabeledInput>
              <LabeledInput label="Wastage">
                <TextInputStyled
                  value={wastage}
                  onChangeText={setWastage}
                  keyboardType="decimal-pad"
                />
              </LabeledInput>
            </View>
          </Card>

          <Card>
            <Text
              style={{
                fontFamily: "Chivo_700Bold",
                fontSize: 14,
                color: colors.foreground,
                marginBottom: 12,
                letterSpacing: 0.4,
              }}
            >
              LABOUR
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <LabeledInput label="Hours">
                <TextInputStyled
                  value={labourHours}
                  onChangeText={setLabourHours}
                  keyboardType="decimal-pad"
                />
              </LabeledInput>
              <LabeledInput label="Rate $/hr">
                <TextInputStyled
                  value={labourRate}
                  onChangeText={setLabourRate}
                  keyboardType="decimal-pad"
                />
              </LabeledInput>
            </View>
          </Card>

          <View
            style={{
              backgroundColor: colors.sidebar,
              borderRadius: colors.radius,
              padding: 18,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_700Bold",
                color: colors.primary,
                fontSize: 11,
                letterSpacing: 1.4,
              }}
            >
              TOTAL (INC GST) {isPending ? "· UPDATING…" : ""}
            </Text>
            <Text
              style={{
                fontFamily: "Chivo_900Black",
                color: "#fff",
                fontSize: 44,
                letterSpacing: -1,
                marginTop: 4,
              }}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatAUD(total)}
            </Text>
            <View style={{ marginTop: 14, gap: 6 }}>
              <Row label="Materials" value={formatAUD(subtotal)} />
              <Row label="Labour" value={formatAUD(labour)} />
              <Row label="GST" value={formatAUD(gst)} />
              <Row label={`Deck ${estimate?.deckAreaM2 ?? 0}m²`} value="" />
            </View>
          </View>

          <Button
            label="Save as quote"
            icon="save"
            onPress={() => {
              if (!estimate) return;
              router.push({
                pathname: "/quote/new",
                params: {
                  spec: JSON.stringify(spec),
                  labourHours,
                  labourRate,
                },
              });
            }}
          />

          {estimate && estimate.lines.length > 0 ? (
            <Card>
              <Text
                style={{
                  fontFamily: "Chivo_700Bold",
                  fontSize: 14,
                  color: colors.foreground,
                  marginBottom: 12,
                  letterSpacing: 0.4,
                }}
              >
                LINE ITEMS
              </Text>
              <View style={{ gap: 10 }}>
                {estimate.lines.map((l, i) => (
                  <View
                    key={i}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      paddingBottom: 10,
                      borderBottomWidth:
                        i === estimate.lines.length - 1 ? 0 : 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <View style={{ flex: 1, marginRight: 10 }}>
                      <Text
                        style={{
                          fontFamily: "Inter_600SemiBold",
                          color: colors.foreground,
                          fontSize: 13,
                        }}
                      >
                        {l.description}
                      </Text>
                      <Text
                        style={{
                          fontFamily: "Inter_500Medium",
                          color: colors.mutedForeground,
                          fontSize: 11,
                          marginTop: 2,
                        }}
                      >
                        {l.quantity} {l.unit} · {formatAUD(l.unitPrice)}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontFamily: "Chivo_700Bold",
                        color: colors.foreground,
                        fontSize: 14,
                      }}
                    >
                      {formatAUD(l.lineTotal)}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
      }}
    >
      <Text
        style={{
          fontFamily: "Inter_500Medium",
          color: "rgba(255,255,255,0.7)",
          fontSize: 13,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: "Inter_700Bold",
          color: "#fff",
          fontSize: 13,
        }}
      >
        {value}
      </Text>
    </View>
  );
}
