import { Colors } from '@/constants/theme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';

interface ClusterMarkerProps {
  coordinate: { latitude: number; longitude: number };
  count: number;
  onPress?: () => void;
}

/**
 * Renders a circular bubble that represents a cluster of map markers.
 * The bubble grows slightly as the count increases.
 */
export function ClusterMarker({ coordinate, count, onPress }: ClusterMarkerProps) {
  const size = count < 10 ? 36 : count < 100 ? 44 : 52;

  return (
    <Marker coordinate={coordinate} onPress={onPress} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
      <View style={[styles.bubble, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={styles.label}>{count}</Text>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  bubble: {
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  label: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
});
