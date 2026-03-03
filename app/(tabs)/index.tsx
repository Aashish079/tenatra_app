import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Location from 'expo-location';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FilterButton, MapMarker, MarkerType, SearchBar } from '@/components/map';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { scanStations } from '@/services/dynamodb';

interface Marker {
  id: string;
  name: string;
  coordinate: { latitude: number; longitude: number };
  type: MarkerType;
  // DynamoDB extra fields
  plugType?: string;
  powerKW?: number;
  operator?: string;
  chargingPoints?: number;
  country?: string;
  district?: string;
}

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
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ charging: true, carService: true, maintenance: true });
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [markersLoading, setMarkersLoading] = useState(true);
  const [visibleRegion, setVisibleRegion] = useState<Region | null>(null);
  // Search-based custom origin (replaces GPS as the "from" point for routing)
  const [searchedLocation, setSearchedLocation] = useState<{ latitude: number; longitude: number; label: string } | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const selectedMarker = markers.find((m) => m.id === selectedMarkerId) ?? null;

  // Only render markers inside the visible map area (+ 60 % buffer on each side).
  // Recomputes only when the region, filter settings, or marker list changes.
  const VIEWPORT_BUFFER = 0.6;
  const visibleMarkers = useMemo(() => {
    const r = visibleRegion ?? region;
    if (!r) return [];
    const latMin = r.latitude - r.latitudeDelta * (0.5 + VIEWPORT_BUFFER);
    const latMax = r.latitude + r.latitudeDelta * (0.5 + VIEWPORT_BUFFER);
    const lonMin = r.longitude - r.longitudeDelta * (0.5 + VIEWPORT_BUFFER);
    const lonMax = r.longitude + r.longitudeDelta * (0.5 + VIEWPORT_BUFFER);
    return markers.filter((m) => {
      const { latitude: lat, longitude: lon } = m.coordinate;
      if (lat < latMin || lat > latMax || lon < lonMin || lon > lonMax) return false;
      if (m.type === 'charging' && !filters.charging) return false;
      if (m.type === 'carService' && !filters.carService) return false;
      if (m.type === 'maintenance' && !filters.maintenance) return false;
      return true;
    });
  }, [markers, visibleRegion, region, filters]);

  useEffect(() => {
    getCurrentLocation();
    fetchMarkers();
  }, []);

  const fetchMarkers = async () => {
    try {
      setMarkersLoading(true);
      const stations = await scanStations();
      const mapped: Marker[] = stations.map((s) => ({
        id: s.Station_ID,
        name: s.Station_Name,
        coordinate: { latitude: s.Latitude, longitude: s.Longitude },
        type: 'charging' as MarkerType,
        plugType: s.Plug_Type,
        powerKW: s.Power_kW,
        operator: s.Operator,
        chargingPoints: s.Charging_Points,
        country: s.Country,
        district: s.District,
      }));
      setMarkers(mapped);
    } catch (err) {
      console.error('Failed to load stations from DynamoDB:', err);
    } finally {
      setMarkersLoading(false);
    }
  };

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
      setUserLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude });
      setIsLoading(false);
    } catch (error) {
      console.error('Error getting location:', error);
      setLocationError('Could not get current location');
      setRegion(FALLBACK_REGION);
      setIsLoading(false);
    }
  };

  /** Haversine distance in metres between two coordinates */
  const haversineDistance = (
    from: { latitude: number; longitude: number },
    to: { latitude: number; longitude: number }
  ): number => {
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(to.latitude - from.latitude);
    const dLon = toRad(to.longitude - from.longitude);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const fetchDistance = (
    from: { latitude: number; longitude: number },
    to: { latitude: number; longitude: number }
  ) => {
    const dist = haversineDistance(from, to);
    setRouteDistance(dist);
  };

  const fetchRoute = async (
    from: { latitude: number; longitude: number },
    to: { latitude: number; longitude: number }
  ) => {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        const coords = data.routes[0].geometry.coordinates.map(
          ([lon, lat]: [number, number]) => ({ latitude: lat, longitude: lon })
        );
        setRouteCoords(coords);
        setRouteDistance(data.routes[0].distance);
      }
    } catch (e) {
      console.warn('Route fetch failed, using straight line', e);
      setRouteCoords([from, to]);
      setRouteDistance(haversineDistance(from, to));
    }
  };

  const handleFilterPress = () => {
    setShowFilters((prev) => !prev);
  };

  /** Geocode typed address, drop a pin, and pan the map there */
  const handleSearchSubmit = async () => {
    if (!searchQuery.trim()) return;
    setIsGeocoding(true);
    try {
      const results = await Location.geocodeAsync(searchQuery.trim());
      if (results.length === 0) {
        alert(`No location found for "${searchQuery}"`);
        return;
      }
      const { latitude, longitude } = results[0];
      const newRegion: Region = { latitude, longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 };
      setSearchedLocation({ latitude, longitude, label: searchQuery.trim() });
      setRouteCoords([]); // clear any old route
      setRouteDistance(null);
      mapRef.current?.animateToRegion(newRegion, 700);
    } catch (e) {
      console.error('Geocode error', e);
      alert('Could not find that location. Try a more specific address.');
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSearchClear = () => {
    setSearchQuery('');
    setSearchedLocation(null);
    setRouteCoords([]);
    setRouteDistance(null);
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
    const m = markers.find((x) => x.id === markerId);
    const origin = searchedLocation ?? userLocation;
    if (m && origin) {
      fetchDistance(origin, m.coordinate);
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
        onRegionChangeComplete={(r) => setVisibleRegion(r)}
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
        {/* Custom searched-location pin */}
        {searchedLocation && (
          <Marker
            coordinate={searchedLocation}
            pinColor={Colors.secondary}
            title={searchedLocation.label}
          />
        )}
        {visibleMarkers.map((marker) => (
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
          onSubmit={handleSearchSubmit}
          onClear={handleSearchClear}
          isLoading={isGeocoding}
          style={styles.searchBar}
        />
        <FilterButton onPress={handleFilterPress} />
      </View>

      {/* Searched-location banner */}
      {searchedLocation && (
        <View style={[styles.locationBanner, { top: insets.top + 72 }]}>
          <MaterialIcons name="place" size={14} color={Colors.secondary} />
          <Text style={styles.locationBannerText} numberOfLines={1}>
            From: {searchedLocation.label}
          </Text>
          <TouchableOpacity onPress={handleSearchClear} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <MaterialIcons name="close" size={14} color="#666" />
          </TouchableOpacity>
        </View>
      )}

      {/* Alert Button removed */}

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
            {selectedMarker?.plugType != null && (
              <Text style={styles.modalSubtitle}>Plug: {selectedMarker.plugType}</Text>
            )}
            {selectedMarker?.powerKW != null && (
              <Text style={styles.modalSubtitle}>Power: {selectedMarker.powerKW} kW</Text>
            )}
            {selectedMarker?.operator != null && (
              <Text style={styles.modalSubtitle}>Operator: {selectedMarker.operator}</Text>
            )}
            {selectedMarker?.chargingPoints != null && (
              <Text style={styles.modalSubtitle}>Points: {selectedMarker.chargingPoints}</Text>
            )}
            {(selectedMarker?.district ?? selectedMarker?.country) != null && (
              <Text style={styles.modalSubtitle}>
                {[selectedMarker?.district, selectedMarker?.country].filter(Boolean).join(', ')}
              </Text>
            )}
            {routeDistance != null && (
              <Text style={styles.modalSubtitle}>Distance: {(routeDistance / 1000).toFixed(2)} km</Text>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: Colors.secondary }]}
                onPress={async () => {
                  const origin = searchedLocation ?? userLocation;
                  if (selectedMarker && origin) {
                    await fetchRoute(origin, selectedMarker.coordinate);
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
    color: Colors.secondary,
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
  /* alertButton style removed */
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
  locationBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  locationBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#444',
  },
});
