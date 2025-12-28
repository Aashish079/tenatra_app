import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';

const PROFILE_OPTIONS = [
  { id: '1', icon: 'history', title: 'Charging History' },
  { id: '2', icon: 'payment', title: 'Payment Methods' },
  { id: '3', icon: 'favorite', title: 'Saved Stations' },
  { id: '4', icon: 'notifications', title: 'Notifications' },
  { id: '5', icon: 'settings', title: 'Settings' },
  { id: '6', icon: 'help', title: 'Help & Support' },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          <MaterialIcons name="person" size={48} color={Colors.primary} />
        </View>
        <ThemedText type="title" style={styles.userName}>John Doe</ThemedText>
        <ThemedText style={styles.userEmail}>john.doe@example.com</ThemedText>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <ThemedText type="title" style={styles.statValue}>42</ThemedText>
          <ThemedText style={styles.statLabel}>Sessions</ThemedText>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <ThemedText type="title" style={styles.statValue}>156</ThemedText>
          <ThemedText style={styles.statLabel}>kWh</ThemedText>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <ThemedText type="title" style={styles.statValue}>$89</ThemedText>
          <ThemedText style={styles.statLabel}>Saved</ThemedText>
        </View>
      </View>

      {/* Menu Options */}
      <View style={styles.menuContainer}>
        {PROFILE_OPTIONS.map((option) => (
          <TouchableOpacity key={option.id} style={styles.menuItem} activeOpacity={0.7}>
            <View style={styles.menuIconContainer}>
              <MaterialIcons name={option.icon as any} size={24} color={Colors.primary} />
            </View>
            <ThemedText style={styles.menuTitle}>{option.title}</ThemedText>
            <MaterialIcons name="chevron-right" size={24} color="#999" />
          </TouchableOpacity>
        ))}
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} activeOpacity={0.7}>
        <MaterialIcons name="logout" size={20} color={Colors.warning} />
        <ThemedText style={styles.logoutText}>Log Out</ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  userName: {
    fontSize: 24,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    color: Colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#ddd',
  },
  menuContainer: {
    gap: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e8f4f8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuTitle: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    padding: 16,
  },
  logoutText: {
    color: Colors.warning,
    fontSize: 16,
    fontWeight: '600',
  },
});
