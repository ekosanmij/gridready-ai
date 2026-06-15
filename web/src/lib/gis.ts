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
