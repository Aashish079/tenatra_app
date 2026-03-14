/**
 * traffic.ts — simplified: no congestion or incident modeling.
 * Estimation is based purely on location waypoints and a fixed average speed.
 */

import { LatLon, energyWh, haversineM } from './sim';

export interface TripLeg {
  from: LatLon;
  to: LatLon;
  /** Travel time for this leg in seconds */
  travelTimeSec: number;
  /** Energy consumed in Wh */
  energyConsumedWh: number;
  /** Speed used for this leg in km/h */
  speedKph: number;
}

export interface TripSimResult {
  legs: TripLeg[];
  totalTimeSec: number;
  totalDistanceM: number;
  totalEnergyWh: number;
  /** Final SOC in kWh */
  finalSocKWh: number;
  /** True if battery was depleted before reaching the destination */
  rangeExhausted: boolean;
}

/**
 * Simulate a trip along a sequence of coordinates using a fixed average speed.
 * This version does not include time-of-day congestion or incidents.
 */
export function simulateTrip(
  waypoints: LatLon[],
  startSocKWh: number,
  departTimeSec: number,
  avgSpeedKph = 60
): TripSimResult {
  const legs: TripLeg[] = [];
  let currentSocKWh = startSocKWh;
  let currentTime = departTimeSec;
  let totalDistM = 0;
  let rangeExhausted = false;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i];
    const to = waypoints[i + 1];
    const distM = haversineM(from, to);

    const effectiveSpeedKph = Math.max(1, avgSpeedKph);
    const travelTimeSec = distM / (effectiveSpeedKph / 3.6);

    // Flat gradient assumption
    const gradient = 0;
    const whConsumed = energyWh(distM, effectiveSpeedKph, gradient);
    const kwConsumed = whConsumed / 1000;

    const leg: TripLeg = {
      from,
      to,
      travelTimeSec,
      energyConsumedWh: whConsumed,
      speedKph: effectiveSpeedKph,
    };
    legs.push(leg);

    currentSocKWh -= kwConsumed;
    currentTime += travelTimeSec;
    totalDistM += distM;

    if (currentSocKWh <= 0) {
      currentSocKWh = 0;
      rangeExhausted = true;
      break;
    }
  }

  return {
    legs,
    totalTimeSec: currentTime - departTimeSec,
    totalDistanceM: totalDistM,
    totalEnergyWh: (startSocKWh - currentSocKWh) * 1000,
    finalSocKWh: currentSocKWh,
    rangeExhausted,
  };
}
