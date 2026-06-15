const geoapifyApiKey = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY;

export const hasAddressAutocompleteConfig = Boolean(geoapifyApiKey);

export type AddressSuggestion = {
  addressLine1: string;
  city: string;
  county: string;
  country: string;
  formattedAddress: string;
  id: string;
  latitude: number;
  longitude: number;
  postcode: string;
  state: string;
  stateCode: string;
};

type GeoapifyAutocompleteResult = {
  address_line1?: string;
  city?: string;
  country?: string;
  county?: string;
  formatted?: string;
  lat?: number;
  lon?: number;
  name?: string;
  place_id?: string;
  postcode?: string;
  state?: string;
  state_code?: string;
  street?: string;
};

type GeoapifyAutocompleteResponse = {
  results?: GeoapifyAutocompleteResult[];
};

function clean(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function isFiniteCoordinate(latitude: unknown, longitude: unknown) {
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  );
}

function toSuggestion(result: GeoapifyAutocompleteResult, index: number): AddressSuggestion | null {
  if (!isFiniteCoordinate(result.lat, result.lon)) {
    return null;
  }

  const addressLine1 = clean(result.address_line1) || clean(result.name) || clean(result.street);
  const formattedAddress = clean(result.formatted) || [addressLine1, result.city, result.state].filter(Boolean).join(", ");

  if (!formattedAddress) {
    return null;
  }

  return {
    addressLine1,
    city: clean(result.city),
    country: clean(result.country),
    county: clean(result.county),
    formattedAddress,
    id: clean(result.place_id) || `${formattedAddress}-${index}`,
    latitude: result.lat as number,
    longitude: result.lon as number,
    postcode: clean(result.postcode),
    state: clean(result.state),
    stateCode: clean(result.state_code),
  };
}

export async function searchAddressSuggestions(query: string, signal?: AbortSignal): Promise<AddressSuggestion[]> {
  const trimmedQuery = query.trim();

  if (!geoapifyApiKey || trimmedQuery.length < 3) {
    return [];
  }

  const params = new URLSearchParams({
    apiKey: geoapifyApiKey,
    bias: "rect:-106.65,25.84,-93.51,36.5",
    filter: "countrycode:us",
    format: "json",
    lang: "en",
    limit: "5",
    text: trimmedQuery,
  });

  const response = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?${params.toString()}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error("Address lookup unavailable.");
  }

  const data = (await response.json()) as GeoapifyAutocompleteResponse;

  return (data.results ?? [])
    .map((result, index) => toSuggestion(result, index))
    .filter((result): result is AddressSuggestion => Boolean(result));
}
