import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const DATASET_KEY = "puct_iou_service_areas";
const SOURCE_URL = "https://services6.arcgis.com/N6Lzvtb46cpxThhu/ArcGIS/rest/services/IOU/FeatureServer/300";
const QUERY_URL = new URL(`${SOURCE_URL}/query`);

QUERY_URL.search = new URLSearchParams({
  f: "geojson",
  outFields: "OBJECTID,COMPANY_NAME,COMPANY_ABBREVIATION,COMPANY_TYPE,COMPANY_WEBSITE,ISO_RTO,DATA_SOURCE,DATA_SOURCE_DATE",
  outSR: "4326",
  returnGeometry: "true",
  where: "1=1",
}).toString();

function normalizeGeometry(geometry) {
  if (!geometry || !["Polygon", "MultiPolygon"].includes(geometry.type)) {
    return null;
  }

  return geometry;
}

export function normalizePuctFeatures(featureCollection) {
  if (featureCollection?.type !== "FeatureCollection" || !Array.isArray(featureCollection.features)) {
    throw new Error("The PUCT endpoint did not return a GeoJSON FeatureCollection.");
  }

  const features = featureCollection.features.flatMap((feature) => {
    const geometry = normalizeGeometry(feature.geometry);
    const source = feature.properties ?? {};
    const utilityName = String(source.COMPANY_NAME ?? "").trim();

    if (!geometry || !utilityName) {
      return [];
    }

    return [{
      type: "Feature",
      geometry,
      properties: {
        confidence_level: "medium",
        market_region: String(source.ISO_RTO ?? "").toUpperCase().includes("ERCOT") ? "ERCOT" : String(source.ISO_RTO ?? "Texas"),
        metadata: {
          company_abbreviation: source.COMPANY_ABBREVIATION ?? null,
          company_website: source.COMPANY_WEBSITE ?? null,
          data_source: source.DATA_SOURCE ?? null,
          data_source_date: source.DATA_SOURCE_DATE ?? null,
          iso_rto: source.ISO_RTO ?? null,
        },
        priority: 100,
        source_feature_id: String(source.OBJECTID ?? feature.id ?? utilityName),
        tsp_name: null,
        utility_name: utilityName,
        utility_type: source.COMPANY_TYPE ?? "investor_owned_utility",
      },
    }];
  });

  if (features.length === 0) {
    throw new Error("The PUCT endpoint returned no usable utility polygons.");
  }

  return features;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const response = await fetch(QUERY_URL, { headers: { accept: "application/geo+json, application/json" } });

  if (!response.ok) {
    throw new Error(`PUCT download failed with HTTP ${response.status}.`);
  }

  const features = normalizePuctFeatures(await response.json());
  const checksum = createHash("sha256").update(JSON.stringify(features)).digest("hex");

  if (dryRun) {
    console.log(JSON.stringify({ checksumSha256: checksum, datasetKey: DATASET_KEY, featureCount: features.length }, null, 2));
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before importing.");
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.rpc("replace_utility_territory_dataset", {
    p_checksum_sha256: checksum,
    p_dataset_key: DATASET_KEY,
    p_features: features,
  });

  if (error) {
    throw error;
  }

  console.log(JSON.stringify({ checksumSha256: checksum, datasetKey: DATASET_KEY, importedFeatureCount: data }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
