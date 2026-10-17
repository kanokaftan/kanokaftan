import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { isRateLimited } from "../_shared/rateLimit.ts";

/** Address lookups per IP per minute: typing an address fires several suggestions. */
const GEOCODE_LIMIT_PER_MINUTE = 60;
const MINUTE_SECONDS = 60;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeocodeRequest {
  street_address: string;
  city: string;
  state: string;
}

interface GeocodeResponse {
  success: boolean;
  latitude?: number;
  longitude?: number;
  error?: string;
}

// State capital coordinates as fallback
const STATE_COORDINATES: Record<string, { lat: number; lng: number }> = {
  "Abia": { lat: 5.5320, lng: 7.4860 },
  "Adamawa": { lat: 9.3265, lng: 12.3984 },
  "Akwa Ibom": { lat: 5.0510, lng: 7.9335 },
  "Anambra": { lat: 6.2100, lng: 7.0700 },
  "Bauchi": { lat: 10.3158, lng: 9.8442 },
  "Bayelsa": { lat: 4.9261, lng: 6.2677 },
  "Benue": { lat: 7.7336, lng: 8.5215 },
  "Borno": { lat: 11.8333, lng: 13.1500 },
  "Cross River": { lat: 4.9517, lng: 8.3220 },
  "Delta": { lat: 5.5000, lng: 6.0000 },
  "Ebonyi": { lat: 6.2649, lng: 8.0130 },
  "Edo": { lat: 6.3350, lng: 5.6037 },
  "Ekiti": { lat: 7.6210, lng: 5.2210 },
  "Enugu": { lat: 6.4584, lng: 7.5464 },
  "FCT": { lat: 9.0579, lng: 7.4951 },
  "Gombe": { lat: 10.2897, lng: 11.1673 },
  "Imo": { lat: 5.4920, lng: 7.0260 },
  "Jigawa": { lat: 11.7990, lng: 9.3502 },
  "Kaduna": { lat: 10.5264, lng: 7.4388 },
  "Kano": { lat: 12.0000, lng: 8.5167 },
  "Katsina": { lat: 12.9889, lng: 7.6008 },
  "Kebbi": { lat: 12.4539, lng: 4.1975 },
  "Kogi": { lat: 7.7969, lng: 6.7406 },
  "Kwara": { lat: 8.4966, lng: 4.5426 },
  "Lagos": { lat: 6.5244, lng: 3.3792 },
  "Nasarawa": { lat: 8.5380, lng: 8.5200 },
  "Niger": { lat: 9.6145, lng: 6.5568 },
  "Ogun": { lat: 7.1600, lng: 3.3500 },
  "Ondo": { lat: 7.2500, lng: 5.2000 },
  "Osun": { lat: 7.5629, lng: 4.5200 },
  "Oyo": { lat: 7.3775, lng: 3.9470 },
  "Plateau": { lat: 9.8965, lng: 8.8583 },
  "Rivers": { lat: 4.8156, lng: 7.0498 },
  "Sokoto": { lat: 13.0629, lng: 5.2476 },
  "Taraba": { lat: 8.8904, lng: 11.3596 },
  "Yobe": { lat: 11.7488, lng: 11.9662 },
  "Zamfara": { lat: 12.1222, lng: 6.2236 },
};


// ── Address suggestions (autocomplete) ─────────────────────────────────────
// Mapbox when MAPBOX_ACCESS_TOKEN is set, otherwise OpenStreetMap's free
// Photon search, limited to Nigeria. People can always save their own text.

interface Suggestion {
  label: string;      // what the list shows
  street: string;     // goes in "Street address"
  city: string;
  state: string;
  latitude: number;
  longitude: number;
}

const NIGERIA_BBOX = '2.67,4.27,14.68,13.89'; // minLon,minLat,maxLon,maxLat
const SUGGEST_LIMIT = 6;
const MIN_QUERY_LENGTH = 3;
const MAX_QUERY_LENGTH = 120;

/** "Kano State" -> "Kano", "Federal Capital Territory" -> "FCT". */
function normaliseState(raw: string | undefined): string {
  if (!raw) return '';
  const cleaned = raw.replace(/\s+state$/i, '').trim();
  if (/federal capital territory|abuja/i.test(cleaned)) return 'FCT';
  const match = Object.keys(STATE_COORDINATES).find((s) => s.toLowerCase() === cleaned.toLowerCase());
  return match ?? cleaned;
}

async function suggestWithMapbox(query: string, token: string, state?: string): Promise<Suggestion[]> {
  const q = encodeURIComponent(state ? `${query}, ${state}` : query);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?access_token=${token}&country=NG&autocomplete=true&limit=${SUGGEST_LIMIT}&types=address,poi,neighborhood,locality,place`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mapbox ${res.status}`);
  const data = await res.json();
  type Ctx = { id: string; text: string };
  return (data.features ?? []).map((f: { text: string; address?: string; place_name: string; center: [number, number]; context?: Ctx[] }) => {
    const ctx = f.context ?? [];
    const city = ctx.find((c) => c.id.startsWith('place') || c.id.startsWith('locality'))?.text ?? '';
    const region = ctx.find((c) => c.id.startsWith('region'))?.text;
    return {
      label: f.place_name.replace(/, Nigeria$/, ''),
      street: [f.address, f.text].filter(Boolean).join(' '),
      city,
      state: normaliseState(region),
      latitude: f.center[1],
      longitude: f.center[0],
    };
  });
}

async function suggestWithPhoton(query: string, state?: string): Promise<Suggestion[]> {
  const q = encodeURIComponent(state ? `${query} ${state}` : query);
  const url = `https://photon.komoot.io/api/?q=${q}&limit=${SUGGEST_LIMIT * 2}&lang=en&bbox=${NIGERIA_BBOX}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'KanoKaftan/1.0 (kanokaftan.shop)' } });
  if (!res.ok) throw new Error(`Photon ${res.status}`);
  const data = await res.json();
  type Props = { name?: string; street?: string; housenumber?: string; district?: string; locality?: string; city?: string; county?: string; state?: string; countrycode?: string };
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const f of (data.features ?? []) as { geometry: { coordinates: [number, number] }; properties: Props }[]) {
    const p = f.properties;
    if (p.countrycode && p.countrycode.toUpperCase() !== 'NG') continue;
    const streetPart = [p.housenumber, p.street].filter(Boolean).join(' ');
    const street = [p.name, streetPart].filter((v, i, a) => v && a.indexOf(v) === i).join(', ');
    const city = p.city ?? p.district ?? p.locality ?? p.county ?? '';
    const stateName = normaliseState(p.state);
    const label = [street, p.district && p.district !== city ? p.district : null, city, stateName].filter(Boolean).join(', ');
    if (!street || seen.has(label)) continue;
    seen.add(label);
    out.push({ label, street, city, state: stateName, latitude: f.geometry.coordinates[1], longitude: f.geometry.coordinates[0] });
    if (out.length >= SUGGEST_LIMIT) break;
  }
  return out;
}

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders } });
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (await isRateLimited(req, 'geocode', GEOCODE_LIMIT_PER_MINUTE, MINUTE_SECONDS)) {
    return jsonResponse({ success: false, error: 'Too many address lookups. Please wait a minute.', suggestions: [] }, 429);
  }

  try {
    const mapboxToken = Deno.env.get('MAPBOX_ACCESS_TOKEN');
    const body = await req.json();

    if (body?.action === 'suggest') {
      const query = typeof body.query === 'string' ? body.query.trim().slice(0, MAX_QUERY_LENGTH) : '';
      const stateHint = typeof body.state === 'string' ? body.state : undefined;
      if (query.length < MIN_QUERY_LENGTH) return jsonResponse({ success: true, suggestions: [] });
      try {
        const suggestions = mapboxToken
          ? await suggestWithMapbox(query, mapboxToken, stateHint)
          : await suggestWithPhoton(query, stateHint);
        // Browsers may reuse the same answer for a few minutes.
        return jsonResponse({ success: true, suggestions }, 200, { 'Cache-Control': 'public, max-age=300' });
      } catch (suggestError) {
        // Suggestions are a nice-to-have: an empty list lets people type their own address.
        console.error('Address suggestions failed:', suggestError);
        return jsonResponse({ success: true, suggestions: [] });
      }
    }

    const { street_address, city, state }: GeocodeRequest = body;

    // Without Mapbox, use the state capital so delivery pricing still has a rough distance.
    if (!mapboxToken) {
      const fallback = STATE_COORDINATES[state];
      return new Response(
        JSON.stringify(fallback
          ? { success: true, latitude: fallback.lat, longitude: fallback.lng }
          : { success: false, error: 'Unknown state' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Addresses are personal data: log only the town.
    console.log('Geocoding request:', { city, state });

    // Build the search query
    const searchQuery = encodeURIComponent(`${street_address}, ${city}, ${state}, Nigeria`);
    const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${searchQuery}.json?access_token=${mapboxToken}&country=NG&limit=1`;

    console.log('Calling Mapbox API...');
    const response = await fetch(mapboxUrl);
    
    if (!response.ok) {
      console.error('Mapbox API error:', response.status, response.statusText);
      throw new Error('Geocoding API request failed');
    }

    const data = await response.json();
    console.log('Mapbox results:', data.features?.length ?? 0);

    if (data.features && data.features.length > 0) {
      const [longitude, latitude] = data.features[0].center;
      console.log('Geocoded OK');
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          latitude, 
          longitude 
        } as GeocodeResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fallback to state capital coordinates
    console.log('No results from Mapbox, using state fallback for:', state);
    const stateCoords = STATE_COORDINATES[state];
    
    if (stateCoords) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          latitude: stateCoords.lat, 
          longitude: stateCoords.lng 
        } as GeocodeResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Could not geocode address' } as GeocodeResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Geocoding failed';
    console.error('Geocoding error:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
