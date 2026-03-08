// ---------------------------------------------------------------------------
// Charging stations API
// ---------------------------------------------------------------------------
const API_URL =
  "https://i20hq7uqh4.execute-api.us-east-1.amazonaws.com/stations";

export type PlugType = "AC Type-1" | "AC Type-2" | "DC" | string;

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

// Raw shape returned by the API — all numeric fields may arrive as strings.
// Extra normalized fields (e.g. Latitude_Normalized) are captured by the index
// signature and intentionally excluded from the public ChargingStation type.
interface RawStation {
  Station_ID: string;
  Station_Name: string;
  Latitude: string | number;
  Longitude: string | number;
  Country?: string;
  Province?: string;
  District?: string;
  PBT?: string;
  Plug_Type?: string;
  Power_kW?: string | number;
  Operator?: string;
  Charging_Points?: string | number;
  Operational_Year?: string | number;
  [key: string]: unknown;
}

/** Safely coerce a value to a number; returns undefined when not meaningful. */
function toNum(v: string | number | undefined | null): number | undefined {
  if (v == null || String(v).trim() === "") return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}

export async function scanStations(): Promise<ChargingStation[]> {
  const response = await fetch(API_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch stations: ${response.status} ${response.statusText}`,
    );
  }
  // Cast to the raw shape first — the API sends numbers as strings.
  const data: RawStation[] = await response.json();

  return data
    .filter((s) => {
      // Reject records where Latitude or Longitude are missing, empty, or
      // non-numeric. Also reject empty strings: Number("") === 0 which would
      // silently place markers at (0, 0) in the ocean off Africa.
      const lat = toNum(s.Latitude);
      const lon = toNum(s.Longitude);
      return lat !== undefined && lon !== undefined;
    })
    .map((s) => ({
      // Explicitly map known fields so extra API properties (Latitude_Normalized,
      // Power_kW_Normalized, etc.) are not leaked into the public type.
      Station_ID: s.Station_ID,
      Station_Name: s.Station_Name,
      Latitude: toNum(s.Latitude) as number,
      Longitude: toNum(s.Longitude) as number,
      Country: s.Country,
      Province: s.Province,
      District: s.District,
      PBT: s.PBT,
      Plug_Type: s.Plug_Type,
      Power_kW: toNum(s.Power_kW),
      Operator: s.Operator,
      Charging_Points: toNum(s.Charging_Points),
      Operational_Year: toNum(s.Operational_Year),
    }));
}
