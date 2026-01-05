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
  onPress: () => void;
  name?: string;
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

// No callout text; popup removed per request

export function MapMarker({ coordinate, type, onPress, name }: MapMarkerProps) {
  const config = markerConfig[type];
  const isLarge = config.size === 'large';

  return (
    <Marker
      coordinate={coordinate}
      onPress={onPress}
      anchor={{ x: 0.5, y: 1 }}
    >
      {isLarge ? (
        <View style={[styles.largeMarker, { backgroundColor: config.color }]}> 
          <MaterialIcons name={config.icon} size={24} color="white" />
        </View>
      ) : (
        <View style={styles.wrapper} collapsable={false}>
          <View style={[styles.markerContainer, { backgroundColor: config.color }]}> 
            <MaterialIcons name={config.icon} size={16} color="white" />
          </View>
        </View>
      )}
    </Marker>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: 36,
    height: 46, // 36 circle + ~10 tail
    alignItems: 'center',
  },
  markerContainer: {
    width: 30,
    height: 30,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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
