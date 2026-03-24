import { Colors } from "@/constants/theme";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";

interface ClusterMarkerProps {
  coordinate: { latitude: number; longitude: number };
  count: number;
  onPress?: () => void;
}

/**
 * Renders a circular bubble that represents a cluster of map markers.
 * The bubble grows slightly as the count increases.
 */
export function ClusterMarker({
  coordinate,
  count,
  onPress,
}: ClusterMarkerProps) {
  const [trackViewChanges, setTrackViewChanges] = useState(true);

  useEffect(() => {
    setTrackViewChanges(true);
    const timer = setTimeout(() => setTrackViewChanges(false), 800);
    return () => clearTimeout(timer);
  }, [count]);

  // Keep visual tiers simple and stable to avoid clipping artifacts.
  const size = count < 10 ? 40 : count < 100 ? 60 : 80;
  const borderWidth = count < 10 ? 3 : 10;
  // const wrapperPadding = borderWidth; // keep overall wrapper size constant as border grows
  // const shadowBleed = 10; // additional space for shadow to prevent clipping
  const wrapperSize = size + size * 10;
  const labelFontSize = count < 10 ? 12 : count < 100 ? 13 : 14;

  return (
    <Marker
      coordinate={coordinate}
      onPress={onPress}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={trackViewChanges}
      zIndex={1000}
    >
      <View
        style={[
          styles.wrapper,
          {
            width: wrapperSize,
            height: wrapperSize,
            // padding: wrapperPadding,
          },
        ]}
        collapsable={false}
      >
        <View
          style={[
            styles.bubble,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth,
              overflow: "visible",
            },
          ]}
        >
          <Text style={[styles.label, { fontSize: labelFontSize }]}>
            {count}
          </Text>
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  bubble: {
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    overflow: "visible",
    borderColor: "#fff",
    // shadowColor: "#000",
    // shadowOffset: { width: 0, height: 1 },
    // shadowOpacity: 0.2,
    // shadowRadius: 2,
    // elevation: 5,
  },
  label: {
    color: "#fff",
    fontWeight: "700",
  },
});
