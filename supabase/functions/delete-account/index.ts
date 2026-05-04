import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the user with their JWT
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { reason } = await req.json();
    if (!reason) {
      return new Response(JSON.stringify({ error: "Reason is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // 1. Log the deletion
    await adminClient.from("account_deletions").insert({
      user_id: user.id,
      email: user.email!,
      account_created_at: user.created_at,
      deletion_reason: reason,
    });

    // 2. Delete user data in order (respecting foreign keys)
    // Delete votes
    await adminClient.from("votes").delete().eq("user_id", user.id);

    // Delete event participants (where user is participant)
    await adminClient.from("event_participants").delete().eq("user_id", user.id);

    // Delete share tokens created by user
    await adminClient.from("event_share_tokens").delete().eq("created_by", user.id);

    // Get events created by user to clean up their participants/votes/tokens
    const { data: ownEvents } = await adminClient
      .from("events")
      .select("id")
      .eq("created_by", user.id);

    if (ownEvents && ownEvents.length > 0) {
      const eventIds = ownEvents.map((e) => e.id);
      // Delete all votes on user's events
      await adminClient.from("votes").delete().in("event_id", eventIds);
      // Delete all participants of user's events
      await adminClient.from("event_participants").delete().in("event_id", eventIds);
      // Delete all share tokens of user's events
      await adminClient.from("event_share_tokens").delete().in("event_id", eventIds);
      // Delete the events themselves
      await adminClient.from("events").delete().in("id", eventIds);
    }

    // Delete personal availability
    await adminClient.from("personal_availability").delete().eq("user_id", user.id);

    // Delete favorites
    await adminClient.from("favorites").delete().eq("user_id", user.id);
    await adminClient.from("favorites").delete().eq("favorite_user_id", user.id);

    // Delete friendships
    await adminClient.from("friendships").delete().eq("requester_id", user.id);
    await adminClient.from("friendships").delete().eq("addressee_id", user.id);

    // Delete user roles
    await adminClient.from("user_roles").delete().eq("user_id", user.id);

    // Delete profile
    await adminClient.from("profiles").delete().eq("user_id", user.id);

    // 3. Delete auth user
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error("Error deleting auth user:", deleteError);
      return new Response(JSON.stringify({ error: "Failed to delete account" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("delete-account error:", message);
    return new Response(JSON.stringify({ error: message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
