/**
 * sim.ts
 * Core simulation primitives: graph types, energy model, queue model,
 * edge traversal based on speed limit.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type LatLon = { latitude: number; longitude: number };

/** A directed edge in the road graph */
export interface Edge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  /** physical length in metres */
  lengthM: number;
  /** speed limit / free-flow speed in km/h */
  baseSpeedKph: number;
  /** positive = uphill, negative = downhill (degrees or % grade) */
  gradient?: number;
}

/** A node in the road graph */
export interface GraphNode {
  id: string;
  coord: LatLon;
  /** If this node hosts a charging station */
  charger?: ChargerSpec;
}

/** Charging station specification at a node */
export interface ChargerSpec {
  stationId: string;
  /** Maximum charging rate in kW */
  maxPowerKW: number;
  /** Number of independent charging plugs */
  plugCount: number;
  /** Arrival rate of other EVs (vehicles / second) at time t */
  arrivalRate?: (t: number) => number;
  /** Mean service time per vehicle in seconds (how long each plug is occupied) */
  meanServiceTimeSec?: number;
  /**
   * Simulated number of vehicles already queued at the station.
   * When set, wait time = ceil(currentQueueLength / plugCount) * meanServiceTimeSec
   * (overrides M/M/c calculation).
   */
  currentQueueLength?: number;
}

/** Energy cost coefficients for the EV model */
export interface EnergyCoefficients {
  /** base Wh per metre (rolling resistance contribution) */
  a: number;
  /** speed-linear term Wh / (metre · km/h) */
  b: number;
  /** speed-quadratic term Wh / (metre · (km/h)²) – aero drag */
  c: number;
  /** gradient energy factor: extra Wh per metre per % grade */
  gradeKWh?: number;
  /** regenerative braking efficiency [0–1] for downhill recovery */
  regenEff?: number;
}

export const DEFAULT_EV_COEFFS: EnergyCoefficients = {
  a: 0.025,    // Wh/m at any speed
  b: 0.0003,   // Wh/(m·km/h)
  c: 0.000012, // Wh/(m·(km/h)²)
  gradeKWh: 0.00027, // ~1 kWh / (3.6 km · 1 % grade)
  regenEff: 0.65,
};

// ─────────────────────────────────────────────────────────────────────────────
// Energy Model
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Energy consumption in Wh for travelling `lengthM` metres at `speedKph`
 * with optional road gradient.
 */
export function energyWh(
  lengthM: number,
  speedKph: number,
  gradient = 0,
  coeffs: EnergyCoefficients = DEFAULT_EV_COEFFS
): number {
  const v = Math.max(0, speedKph);
  const aeroDrag = coeffs.c * v * v;
  const rolling = coeffs.a + coeffs.b * v;

  const base = (rolling + aeroDrag) * lengthM;

  // Grade energy: positive grade = uphill = more consumption
  const gradeEff = coeffs.gradeKWh ?? 0.00027;
  const regenEff = coeffs.regenEff ?? 0.65;
  let gradeEnergy = 0;
  if (gradient > 0) {
    gradeEnergy = gradeEff * gradient * lengthM;
  } else if (gradient < 0) {
    // Downhill: partial recovery via regenerative braking
    gradeEnergy = gradeEff * gradient * lengthM * regenEff; // negative value
  }

  return Math.max(0, base + gradeEnergy);
}

/**
 * Returns how many seconds are needed to charge `energyNeededKWh` of battery
 * given the available charging power in kW (may be limited by both charger and
 * remaining battery capacity leading to a tapered rate — simplified linear here).
 */
export function chargingTimeSec(energyNeededKWh: number, chargerPowerKW: number): number {
  if (chargerPowerKW <= 0) return Infinity;
  return (energyNeededKWh / chargerPowerKW) * 3600;
}

// ─────────────────────────────────────────────────────────────────────────────
// Edge Traversal
// ─────────────────────────────────────────────────────────────────────────────

export interface TraversalResult {
  /** Time to traverse the edge in seconds */
  timeSec: number;
  /** Energy consumed in Wh */
  energyWh: number;
  /** Effective speed used for the traversal in km/h */
  effectiveSpeedKph: number;
}

/**
 * Compute traversal time & energy for `edge` using its speed limit.
 */
export function traverseEdge(
  edge: Edge,
  _departTimeSec?: number,
  coeffs: EnergyCoefficients = DEFAULT_EV_COEFFS
): TraversalResult {
  const effectiveSpeedKph = Math.max(1, edge.baseSpeedKph);
  const speedMs = effectiveSpeedKph / 3.6;
  const timeSec = edge.lengthM / speedMs;
  const energy = energyWh(edge.lengthM, effectiveSpeedKph, edge.gradient ?? 0, coeffs);
  return { timeSec, energyWh: energy, effectiveSpeedKph };
}

// ─────────────────────────────────────────────────────────────────────────────
// Queue Model  (M/M/c — Erlang C approximation)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute Erlang-C probability: probability that an arriving vehicle has to
 * wait for a free plug (Pr[wait > 0]).
 */
function erlangC(lambda: number, mu: number, c: number): number {
  if (c <= 0 || mu <= 0) return 1;
  const rho = lambda / (c * mu);
  if (rho >= 1) return 1; // overloaded system

  const a = lambda / mu; // offered load per server
  let poisson = Math.pow(a, c) / (factorial(c) * (1 - rho)); // Erlang-C numerator term
  let sum = 0;
  for (let k = 0; k < c; k++) {
    sum += Math.pow(a, k) / factorial(k);
  }
  const total = sum + poisson;
  return poisson / total;
}

/**
 * Expected waiting time in queue (seconds) before a plug becomes free.
 * Uses M/M/c Erlang C approximation.
 *
 * @param lambda  Arrival rate of EVs (vehicles / second) at time t
 * @param mu      Service rate per plug (1 / mean_service_time_sec)
 * @param c       Number of plugs (servers)
 */
export function expectedQueueWaitSec(lambda: number, mu: number, c: number): number {
  if (lambda <= 0) return 0;
  const rho = lambda / (c * mu);
  if (rho >= 1) return 1800; // station heavily loaded — cap at 30 min penalty
  const Cprob = erlangC(lambda, mu, c);
  return Cprob / (c * mu - lambda);
}

function factorial(n: number): number {
  if (n <= 1) return 1;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

// ─────────────────────────────────────────────────────────────────────────────
// Haversine distance
// ─────────────────────────────────────────────────────────────────────────────

export function haversineM(a: LatLon, b: LatLon): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const sinA =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(sinA), Math.sqrt(1 - sinA));
}
