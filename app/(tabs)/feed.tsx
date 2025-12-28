import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';

// Sample feed data - replace with actual data from your API
const SAMPLE_FEED = [
  {
    id: '1',
    type: 'alert',
    title: 'New Charging Station',
    message: 'A new fast charging station has opened at 123 Main St. 150kW available!',
    time: '2h ago',
  },
  {
    id: '2',
    type: 'update',
    title: 'Maintenance Complete',
    message: 'Station #42 maintenance is complete. All chargers are now operational.',
    time: '5h ago',
  },
  {
    id: '3',
    type: 'promo',
    title: 'Weekend Special',
    message: 'Get 20% off charging this weekend at all partner stations.',
    time: '1d ago',
  },
  {
    id: '4',
    type: 'alert',
    title: 'Service Advisory',
    message: 'Station #15 is currently experiencing high demand. Consider alternatives.',
    time: '2d ago',
  },
];

type FeedType = 'alert' | 'update' | 'promo';

const getTypeIcon = (type: FeedType): keyof typeof MaterialIcons.glyphMap => {
  switch (type) {
    case 'alert':
      return 'notifications';
    case 'update':
      return 'update';
    case 'promo':
      return 'local-offer';
    default:
      return 'info';
  }
};

const getTypeColor = (type: FeedType): string => {
  switch (type) {
    case 'alert':
      return Colors.warning;
    case 'update':
      return Colors.primary;
    case 'promo':
      return Colors.charging;
    default:
      return Colors.primary;
  }
};

export default function FeedScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ThemedText type="title" style={styles.header}>Feed</ThemedText>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {SAMPLE_FEED.map((item) => (
          <ThemedView key={item.id} style={styles.feedCard}>
            <View style={styles.feedHeader}>
              <View style={[styles.iconContainer, { backgroundColor: getTypeColor(item.type as FeedType) }]}>
                <MaterialIcons name={getTypeIcon(item.type as FeedType)} size={20} color="white" />
              </View>
              <View style={styles.feedTitleContainer}>
                <ThemedText type="defaultSemiBold">{item.title}</ThemedText>
                <ThemedText style={styles.time}>{item.time}</ThemedText>
              </View>
            </View>
            <ThemedText style={styles.message}>{item.message}</ThemedText>
          </ThemedView>
        ))}
      </ScrollView>
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
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 24,
  },
  feedCard: {
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedTitleContainer: {
    flex: 1,
    marginLeft: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  time: {
    fontSize: 12,
    color: '#999',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
  },
});
