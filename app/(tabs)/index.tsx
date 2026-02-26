import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlertButton, FilterButton, MapMarker, MarkerType, SearchBar } from '@/components/map';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';

// Sample marker data - replace with actual data from your API

interface Marker {
  id: string;
  name: string; // Added name property
  coordinate: { latitude: number; longitude: number };
  type: MarkerType;
}

const SAMPLE_MARKERS: Marker[] = [
  // --- San Francisco Locations ---
  { id: '1', name: 'SF Charging Station A', coordinate: { latitude: 37.785, longitude: -122.406 }, type: 'charging' },
  { id: '2', name: 'SF Charging Station B', coordinate: { latitude: 37.778, longitude: -122.412 }, type: 'charging' },
  { id: '3', name: 'SF Charging Station C', coordinate: { latitude: 37.782, longitude: -122.395 }, type: 'charging' },
  { id: '4', name: 'Market St. Car Service', coordinate: { latitude: 37.790, longitude: -122.420 }, type: 'carService' },
  { id: '5', name: 'SOMA Car Clinic', coordinate: { latitude: 37.775, longitude: -122.400 }, type: 'carService' },
  { id: '6', name: 'Mission District Auto', coordinate: { latitude: 37.788, longitude: -122.390 }, type: 'carService' },
  { id: '7', name: 'Bay Bridge Maintenance', coordinate: { latitude: 37.770, longitude: -122.415 }, type: 'maintenance' },
  { id: '8', name: 'Civic Center Repairs', coordinate: { latitude: 37.795, longitude: -122.408 }, type: 'maintenance' },
  { id: '9', name: 'Union Square Tune-up', coordinate: { latitude: 37.780, longitude: -122.425 }, type: 'maintenance' },

  // --- Penang (USM Area) Locations ---
  { 
    id: '10', 
    name: 'Lotus’s Sungai Dua EV Hub',
    coordinate: { latitude: 5.35097, longitude: 100.29715 }, 
    type: 'charging' 
  },
  { 
    id: '11', 
    name: 'Queensbay Mall EV Station',
    coordinate: { latitude: 5.3346, longitude: 100.3066 }, 
    type: 'charging' 
  },
  { 
    id: '12', 
    name: 'Ivory Plaza Charging Point',
    coordinate: { latitude: 5.35802, longitude: 100.2926 }, 
    type: 'charging' 
  },
  { 
    id: '13', 
    name: 'Perodua Service Sungai Nibong',
    coordinate: { latitude: 5.3435, longitude: 100.3012 }, 
    type: 'carService' 
  },
  { 
    id: '14', 
    name: 'Shell Gelugor Auto Service',
    coordinate: { latitude: 5.37685, longitude: 100.30779 }, 
    type: 'carService' 
  },
  { 
    id: '15', 
    name: 'USM Sungai Dua Workshop',
    coordinate: { latitude: 5.35379, longitude: 100.30167 }, 
    type: 'carService' 
  },
  { 
    id: '16', 
    name: 'Petronas Sungai Dua Maintenance',
    coordinate: { latitude: 5.3481, longitude: 100.3005 }, 
    type: 'maintenance' 
  },
  { 
    id: '17', 
    name: 'Caltex Bukit Gambir Center',
    coordinate: { latitude: 5.3562, longitude: 100.2945 }, 
    type: 'maintenance' 
  },
  { 
    id: '18', 
    name: 'Bayan Lepas Tire & Battery',
    coordinate: { latitude: 5.3315, longitude: 100.3001 }, 
    type: 'maintenance' 
  },
];

// Fallback region if location is not available
const FALLBACK_REGION = {
  latitude: 37.782,
  longitude: -122.406,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [region, setRegion] = useState<Region | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setLocationError('Location permission denied');
        setRegion(FALLBACK_REGION);
        setIsLoading(false);
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const newRegion: Region = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      };

      setRegion(newRegion);
      setIsLoading(false);
    } catch (error) {
      console.error('Error getting location:', error);
      setLocationError('Could not get current location');
      setRegion(FALLBACK_REGION);
      setIsLoading(false);
    }
  };

  const handleFilterPress = () => {
    setShowFilters((prev) => !prev);
  };

  const handleAlertPress = async () => {
    // Recenter map to the user's current location
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      const nextRegion: Region = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
      if (mapRef.current) {
        mapRef.current.animateToRegion(nextRegion, 600);
      }
      setRegion(nextRegion);
    } catch (e) {
      console.warn('Recenter error', e);
    }
  };

  const handleMarkerPress = (markerId: string) => {
    setSelectedMarkerId(markerId);
    setDetailsVisible(true);
    setRouteDistance(null);
    const m = SAMPLE_MARKERS.find((x) => x.id === markerId);
    if (m && userLocation) {
      // Fetch only distance (do not draw route yet)
      fetchDistance(userLocation, m.coordinate);
    }
  };

  const goToCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const newRegion: Region = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };

      mapRef.current?.animateToRegion(newRegion, 1000);
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <ThemedText style={styles.loadingText}>Getting your location...</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={region || FALLBACK_REGION}
        showsUserLocation
        showsMyLocationButton={false}
        zoomEnabled={true}
        zoomControlEnabled={true}
        scrollEnabled={true}
        pitchEnabled={true}
        rotateEnabled={true}
      >
        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor={Colors.primary}
            strokeWidth={5}
          />
        )}
        {SAMPLE_MARKERS.filter((m) =>
          (m.type === 'charging' && filters.charging) ||
          (m.type === 'carService' && filters.carService) ||
          (m.type === 'maintenance' && filters.maintenance)
        ).map((marker) => (
          <MapMarker
            key={marker.id}
            name={marker.name}
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

      {/* Details Modal */}
      <Modal
        visible={detailsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailsVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{selectedMarker?.name ?? 'No marker selected'}</Text>
            {routeDistance != null && (
              <Text style={styles.modalSubtitle}>Distance: {(routeDistance / 1000).toFixed(2)} km</Text>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: Colors.secondary }]}
                onPress={async () => {
                  if (selectedMarker && userLocation) {
                    await fetchRoute(userLocation, selectedMarker.coordinate);
                  }
                }}
              >
                <Text style={styles.modalButtonText}>Directions</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButton} onPress={() => setDetailsVisible(false)}>
                <Text style={styles.modalButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {showFilters && (
        <View style={[styles.filterPanel, { top: insets.top + 68 }]}> 
          <Text style={styles.filterTitle}>Show categories</Text>
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterChip, filters.charging ? styles.filterChipActive : null]}
              onPress={() => setFilters((f) => ({ ...f, charging: !f.charging }))}
              activeOpacity={0.8}
            >
              <View style={[styles.colorDot, { backgroundColor: Colors.charging }]} />
              <Text style={styles.filterChipText}>Charging</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, filters.carService ? styles.filterChipActive : null]}
              onPress={() => setFilters((f) => ({ ...f, carService: !f.carService }))}
              activeOpacity={0.8}
            >
              <View style={[styles.colorDot, { backgroundColor: Colors.carService }]} />
              <Text style={styles.filterChipText}>Car Service</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, filters.maintenance ? styles.filterChipActive : null]}
              onPress={() => setFilters((f) => ({ ...f, maintenance: !f.maintenance }))}
              activeOpacity={0.8}
            >
              <View style={[styles.colorDot, { backgroundColor: Colors.maintenance }]} />
              <Text style={styles.filterChipText}>Maintenance</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.textSecondary,
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
  filterPanel: {
    position: 'absolute',
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
    gap: 8,
  },
  filterTitle: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    borderRadius: 999,
    padding: 6,
    gap: 6,
  },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalCard: {
      width: '85%',
      backgroundColor: '#fff',
      borderRadius: 16,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 6,
      gap: 6,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: '#222',
    },
    modalSubtitle: {
      fontSize: 14,
      color: '#555',
      marginTop: 2,
    },
    modalActions: {
      marginTop: 12,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
    },
    modalButton: {
      backgroundColor: Colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
    },
    modalButtonText: {
      color: '#fff',
      fontWeight: '600',
    },
  filterChipActive: {
    borderColor: Colors.primary,
    borderWidth: 1,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  filterChipText: {
    fontSize: 12,
    color: '#333',
  },
});
