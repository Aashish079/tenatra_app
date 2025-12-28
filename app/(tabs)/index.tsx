import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlertButton, FilterButton, MapMarker, MarkerType, SearchBar } from '@/components/map';

// Sample marker data - replace with actual data from your API
const SAMPLE_MARKERS: Array<{
  id: string;
  coordinate: { latitude: number; longitude: number };
  type: MarkerType;
}> = [
  { id: '1', coordinate: { latitude: 37.785, longitude: -122.406 }, type: 'charging' },
  { id: '2', coordinate: { latitude: 37.778, longitude: -122.412 }, type: 'charging' },
  { id: '3', coordinate: { latitude: 37.782, longitude: -122.395 }, type: 'charging' },
  { id: '4', coordinate: { latitude: 37.790, longitude: -122.420 }, type: 'carService' },
  { id: '5', coordinate: { latitude: 37.775, longitude: -122.400 }, type: 'carService' },
  { id: '6', coordinate: { latitude: 37.788, longitude: -122.390 }, type: 'carService' },
  { id: '7', coordinate: { latitude: 37.770, longitude: -122.415 }, type: 'maintenance' },
  { id: '8', coordinate: { latitude: 37.795, longitude: -122.408 }, type: 'maintenance' },
  { id: '9', coordinate: { latitude: 37.780, longitude: -122.425 }, type: 'maintenance' },
];

const INITIAL_REGION = {
  latitude: 37.782,
  longitude: -122.406,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');

  const handleFilterPress = () => {
    // TODO: Implement filter modal
    console.log('Filter pressed');
  };

  const handleAlertPress = () => {
    // TODO: Implement alert functionality
    console.log('Alert pressed');
  };

  const handleMarkerPress = (markerId: string) => {
    // TODO: Implement marker details modal
    console.log('Marker pressed:', markerId);
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={INITIAL_REGION}
        showsUserLocation
        showsMyLocationButton={false}
        zoomEnabled={true}
        zoomControlEnabled={true}
        scrollEnabled={true}
        pitchEnabled={true}
        rotateEnabled={true}
      >
        {SAMPLE_MARKERS.map((marker) => (
          <MapMarker
            key={marker.id}
            coordinate={marker.coordinate}
            type={marker.type}
            onPress={() => handleMarkerPress(marker.id)}
          />
        ))}
      </MapView>

      {/* Search Bar Container */}
      <View style={[styles.searchContainer, { top: insets.top + 12 }]}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchBar}
        />
        <FilterButton onPress={handleFilterPress} />
      </View>

      {/* Alert Button */}
      <AlertButton
        onPress={handleAlertPress}
        style={[styles.alertButton, { bottom: 24 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  searchContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchBar: {
    flex: 1,
  },
  alertButton: {
    position: 'absolute',
    right: 16,
  },
});
