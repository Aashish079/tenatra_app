import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://54.147.246.169:8000';

export interface EvCar {
  make: string;
  model: string;
  year: string | null;
  plugType: string | null;
  batteryKwh: string | null;
  rangeKm: string | null;
}

export function useVehicle() {
  const [vehicle, setVehicle] = useState<EvCar | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchVehicle = useCallback(async () => {
    const token = await SecureStore.getItemAsync('session_token');
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/vehicles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setVehicle(data);
      }
    } catch {
      // network error – silently ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVehicle();
  }, [fetchVehicle]);

  const upsertVehicle = async (payload: EvCar) => {
    const token = await SecureStore.getItemAsync('session_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API_BASE_URL}/vehicles`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to save vehicle');
    }
    setVehicle(payload);
  };

  return { vehicle, isLoading, upsertVehicle, refetch: fetchVehicle };
}
