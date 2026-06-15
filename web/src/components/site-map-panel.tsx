"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, MapPin, Plus, RadioTower, Save, Waypoints } from "lucide-react";
import {
  ConfidenceLevel,
  GridAssetDraft,
  GridAssetRecord,
  GridAssetType,
  confidenceLevelLabel,
  confidenceLevels,
  createRadiusFeatureCollection,
  formatDistanceMiles,
  gridAssetTypeLabel,
  gridAssetTypes,
  hasValidCoordinatePair,
  mapRadiusMiles,
} from "@/lib/gis";

type SiteMapPanelProps = {
  assetDraft: GridAssetDraft;
  assets: GridAssetRecord[];
  error: string;
  knownSubstationOrPoi: string | null;
  knownTsp: string | null;
  knownUtility: string | null;
  marketRegion: string;
  onAssetDraftChange: (value: GridAssetDraft) => void;
  onAssetSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  site: {
    address: string | null;
    city: string | null;
    county: string | null;
    latitude: number | null;
    longitude: number | null;
    parcelId: string | null;
    siteName: string;
    state: string | null;
  } | null;
};

const inputClass =
  "h-11 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#1b365d] focus:ring-2 focus:ring-[#1b365d]/20";
const textareaClass =
  "w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#1b365d] focus:ring-2 focus:ring-[#1b365d]/20";
const primaryButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#1b365d] px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#142844] focus:outline-none focus:ring-2 focus:ring-[#1b365d]/30 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400";

const baseMapStyle = {
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

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-sm font-semibold text-slate-700">{children}</span>;
}

function ContextLine({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-md border border-slate-200 bg-[#f8faf7] px-3 py-2">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-slate-800">{value || "Not set"}</p>
    </div>
  );
}

function sortAssets(assets: GridAssetRecord[]) {
  return [...assets].sort((first, second) => {
    if (first.distance_miles === null && second.distance_miles === null) {
      return first.asset_name.localeCompare(second.asset_name);
    }

    if (first.distance_miles === null) {
      return 1;
    }

    if (second.distance_miles === null) {
      return -1;
    }

    return first.distance_miles - second.distance_miles;
  });
}

function createMarkerElement(kind: "asset" | "candidate" | "site") {
  const marker = document.createElement("div");

  marker.className = cx(
    "flex h-5 w-5 items-center justify-center rounded-full border-2 border-white shadow-md",
    kind === "site" && "bg-[#1b365d]",
    kind === "asset" && "bg-emerald-500",
    kind === "candidate" && "bg-amber-400",
  );

  const inner = document.createElement("div");
  inner.className = "h-1.5 w-1.5 rounded-full bg-white";
  marker.appendChild(inner);

  return marker;
}

export function SiteMapPanel({
  assetDraft,
  assets,
  error,
  knownSubstationOrPoi,
  knownTsp,
  knownUtility,
  marketRegion,
  onAssetDraftChange,
  onAssetSubmit,
  saving,
  site,
}: SiteMapPanelProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const [mapError, setMapError] = useState("");

  const siteHasCoordinates = hasValidCoordinatePair(site?.latitude, site?.longitude);
  const sortedAssets = useMemo(() => sortAssets(assets), [assets]);

  useEffect(() => {
    const siteLatitude = site?.latitude;
    const siteLongitude = site?.longitude;
    const siteName = site?.siteName || "Site";

    if (
      !mapContainerRef.current ||
      !siteHasCoordinates ||
      siteLatitude === null ||
      siteLatitude === undefined ||
      siteLongitude === null ||
      siteLongitude === undefined
    ) {
      return;
    }

    const latitude = siteLatitude;
    const longitude = siteLongitude;
    let disposed = false;
    const markers: import("maplibre-gl").Marker[] = [];

    async function initialiseMap() {
      try {
        const maplibre = await import("maplibre-gl");

        if (
          disposed ||
          !mapContainerRef.current
        ) {
          return;
        }

        const map = new maplibre.default.Map({
          attributionControl: false,
          center: [longitude, latitude],
          container: mapContainerRef.current,
          maxZoom: 16,
          minZoom: 3,
          style: baseMapStyle,
          zoom: 8,
        });

        mapRef.current = map;
        map.addControl(new maplibre.default.NavigationControl({ showCompass: false }), "top-right");
        map.addControl(new maplibre.default.AttributionControl({ compact: true }), "bottom-right");

        map.on("error", () => setMapError("Map tiles could not be loaded."));
        map.on("load", () => {
          if (disposed) {
            return;
          }

          const rings = createRadiusFeatureCollection(latitude, longitude);

          map.addSource("radius-rings", {
            type: "geojson",
            data: rings,
          });
          map.addLayer({
            id: "radius-rings-line",
            type: "line",
            source: "radius-rings",
            paint: {
              "line-color": "#1b365d",
              "line-dasharray": [2, 2],
              "line-opacity": 0.55,
              "line-width": 1.2,
            },
          });

          markers.push(
            new maplibre.default.Marker({ element: createMarkerElement("site") })
              .setLngLat([longitude, latitude])
              .setPopup(new maplibre.default.Popup({ closeButton: false }).setText(`${siteName} marker`))
              .addTo(map),
          );

          const bounds = new maplibre.default.LngLatBounds([longitude, latitude], [longitude, latitude]);

          sortedAssets.forEach((asset) => {
            if (!hasValidCoordinatePair(asset.latitude, asset.longitude)) {
              return;
            }

            markers.push(
              new maplibre.default.Marker({
                element: createMarkerElement(asset.is_candidate_poi ? "candidate" : "asset"),
              })
                .setLngLat([asset.longitude, asset.latitude])
                .setPopup(
                  new maplibre.default.Popup({ closeButton: false }).setText(
                    `${asset.asset_name} · ${gridAssetTypeLabel(asset.asset_type)} · ${formatDistanceMiles(asset.distance_miles)}`,
                  ),
                )
                .addTo(map),
            );
            bounds.extend([asset.longitude, asset.latitude]);
          });

          if (sortedAssets.length > 0) {
            map.fitBounds(bounds, { maxZoom: 10, padding: 72 });
          }
        });
      } catch {
        setMapError("Map could not be initialized.");
      }
    }

    void initialiseMap();

    return () => {
      disposed = true;
      markers.forEach((marker) => marker.remove());
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [site?.latitude, site?.longitude, site?.siteName, siteHasCoordinates, sortedAssets]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1b365d]/10 text-[#1b365d]">
              <MapPin size={18} />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-[#10243f]">GIS site context</h3>
              <p className="truncate text-sm text-slate-600">{site?.siteName || "Site location pending"}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
            {mapRadiusMiles.map((radius) => (
              <span key={radius} className="rounded-md border border-slate-200 bg-[#f8faf7] px-2 py-1">
                {radius} mi
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-[#eef3ef]">
          {siteHasCoordinates ? (
            <div className="relative h-[420px] min-h-[320px]">
              <div ref={mapContainerRef} className="h-full w-full" />
              {mapError ? (
                <div className="absolute left-3 top-3 flex max-w-sm items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 shadow-sm">
                  <AlertCircle className="mt-0.5 shrink-0" size={16} />
                  <span>{mapError}</span>
                </div>
              ) : null}
              <div className="absolute bottom-3 left-3 flex flex-wrap gap-2 rounded-md border border-slate-200 bg-white/92 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#1b365d]" />
                  Site
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  Asset
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  Candidate POI
                </span>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[320px] items-center justify-center p-6 text-center">
              <div className="max-w-md">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-[#1b365d]/10 text-[#1b365d]">
                  <MapPin size={22} />
                </div>
                <h4 className="text-base font-semibold text-[#10243f]">Coordinates needed</h4>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {site?.address || [site?.city, site?.county, site?.state].filter(Boolean).join(", ") || "No usable address or coordinates are attached."}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <ContextLine label="Market" value={marketRegion} />
          <ContextLine label="Utility" value={knownUtility} />
          <ContextLine label="TSP" value={knownTsp} />
          <ContextLine label="Known POI" value={knownSubstationOrPoi} />
          <ContextLine label="Parcel" value={site?.parcelId} />
          <ContextLine
            label="Coordinates"
            value={siteHasCoordinates ? `${site?.latitude}, ${site?.longitude}` : null}
          />
        </div>
      </div>

      <div className="border-t border-slate-200 p-4">
        {error ? (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            <p>{error}</p>
          </div>
        ) : null}

        <form onSubmit={onAssetSubmit} className="grid gap-3 lg:grid-cols-4">
          <label className="block lg:col-span-2">
            <FieldLabel>Asset name</FieldLabel>
            <input
              value={assetDraft.assetName}
              onChange={(event) => onAssetDraftChange({ ...assetDraft, assetName: event.target.value })}
              className={inputClass}
              required
            />
          </label>
          <label className="block">
            <FieldLabel>Asset type</FieldLabel>
            <select
              value={assetDraft.assetType}
              onChange={(event) => onAssetDraftChange({ ...assetDraft, assetType: event.target.value as GridAssetType })}
              className={inputClass}
            >
              {gridAssetTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <FieldLabel>Confidence</FieldLabel>
            <select
              value={assetDraft.confidenceLevel}
              onChange={(event) => onAssetDraftChange({ ...assetDraft, confidenceLevel: event.target.value as ConfidenceLevel })}
              className={inputClass}
            >
              {confidenceLevels.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <FieldLabel>Latitude</FieldLabel>
            <input
              value={assetDraft.latitude}
              onChange={(event) => onAssetDraftChange({ ...assetDraft, latitude: event.target.value })}
              inputMode="decimal"
              className={inputClass}
              required
            />
          </label>
          <label className="block">
            <FieldLabel>Longitude</FieldLabel>
            <input
              value={assetDraft.longitude}
              onChange={(event) => onAssetDraftChange({ ...assetDraft, longitude: event.target.value })}
              inputMode="decimal"
              className={inputClass}
              required
            />
          </label>
          <label className="block">
            <FieldLabel>Voltage kV</FieldLabel>
            <input
              value={assetDraft.voltageKv}
              onChange={(event) => onAssetDraftChange({ ...assetDraft, voltageKv: event.target.value })}
              inputMode="decimal"
              className={inputClass}
            />
          </label>
          <label className="flex items-end">
            <span className="inline-flex h-11 w-full items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">
              <input
                checked={assetDraft.isCandidatePoi}
                onChange={(event) => onAssetDraftChange({ ...assetDraft, isCandidatePoi: event.target.checked })}
                type="checkbox"
                className="h-4 w-4 accent-[#1b365d]"
              />
              Candidate POI
            </span>
          </label>
          <label className="block lg:col-span-2">
            <FieldLabel>Owner/operator</FieldLabel>
            <input
              value={assetDraft.ownerOperator}
              onChange={(event) => onAssetDraftChange({ ...assetDraft, ownerOperator: event.target.value })}
              className={inputClass}
            />
          </label>
          <label className="block lg:col-span-2">
            <FieldLabel>Source</FieldLabel>
            <input
              value={assetDraft.source}
              onChange={(event) => onAssetDraftChange({ ...assetDraft, source: event.target.value })}
              className={inputClass}
            />
          </label>
          <label className="block lg:col-span-2">
            <FieldLabel>Rationale</FieldLabel>
            <textarea
              value={assetDraft.rationale}
              onChange={(event) => onAssetDraftChange({ ...assetDraft, rationale: event.target.value })}
              rows={3}
              className={textareaClass}
            />
          </label>
          <label className="block lg:col-span-2">
            <FieldLabel>Analyst notes</FieldLabel>
            <textarea
              value={assetDraft.analystNotes}
              onChange={(event) => onAssetDraftChange({ ...assetDraft, analystNotes: event.target.value })}
              rows={3}
              className={textareaClass}
            />
          </label>
          <div className="lg:col-span-4">
            <button type="submit" disabled={saving || !assetDraft.assetName.trim()} className={primaryButtonClass}>
              {saving ? <Save className="animate-pulse" size={16} /> : <Plus size={16} />}
              Add grid asset
            </button>
          </div>
        </form>
      </div>

      <div className="border-t border-slate-200">
        <div className="flex items-center gap-2 px-4 py-3">
          <RadioTower size={16} className="text-[#1b365d]" />
          <h4 className="text-sm font-semibold text-[#10243f]">Grid assets and candidate POIs</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead className="bg-[#f8faf7] text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Asset</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Distance</th>
                <th className="px-4 py-3 font-semibold">Voltage</th>
                <th className="px-4 py-3 font-semibold">Owner/operator</th>
                <th className="px-4 py-3 font-semibold">Confidence</th>
                <th className="px-4 py-3 font-semibold">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedAssets.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={7}>
                    No grid assets yet
                  </td>
                </tr>
              ) : null}
              {sortedAssets.map((asset) => (
                <tr key={asset.id} className="transition hover:bg-[#f8faf7]">
                  <td className="max-w-[240px] px-4 py-3">
                    <div className="flex items-start gap-2">
                      <Waypoints size={16} className="mt-0.5 shrink-0 text-[#1b365d]" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{asset.asset_name}</p>
                        {asset.is_candidate_poi ? (
                          <span className="mt-1 inline-flex rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            Candidate POI
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{gridAssetTypeLabel(asset.asset_type)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{formatDistanceMiles(asset.distance_miles)}</td>
                  <td className="px-4 py-3 text-slate-700">{asset.voltage_kv !== null ? `${asset.voltage_kv} kV` : "Not set"}</td>
                  <td className="max-w-[180px] px-4 py-3 text-slate-700">
                    <span className="block truncate">{asset.owner_operator || "Not set"}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{confidenceLevelLabel(asset.confidence_level)}</td>
                  <td className="max-w-[220px] px-4 py-3 text-slate-700">
                    <span className="block truncate">{asset.source || "Not set"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
