import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationPayload {
  user_id: string;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'order' | 'payment' | 'system';
  category?: 'order' | 'payment' | 'product' | 'review' | 'system' | 'promotion' | 'general';
  action_url?: string;
  metadata?: Record<string, any>;
}

interface BulkNotificationPayload {
  user_ids: string[];
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'order' | 'payment' | 'system';
  category?: 'order' | 'payment' | 'product' | 'review' | 'system' | 'promotion' | 'general';
  action_url?: string;
  metadata?: Record<string, any>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const body = await req.json();
    const { action } = body;

    if (action === 'create') {
      const { user_id, title, message, type = 'info', category = 'general', action_url, metadata = {} } = body as NotificationPayload & { action: string };
      
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id,
          title,
          message,
          type,
          category,
          action_url,
          metadata,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, notification: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === 'bulk') {
      const { user_ids, title, message, type = 'info', category = 'general', action_url, metadata = {} } = body as BulkNotificationPayload & { action: string };
      
      const notifications = user_ids.map(user_id => ({
        user_id,
        title,
        message,
        type,
        category,
        action_url,
        metadata,
      }));

      const { data, error } = await supabase
        .from('notifications')
        .insert(notifications)
        .select();

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, count: data.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Notify all users of a specific role
    if (action === 'notify_role') {
      const { role, title, message, type = 'info', category = 'general', action_url, metadata = {} } = body;
      
      // Get all users with the specified role
      const { data: roleUsers, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', role);

      if (roleError) throw roleError;

      if (!roleUsers || roleUsers.length === 0) {
        return new Response(JSON.stringify({ success: true, count: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const notifications = roleUsers.map(({ user_id }) => ({
        user_id,
        title,
        message,
        type,
        category,
        action_url,
        metadata,
      }));

      const { data, error } = await supabase
        .from('notifications')
        .insert(notifications)
        .select();

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, count: data.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
