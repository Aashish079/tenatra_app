/**
 * astar.ts
 * Multi-state A* for EV route optimisation.
 *
 * State:  (nodeId, soc [kWh], timeSec)
 * Cost:   weighted combination of travel time + energy penalty (configurable)
 * Heuristic: admissible lower bounds for time and energy using straight-line
 *            distances and maximum possible speed / minimum energy rate.
 *
 * Supports:
 *  - Speed-limit based edge weights (via edge.baseSpeedKph)
 *  - Charging stops: queue wait + charge time calculation
 *  - SOC feasibility constraint (never below minSocKWh during routing)
 *  - SOC discretisation to limit state-space explosion
 */

import { chargingTimeSec, DEFAULT_EV_COEFFS, Edge, EnergyCoefficients, GraphNode, haversineM, LatLon, traverseEdge } from './sim';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AStarConfig {
  /** Battery capacity in kWh */
  batteryCapacityKWh: number;
  /** Starting SOC in kWh */
  startSocKWh: number;
  /** Target minimum SOC on arrival in kWh (range anxiety buffer) */
  minArrivalSocKWh?: number;
  /** Never allow SOC to drop below this during the journey */
  minSocKWh?: number;
  /** Departure time in seconds since midnight */
  departTimeSec: number;
  /** Weight on time component (1 = minimise time only, 0 = minimise energy only) */
  timeWeight?: number;
  /** SOC discretisation step in kWh (smaller = more accurate, larger = faster) */
  socStepKWh?: number;
  /** Maximum number of nodes to expand before giving up */
  maxExpansions?: number;
  /** EV energy model coefficients */
  evCoeffs?: EnergyCoefficients;
  /** Maximum safe speed on every edge in km/h (for admissible heuristic) */
  maxSpeedKph?: number;
}

export interface AStarState {
  nodeId: string;
  /** Discretised SOC bucket index */
  socBucket: number;
  /** Continuous time (seconds since midnight) */
  timeSec: number;
}

export interface PathStep {
  nodeId: string;
  socKWh: number;
  timeSec: number;
  /** Edge taken to reach this node (null for start) */
  edgeId: string | null;
  /** If a charging stop was made here */
  charged?: ChargeEvent;
}

export interface ChargeEvent {
  energyKWh: number;
  waitSec: number;
  chargeSec: number;
}

export interface AStarResult {
  found: boolean;
  path: PathStep[];
  totalTimeSec: number;
  totalEnergyKWh: number;
  /** Number of charging stops made */
  chargingStops: number;
  /** Number of nodes expanded during the search */
  expanded: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Priority queue (min-heap)
// ─────────────────────────────────────────────────────────────────────────────

interface HeapItem {
  f: number;
  g: number;
  state: AStarState;
  parent: string | null; // serialised state key of parent
  edgeId: string | null;
  socKWh: number;       // continuous SOC at this state
  charged?: PathStep['charged'];
}

class MinHeap {
  private data: HeapItem[] = [];

  push(item: HeapItem) {
    this.data.push(item);
    this._bubbleUp(this.data.length - 1);
  }

  pop(): HeapItem | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  get size() { return this.data.length; }

  private _bubbleUp(i: number) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.data[p].f <= this.data[i].f) break;
      [this.data[p], this.data[i]] = [this.data[i], this.data[p]];
      i = p;
    }
  }

  private _sinkDown(i: number) {
    const n = this.data.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.data[l].f < this.data[smallest].f) smallest = l;
      if (r < n && this.data[r].f < this.data[smallest].f) smallest = r;
      if (smallest === i) break;
      [this.data[smallest], this.data[i]] = [this.data[i], this.data[smallest]];
      i = smallest;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Graph helper
// ─────────────────────────────────────────────────────────────────────────────

export interface Graph {
  nodes: Map<string, GraphNode>;
  /** nodeId → outgoing edges */
  adjacency: Map<string, Edge[]>;
}

export function buildGraph(nodes: GraphNode[], edges: Edge[]): Graph {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const adj = new Map<string, Edge[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    adj.get(e.fromNodeId)?.push(e);
  }
  return { nodes: nodeMap, adjacency: adj };
}

// ─────────────────────────────────────────────────────────────────────────────
// Admissible heuristics
// ─────────────────────────────────────────────────────────────────────────────

function stateKey(s: AStarState): string {
  return `${s.nodeId}|${s.socBucket}`;
}

function heuristic(
  nodeCoord: LatLon,
  goalCoord: LatLon,
  maxSpeedKph: number,
  timeWeight: number,
  minEnergyWhPerM: number,
  batteryCapKWh: number
): number {
  const distM = haversineM(nodeCoord, goalCoord);
  const maxSpeedMs = maxSpeedKph / 3.6;
  // Time lower bound: straight line at max speed
  const hTime = timeWeight * (distM / maxSpeedMs);
  // Energy lower bound converted to "time equivalent" cost
  const hEnergy = (1 - timeWeight) * (minEnergyWhPerM * distM) / (batteryCapKWh * 1000);
  return hTime + hEnergy;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core A* search
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run multi-state A* on `graph` from `startNodeId` to `goalNodeId`.
 */
export function evAstar(
  graph: Graph,
  startNodeId: string,
  goalNodeId: string,
  config: AStarConfig
): AStarResult {
  const {
    batteryCapacityKWh,
    startSocKWh,
    departTimeSec,
    minArrivalSocKWh = 0.1 * batteryCapacityKWh,
    minSocKWh = 0.05 * batteryCapacityKWh,
    timeWeight = 0.7,
    socStepKWh = 1.0,
    maxExpansions = 50_000,
    evCoeffs = DEFAULT_EV_COEFFS,
    maxSpeedKph = 130,
  } = config;

  const socBuckets = Math.ceil(batteryCapacityKWh / socStepKWh);
  const socToBucket = (s: number) => Math.max(0, Math.min(socBuckets - 1, Math.floor(s / socStepKWh)));
  const bucketToSoc = (b: number) => b * socStepKWh;

  // Minimum energy Wh/m at very low speed (lower bound for heuristic)
  const minEnergyWhPerM = energyWhPerMeter(5, evCoeffs);

  const goalNode = graph.nodes.get(goalNodeId);
  if (!goalNode) return noPath();

  const heap = new MinHeap();
  const gScore = new Map<string, number>(); // key → best g
  const cameFrom = new Map<string, { parent: string | null; edgeId: string | null; socKWh: number; timeSec: number; charged?: ChargeEvent }>();

  const startState: AStarState = {
    nodeId: startNodeId,
    socBucket: socToBucket(startSocKWh),
    timeSec: departTimeSec,
  };
  const startKey = stateKey(startState);
  gScore.set(startKey, 0);
  cameFrom.set(startKey, { parent: null, edgeId: null, socKWh: startSocKWh, timeSec: departTimeSec });

  const startNode = graph.nodes.get(startNodeId);
  const h0 = startNode ? heuristic(startNode.coord, goalNode.coord, maxSpeedKph, timeWeight, minEnergyWhPerM, batteryCapacityKWh) : 0;
  heap.push({ f: h0, g: 0, state: startState, parent: null, edgeId: null, socKWh: startSocKWh });

  let expanded = 0;

  while (heap.size > 0 && expanded < maxExpansions) {
    const item = heap.pop()!;
    const { state, g, socKWh } = item;
    const key = stateKey(state);
    expanded++;

    // Goal check
    if (state.nodeId === goalNodeId) {
      if (socKWh < minArrivalSocKWh) continue; // insufficient charge on arrival
      return reconstructPath(cameFrom, key, startKey, expanded, batteryCapacityKWh, startSocKWh);
    }

    // Skip if we've found a better path to this state already
    const bestG = gScore.get(key);
    if (bestG !== undefined && g > bestG + 1e-6) continue;

    const curNode = graph.nodes.get(state.nodeId);
    if (!curNode) continue;

    // ── Option A: Charge here if there's a charger ──────────────────────────
    if (curNode.charger && socKWh < batteryCapacityKWh * 0.95) {
      const charger = curNode.charger;
      const meanSvc = charger.meanServiceTimeSec ?? 1800;

      // Charge to 80 % target
      const targetSoc = batteryCapacityKWh * 0.8;
      const energyNeededKWh = Math.max(0, targetSoc - socKWh);

      // Skip the charging expansion if the vehicle barely needs energy —
      // avoids adding queue-wait overhead to the path for no gain.
      if (energyNeededKWh >= 0.5) {
        // If a simulated queue length is provided use it directly;
        // otherwise fall back to M/M/c Erlang C model.
        let waitSec: number;
        if (charger.currentQueueLength !== undefined) {
          waitSec = Math.ceil(charger.currentQueueLength / charger.plugCount) * meanSvc;
        } else {
          // No queue info — assume one cycle of service time per plug
          waitSec = meanSvc;
        }

        const chargeSec = chargingTimeSec(energyNeededKWh, charger.maxPowerKW);
        const newTimeSec = state.timeSec + waitSec + chargeSec;
        const newSocKWh = socKWh + energyNeededKWh;
        const newBucket = socToBucket(newSocKWh);

        const chargeCost = timeWeight * (waitSec + chargeSec);
        const newG = g + chargeCost;

        const newState: AStarState = { nodeId: state.nodeId, socBucket: newBucket, timeSec: newTimeSec };
        const newKey = stateKey(newState);
        const prevBest = gScore.get(newKey) ?? Infinity;
        if (newG < prevBest) {
          gScore.set(newKey, newG);
          const h = heuristic(curNode.coord, goalNode.coord, maxSpeedKph, timeWeight, minEnergyWhPerM, batteryCapacityKWh);
          cameFrom.set(newKey, {
            parent: key,
            edgeId: null,
            socKWh: newSocKWh,
            timeSec: newTimeSec,
            charged: { energyKWh: energyNeededKWh, waitSec, chargeSec },
          });
          heap.push({ f: newG + h, g: newG, state: newState, parent: key, edgeId: null, socKWh: newSocKWh, charged: { energyKWh: energyNeededKWh, waitSec, chargeSec } });
        }
      }
    }

    // ── Option B: Drive along each outgoing edge ─────────────────────────────
    const edges = graph.adjacency.get(state.nodeId) ?? [];
    for (const edge of edges) {
      const { timeSec: dt, energyWh: dEwh } = traverseEdge(edge, state.timeSec, evCoeffs);
      const dEkwh = dEwh / 1000;
      const newSocKWh = socKWh - dEkwh;

      // Feasibility: never drop below minimum SOC
      if (newSocKWh < minSocKWh) continue;

      const newTimeSec = state.timeSec + dt;
      const newBucket = socToBucket(newSocKWh);
      const newState: AStarState = { nodeId: edge.toNodeId, socBucket: newBucket, timeSec: newTimeSec };
      const newKey = stateKey(newState);

      // Cost: weighted time + energy penalty
      const energyPenalty = (1 - timeWeight) * (dEkwh / batteryCapacityKWh) * 3600; // normalised to seconds
      const edgeCost = timeWeight * dt + energyPenalty;
      const newG = g + edgeCost;

      const prevBest = gScore.get(newKey) ?? Infinity;
      if (newG < prevBest) {
        gScore.set(newKey, newG);
        const toNode = graph.nodes.get(edge.toNodeId);
        const h = toNode
          ? heuristic(toNode.coord, goalNode.coord, maxSpeedKph, timeWeight, minEnergyWhPerM, batteryCapacityKWh)
          : 0;
        cameFrom.set(newKey, { parent: key, edgeId: edge.id, socKWh: newSocKWh, timeSec: newTimeSec });
        heap.push({ f: newG + h, g: newG, state: newState, parent: key, edgeId: edge.id, socKWh: newSocKWh });
      }
    }
  }

  return noPath(expanded);
}

// ─────────────────────────────────────────────────────────────────────────────
// Path reconstruction
// ─────────────────────────────────────────────────────────────────────────────

function reconstructPath(
  cameFrom: Map<string, { parent: string | null; edgeId: string | null; socKWh: number; timeSec: number; charged?: ChargeEvent }>,
  goalKey: string,
  startKey: string,
  expanded: number,
  batteryCapKWh: number,
  startSocKWh: number
): AStarResult {
  const steps: PathStep[] = [];
  let cur: string | null = goalKey;
  while (cur !== null) {
    const info: { parent: string | null; edgeId: string | null; socKWh: number; timeSec: number; charged?: ChargeEvent } = cameFrom.get(cur)!;
    const [nodeId, ] = cur.split('|');
    steps.unshift({
      nodeId,
      socKWh: info.socKWh,
      timeSec: info.timeSec,
      edgeId: info.edgeId,
      charged: info.charged,
    });
    cur = info.parent;
  }

  const totalTimeSec = steps.length > 0 ? steps[steps.length - 1].timeSec - steps[0].timeSec : 0;
  const totalEnergyKWh = startSocKWh - (steps[steps.length - 1]?.socKWh ?? startSocKWh);
  const chargingStops = steps.filter((s) => s.charged).length;

  return { found: true, path: steps, totalTimeSec, totalEnergyKWh, chargingStops, expanded };
}

function noPath(expanded = 0): AStarResult {
  return { found: false, path: [], totalTimeSec: 0, totalEnergyKWh: 0, chargingStops: 0, expanded };
}

function energyWhPerMeter(speedKph: number, coeffs: EnergyCoefficients): number {
  return coeffs.a + coeffs.b * speedKph + coeffs.c * speedKph * speedKph;
}

// ─────────────────────────────────────────────────────────────────────────────
// Incremental replanning helper
// ─────────────────────────────────────────────────────────────────────────────

