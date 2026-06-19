export const gridAssetTypes = [
  { value: "substation", label: "Substation" },
  { value: "transmission_line", label: "Transmission line" },
  { value: "generation_asset", label: "Generation asset" },
  { value: "switching_station", label: "Switching station" },
  { value: "distribution_substation", label: "Distribution substation" },
  { value: "interconnection_point", label: "Interconnection point" },
  { value: "major_road", label: "Major road" },
  { value: "water_source", label: "Water source" },
  { value: "other", label: "Other" },
] as const;

export const confidenceLevels = [
  { value: "unknown", label: "Unknown" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
] as const;

export const mapRadiusMiles = [1, 5, 10, 25, 50] as const;

export type GridAssetType = (typeof gridAssetTypes)[number]["value"];
export type ConfidenceLevel = (typeof confidenceLevels)[number]["value"];

export const osmFallbackMapStyle = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster" as const,
      source: "osm",
    },
  ],
};

export const configuredMapLayerSources = {
  environmentalConstraints: process.env.NEXT_PUBLIC_ENV_CONSTRAINT_LAYER_SOURCE_URL ?? "",
  grid: process.env.NEXT_PUBLIC_GRID_LAYER_SOURCE_URL ?? "",
  parcels: process.env.NEXT_PUBLIC_PARCEL_LAYER_SOURCE_URL ?? "",
};

export function getMapStyle() {
  return process.env.NEXT_PUBLIC_MAP_STYLE_URL || osmFallbackMapStyle;
}

export type GridAssetDraft = {
  analystNotes: string;
  assetName: string;
  assetType: GridAssetType;
  confidenceLevel: ConfidenceLevel;
  isCandidatePoi: boolean;
  latitude: string;
  longitude: string;
  ownerOperator: string;
  rationale: string;
  source: string;
  voltageKv: string;
};

export type GridAssetRecord = {
  analyst_notes: string | null;
  asset_name: string;
  asset_type: GridAssetType;
  confidence_level: ConfidenceLevel;
  created_at: string;
  distance_miles: number | null;
  id: string;
  is_candidate_poi: boolean;
  latitude: number;
  longitude: number;
  owner_operator: string | null;
  rationale: string | null;
  site_assessment_id: string;
  site_id: string;
  source: string | null;
  updated_at: string;
  voltage_kv: number | null;
};

export type GeospatialPolygonGeometry =
  | { coordinates: number[][][]; type: "Polygon" }
  | { coordinates: number[][][][]; type: "MultiPolygon" };

export type SiteGeospatialContext = {
  coverage_status: "no_active_dataset_match" | "territory_and_zone_matched" | "territory_matched_zone_unavailable" | "zone_matched_territory_unavailable";
  pricing_zone: string | null;
  territory_dataset_key: string | null;
  territory_dataset_name: string | null;
  territory_dataset_version: string | null;
  territory_geojson: GeospatialPolygonGeometry | null;
  territory_limitations: string | null;
  territory_source_url: string | null;
  tsp_name: string | null;
  utility_confidence: "high" | "low" | "medium" | null;
  utility_name: string | null;
  zone_confidence: "high" | "low" | "medium" | null;
  zone_dataset_key: string | null;
  zone_dataset_name: string | null;
  zone_dataset_version: string | null;
  zone_geojson: GeospatialPolygonGeometry | null;
  zone_limitations: string | null;
  zone_source_url: string | null;
};

export type GeospatialContextFeatureCollection = {
  features: Array<{
    geometry: GeospatialPolygonGeometry;
    properties: { kind: "market_zone" | "utility_territory"; label: string };
    type: "Feature";
  }>;
  type: "FeatureCollection";
};

type RadiusFeature = {
  geometry: {
    coordinates: number[][][];
    type: "Polygon";
  };
  properties: {
    label: string;
    radiusMiles: number;
  };
  type: "Feature";
};

export type RadiusFeatureCollection = {
  features: RadiusFeature[];
  type: "FeatureCollection";
};

export const blankGridAssetDraft: GridAssetDraft = {
  analystNotes: "",
  assetName: "",
  assetType: "substation",
  confidenceLevel: "unknown",
  isCandidatePoi: false,
  latitude: "",
  longitude: "",
  ownerOperator: "",
  rationale: "",
  source: "",
  voltageKv: "",
};

export function gridAssetTypeLabel(value: string) {
  return gridAssetTypes.find((item) => item.value === value)?.label ?? value.replaceAll("_", " ");
}

export function confidenceLevelLabel(value: string) {
  return confidenceLevels.find((item) => item.value === value)?.label ?? value;
}

export function geospatialCoverageLabel(status: SiteGeospatialContext["coverage_status"]) {
  return {
    no_active_dataset_match: "No active dataset match",
    territory_and_zone_matched: "Territory and zone matched",
    territory_matched_zone_unavailable: "Territory matched; zone unavailable",
    zone_matched_territory_unavailable: "Zone matched; territory unavailable",
  }[status];
}

export function createGeospatialContextFeatureCollection(
  context: SiteGeospatialContext | null | undefined,
): GeospatialContextFeatureCollection {
  if (!context) {
    return { type: "FeatureCollection", features: [] };
  }

  const features: GeospatialContextFeatureCollection["features"] = [];

  if (context.territory_geojson) {
    features.push({
      type: "Feature",
      geometry: context.territory_geojson,
      properties: {
        kind: "utility_territory",
        label: context.utility_name ?? "Utility territory",
      },
    });
  }

  if (context.zone_geojson) {
    features.push({
      type: "Feature",
      geometry: context.zone_geojson,
      properties: {
        kind: "market_zone",
        label: context.pricing_zone ?? "Market zone",
      },
    });
  }

  return { type: "FeatureCollection", features };
}

export function parseNumericInput(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

export function hasValidCoordinatePair(latitude: number | null | undefined, longitude: number | null | undefined) {
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

type CoordinateValidationResult =
  | { error: string; latitude?: never; longitude?: never }
  | { error?: never; latitude: number; longitude: number };

export function validateCoordinateInputs(latitudeValue: string, longitudeValue: string): CoordinateValidationResult {
  const latitude = parseNumericInput(latitudeValue);
  const longitude = parseNumericInput(longitudeValue);

  if (latitude === null || longitude === null) {
    return { error: "Latitude and longitude are required numeric values." };
  }

  if (latitude < -90 || latitude > 90) {
    return { error: "Latitude must be between -90 and 90." };
  }

  if (longitude < -180 || longitude > 180) {
    return { error: "Longitude must be between -180 and 180." };
  }

  return { latitude, longitude };
}

export function calculateDistanceMiles(
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number,
) {
  const earthRadiusMiles = 3958.7613;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLatitude = toRadians(toLatitude - fromLatitude);
  const deltaLongitude = toRadians(toLongitude - fromLongitude);
  const fromLatitudeRadians = toRadians(fromLatitude);
  const toLatitudeRadians = toRadians(toLatitude);
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(fromLatitudeRadians) * Math.cos(toLatitudeRadians) * Math.sin(deltaLongitude / 2) ** 2;

  return 2 * earthRadiusMiles * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

export function formatDistanceMiles(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Not calculated";
  }

  if (value < 10) {
    return `${value.toFixed(1)} mi`;
  }

  return `${Math.round(value)} mi`;
}

export function externalMapUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
}

export function createRadiusFeatureCollection(latitude: number, longitude: number): RadiusFeatureCollection {
  const pointCount = 96;
  const milesPerDegreeLatitude = 69;
  const longitudeScale = Math.max(0.1, Math.cos((latitude * Math.PI) / 180));

  return {
    type: "FeatureCollection",
    features: mapRadiusMiles.map((radiusMiles) => {
      const coordinates = Array.from({ length: pointCount + 1 }, (_, index) => {
        const angle = (index / pointCount) * Math.PI * 2;
        const latitudeOffset = (Math.sin(angle) * radiusMiles) / milesPerDegreeLatitude;
        const longitudeOffset = (Math.cos(angle) * radiusMiles) / (milesPerDegreeLatitude * longitudeScale);

        return [longitude + longitudeOffset, latitude + latitudeOffset];
      });

      return {
        type: "Feature",
        properties: {
          label: `${radiusMiles} mi`,
          radiusMiles,
        },
        geometry: {
          type: "Polygon",
          coordinates: [coordinates],
        },
      };
    }),
  };
}
