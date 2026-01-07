import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const mapboxToken = Deno.env.get('MAPBOX_ACCESS_TOKEN');
    
    if (!mapboxToken) {
      console.error('MAPBOX_ACCESS_TOKEN not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Geocoding service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { street_address, city, state }: GeocodeRequest = await req.json();
    
    console.log('Geocoding request:', { street_address, city, state });

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
    console.log('Mapbox response:', JSON.stringify(data, null, 2));

    if (data.features && data.features.length > 0) {
      const [longitude, latitude] = data.features[0].center;
      console.log('Geocoded coordinates:', { latitude, longitude });
      
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
