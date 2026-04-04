import { Colors } from "@/constants/theme";
import { StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";

interface ClusterMarkerProps {
  coordinate: { latitude: number; longitude: number };
  count: number;
  onPress?: () => void;
}

/**
 * Renders a circular bubble that represents a cluster of map markers.
 *
 * Layout strategy: the root View IS the full circle (inner colored area +
 * white border). No wrapper or flexbox centering is used, which prevents the
 * "quarter circle" clipping that occurs when Android's native createDrawable()
 * snapshots a flexbox-centered child at an offset position within the bitmap.
 *
 * Sizes:
 *   innerSize  — the visible colored circle diameter
 *   borderWidth — the white ring thickness
 *   totalSize   — innerSize + borderWidth * 2 (actual bitmap dimensions)
 *   borderRadius — totalSize / 2 (makes the root view a perfect circle)
 *
 * anchor={0.5, 0.5} places the center of the totalSize×totalSize bitmap on
 * the map coordinate, so the circle is correctly centered on the pin point.
 */
export function ClusterMarker({
  coordinate,
  count,
  onPress,
}: ClusterMarkerProps) {
  const innerSize = count < 10 ? 40 : count < 100 ? 60 : 80;
  const borderWidth = count < 10 ? 3 : 10;
  const totalSize = innerSize + borderWidth * 2;
  const labelFontSize = count < 10 ? 12 : count < 100 ? 13 : 14;

  return (
    <Marker
      coordinate={coordinate}
      onPress={onPress}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={true}
      zIndex={1000}
    >
      <View
        style={[
          styles.bubble,
          {
            width: totalSize,
            height: totalSize,
            borderRadius: totalSize / 2,
            borderWidth,
          },
        ]}
        collapsable={false}
      >
        <Text style={[styles.label, { fontSize: labelFontSize }]}>
          {count}
        </Text>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  bubble: {
    backgroundColor: Colors.primary,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  label: {
    color: "#fff",
    fontWeight: "700",
  },
});
