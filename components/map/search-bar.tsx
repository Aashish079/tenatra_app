import { Colors } from '@/constants/theme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { ActivityIndicator, StyleSheet, TextInput, TouchableOpacity, View, ViewStyle } from 'react-native';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
  onClear?: () => void;
  isLoading?: boolean;
  placeholder?: string;
  style?: ViewStyle;
}

export function SearchBar({
  value,
  onChangeText,
  onSubmit,
  onClear,
  isLoading = false,
  placeholder = 'Search location...',
  style,
}: SearchBarProps) {
  return (
    <View style={[styles.container, style]}>
      <MaterialIcons name="search" size={20} color="#666" style={styles.iconLeft} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor="#999"
        returnKeyType="search"
        blurOnSubmit
      />
      {isLoading ? (
        <ActivityIndicator size="small" color={Colors.primary} style={styles.iconRight} />
      ) : value.length > 0 ? (
        <TouchableOpacity onPress={onClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialIcons name="close" size={20} color="#999" style={styles.iconRight} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.searchBg,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginHorizontal: 6,
  },
  iconLeft: {},
  iconRight: {},
});
