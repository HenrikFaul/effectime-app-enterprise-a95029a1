import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { corsHeaders } from "../_shared/cors.ts";

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonRes({ error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonRes({ error: "Unauthorized" }, 401);

    // Check admin role
    const { data: roleData } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) return jsonRes({ error: "Forbidden" }, 403);

    const body = await req.json();
    const { action } = body;

    // === LIST USERS ===
    if (action === "list-users") {
      const { page = 1, perPage = 50, search, filter } = body;

      // Get auth users
      const { data: authData, error: authError } = await admin.auth.admin.listUsers({
        page,
        perPage,
      });
      if (authError) return jsonRes({ error: authError.message }, 500);

      // Get all profiles
      const { data: profiles } = await admin.from("profiles").select("*");
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

      // Get all roles
      const { data: roles } = await admin.from("user_roles").select("*");
      const roleMap = new Map<string, string[]>();
      (roles || []).forEach((r: any) => {
        const existing = roleMap.get(r.user_id) || [];
        existing.push(r.role);
        roleMap.set(r.user_id, existing);
      });

      // Get event participation counts
      const { data: participations } = await admin.from("event_participants").select("user_id");
      const participationCount = new Map<string, number>();
      (participations || []).forEach((p: any) => {
        participationCount.set(p.user_id, (participationCount.get(p.user_id) || 0) + 1);
      });

      // Get vote counts
      const { data: votes } = await admin.from("votes").select("user_id");
      const voteCount = new Map<string, number>();
      (votes || []).forEach((v: any) => {
        voteCount.set(v.user_id, (voteCount.get(v.user_id) || 0) + 1);
      });

      let users = authData.users
        .filter((u: any) => !u.deleted_at)
        .map((u: any) => {
          const profile = profileMap.get(u.id) as any;
          return {
            id: u.id,
            email: u.email || '',
            display_name: profile?.display_name || u.user_metadata?.display_name || '',
            is_temporary: profile?.is_temporary || false,
            linked_event_id: profile?.linked_event_id || null,
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at || null,
            roles: roleMap.get(u.id) || [],
            event_count: participationCount.get(u.id) || 0,
            vote_count: voteCount.get(u.id) || 0,
            avatar_url: profile?.avatar_url || null,
            provider: u.app_metadata?.provider || 'email',
          };
        });

      // Apply filters
      if (filter === 'temporary') {
        users = users.filter((u: any) => u.is_temporary);
      } else if (filter === 'registered') {
        users = users.filter((u: any) => !u.is_temporary);
      } else if (filter === 'admin') {
        users = users.filter((u: any) => u.roles.includes('admin'));
      }

      // Apply search
      if (search) {
        const s = search.toLowerCase();
        users = users.filter((u: any) =>
          u.email.toLowerCase().includes(s) ||
          u.display_name.toLowerCase().includes(s)
        );
      }

      return jsonRes({
        users,
        total: users.length,
      });
    }

    // === GET STATS ===
    if (action === "get-stats") {
      const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 10000 });
      const allUsers = (authData?.users || []).filter((u: any) => !u.deleted_at);

      const { data: profiles } = await admin.from("profiles").select("is_temporary, created_at");
      const { data: events } = await admin.from("events").select("id, created_at, start_date, end_date, is_active, title");
      const { data: votes } = await admin.from("votes").select("id, created_at, event_id, user_id");
      const { data: participants } = await admin.from("event_participants").select("id, event_id, user_id");
      const { data: deletions } = await admin.from("account_deletions").select("id, deleted_at");

      const tempUsers = (profiles || []).filter((p: any) => p.is_temporary).length;
      const registeredUsers = allUsers.length - tempUsers;
      const activeEvents = (events || []).filter((e: any) => e.is_active).length;
      const totalVotes = (votes || []).length;
      const totalEvents = (events || []).length;
      const totalDeletions = (deletions || []).length;

      // Registrations by day (last 30 days)
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const registrationsByDay: Record<string, number> = {};
      allUsers.forEach((u: any) => {
        const d = new Date(u.created_at);
        if (d >= thirtyDaysAgo) {
          const key = d.toISOString().split('T')[0];
          registrationsByDay[key] = (registrationsByDay[key] || 0) + 1;
        }
      });

      // Events by month (last 6 months)
      const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      const eventsByMonth: Record<string, number> = {};
      (events || []).forEach((e: any) => {
        const d = new Date(e.created_at);
        if (d >= sixMonthsAgo) {
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          eventsByMonth[key] = (eventsByMonth[key] || 0) + 1;
        }
      });

      // Votes by day (last 30 days)
      const votesByDay: Record<string, number> = {};
      (votes || []).forEach((v: any) => {
        const d = new Date(v.created_at);
        if (d >= thirtyDaysAgo) {
          const key = d.toISOString().split('T')[0];
          votesByDay[key] = (votesByDay[key] || 0) + 1;
        }
      });

      // Top events by participant count
      const eventParticipantCount: Record<string, number> = {};
      (participants || []).forEach((p: any) => {
        eventParticipantCount[p.event_id] = (eventParticipantCount[p.event_id] || 0) + 1;
      });
      const eventVoteCount: Record<string, number> = {};
      (votes || []).forEach((v: any) => {
        eventVoteCount[v.event_id] = (eventVoteCount[v.event_id] || 0) + 1;
      });

      const topEvents = (events || [])
        .map((e: any) => ({
          id: e.id,
          title: e.title,
          participants: eventParticipantCount[e.id] || 0,
          votes: eventVoteCount[e.id] || 0,
          is_active: e.is_active,
          start_date: e.start_date,
          end_date: e.end_date,
        }))
        .sort((a: any, b: any) => b.participants - a.participants)
        .slice(0, 10);

      return jsonRes({
        overview: {
          total_users: allUsers.length,
          registered_users: registeredUsers,
          temporary_users: tempUsers,
          total_events: totalEvents,
          active_events: activeEvents,
          total_votes: totalVotes,
          total_deletions: totalDeletions,
        },
        charts: {
          registrations_by_day: registrationsByDay,
          events_by_month: eventsByMonth,
          votes_by_day: votesByDay,
        },
        top_events: topEvents,
      });
    }

    // === DELETE USER ===
    if (action === "delete-user") {
      const { user_id } = body;
      if (!user_id) return jsonRes({ error: "user_id szükséges." }, 400);
      if (user_id === user.id) return jsonRes({ error: "Saját magadat nem törölheted." }, 400);

      // Delete votes, participants, profiles, then auth user
      await admin.from("votes").delete().eq("user_id", user_id);
      await admin.from("event_participants").delete().eq("user_id", user_id);
      await admin.from("favorites").delete().eq("user_id", user_id);
      await admin.from("favorites").delete().eq("favorite_user_id", user_id);
      await admin.from("friendships").delete().or(`requester_id.eq.${user_id},addressee_id.eq.${user_id}`);
      await admin.from("personal_availability").delete().eq("user_id", user_id);
      await admin.from("user_roles").delete().eq("user_id", user_id);
      await admin.from("profiles").delete().eq("user_id", user_id);

      const { error: deleteError } = await admin.auth.admin.deleteUser(user_id);
      if (deleteError) return jsonRes({ error: deleteError.message }, 500);

      return jsonRes({ success: true });
    }

    // === UPDATE ROLE ===
    if (action === "update-role") {
      const { user_id, role, grant } = body;
      if (!user_id || !role) return jsonRes({ error: "user_id és role szükséges." }, 400);
      if (user_id === user.id) return jsonRes({ error: "Saját szerepkörödet nem módosíthatod." }, 400);

      if (grant) {
        const { error } = await admin.from("user_roles").upsert(
          { user_id, role },
          { onConflict: "user_id,role" }
        );
        if (error) return jsonRes({ error: error.message }, 500);
      } else {
        const { error } = await admin.from("user_roles").delete()
          .eq("user_id", user_id)
          .eq("role", role);
        if (error) return jsonRes({ error: error.message }, 500);
      }

      return jsonRes({ success: true });
    }

    return jsonRes({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("Admin function error:", err);
    return jsonRes({ error: "Internal server error" }, 500);
  }
});
