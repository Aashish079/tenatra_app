import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { ChargingStation, scanStations } from '@/services/dynamodb';

const DEFAULT_MAX_DISTANCE_KM = 1;

interface NearbyStation extends ChargingStation {
  distanceKm: number;
}

// DEV: Toggle to use a mock location for testing. Default is false.
// Set to `true` and edit `MOCK_LOCATION` to test from a specific lat/lon.
const USE_MOCK_LOCATION = true;
const MOCK_LOCATION: { latitude: number; longitude: number } = { latitude: 5.419102983272989, longitude: 100.32032643665518 };

/** Haversine distance in kilometres between two coordinates */
function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function ListScreen() {
  const insets = useSafeAreaInsets();

  // User-selectable max distance (km)
  const [maxDistanceKm, setMaxDistanceKm] = useState<number>(DEFAULT_MAX_DISTANCE_KM);

  const [stations, setStations] = useState<NearbyStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const fetchStations = useCallback(async ({ isRefresh = false } = {}) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (isMounted.current) setError('Location permission is required to show nearby stations.');
        return;
      }

      const locPromise = USE_MOCK_LOCATION
        ? Promise.resolve({ coords: MOCK_LOCATION })
        : Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });

      const [loc, allStations] = await Promise.all([locPromise, scanStations()]);
      if (!isMounted.current) return;

      const { latitude, longitude } = loc.coords;

      const nearby: NearbyStation[] = allStations
        .map((s) => ({
          ...s,
          distanceKm: haversineKm(latitude, longitude, s.Latitude, s.Longitude),
        }))
        .filter((s) => s.distanceKm <= maxDistanceKm)
        .sort((a, b) => a.distanceKm - b.distanceKm);

      if (isMounted.current) setStations(nearby);
    } catch (e) {
      if (isMounted.current) setError('Failed to load stations. Please try again.');
      console.error(e);
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [maxDistanceKm]);

  useEffect(() => {
    isMounted.current = true;
    fetchStations();
    return () => { isMounted.current = false; };
  }, [fetchStations]);

  const renderStation = ({ item }: { item: NearbyStation }) => (
    <ThemedView style={styles.stationCard}>
      <View style={[styles.iconContainer, { backgroundColor: Colors.charging }]}>
        <MaterialIcons name="bolt" size={24} color="white" />
      </View>
      <View style={styles.stationInfo}>
        <ThemedText type="defaultSemiBold">{item.Station_Name}</ThemedText>
        {(item.District ?? item.Province ?? item.Country) ? (
          <ThemedText style={styles.location} numberOfLines={1}>
            {[item.District, item.Province, item.Country].filter(Boolean).join(', ')}
          </ThemedText>
        ) : null}
        {item.Plug_Type ? (
          <ThemedText style={styles.meta}>{item.Plug_Type}{item.Power_kW ? ` · ${item.Power_kW} kW` : ''}</ThemedText>
        ) : null}
      </View>
      <View style={styles.distanceBadge}>
        <ThemedText style={styles.distanceText}>
          {item.distanceKm < 1
            ? `${Math.round(item.distanceKm * 1000)} m`
            : `${item.distanceKm.toFixed(2)} km`}
        </ThemedText>
        <MaterialIcons name="chevron-right" size={24} color="#999" />
      </View>
    </ThemedView>
  );

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <ThemedText style={styles.statusText}>Finding nearby stations…</ThemedText>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <MaterialIcons name="error-outline" size={48} color="#999" />
        <ThemedText style={styles.statusText}>{error}</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ThemedText type="title" style={styles.header}>Nearby Stations</ThemedText>

      <View style={styles.selectorRow}>
        {[1, 2, 5, 10].map((d) => (
          <TouchableOpacity
            key={d}
            onPress={() => setMaxDistanceKm(d)}
            activeOpacity={0.8}
            style={[
              styles.selectorOption,
              maxDistanceKm === d ? styles.selectorOptionActive : null,
            ]}
          >
            <ThemedText style={[styles.selectorText, maxDistanceKm === d ? styles.selectorTextActive : null]}>{d} km</ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      <ThemedText style={styles.subheader}>Within {maxDistanceKm} km · {stations.length} found</ThemedText>
      {stations.length === 0 ? (
        <View style={styles.centered}>
          <MaterialIcons name="ev-station" size={48} color="#ccc" />
          <ThemedText style={styles.statusText}>No stations within {maxDistanceKm} km.</ThemedText>
        </View>
      ) : (
        <FlatList
          data={stations}
          renderItem={renderStation}
          keyExtractor={(item) => item.Station_ID}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={() => fetchStations({ isRefresh: true })}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 2,
  },
  subheader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    fontSize: 13,
    color: '#888',
  },
  statusText: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  listContent: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 24,
  },
  stationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stationInfo: {
    flex: 1,
    marginLeft: 12,
    gap: 2,
  },
  location: {
    fontSize: 13,
    color: '#666',
  },
  meta: {
    fontSize: 12,
    color: '#999',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  distanceText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },
  selectorRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
    marginTop: 8,
  },
  selectorOption: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  selectorOptionActive: {
    backgroundColor: Colors.primary,
  },
  selectorText: {
    fontSize: 13,
    color: '#444',
  },
  selectorTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
});
