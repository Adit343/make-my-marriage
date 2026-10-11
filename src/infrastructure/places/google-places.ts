import "server-only";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

// Google Places (Architecture §28): the key stays on the server and the browser only ever talks to
// our own API. Results are NOT stored by this module; a vendor row is written only when a member
// chooses one and submits the form (DB Design §6.13). Google restricts how long Places content
// may be kept, so only the place id and what the member confirms are saved (DB Design §15 item 8).
// This module uses the "Text Search (New)" endpoint with the cheapest field set that is enough
// to pick a business: id, name and address. No phone, website or coordinates are requested.

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = "places.id,places.displayName,places.formattedAddress";
const MAX_RESULTS = 8;
const TIMEOUT_MS = 6000;

export interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
}

export type PlacesOutcome =
  | { status: "ok"; results: PlaceResult[] }
  /** No GOOGLE_PLACES_API_KEY: search is off, typing the details still works. */
  | { status: "not_configured" }
  /** Google failed or timed out. The caller shows a calm message; nothing was saved. */
  | { status: "unavailable" };

interface PlacesResponse {
  places?: {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
  }[];
}

export async function searchPlaces(query: string): Promise<PlacesOutcome> {
  const key = getEnv().GOOGLE_PLACES_API_KEY;
  if (!key) return { status: "not_configured" };

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": key,
        "x-goog-fieldmask": FIELD_MASK,
      },
      body: JSON.stringify({ textQuery: query, pageSize: MAX_RESULTS, regionCode: "IN" }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      // Log the status only: the response body could echo the request, which carries the key.
      logger.warn("places.search_failed", { status: response.status });
      return { status: "unavailable" };
    }
    const body = (await response.json()) as PlacesResponse;
    const results = (body.places ?? []).flatMap((place) =>
      place.id && place.displayName?.text
        ? [
            {
              placeId: place.id,
              name: place.displayName.text,
              address: place.formattedAddress ?? "",
            },
          ]
        : [],
    );
    return { status: "ok", results };
  } catch (error) {
    logger.warn("places.search_failed", {
      reason: error instanceof Error ? error.name : "unknown",
    });
    return { status: "unavailable" };
  }
}
