import { Colors } from '@/constants/theme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

export type MarkerType = 'charging' | 'carService' | 'maintenance' | 'warning';

interface MapMarkerProps {
  coordinate: {
    latitude: number;
    longitude: number;
  };
  type: MarkerType;
  onPress?: () => void;
}

const markerConfig: Record<MarkerType, { icon: keyof typeof MaterialIcons.glyphMap; color: string; size: 'small' | 'large' }> = {
  charging: {
    icon: 'bolt',
    color: Colors.charging,
    size: 'small',
  },
  carService: {
    icon: 'directions-car',
    color: Colors.carService,
    size: 'small',
  },
  maintenance: {
    icon: 'build',
    color: Colors.maintenance,
    size: 'small',
  },
  warning: {
    icon: 'warning',
    color: Colors.warning,
    size: 'large',
  },
};

export function MapMarker({ coordinate, type, onPress }: MapMarkerProps) {
  const config = markerConfig[type];
  const isLarge = config.size === 'large';

  return (
    <Marker coordinate={coordinate} onPress={onPress}>
      {isLarge ? (
        <View style={[styles.largeMarker, { backgroundColor: config.color }]}>
          <MaterialIcons name={config.icon} size={24} color="white" />
        </View>
      ) : (
        <View style={[styles.markerContainer, { backgroundColor: config.color }]}>
          <MaterialIcons name={config.icon} size={16} color="white" />
          <View style={[styles.markerTail, { borderTopColor: config.color }]} />
        </View>
      )}
    </Marker>
  );
}

const styles = StyleSheet.create({
  markerContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  markerTail: {
    position: 'absolute',
    bottom: -8,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  largeMarker: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});
