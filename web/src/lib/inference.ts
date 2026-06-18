import type { GridAssetRecord } from "@/lib/gis";

export type TerritoryInference = {
  confidence_level: "high" | "medium" | "low";
  source_name: string;
  source_url: string | null;
  tsp_name: string | null;
  utility_name: string;
};

export type InferredValue = {
  confidence: "high" | "medium" | "low";
  field: "known_tsp" | "known_utility";
  rationale: string;
  source: string;
  value: string;
};

export function deriveUtilityTspSuggestions(
  territory: TerritoryInference | null,
  assets: GridAssetRecord[],
  current: { known_tsp: string | null; known_utility: string | null },
): InferredValue[] {
  const suggestions: InferredValue[] = [];

  if (territory?.utility_name && territory.utility_name !== current.known_utility) {
    suggestions.push({
      confidence: territory.confidence_level,
      field: "known_utility",
      rationale: `The site coordinate falls inside the indexed ${territory.utility_name} service territory.`,
      source: territory.source_url || territory.source_name,
      value: territory.utility_name,
    });
  }

  if (territory?.tsp_name && territory.tsp_name !== current.known_tsp) {
    suggestions.push({
      confidence: territory.confidence_level,
      field: "known_tsp",
      rationale: `The matched utility territory identifies ${territory.tsp_name} as the associated TSP.`,
      source: territory.source_url || territory.source_name,
      value: territory.tsp_name,
    });
  }

  if (!suggestions.some((item) => item.field === "known_tsp")) {
    const nearestOwnedAsset = [...assets]
      .filter((asset) => asset.owner_operator?.trim() && ["substation", "transmission_line", "switching_station"].includes(asset.asset_type))
      .sort((first, second) => (first.distance_miles ?? Number.MAX_VALUE) - (second.distance_miles ?? Number.MAX_VALUE))[0];

    if (nearestOwnedAsset?.owner_operator && nearestOwnedAsset.owner_operator !== current.known_tsp) {
      suggestions.push({
        confidence: nearestOwnedAsset.distance_miles !== null && nearestOwnedAsset.distance_miles <= 10 ? "medium" : "low",
        field: "known_tsp",
        rationale: `${nearestOwnedAsset.asset_name} is the nearest owned transmission asset (${nearestOwnedAsset.distance_miles?.toFixed(1) ?? "unknown"} mi). Confirm with the provider before relying on it.`,
        source: nearestOwnedAsset.source || "Assessment grid asset inventory",
        value: nearestOwnedAsset.owner_operator,
      });
    }
  }

  return suggestions;
}
