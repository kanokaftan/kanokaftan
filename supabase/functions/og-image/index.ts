import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const vendorId = url.searchParams.get("vendorId");

    if (!vendorId) {
      return new Response(
        JSON.stringify({ error: "vendorId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: vendor, error } = await supabase
      .from("public_vendor_profiles")
      .select("id, store_name, store_description, avatar_url, is_verified")
      .eq("id", vendorId)
      .single();

    if (error || !vendor) {
      return new Response(
        JSON.stringify({ 
          title: "Kano Kaftan - Store",
          description: "Shop authentic Nigerian traditional attire",
          image: "https://storage.googleapis.com/gpt-engineer-file-uploads/n85PtjtstLSH7FGT5eE0A6dm6zi2/social-images/social-1767791624177-Gemini_Generated_Image_duw5q6duw5q6duw5.png",
          storeName: null
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const storeName = vendor.store_name || "Store";
    const description = vendor.store_description || `Shop authentic Nigerian Agbada, Kaftan, and Dashiki from ${storeName} on Kano Kaftan.`;
    const image = vendor.avatar_url || "https://storage.googleapis.com/gpt-engineer-file-uploads/n85PtjtstLSH7FGT5eE0A6dm6zi2/social-images/social-1767791624177-Gemini_Generated_Image_duw5q6duw5q6duw5.png";

    return new Response(
      JSON.stringify({
        title: `${storeName} - Kano Kaftan`,
        description: description.substring(0, 160),
        image: image,
        storeName: storeName,
        isVerified: vendor.is_verified,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching vendor OG data:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
