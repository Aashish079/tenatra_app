import { useMemo } from "react";
import { Region } from "react-native-maps";
import Supercluster, { ClusterFeature, PointFeature } from "supercluster";

export interface MarkerPoint {
  id: string;
  name: string;
  coordinate: { latitude: number; longitude: number };
  type: string;
}

export interface ClusterItem {
  /** true when this item represents a cluster of multiple markers */
  isCluster: true;
  clusterId: number;
  coordinate: { latitude: number; longitude: number };
  count: number;
}

export interface MarkerItem extends MarkerPoint {
  isCluster: false;
}

export type ClusteredItem = ClusterItem | MarkerItem;

/**
 * Derive a supercluster zoom level from the map's latitudeDelta.
 * latitudeDelta ~ 360 / 2^zoom  →  zoom = log2(360 / latitudeDelta)
 */
function zoomFromLatitudeDelta(latitudeDelta: number): number {
  if (!latitudeDelta || latitudeDelta <= 0) return 10;
  const zoom = Math.log2(360 / latitudeDelta);
  return Math.min(Math.max(Math.round(zoom), 1), 20);
}

/**
 * Hook that builds and queries a Supercluster instance.
 *
 * - The Supercluster instance (and GeoJSON load) is memoised and only rebuilt
 *   when the `markers` array reference changes.
 * - The cluster query is cheap and re-runs whenever `region` changes.
 */
export function useClusteredMarkers(
  markers: MarkerPoint[],
  region: Region | null,
): ClusteredItem[] {
  // Build + load the supercluster only when the markers array changes.
  const cluster = useMemo(() => {
    const sc = new Supercluster<{ marker: MarkerPoint }>({
      radius: 100,
      maxZoom: 20,
    });

    const points: PointFeature<{ marker: MarkerPoint }>[] = markers.map(
      (m) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [m.coordinate.longitude, m.coordinate.latitude],
        },
        properties: { marker: m },
      }),
    );

    sc.load(points);
    return sc;
  }, [markers]);

  return useMemo(() => {
    if (!region) return [];

    const zoom = zoomFromLatitudeDelta(region.latitudeDelta);

    const westLon = region.longitude - region.longitudeDelta / 2;
    const eastLon = region.longitude + region.longitudeDelta / 2;
    const southLat = region.latitude - region.latitudeDelta / 2;
    const northLat = region.latitude + region.latitudeDelta / 2;

    const features = cluster.getClusters(
      [westLon, southLat, eastLon, northLat],
      zoom,
    ) as Array<
      | ClusterFeature<{ marker: MarkerPoint }>
      | PointFeature<{ marker: MarkerPoint }>
    >;
    console.log("Zoom:", zoom);
    console.log("Region:", region);
    console.log("Total features:", features.length);
    console.log(
      "Clusters:",
      features.filter((f) => "cluster" in f.properties && f.properties.cluster)
        .length,
    );

    return features.map((f): ClusteredItem => {
      const [lon, lat] = f.geometry.coordinates;
      if ("cluster" in f.properties && f.properties.cluster) {
        const cf = f as ClusterFeature<{ marker: MarkerPoint }>;
        return {
          isCluster: true,
          clusterId: cf.properties.cluster_id,
          coordinate: { latitude: lat, longitude: lon },
          count: cf.properties.point_count,
        };
      }
      const pf = f as PointFeature<{ marker: MarkerPoint }>;
      return {
        isCluster: false,
        ...pf.properties.marker,
      };
    });
  }, [cluster, region]);
}
