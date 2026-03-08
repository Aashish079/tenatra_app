// ---------------------------------------------------------------------------
// Charging stations API
// ---------------------------------------------------------------------------
const API_URL = 'https://i20hq7uqh4.execute-api.us-east-1.amazonaws.com/stations';

export type PlugType = 'AC Type-1' | 'AC Type-2' | 'DC' | string;

export interface ChargingStation {
  Station_ID: string;
  Station_Name: string;
  Latitude: number;
  Longitude: number;
  Country?: string;
  Province?: string;
  District?: string;
  PBT?: string;
  Plug_Type?: PlugType;
  Power_kW?: number;
  Operator?: string;
  Charging_Points?: number;
  Operational_Year?: number;
}

export async function scanStations(): Promise<ChargingStation[]> {
  const response = await fetch(API_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch stations: ${response.status} ${response.statusText}`);
  }
  const data: ChargingStation[] = await response.json();
  // Filter out any items missing valid coordinates
  return data.filter(
    (s) => s.Latitude != null && s.Longitude != null &&
           !isNaN(Number(s.Latitude)) && !isNaN(Number(s.Longitude))
  );
}
