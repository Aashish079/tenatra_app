/**
 * kdrtree.ts
 * Simulated KD-Tree and R-Tree implementations for spatial indexing of
 * charging stations / map markers.
 *
 * KD-Tree  – optimal for nearest-neighbour point queries.
 * R-Tree   – optimal for range/bounding-box queries and k-NN on larger sets.
 */

import { haversineM, LatLon } from './sim';

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

export interface SpatialEntry<T = unknown> {
  id: string;
  coord: LatLon;
  data: T;
}

// ─────────────────────────────────────────────────────────────────────────────
// KD-Tree  (2-D, splitting on latitude/longitude alternately)
// ─────────────────────────────────────────────────────────────────────────────

interface KDNode<T> {
  entry: SpatialEntry<T>;
  left: KDNode<T> | null;
  right: KDNode<T> | null;
}

export class KDTree<T = unknown> {
  private root: KDNode<T> | null = null;
  private size = 0;

  constructor(entries: SpatialEntry<T>[] = []) {
    this.root = this._build([...entries], 0);
    this.size = entries.length;
  }

  private _build(pts: SpatialEntry<T>[], depth: number): KDNode<T> | null {
    if (pts.length === 0) return null;
    const axis = depth % 2; // 0 = latitude, 1 = longitude
    pts.sort((a, b) =>
      axis === 0
        ? a.coord.latitude - b.coord.latitude
        : a.coord.longitude - b.coord.longitude
    );
    const mid = Math.floor(pts.length / 2);
    return {
      entry: pts[mid],
      left: this._build(pts.slice(0, mid), depth + 1),
      right: this._build(pts.slice(mid + 1), depth + 1),
    };
  }

  get count() { return this.size; }

  /**
   * Insert a single entry into the tree.
   * For simplicity this does a standard recursive insert (not self-balancing;
   * rebuild after bulk inserts for best performance).
   */
  insert(entry: SpatialEntry<T>): void {
    this.root = this._insert(this.root, entry, 0);
    this.size++;
  }

  private _insert(node: KDNode<T> | null, entry: SpatialEntry<T>, depth: number): KDNode<T> {
    if (!node) return { entry, left: null, right: null };
    const axis = depth % 2;
    const val = axis === 0 ? entry.coord.latitude : entry.coord.longitude;
    const nodeVal = axis === 0 ? node.entry.coord.latitude : node.entry.coord.longitude;
    if (val < nodeVal) {
      node.left = this._insert(node.left, entry, depth + 1);
    } else {
      node.right = this._insert(node.right, entry, depth + 1);
    }
    return node;
  }

  /**
   * Find the k nearest neighbours to `query` coord.
   * Returns entries sorted ascending by distance in metres.
   */
  nearest(query: LatLon, k = 1): Array<{ entry: SpatialEntry<T>; distM: number }> {
    // Max-heap maintained as sorted array (small k, so this is fine)
    const heap: Array<{ entry: SpatialEntry<T>; distM: number }> = [];

    const push = (e: SpatialEntry<T>, d: number) => {
      heap.push({ entry: e, distM: d });
      heap.sort((a, b) => b.distM - a.distM); // largest at front
      if (heap.length > k) heap.pop();
    };

    const search = (node: KDNode<T> | null, depth: number) => {
      if (!node) return;
      const d = haversineM(query, node.entry.coord);
      if (heap.length < k || d < heap[0].distM) push(node.entry, d);

      const axis = depth % 2;
      const diff =
        axis === 0
          ? query.latitude - node.entry.coord.latitude
          : query.longitude - node.entry.coord.longitude;
      // diff in degrees, convert roughly to metres for pruning
      const diffM = Math.abs(diff) * (axis === 0 ? 111_320 : 111_320 * Math.cos(query.latitude * (Math.PI / 180)));

      const [near, far] = diff < 0 ? [node.left, node.right] : [node.right, node.left];
      search(near, depth + 1);
      if (heap.length < k || diffM < heap[0].distM) search(far, depth + 1);
    };

    search(this.root, 0);
    return heap.sort((a, b) => a.distM - b.distM);
  }

  /**
   * Range query: return all entries within `radiusM` metres of `centre`.
   */
  withinRadius(centre: LatLon, radiusM: number): Array<SpatialEntry<T>> {
    const results: Array<SpatialEntry<T>> = [];

    const search = (node: KDNode<T> | null, depth: number) => {
      if (!node) return;
      if (haversineM(centre, node.entry.coord) <= radiusM) results.push(node.entry);
      const axis = depth % 2;
      const diff =
        axis === 0
          ? centre.latitude - node.entry.coord.latitude
          : centre.longitude - node.entry.coord.longitude;
      const diffM = Math.abs(diff) * (axis === 0 ? 111_320 : 111_320 * Math.cos(centre.latitude * (Math.PI / 180)));
      const [near, far] = diff < 0 ? [node.left, node.right] : [node.right, node.left];
      search(near, depth + 1);
      if (diffM <= radiusM) search(far, depth + 1);
    };

    search(this.root, 0);
    return results;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// R-Tree  (simulated – 2-D MBR-based, degree-limited node splitting)
// ─────────────────────────────────────────────────────────────────────────────

interface MBR {
  latMin: number; latMax: number;
  lonMin: number; lonMax: number;
}

function pointMBR(c: LatLon): MBR {
  return { latMin: c.latitude, latMax: c.latitude, lonMin: c.longitude, lonMax: c.longitude };
}

function unionMBR(a: MBR, b: MBR): MBR {
  return {
    latMin: Math.min(a.latMin, b.latMin),
    latMax: Math.max(a.latMax, b.latMax),
    lonMin: Math.min(a.lonMin, b.lonMin),
    lonMax: Math.max(a.lonMax, b.lonMax),
  };
}

function mbrArea(m: MBR): number {
  return (m.latMax - m.latMin) * (m.lonMax - m.lonMin);
}

function enlargement(m: MBR, p: MBR): number {
  return mbrArea(unionMBR(m, p)) - mbrArea(m);
}

function intersects(m: MBR, q: MBR): boolean {
  return m.latMin <= q.latMax && m.latMax >= q.latMin && m.lonMin <= q.lonMax && m.lonMax >= q.lonMin;
}

function containsPoint(m: MBR, c: LatLon): boolean {
  return c.latitude >= m.latMin && c.latitude <= m.latMax && c.longitude >= m.lonMin && c.longitude <= m.lonMax;
}

type RTreeNode<T> =
  | { leaf: true;  mbr: MBR; entries: SpatialEntry<T>[] }
  | { leaf: false; mbr: MBR; children: RTreeNode<T>[] };

const R_MAX = 8; // max entries / children per node (page size)
const R_MIN = Math.floor(R_MAX / 2);

export class RTree<T = unknown> {
  private root: RTreeNode<T> = { leaf: true, mbr: { latMin: 0, latMax: 0, lonMin: 0, lonMax: 0 }, entries: [] };
  private _count = 0;

  constructor(entries: SpatialEntry<T>[] = []) {
    for (const e of entries) this.insert(e);
  }

  get count() { return this._count; }

  insert(entry: SpatialEntry<T>): void {
    const leaf = this._chooseLeaf(this.root, pointMBR(entry.coord));
    (leaf as Extract<RTreeNode<T>, { leaf: true }>).entries.push(entry);
    this._updateMBR(leaf);
    this._splitIfNeeded(leaf);
    this._count++;
  }

  private _chooseLeaf(node: RTreeNode<T>, mbr: MBR): RTreeNode<T> {
    if (node.leaf) return node;
    // Choose child with minimum enlargement
    const inner = node as Extract<RTreeNode<T>, { leaf: false }>;
    let best = inner.children[0];
    let bestEnl = enlargement(best.mbr, mbr);
    for (let i = 1; i < inner.children.length; i++) {
      const enl = enlargement(inner.children[i].mbr, mbr);
      if (enl < bestEnl) { bestEnl = enl; best = inner.children[i]; }
    }
    return this._chooseLeaf(best, mbr);
  }

  private _updateMBR(node: RTreeNode<T>): void {
    if (node.leaf) {
      const e = node as Extract<RTreeNode<T>, { leaf: true }>;
      if (e.entries.length === 0) return;
      node.mbr = e.entries.reduce(
        (acc, x) => unionMBR(acc, pointMBR(x.coord)),
        pointMBR(e.entries[0].coord)
      );
    } else {
      const e = node as Extract<RTreeNode<T>, { leaf: false }>;
      if (e.children.length === 0) return;
      node.mbr = e.children.reduce(
        (acc, c) => unionMBR(acc, c.mbr),
        e.children[0].mbr
      );
    }
  }

  private _splitIfNeeded(node: RTreeNode<T>): void {
    // Simple linear split strategy
    if (node.leaf) {
      const e = node as Extract<RTreeNode<T>, { leaf: true }>;
      if (e.entries.length <= R_MAX) return;
      // Split along latitude (simplistic)
      e.entries.sort((a, b) => a.coord.latitude - b.coord.latitude);
      const mid = Math.floor(e.entries.length / 2);
      e.entries = e.entries.slice(0, mid);
      this._updateMBR(node);
    } else {
      const e = node as Extract<RTreeNode<T>, { leaf: false }>;
      if (e.children.length <= R_MAX) return;
      e.children.sort((a, b) => a.mbr.latMin - b.mbr.latMin);
      const mid = Math.floor(e.children.length / 2);
      e.children = e.children.slice(0, mid);
      this._updateMBR(node);
    }
  }

  /**
   * Range query: all entries within an axis-aligned bounding box.
   */
  searchBox(qLatMin: number, qLatMax: number, qLonMin: number, qLonMax: number): SpatialEntry<T>[] {
    const q: MBR = { latMin: qLatMin, latMax: qLatMax, lonMin: qLonMin, lonMax: qLonMax };
    const results: SpatialEntry<T>[] = [];
    this._search(this.root, q, results);
    return results;
  }

  /** Range query: all entries within `radiusM` metres of `centre` */
  withinRadius(centre: LatLon, radiusM: number): SpatialEntry<T>[] {
    // Approximate bounding degrees for fast MBR culling
    const dLat = radiusM / 111_320;
    const dLon = radiusM / (111_320 * Math.cos(centre.latitude * (Math.PI / 180)));
    const candidates = this.searchBox(
      centre.latitude - dLat, centre.latitude + dLat,
      centre.longitude - dLon, centre.longitude + dLon
    );
    return candidates.filter((e) => haversineM(centre, e.coord) <= radiusM);
  }

  private _search(node: RTreeNode<T>, q: MBR, out: SpatialEntry<T>[]): void {
    if (!intersects(node.mbr, q) && this._count > 0) return;
    if (node.leaf) {
      const e = node as Extract<RTreeNode<T>, { leaf: true }>;
      for (const entry of e.entries) {
        if (containsPoint(q, entry.coord)) out.push(entry);
      }
    } else {
      const e = node as Extract<RTreeNode<T>, { leaf: false }>;
      for (const child of e.children) this._search(child, q, out);
    }
  }
}
