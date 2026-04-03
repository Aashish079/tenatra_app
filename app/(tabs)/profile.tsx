import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useVehicle } from '@/hooks/useVehicle';

const ROLE_LABELS: Record<number, string> = { 0: 'Member', 1: 'Premium', 2: 'Admin' };

const PROFILE_OPTIONS = [
  { id: '1', icon: 'history', title: 'Charging History' },
  { id: '2', icon: 'payment', title: 'Payment Methods' },
  { id: '3', icon: 'favorite', title: 'Saved Stations' },
  { id: '4', icon: 'notifications', title: 'Notifications' },
  { id: '5', icon: 'settings', title: 'Settings' },
  { id: '6', icon: 'help', title: 'Help & Support' },
];

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, isLoading, updateProfile } = useAuth();

  const { vehicle, isLoading: vehicleLoading, upsertVehicle } = useVehicle();

  // Profile edit state
  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editConfirm, setEditConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  // Vehicle edit state
  const [carVisible, setCarVisible] = useState(false);
  const [carMake, setCarMake] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carYear, setCarYear] = useState('');
  const [carPlugType, setCarPlugType] = useState('');
  const [carBatteryKwh, setCarBatteryKwh] = useState('');
  const [carRangeKm, setCarRangeKm] = useState('');
  const [carSaving, setCarSaving] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const openEdit = () => {
    setEditName(user?.name ?? '');
    setEditEmail(user?.email ?? '');
    setEditPassword('');
    setEditConfirm('');
    setEditVisible(true);
  };

  const openCarEdit = () => {
    setCarMake(vehicle?.make ?? '');
    setCarModel(vehicle?.model ?? '');
    setCarYear(vehicle?.year ?? '');
    setCarPlugType(vehicle?.plugType ?? '');
    setCarBatteryKwh(vehicle?.batteryKwh ?? '');
    setCarRangeKm(vehicle?.rangeKm ?? '');
    setCarVisible(true);
  };

  const handleCarSave = async () => {
    if (!carMake.trim() || !carModel.trim()) {
      Alert.alert('Error', 'Make and Model are required');
      return;
    }
    setCarSaving(true);
    try {
      await upsertVehicle({
        make: carMake.trim(),
        model: carModel.trim(),
        year: carYear.trim() || null,
        plugType: carPlugType.trim() || null,
        batteryKwh: carBatteryKwh.trim() || null,
        rangeKm: carRangeKm.trim() || null,
      });
      setCarVisible(false);
      Alert.alert('Saved', 'Vehicle details updated');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save vehicle');
    } finally {
      setCarSaving(false);
    }
  };

  const handleSave = async () => {
    if (editPassword && editPassword !== editConfirm) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    const payload: { name?: string; email?: string; password?: string } = {};
    if (editName.trim() && editName.trim() !== user?.name) payload.name = editName.trim();
    if (editEmail.trim() && editEmail.trim() !== user?.email) payload.email = editEmail.trim();
    if (editPassword) payload.password = editPassword;

    if (Object.keys(payload).length === 0) {
      setEditVisible(false);
      return;
    }
    setSaving(true);
    try {
      await updateProfile(payload);
      setEditVisible(false);
      Alert.alert('Success', 'Profile updated');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <MaterialIcons name="person" size={48} color={Colors.primary} />
          </View>
          <ThemedText type="title" style={styles.userName}>
            {user?.name || 'Guest'}
          </ThemedText>
          <ThemedText style={styles.userEmail}>{user?.email || 'Not signed in'}</ThemedText>
          <View style={styles.roleBadge}>
            <ThemedText style={styles.roleText}>
              {ROLE_LABELS[user?.role ?? 0] ?? 'Member'}
            </ThemedText>
          </View>
          <TouchableOpacity style={styles.editButton} onPress={openEdit} activeOpacity={0.7}>
            <MaterialIcons name="edit" size={16} color={Colors.primary} />
            <ThemedText style={styles.editButtonText}>Edit Profile</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Account Info */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <MaterialIcons name="calendar-today" size={18} color="#999" />
            <ThemedText style={styles.infoLabel}>Member since</ThemedText>
            <ThemedText style={styles.infoValue}>{formatDate(user?.created_at)}</ThemedText>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoRow}>
            <MaterialIcons name="access-time" size={18} color="#999" />
            <ThemedText style={styles.infoLabel}>Last login</ThemedText>
            <ThemedText style={styles.infoValue}>{formatDate(user?.last_login)}</ThemedText>
          </View>
        </View>

        {/* EV Car Section */}
        <View style={styles.carCard}>
          <View style={styles.carCardHeader}>
            <View style={styles.carIconContainer}>
              <MaterialIcons name="electric-car" size={24} color={Colors.primary} />
            </View>
            <ThemedText style={styles.carCardTitle}>My EV</ThemedText>
            <TouchableOpacity onPress={openCarEdit} activeOpacity={0.7} style={styles.carEditBtn}>
              <MaterialIcons name={vehicle ? 'edit' : 'add'} size={18} color={Colors.primary} />
              <ThemedText style={styles.carEditBtnText}>
                {vehicle ? 'Edit' : 'Add Vehicle'}
              </ThemedText>
            </TouchableOpacity>
          </View>

          {vehicleLoading ? (
            <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 12 }} />
          ) : vehicle ? (
            <View style={styles.carDetails}>
              <ThemedText style={styles.carName}>
                {vehicle.make} {vehicle.model}
              </ThemedText>
              <View style={styles.carSpecsGrid}>
                {vehicle.year ? (
                  <View style={styles.carSpecItem}>
                    <MaterialIcons name="calendar-today" size={14} color="#999" />
                    <ThemedText style={styles.carSpecText}>{vehicle.year}</ThemedText>
                  </View>
                ) : null}
                {vehicle.plugType ? (
                  <View style={styles.carSpecItem}>
                    <MaterialIcons name="power" size={14} color="#999" />
                    <ThemedText style={styles.carSpecText}>{vehicle.plugType}</ThemedText>
                  </View>
                ) : null}
                {vehicle.batteryKwh ? (
                  <View style={styles.carSpecItem}>
                    <MaterialIcons name="battery-charging-full" size={14} color="#999" />
                    <ThemedText style={styles.carSpecText}>{vehicle.batteryKwh} kWh</ThemedText>
                  </View>
                ) : null}
                {vehicle.rangeKm ? (
                  <View style={styles.carSpecItem}>
                    <MaterialIcons name="speed" size={14} color="#999" />
                    <ThemedText style={styles.carSpecText}>{vehicle.rangeKm} km</ThemedText>
                  </View>
                ) : null}
              </View>
            </View>
          ) : (
            <ThemedText style={styles.carEmpty}>No vehicle added yet</ThemedText>
          )}
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
        <TouchableOpacity style={styles.logoutButton} activeOpacity={0.7} onPress={handleLogout}>
          <MaterialIcons name="logout" size={20} color={Colors.warning} />
          <ThemedText style={styles.logoutText}>Log Out</ThemedText>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={editVisible} animationType="slide" transparent onRequestClose={() => setEditVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText type="title" style={styles.modalTitle}>Edit Profile</ThemedText>
              <TouchableOpacity onPress={() => setEditVisible(false)}>
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ThemedText style={styles.fieldLabel}>Name</ThemedText>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Full name"
              autoCapitalize="words"
            />

            <ThemedText style={styles.fieldLabel}>Email</ThemedText>
            <TextInput
              style={styles.input}
              value={editEmail}
              onChangeText={setEditEmail}
              placeholder="Email address"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <ThemedText style={styles.fieldLabel}>New Password (optional)</ThemedText>
            <TextInput
              style={styles.input}
              value={editPassword}
              onChangeText={setEditPassword}
              placeholder="Leave blank to keep current"
              secureTextEntry
            />

            <ThemedText style={styles.fieldLabel}>Confirm Password</ThemedText>
            <TextInput
              style={styles.input}
              value={editConfirm}
              onChangeText={setEditConfirm}
              placeholder="Repeat new password"
              secureTextEntry
            />

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <ThemedText style={styles.saveButtonText}>Save Changes</ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* Edit Vehicle Modal */}
      <Modal visible={carVisible} animationType="slide" transparent onRequestClose={() => setCarVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText type="title" style={styles.modalTitle}>My EV Details</ThemedText>
              <TouchableOpacity onPress={() => setCarVisible(false)}>
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <ThemedText style={styles.fieldLabel}>Make *</ThemedText>
              <TextInput
                style={styles.input}
                value={carMake}
                onChangeText={setCarMake}
                placeholder="e.g. Tesla"
                autoCapitalize="words"
              />
              <ThemedText style={styles.fieldLabel}>Model *</ThemedText>
              <TextInput
                style={styles.input}
                value={carModel}
                onChangeText={setCarModel}
                placeholder="e.g. Model 3"
                autoCapitalize="words"
              />
              <ThemedText style={styles.fieldLabel}>Year</ThemedText>
              <TextInput
                style={styles.input}
                value={carYear}
                onChangeText={setCarYear}
                placeholder="e.g. 2024"
                keyboardType="number-pad"
              />
              <ThemedText style={styles.fieldLabel}>Plug Type</ThemedText>
              <TextInput
                style={styles.input}
                value={carPlugType}
                onChangeText={setCarPlugType}
                placeholder="e.g. CCS2, CHAdeMO, Type 2"
                autoCapitalize="characters"
              />
              <ThemedText style={styles.fieldLabel}>Battery Capacity (kWh)</ThemedText>
              <TextInput
                style={styles.input}
                value={carBatteryKwh}
                onChangeText={setCarBatteryKwh}
                placeholder="e.g. 75"
                keyboardType="decimal-pad"
              />
              <ThemedText style={styles.fieldLabel}>Range (km)</ThemedText>
              <TextInput
                style={styles.input}
                value={carRangeKm}
                onChangeText={setCarRangeKm}
                placeholder="e.g. 500"
                keyboardType="number-pad"
              />
              <TouchableOpacity
                style={[styles.saveButton, carSaving && styles.saveButtonDisabled]}
                onPress={handleCarSave}
                disabled={carSaving}
                activeOpacity={0.8}
              >
                {carSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={styles.saveButtonText}>Save Vehicle</ThemedText>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
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
  roleBadge: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#e8f4f8',
    borderRadius: 12,
  },
  roleText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 20,
  },
  editButtonText: {
    fontSize: 14,
    color: Colors.primary,
  },
  infoCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoDivider: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 12,
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
    color: '#000',
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
    fontSize: 16,
    fontWeight: '600',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
  },
  fieldLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  saveButton: {
    marginTop: 24,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // EV Car card
  carCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  carCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  carIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e8f4f8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  carCardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  carEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 12,
  },
  carEditBtnText: {
    fontSize: 12,
    color: Colors.primary,
  },
  carDetails: {
    gap: 8,
  },
  carName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  carSpecsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  carSpecItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e8f4f8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  carSpecText: {
    fontSize: 12,
    color: '#444',
  },
  carEmpty: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 8,
  },
});
