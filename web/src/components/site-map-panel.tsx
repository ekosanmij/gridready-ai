"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Layers3,
  Loader2,
  LocateFixed,
  MapPin,
  Plus,
  RadioTower,
  RefreshCw,
  Save,
  Waypoints,
  ZoomIn,
} from "lucide-react";
import {
  ConfidenceLevel,
  GridAssetDraft,
  GridAssetRecord,
  GridAssetType,
  SiteGeospatialContext,
  calculateDistanceMiles,
  confidenceLevelLabel,
  confidenceLevels,
  createGeospatialContextFeatureCollection,
  createRadiusFeatureCollection,
  externalMapUrl,
  formatDistanceMiles,
  geospatialCoverageLabel,
  getMapStyle,
  gridAssetTypeLabel,
  gridAssetTypes,
  hasValidCoordinatePair,
  mapRadiusMiles,
  parseNumericInput,
} from "@/lib/gis";
import {
  cx,
  inputClass,
  panelClass,
  primaryButtonClass,
  secondaryButtonClass,
  textareaClass,
} from "@/components/ui-primitives";
import { trackWorkflowEvent } from "@/lib/workflow-analytics";

type SiteMapPanelProps = {
  assessmentId: string;
  assetDraft: GridAssetDraft;
  assets: GridAssetRecord[];
  contextError?: string;
  contextLoading?: boolean;
  editable?: boolean;
  error: string;
  geospatialContext?: SiteGeospatialContext | null;
  knownSubstationOrPoi: string | null;
  knownTsp: string | null;
  knownUtility: string | null;
  marketRegion: string;
  onAssetDraftChange: (value: GridAssetDraft) => void;
  onAssetFocus?: (assetId: string) => void;
  onAssetSubmit: (event: FormEvent<HTMLFormElement>) => void;
  recentlySavedAssetId?: string;
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

type MapLifecycleStatus = "error" | "idle" | "loading" | "ready";

type MapLayerVisibility = {
  candidatePois: boolean;
  marketZone: boolean;
  radiusRings: boolean;
  savedAssets: boolean;
  siteMarker: boolean;
  utilityTerritory: boolean;
};

type MaplibreMap = import("maplibre-gl").Map;
type MaplibreMarker = import("maplibre-gl").Marker;

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-sm font-semibold text-[var(--color-text-primary)]">{children}</span>;
}

function ContextLine({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2">
      <p className="text-xs font-semibold uppercase text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-[var(--color-text-primary)]">{value || "Not set"}</p>
    </div>
  );
}

function DatasetSourceCard({
  label,
  limitations,
  name,
  sourceUrl,
  version,
}: {
  label: string;
  limitations: string | null | undefined;
  name: string | null | undefined;
  sourceUrl: string | null | undefined;
  version: string | null | undefined;
}) {
  if (!name) {
    return (
      <div className="rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-3">
        <p className="text-xs font-semibold uppercase text-[var(--color-text-secondary)]">{label}</p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">No active governed dataset matched this site.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-3">
      <p className="text-xs font-semibold uppercase text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{name}</p>
      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Version {version ?? "unversioned"}</p>
      {limitations ? <p className="mt-2 text-xs leading-5 text-[var(--color-text-secondary)]">{limitations}</p> : null}
      {sourceUrl ? (
        <a href={sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-brand-primary)] hover:underline">
          <ExternalLink size={13} /> Source
        </a>
      ) : null}
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
  const marker = document.createElement("button");

  marker.type = "button";
  marker.className = cx(
    "flex h-6 w-6 items-center justify-center rounded-full border-2 border-white shadow-md transition focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2",
    kind === "site" && "bg-[var(--color-map-site)]",
    kind === "asset" && "bg-[var(--color-map-asset)]",
    kind === "candidate" && "bg-[var(--color-map-candidate)]",
  );

  const inner = document.createElement("span");
  inner.className = "h-1.5 w-1.5 rounded-full bg-white";
  marker.appendChild(inner);

  return marker;
}

function escapeHtml(value: string | null | undefined) {
  return (value || "Not set")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function assetPopupHtml(asset: GridAssetRecord) {
  return `
    <div style="font-family: inherit; min-width: 190px;">
      <div style="font-weight: 700; color: var(--color-text-primary); margin-bottom: 6px;">${escapeHtml(asset.asset_name)}</div>
      <div style="font-size: 12px; line-height: 1.6; color: var(--color-text-secondary);">
        <div><strong>Type:</strong> ${escapeHtml(gridAssetTypeLabel(asset.asset_type))}</div>
        <div><strong>Distance:</strong> ${escapeHtml(formatDistanceMiles(asset.distance_miles))}</div>
        <div><strong>Voltage:</strong> ${asset.voltage_kv !== null ? `${asset.voltage_kv} kV` : "Not set"}</div>
        <div><strong>Confidence:</strong> ${escapeHtml(confidenceLevelLabel(asset.confidence_level))}</div>
        <div><strong>Source:</strong> ${escapeHtml(asset.source)}</div>
      </div>
    </div>
  `;
}

function layerIsVisible(asset: GridAssetRecord, layers: MapLayerVisibility) {
  return asset.is_candidate_poi ? layers.candidatePois : layers.savedAssets;
}

export function SiteMapPanel({
  assessmentId,
  assetDraft,
  assets,
  contextError = "",
  contextLoading = false,
  editable = true,
  error,
  geospatialContext = null,
  knownSubstationOrPoi,
  knownTsp,
  knownUtility,
  marketRegion,
  onAssetDraftChange,
  onAssetFocus,
  onAssetSubmit,
  recentlySavedAssetId,
  saving,
  site,
}: SiteMapPanelProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const markerRefs = useRef<{ assets: Map<string, MaplibreMarker>; site: MaplibreMarker | null }>({
    assets: new Map(),
    site: null,
  });
  const mapStyle = useMemo(() => getMapStyle(), []);
  const geospatialFeatures = useMemo(
    () => createGeospatialContextFeatureCollection(geospatialContext),
    [geospatialContext],
  );
  const [mapError, setMapError] = useState("");
  const [mapStatus, setMapStatus] = useState<MapLifecycleStatus>("idle");
  const [retryCount, setRetryCount] = useState(0);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [layerVisibility, setLayerVisibility] = useState<MapLayerVisibility>({
    candidatePois: true,
    marketZone: true,
    radiusRings: true,
    savedAssets: true,
    siteMarker: true,
    utilityTerritory: true,
  });

  const siteHasCoordinates = hasValidCoordinatePair(site?.latitude, site?.longitude);
  const sortedAssets = useMemo(() => sortAssets(assets), [assets]);
  const visibleAssetCount = sortedAssets.filter((asset) => layerIsVisible(asset, layerVisibility)).length;
  const assetLatitude = parseNumericInput(assetDraft.latitude);
  const assetLongitude = parseNumericInput(assetDraft.longitude);
  const distancePreview =
    siteHasCoordinates && hasValidCoordinatePair(assetLatitude, assetLongitude)
      ? calculateDistanceMiles(Number(site?.latitude), Number(site?.longitude), Number(assetLatitude), Number(assetLongitude))
      : null;
  const siteExternalMapUrl = siteHasCoordinates
    ? externalMapUrl(Number(site?.latitude), Number(site?.longitude))
    : "";

  useEffect(() => {
    const siteLatitude = site?.latitude;
    const siteLongitude = site?.longitude;
    const siteName = site?.siteName || "Site";
    const markerStore = markerRefs.current;

    markerStore.assets.forEach((marker) => marker.remove());
    markerStore.assets.clear();
    markerStore.site?.remove();
    markerStore.site = null;

    if (
      !mapContainerRef.current ||
      !siteHasCoordinates ||
      siteLatitude === null ||
      siteLatitude === undefined ||
      siteLongitude === null ||
      siteLongitude === undefined
    ) {
      mapRef.current?.remove();
      mapRef.current = null;
      return;
    }

    const latitude = siteLatitude;
    const longitude = siteLongitude;
    let disposed = false;
    let map: MaplibreMap | null = null;

    async function initialiseMap() {
      setMapStatus("loading");
      setMapError("");

      try {
        const maplibre = await import("maplibre-gl");

        if (disposed || !mapContainerRef.current) {
          return;
        }

        map = new maplibre.default.Map({
          attributionControl: false,
          center: [longitude, latitude],
          container: mapContainerRef.current,
          maxZoom: 16,
          minZoom: 3,
          style: mapStyle,
          zoom: 8,
        });

        mapRef.current = map;
        map.addControl(new maplibre.default.NavigationControl({ showCompass: false }), "top-right");
        map.addControl(new maplibre.default.AttributionControl({ compact: true }), "bottom-right");

        map.on("error", () => {
          if (!disposed) {
            setMapStatus("error");
            setMapError("Map tiles could not be loaded.");
          }
        });

        map.on("load", () => {
          if (disposed || !map) {
            return;
          }

          const rings = createRadiusFeatureCollection(latitude, longitude);

          if (!map.getSource("radius-rings")) {
            map.addSource("radius-rings", {
              type: "geojson",
              data: rings,
            });
          }

          if (!map.getLayer("radius-rings-line")) {
            const siteColor =
              window.getComputedStyle(document.documentElement).getPropertyValue("--color-map-site").trim() || "#1b365d";

            map.addLayer({
              id: "radius-rings-line",
              type: "line",
              source: "radius-rings",
              paint: {
                "line-color": siteColor,
                "line-dasharray": [2, 2],
                "line-opacity": 0.55,
                "line-width": 1.2,
              },
            });
          }

          if (geospatialFeatures.features.length > 0 && !map.getSource("governed-geospatial-context")) {
            map.addSource("governed-geospatial-context", {
              type: "geojson",
              data: geospatialFeatures,
            });
          }

          if (map.getSource("governed-geospatial-context") && !map.getLayer("utility-territory-fill")) {
            map.addLayer({
              id: "utility-territory-fill",
              type: "fill",
              source: "governed-geospatial-context",
              filter: ["==", ["get", "kind"], "utility_territory"],
              paint: {
                "fill-color": "#2563eb",
                "fill-opacity": 0.12,
                "fill-outline-color": "#1d4ed8",
              },
            });
          }

          if (map.getSource("governed-geospatial-context") && !map.getLayer("market-zone-fill")) {
            map.addLayer({
              id: "market-zone-fill",
              type: "fill",
              source: "governed-geospatial-context",
              filter: ["==", ["get", "kind"], "market_zone"],
              paint: {
                "fill-color": "#f59e0b",
                "fill-opacity": 0.1,
                "fill-outline-color": "#d97706",
              },
            });
          }

          const siteMarker = new maplibre.default.Marker({ element: createMarkerElement("site") })
            .setLngLat([longitude, latitude])
            .setPopup(new maplibre.default.Popup({ closeButton: false }).setText(`${siteName} marker`))
            .addTo(map);
          markerStore.site = siteMarker;

          const bounds = new maplibre.default.LngLatBounds([longitude, latitude], [longitude, latitude]);

          sortedAssets.forEach((asset) => {
            if (!hasValidCoordinatePair(asset.latitude, asset.longitude) || !map) {
              return;
            }

            const marker = new maplibre.default.Marker({
              element: createMarkerElement(asset.is_candidate_poi ? "candidate" : "asset"),
            })
              .setLngLat([asset.longitude, asset.latitude])
              .setPopup(new maplibre.default.Popup({ closeButton: false }).setHTML(assetPopupHtml(asset)))
              .addTo(map);

            marker.getElement().addEventListener("click", () => {
              setSelectedAssetId(asset.id);
              onAssetFocus?.(asset.id);
            });

            markerStore.assets.set(asset.id, marker);
            bounds.extend([asset.longitude, asset.latitude]);
          });

          if (sortedAssets.length > 0) {
            map.fitBounds(bounds, { maxZoom: 10, padding: 72 });
          }

          setMapStatus("ready");
        });
      } catch {
        if (!disposed) {
          setMapStatus("error");
          setMapError("Map could not be initialized.");
        }
      }
    }

    const timer = window.setTimeout(() => {
      void initialiseMap();
    }, 0);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      markerStore.assets.forEach((marker) => marker.remove());
      markerStore.assets.clear();
      markerStore.site?.remove();
      markerStore.site = null;
      map?.remove();
      if (mapRef.current === map) {
        mapRef.current = null;
      }
    };
  }, [
    mapStyle,
    geospatialFeatures,
    onAssetFocus,
    retryCount,
    site?.latitude,
    site?.longitude,
    site?.siteName,
    siteHasCoordinates,
    sortedAssets,
  ]);

  useEffect(() => {
    const map = mapRef.current;

    if (map?.getLayer("radius-rings-line")) {
      map.setLayoutProperty("radius-rings-line", "visibility", layerVisibility.radiusRings ? "visible" : "none");
    }

    if (map?.getLayer("utility-territory-fill")) {
      map.setLayoutProperty("utility-territory-fill", "visibility", layerVisibility.utilityTerritory ? "visible" : "none");
    }

    if (map?.getLayer("market-zone-fill")) {
      map.setLayoutProperty("market-zone-fill", "visibility", layerVisibility.marketZone ? "visible" : "none");
    }

    if (markerRefs.current.site) {
      markerRefs.current.site.getElement().style.display = layerVisibility.siteMarker ? "" : "none";
    }

    sortedAssets.forEach((asset) => {
      const marker = markerRefs.current.assets.get(asset.id);

      if (marker) {
        marker.getElement().style.display = layerIsVisible(asset, layerVisibility) ? "" : "none";
      }
    });
  }, [layerVisibility, sortedAssets]);

  function toggleLayer(layer: keyof MapLayerVisibility) {
    setLayerVisibility((current) => {
      const visible = !current[layer];
      trackWorkflowEvent("map_layer_toggled", {
        assessmentId,
        layer,
        visible,
      });

      return { ...current, [layer]: visible };
    });
  }

  function retryMap() {
    setRetryCount((current) => current + 1);
  }

  function zoomToAsset(asset: GridAssetRecord) {
    if (!hasValidCoordinatePair(asset.latitude, asset.longitude)) {
      return;
    }

    setSelectedAssetId(asset.id);
    onAssetFocus?.(asset.id);
    mapRef.current?.flyTo({ center: [asset.longitude, asset.latitude], essential: true, zoom: 11 });

    const popup = markerRefs.current.assets.get(asset.id)?.getPopup();
    if (popup && mapRef.current) {
      popup.addTo(mapRef.current);
    }
  }

  return (
    <section className={panelClass}>
      <div className="border-b border-[var(--color-border)] px-4 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary)]">
              <MapPin size={18} />
            </span>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">GIS site context</h3>
              <p className="truncate text-sm text-[var(--color-text-secondary)]">{site?.siteName || "Site location pending"}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--color-text-secondary)]">
            {siteHasCoordinates && siteExternalMapUrl ? (
              <a
                href={siteExternalMapUrl}
                target="_blank"
                rel="noreferrer"
                className={secondaryButtonClass}
              >
                <ExternalLink size={15} />
                Open map
              </a>
            ) : null}
            {mapRadiusMiles.map((radius) => (
              <span key={radius} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2 py-1">
                {radius} mi
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="min-w-0 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-map-canvas)]">
          {siteHasCoordinates ? (
            <div className="relative h-[360px] min-h-[320px] sm:h-[420px] xl:h-[480px]">
              <div ref={mapContainerRef} className="h-full w-full" />
              {mapStatus === "idle" || mapStatus === "loading" ? (
                <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-map-canvas)] p-6 backdrop-blur-[1px]">
                  <div className="w-full max-w-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-map-control-surface)] p-4 shadow-sm shadow-[var(--color-shadow)]">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-map-control-strong)]">
                      <Loader2 className="animate-spin" size={16} />
                      Loading map context
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 rounded-full bg-[var(--color-surface-strong)]" />
                      <div className="h-3 w-3/4 rounded-full bg-[var(--color-surface-strong)]" />
                      <div className="h-24 rounded-lg bg-[var(--color-surface-strong)]" />
                    </div>
                  </div>
                </div>
              ) : null}
              {mapStatus === "error" || mapError ? (
                <div className="absolute left-3 top-3 flex max-w-sm flex-col gap-3 rounded-md border border-[var(--color-warning)] bg-[var(--color-warning-soft)] px-3 py-3 text-sm text-[var(--color-warning)] shadow-sm shadow-[var(--color-shadow)]">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 shrink-0" size={16} />
                    <span>{mapError || "Map could not be loaded."}</span>
                  </div>
                  <button type="button" onClick={retryMap} className={secondaryButtonClass}>
                    <RefreshCw size={15} />
                    Retry map
                  </button>
                </div>
              ) : null}
              <div className="absolute left-3 top-3 rounded-md border border-[var(--color-border)] bg-[var(--color-map-control-surface)] p-3 text-xs font-semibold text-[var(--color-map-control-text)] shadow-sm shadow-[var(--color-shadow)] backdrop-blur">
                <div className="mb-2 flex items-center gap-2 text-[var(--color-map-control-strong)]">
                  <Layers3 size={14} />
                  Layers
                </div>
                <div className="grid gap-2">
                  <LayerToggle checked={layerVisibility.siteMarker} label="Site marker" onChange={() => toggleLayer("siteMarker")} />
                  <LayerToggle checked={layerVisibility.radiusRings} label="Radius rings" onChange={() => toggleLayer("radiusRings")} />
                  <LayerToggle checked={layerVisibility.utilityTerritory} label="Utility territory" onChange={() => toggleLayer("utilityTerritory")} />
                  <LayerToggle checked={layerVisibility.marketZone} label="Market / pricing zone" onChange={() => toggleLayer("marketZone")} />
                  <LayerToggle checked={layerVisibility.savedAssets} label="Saved assets" onChange={() => toggleLayer("savedAssets")} />
                  <LayerToggle checked={layerVisibility.candidatePois} label="Candidate POIs" onChange={() => toggleLayer("candidatePois")} />
                </div>
              </div>
              <div className="absolute bottom-3 left-3 flex flex-wrap gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-map-control-surface)] px-3 py-2 text-xs font-semibold text-[var(--color-map-control-text)] shadow-sm shadow-[var(--color-shadow)] backdrop-blur">
                <LegendItem colorClass="bg-[var(--color-map-site)]" label="Site" />
                <LegendItem colorClass="bg-[var(--color-map-asset)]" label="Asset" />
                <LegendItem colorClass="bg-[var(--color-map-candidate)]" label="Candidate POI" />
                {geospatialContext?.territory_geojson ? <LegendItem colorClass="bg-blue-600" label="Utility territory" /> : null}
                {geospatialContext?.zone_geojson ? <LegendItem colorClass="bg-amber-500" label="Market zone" /> : null}
                <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2 py-0.5">{visibleAssetCount} visible</span>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[320px] items-center justify-center p-6 text-center sm:min-h-[380px]">
              <div className="max-w-md">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary)]">
                  <MapPin size={22} />
                </div>
                <h4 className="text-base font-semibold text-[var(--color-text-primary)]">Coordinates needed</h4>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                  {site?.address || [site?.city, site?.county, site?.state].filter(Boolean).join(", ") || "No usable address or coordinates are attached."}
                </p>
                <p className="mt-3 text-sm font-medium text-[var(--color-text-primary)]">
                  Add latitude and longitude in intake to enable map layers, distance previews, and grid asset context.
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
          <ContextLine label="Resolved utility" value={geospatialContext?.utility_name} />
          <ContextLine label="Pricing / load zone" value={geospatialContext?.pricing_zone} />
          <ContextLine
            label="Dataset coverage"
            value={contextLoading ? "Resolving…" : geospatialContext ? geospatialCoverageLabel(geospatialContext.coverage_status) : "Unavailable"}
          />
          <ContextLine label="Parcel" value={site?.parcelId} />
          <ContextLine
            label="Coordinates"
            value={siteHasCoordinates ? `${site?.latitude}, ${site?.longitude}` : null}
          />
        </div>
      </div>

      {contextError ? (
        <div className="mx-4 mb-4 flex items-start gap-2 rounded-md border border-[var(--color-warning)] bg-[var(--color-warning-soft)] px-3 py-3 text-sm text-[var(--color-warning)]">
          <AlertCircle className="mt-0.5 shrink-0" size={16} />
          {contextError}
        </div>
      ) : null}

      {geospatialContext?.territory_dataset_name || geospatialContext?.zone_dataset_name ? (
        <div className="mx-4 mb-4 grid gap-3 lg:grid-cols-2">
          <DatasetSourceCard
            label="Utility territory source"
            name={geospatialContext.territory_dataset_name}
            version={geospatialContext.territory_dataset_version}
            sourceUrl={geospatialContext.territory_source_url}
            limitations={geospatialContext.territory_limitations}
          />
          <DatasetSourceCard
            label="Market-zone source"
            name={geospatialContext.zone_dataset_name}
            version={geospatialContext.zone_dataset_version}
            sourceUrl={geospatialContext.zone_source_url}
            limitations={geospatialContext.zone_limitations}
          />
        </div>
      ) : null}

      {editable ? <div className="border-t border-[var(--color-border)] p-4">
        {error ? (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-[var(--color-warning)] bg-[var(--color-warning-soft)] px-4 py-3 text-sm text-[var(--color-warning)]">
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
            <span className="inline-flex h-11 w-full items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-semibold text-[var(--color-text-primary)]">
              <input
                checked={assetDraft.isCandidatePoi}
                onChange={(event) => onAssetDraftChange({ ...assetDraft, isCandidatePoi: event.target.checked })}
                type="checkbox"
                className="h-4 w-4 accent-[var(--color-brand-primary)]"
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
              required
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
          <div className="flex flex-col gap-3 lg:col-span-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              {distancePreview !== null ? (
                <div className="inline-flex items-center gap-2 rounded-md border border-[var(--color-info)] bg-[var(--color-info-soft)] px-3 py-2 text-sm font-semibold text-[var(--color-info)]">
                  <LocateFixed size={16} />
                  Distance preview: {formatDistanceMiles(distancePreview)}
                </div>
              ) : (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Enter valid site and asset coordinates to preview distance before saving.
                </p>
              )}
            </div>
            <button type="submit" disabled={saving || !assetDraft.assetName.trim()} className={primaryButtonClass}>
              {saving ? <Save className="animate-pulse" size={16} /> : <Plus size={16} />}
              Add grid asset
            </button>
          </div>
        </form>
      </div> : (
        <div className="border-t border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
          Grid asset editing is available to authorised analysts and administrators.
        </div>
      )}

      <div className="border-t border-[var(--color-border)]">
        <div className="flex items-center gap-2 px-4 py-3">
          <RadioTower size={16} className="text-[var(--color-brand-primary)]" />
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">Grid assets and candidate POIs</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] border-collapse text-left text-sm">
            <thead className="bg-[var(--color-surface-muted)] text-xs uppercase text-[var(--color-text-secondary)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Asset</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Distance</th>
                <th className="px-4 py-3 font-semibold">Voltage</th>
                <th className="px-4 py-3 font-semibold">Owner/operator</th>
                <th className="px-4 py-3 font-semibold">Confidence</th>
                <th className="px-4 py-3 font-semibold">Source</th>
                <th className="px-4 py-3 font-semibold">Map</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {sortedAssets.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-[var(--color-text-secondary)]" colSpan={8}>
                    No grid assets yet
                  </td>
                </tr>
              ) : null}
              {sortedAssets.map((asset) => {
                const isSelected = asset.id === selectedAssetId;
                const isRecentlySaved = asset.id === recentlySavedAssetId;

                return (
                  <tr
                    key={asset.id}
                    className={cx(
                      "transition hover:bg-[var(--color-surface-muted)]",
                      isSelected && "bg-[var(--color-info-soft)]",
                      isRecentlySaved && "bg-[var(--color-success-soft)]",
                    )}
                  >
                    <td className="max-w-[240px] px-4 py-3">
                      <div className="flex items-start gap-2">
                        <Waypoints size={16} className="mt-0.5 shrink-0 text-[var(--color-brand-primary)]" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[var(--color-text-primary)]">{asset.asset_name}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {asset.is_candidate_poi ? (
                              <span className="inline-flex rounded-md border border-[var(--color-warning)] bg-[var(--color-warning-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--color-warning)]">
                                Candidate POI
                              </span>
                            ) : null}
                            {isRecentlySaved ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-[var(--color-success)] bg-[var(--color-success-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--color-success)]">
                                <CheckCircle2 size={12} />
                                Saved
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{gridAssetTypeLabel(asset.asset_type)}</td>
                    <td className="px-4 py-3 font-semibold text-[var(--color-text-primary)]">{formatDistanceMiles(asset.distance_miles)}</td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{asset.voltage_kv !== null ? `${asset.voltage_kv} kV` : "Not set"}</td>
                    <td className="max-w-[180px] px-4 py-3 text-[var(--color-text-secondary)]">
                      <span className="block truncate">{asset.owner_operator || "Not set"}</span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">{confidenceLevelLabel(asset.confidence_level)}</td>
                    <td className="max-w-[220px] px-4 py-3 text-[var(--color-text-secondary)]">
                      <span className="block truncate">{asset.source || "Not set"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => zoomToAsset(asset)}
                        disabled={!siteHasCoordinates}
                        className={secondaryButtonClass}
                      >
                        <ZoomIn size={15} />
                        Zoom
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function LayerToggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <input checked={checked} onChange={onChange} type="checkbox" className="h-4 w-4 accent-[var(--color-brand-primary)]" />
      <span>{label}</span>
    </label>
  );
}

function LegendItem({ colorClass, label }: { colorClass: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cx("h-2.5 w-2.5 rounded-full", colorClass)} />
      {label}
    </span>
  );
}
