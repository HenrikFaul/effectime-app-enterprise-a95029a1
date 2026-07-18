import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { corsHeaders } from "../_shared/cors.ts";
import { hasServiceRoleCredential } from "../_shared/request-security.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      console.error("cleanup-temp-users: missing server configuration");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!hasServiceRoleCredential(req, serviceKey)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(supabaseUrl, serviceKey);

    // Find all temporary profiles
    const { data: tempProfiles } = await admin
      .from('profiles')
      .select('user_id, linked_event_id, temp_access_token')
      .eq('is_temporary', true);

    if (!tempProfiles || tempProfiles.length === 0) {
      return new Response(JSON.stringify({ message: "No temp users to clean up.", deleted: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let deletedCount = 0;

    for (const profile of tempProfiles) {
      let shouldDelete = false;

      if (!profile.linked_event_id) {
        // Event was deleted (CASCADE set linked_event_id to null or row deleted)
        shouldDelete = true;
      } else {
        // Check if event end_date + 10 days has passed
        const { data: event } = await admin
          .from('events')
          .select('end_date')
          .eq('id', profile.linked_event_id)
          .single();

        if (!event) {
          shouldDelete = true;
        } else {
          const endDate = new Date(event.end_date);
          const cutoff = new Date(endDate.getTime() + 10 * 24 * 60 * 60 * 1000);
          if (new Date() > cutoff) {
            shouldDelete = true;
          }
        }
      }

      if (shouldDelete) {
        // Delete votes
        await admin.from('votes').delete().eq('user_id', profile.user_id);
        // Delete participants
        await admin.from('event_participants').delete().eq('user_id', profile.user_id);
        // Delete profile
        await admin.from('profiles').delete().eq('user_id', profile.user_id);
        // Delete auth user
        await admin.auth.admin.deleteUser(profile.user_id);
        deletedCount++;
      }
    }

    return new Response(JSON.stringify({ message: `Cleaned up ${deletedCount} temp users.`, deleted: deletedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error('Cleanup error:', err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
