"use client";

import { FormEvent, useEffect, useState } from "react";
import { canManageAssessments, type AppRole } from "@/components/auth/auth-provider";
import { SiteMapPanel } from "@/components/site-map-panel";
import type { AssessmentDetailRecord, SiteRecord } from "@/lib/assessment-workspace";
import {
  type GridAssetRecord,
  type SiteGeospatialContext,
  blankGridAssetDraft,
  calculateDistanceMiles,
  hasValidCoordinatePair,
  parseNumericInput,
  validateCoordinateInputs,
} from "@/lib/gis";
import { supabase } from "@/lib/supabase";
import { trackWorkflowEvent } from "@/lib/workflow-analytics";

export function SiteGridWorkspace({
  assessment,
  assets,
  onChanged,
  role,
  site,
}: {
  assessment: AssessmentDetailRecord;
  assets: GridAssetRecord[];
  onChanged: () => void;
  role: AppRole;
  site: SiteRecord | null;
}) {
  const [assetDraft, setAssetDraft] = useState(blankGridAssetDraft);
  const [assetError, setAssetError] = useState("");
  const [context, setContext] = useState<SiteGeospatialContext | null>(null);
  const [contextError, setContextError] = useState("");
  const [contextLoading, setContextLoading] = useState(hasValidCoordinatePair(site?.latitude, site?.longitude));
  const [recentlySavedAssetId, setRecentlySavedAssetId] = useState("");
  const [saving, setSaving] = useState(false);
  const editable = canManageAssessments(role);

  useEffect(() => {
    if (!supabase || !hasValidCoordinatePair(site?.latitude, site?.longitude)) {
      return;
    }

    let active = true;
    void supabase
      .rpc("resolve_site_geospatial_context", {
        latitude: site?.latitude,
        longitude: site?.longitude,
        market: assessment.market_region || null,
      })
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) {
          return;
        }

        setContextLoading(false);
        if (error) {
          setContextError(`Geospatial context could not be resolved: ${error.message}`);
          return;
        }

        setContext((data as SiteGeospatialContext | null) ?? null);
        setContextError("");
      });

    return () => {
      active = false;
    };
  }, [assessment.market_region, site?.latitude, site?.longitude]);

  async function addAsset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || !editable || !site) {
      return;
    }

    if (!assetDraft.assetName.trim()) {
      setAssetError("Asset name is required.");
      return;
    }

    if (!assetDraft.source.trim()) {
      setAssetError("A source or provenance note is required for every grid asset.");
      return;
    }

    const coordinateResult = validateCoordinateInputs(assetDraft.latitude, assetDraft.longitude);
    if (coordinateResult.error) {
      setAssetError(coordinateResult.error);
      return;
    }

    const assetLatitude = coordinateResult.latitude;
    const assetLongitude = coordinateResult.longitude;
    if (assetLatitude === undefined || assetLongitude === undefined) {
      setAssetError("Latitude and longitude are required numeric values.");
      return;
    }

    const voltageKv = parseNumericInput(assetDraft.voltageKv);
    if (assetDraft.voltageKv.trim() && voltageKv === null) {
      setAssetError("Voltage kV must be numeric.");
      return;
    }

    const distanceMiles = hasValidCoordinatePair(site.latitude, site.longitude)
      ? calculateDistanceMiles(
          Number(site.latitude),
          Number(site.longitude),
          assetLatitude,
          assetLongitude,
        )
      : null;

    setSaving(true);
    setAssetError("");
    const { data, error } = await supabase
      .from("assessment_grid_assets")
      .insert({
        analyst_notes: assetDraft.analystNotes.trim() || null,
        asset_name: assetDraft.assetName.trim(),
        asset_type: assetDraft.assetType,
        confidence_level: assetDraft.confidenceLevel,
        distance_miles: distanceMiles,
        is_candidate_poi: assetDraft.isCandidatePoi,
        latitude: assetLatitude,
        longitude: assetLongitude,
        owner_operator: assetDraft.ownerOperator.trim() || null,
        rationale: assetDraft.rationale.trim() || null,
        site_assessment_id: assessment.id,
        site_id: site.id,
        source: assetDraft.source.trim(),
        voltage_kv: voltageKv,
      })
      .select("id")
      .single();

    setSaving(false);
    if (error) {
      setAssetError(error.message);
      return;
    }

    const savedId = data?.id as string | undefined;
    setAssetDraft(blankGridAssetDraft);
    setRecentlySavedAssetId(savedId ?? "");
    trackWorkflowEvent("grid_asset_added", {
      assessmentId: assessment.id,
      assetId: savedId ?? null,
      assetType: assetDraft.assetType,
      isCandidatePoi: assetDraft.isCandidatePoi,
    });
    onChanged();
  }

  return (
    <SiteMapPanel
      assessmentId={assessment.id}
      assetDraft={assetDraft}
      assets={assets}
      contextError={contextError}
      contextLoading={contextLoading}
      editable={editable}
      error={assetError}
      geospatialContext={context}
      knownSubstationOrPoi={assessment.known_substation_or_poi}
      knownTsp={assessment.known_tsp}
      knownUtility={assessment.known_utility}
      marketRegion={assessment.market_region}
      onAssetDraftChange={setAssetDraft}
      onAssetSubmit={(event) => void addAsset(event)}
      recentlySavedAssetId={recentlySavedAssetId}
      saving={saving}
      site={site ? {
        address: site.address,
        city: site.city,
        county: site.county,
        latitude: site.latitude,
        longitude: site.longitude,
        parcelId: site.parcel_id,
        siteName: site.site_name,
        state: site.state,
      } : null}
    />
  );
}
