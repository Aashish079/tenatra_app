import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';

// Sample station data - replace with actual data from your API
const SAMPLE_STATIONS = [
  { id: '1', name: 'Downtown Charging Hub', type: 'charging', distance: '0.3 mi', status: 'Available' },
  { id: '2', name: 'EV Quick Charge', type: 'charging', distance: '0.5 mi', status: 'Available' },
  { id: '3', name: 'Auto Service Center', type: 'carService', distance: '0.7 mi', status: 'Open' },
  { id: '4', name: 'City Power Station', type: 'charging', distance: '1.2 mi', status: 'Busy' },
  { id: '5', name: 'Quick Fix Auto', type: 'maintenance', distance: '1.5 mi', status: 'Open' },
  { id: '6', name: 'Green Energy Point', type: 'charging', distance: '1.8 mi', status: 'Available' },
];

type StationType = 'charging' | 'carService' | 'maintenance';

const getTypeIcon = (type: StationType): keyof typeof MaterialIcons.glyphMap => {
  switch (type) {
    case 'charging':
      return 'bolt';
    case 'carService':
      return 'directions-car';
    case 'maintenance':
      return 'build';
    default:
      return 'place';
  }
};

const getTypeColor = (type: StationType): string => {
  switch (type) {
    case 'charging':
      return Colors.charging;
    case 'carService':
      return Colors.carService;
    case 'maintenance':
      return Colors.maintenance;
    default:
      return Colors.primary;
  }
};

export default function ListScreen() {
  const insets = useSafeAreaInsets();

  const renderStation = ({ item }: { item: typeof SAMPLE_STATIONS[0] }) => (
    <ThemedView style={styles.stationCard}>
      <View style={[styles.iconContainer, { backgroundColor: getTypeColor(item.type as StationType) }]}>
        <MaterialIcons name={getTypeIcon(item.type as StationType)} size={24} color="white" />
      </View>
      <View style={styles.stationInfo}>
        <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
        <ThemedText style={styles.distance}>{item.distance}</ThemedText>
      </View>
      <View style={styles.statusContainer}>
        <ThemedText style={[styles.status, item.status === 'Available' && styles.statusAvailable]}>
          {item.status}
        </ThemedText>
        <MaterialIcons name="chevron-right" size={24} color="#999" />
      </View>
    </ThemedView>
  );

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ThemedText type="title" style={styles.header}>Stations</ThemedText>
      <FlatList
        data={SAMPLE_STATIONS}
        renderItem={renderStation}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
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
  },
  distance: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  status: {
    fontSize: 14,
    color: '#666',
  },
  statusAvailable: {
    color: Colors.charging,
  },
});
