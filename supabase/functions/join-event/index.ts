import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { corsHeaders } from "../_shared/cors.ts";
import { normalizeAppPath, safeAppOrigin } from "../_shared/request-security.ts";
import {
  canonicalizeDisplayName,
  resolveDisplayNameCandidates,
  resolveOptionalCallerDisplayName,
  resolveRequiredCallerDisplayName,
} from "./display-name.ts";
import {
  cleanupTemporaryUserAuthFirst,
  verifyAuthAdminUpdate,
} from "./auth-profile-sync.ts";

function jsonRes(data: any, status = 200) {
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
    const appOrigin = safeAppOrigin(Deno.env.get('APP_ORIGIN') || Deno.env.get('SITE_URL'));
    const admin = createClient(supabaseUrl, serviceKey);

    const isPastEventRetentionWindow = (eventEndDate: string) => {
      const endDate = new Date(eventEndDate);
      const cutoff = new Date(endDate.getTime() + 10 * 24 * 60 * 60 * 1000);
      return new Date() > cutoff;
    };

    const cleanupTemporaryUser = async (userId: string) => {
      try {
        const { error: votesError } = await admin.from('votes').delete().eq('user_id', userId);
        if (votesError) console.error('Cleanup votes error:', votesError);

        const { error: participantsError } = await admin.from('event_participants').delete().eq('user_id', userId);
        if (participantsError) console.error('Cleanup participants error:', participantsError);

        const { error: profileError } = await admin.from('profiles').delete().eq('user_id', userId);
        if (profileError) console.error('Cleanup profile error:', profileError);

        const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId);
        if (authDeleteError) {
          console.error('Cleanup auth user error:', authDeleteError);
          return false;
        }

        return true;
      } catch (cleanupError) {
        console.error('Cleanup temporary user error:', cleanupError);
        return false;
      }
    };

    const EMAIL_ACTIVATION_QUERY_PARAM = 'email_activation_token';

    const parseProfilePreferences = (value: unknown): Record<string, unknown> => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
      return value as Record<string, unknown>;
    };

    const extractUpgradePayload = (preferences: unknown) => {
      const parsed = parseProfilePreferences(preferences);
      const tempUpgrade = parsed.temp_upgrade;

      if (!tempUpgrade || typeof tempUpgrade !== 'object' || Array.isArray(tempUpgrade)) {
        return null;
      }

      const payload = tempUpgrade as Record<string, unknown>;
      const nonce = typeof payload.nonce === 'string' ? payload.nonce : null;
      const createdAt = typeof payload.created_at === 'string' ? payload.created_at : null;
      const method = typeof payload.method === 'string' ? payload.method : null;

      if (!nonce) return null;
      return { nonce, createdAt, method };
    };

    const extractPendingEmailActivation = (preferences: unknown) => {
      const parsed = parseProfilePreferences(preferences);
      const pending = parsed.pending_email_activation;
      if (!pending || typeof pending !== 'object' || Array.isArray(pending)) return null;

      const payload = pending as Record<string, unknown>;
      const token = typeof payload.token === 'string' ? payload.token : null;
      const expiresAt = typeof payload.expires_at === 'string' ? payload.expires_at : null;

      if (!token) return null;
      return { token, expiresAt };
    };

    const buildActivationRedirectUrl = (origin: string, activationToken: string, redirectTo?: string | null) => {
      const url = new URL(`${origin}/auth`);
      url.searchParams.set(EMAIL_ACTIVATION_QUERY_PARAM, activationToken);
      url.searchParams.set('redirect', normalizeAppPath(redirectTo, '/'));
      return url.toString();
    };

    const consumeShareToken = async (
      token: string,
      currentUseCount: number,
      maxUses: number | null,
    ): Promise<boolean> => {
      let update = admin
        .from('event_share_tokens')
        .update({ use_count: currentUseCount + 1 })
        .eq('token', token)
        .eq('use_count', currentUseCount);
      if (maxUses !== null) update = update.lt('use_count', maxUses);
      const { data, error } = await update.select('token').maybeSingle();
      if (error) console.error('Share token consume failed:', error.message);
      return Boolean(data);
    };

    const markPendingEmailActivation = async (
      userId: string,
      preferences: unknown,
    ): Promise<{ token: string; expiresAt: string } | null> => {
      const parsedPreferences = parseProfilePreferences(preferences);
      const pending = extractPendingEmailActivation(parsedPreferences);
      const now = new Date();
      const pendingIsValid = pending?.expiresAt ? new Date(pending.expiresAt) > now : Boolean(pending);
      const token = pendingIsValid && pending ? pending.token : crypto.randomUUID().replace(/-/g, '');
      const expiresAt = pendingIsValid && pending?.expiresAt
        ? pending.expiresAt
        : new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

      const { pending_email_activation: _oldPending, email_activation_completed_at: _oldCompleted, ...restPreferences } = parsedPreferences;

      const mergedPreferences = {
        ...restPreferences,
        pending_email_activation: {
          token,
          expires_at: expiresAt,
          requested_at: now.toISOString(),
        },
      };

      const { error } = await admin
        .from('profiles')
        .update({ preferences: mergedPreferences })
        .eq('user_id', userId);

      if (error) {
        console.error('Pending email activation update error:', error);
        return null;
      }

      return { token, expiresAt };
    };

    const completePendingEmailActivation = async (
      userId: string,
      preferences: unknown,
      activationToken?: string | null,
    ): Promise<{ success: boolean; alreadyCompleted?: boolean; error?: string }> => {
      const parsedPreferences = parseProfilePreferences(preferences);
      const pending = extractPendingEmailActivation(parsedPreferences);

      if (!pending) {
        return { success: true, alreadyCompleted: true };
      }

      const isExpired = pending.expiresAt ? new Date(pending.expiresAt) < new Date() : false;
      if (isExpired) {
        return { success: false, error: 'Lejárt az aktivációs folyamat, kérj új megerősítő e-mailt.' };
      }

      if (activationToken && activationToken !== pending.token) {
        return { success: false, error: 'Érvénytelen aktivációs token.' };
      }

      const { pending_email_activation: _removedPending, ...restPreferences } = parsedPreferences;
      const updatedPreferences = {
        ...restPreferences,
        email_activation_completed_at: new Date().toISOString(),
      };

      const { error } = await admin
        .from('profiles')
        .update({ preferences: updatedPreferences })
        .eq('user_id', userId);

      if (error) {
        console.error('Complete email activation update error:', error);
        return { success: false, error: 'Nem sikerült véglegesíteni az e-mail aktivációt.' };
      }

      return { success: true, alreadyCompleted: false };
    };

    const findAuthUserByEmail = async (email: string) => {
      const normalizedEmail = email.toLowerCase();
      const { data: authData, error: listUsersError } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

      if (listUsersError) {
        throw listUsersError;
      }

      return (
        authData.users.find(
          (existingUser) =>
            existingUser.email?.toLowerCase() === normalizedEmail && !existingUser.deleted_at,
        ) || null
      );
    };

    const sendUpgradeActivationLink = async (email: string, redirectTo: string) => {
      const anonClient = createClient(supabaseUrl, anonKey);
      const { error } = await anonClient.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: redirectTo,
        },
      });

      return error;
    };

    const body = await req.json();
    const { action } = body;

    // === UNAUTHENTICATED ACTIONS ===

    if (action === 'check-token') {
      const { token } = body;
      if (!token) return jsonRes({ error: "Token szükséges." }, 400);

      const { data: tokenData } = await admin
        .from('event_share_tokens')
        .select('allow_anonymous, event_id, expires_at, max_uses, use_count')
        .eq('token', token)
        .single();

      if (!tokenData) return jsonRes({ error: "Invalid token" }, 400);

      const { data: event } = await admin
        .from('events')
        .select('title, end_date')
        .eq('id', tokenData.event_id)
        .maybeSingle();

      if (!event || isPastEventRetentionWindow(event.end_date)) {
        return jsonRes({ error: "Event unavailable" }, 400);
      }

      const expired = tokenData.expires_at && new Date(tokenData.expires_at) < new Date();
      const limitReached = tokenData.max_uses !== null && tokenData.use_count >= tokenData.max_uses;

      return jsonRes({
        allow_anonymous: tokenData.allow_anonymous,
        event_title: event.title || '',
        event_id: tokenData.event_id,
        expired: !!expired,
        limit_reached: !!limitReached,
      });
    }

    if (action === 'anonymous-join') {
      const { token, display_name } = body;
      const displayNameResult = resolveRequiredCallerDisplayName(display_name);
      if (!token || !displayNameResult.ok) {
        return jsonRes({ error: "Token és név szükséges." }, 400);
      }
      const canonicalDisplayName = displayNameResult.value;

      const { data: shareToken } = await admin
        .from('event_share_tokens')
        .select('event_id, expires_at, max_uses, use_count, allow_anonymous')
        .eq('token', token)
        .single();

      if (!shareToken || !shareToken.allow_anonymous) {
        return jsonRes({ error: "Invalid token" }, 400);
      }
      if (shareToken.expires_at && new Date(shareToken.expires_at) < new Date()) {
        return jsonRes({ error: "Token expired" }, 400);
      }
      if (shareToken.max_uses !== null && shareToken.use_count >= shareToken.max_uses) {
        return jsonRes({ error: "Token usage limit reached" }, 400);
      }

      const { data: event } = await admin
        .from('events')
        .select('end_date')
        .eq('id', shareToken.event_id)
        .maybeSingle();

      if (!event || isPastEventRetentionWindow(event.end_date)) {
        return jsonRes({ error: "Event unavailable" }, 400);
      }

      const tempToken = crypto.randomUUID().replace(/-/g, '');
      const tempEmail = `temp_${tempToken}@temp.syncfolk.local`;
      const tempPassword = `Sync_${tempToken}_folk!1`;
      const tempVerificationCode = String(Math.floor(100000 + Math.random() * 900000));

      const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        email: tempEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { display_name: canonicalDisplayName, is_temporary: true },
      });

      if (createError || !newUser?.user) {
        console.error('Create user error:', createError);
        return jsonRes({ error: "Hiba a felhasználó létrehozásakor." }, 500);
      }

      const { error: profileError } = await admin.from('profiles').upsert({
        user_id: newUser.user.id,
        display_name: canonicalDisplayName,
        is_temporary: true,
        linked_event_id: shareToken.event_id,
        temp_access_token: tempToken,
        temp_verification_code: tempVerificationCode,
      }, { onConflict: 'user_id' });

      if (profileError) {
        console.error('Profile upsert error:', profileError);
        await admin.auth.admin.deleteUser(newUser.user.id);
        return jsonRes({ error: "Hiba az ideiglenes profil létrehozásakor." }, 500);
      }

      const { error: participantError } = await admin.from('event_participants').insert({
        event_id: shareToken.event_id,
        user_id: newUser.user.id,
      });
      if (participantError || !(await consumeShareToken(token, shareToken.use_count || 0, shareToken.max_uses))) {
        await cleanupTemporaryUser(newUser.user.id);
        return jsonRes({ error: "Token usage limit reached" }, 409);
      }

      const anonClient = createClient(supabaseUrl, anonKey);
      const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
        email: tempEmail,
        password: tempPassword,
      });

      if (signInError || !signInData?.session) {
        console.error('Sign in error:', signInError);
        return jsonRes({ error: "Hiba a bejelentkezéskor." }, 500);
      }

      return jsonRes({
        success: true,
        session: {
          access_token: signInData.session.access_token,
          refresh_token: signInData.session.refresh_token,
        },
        temp_access_token: tempToken,
        temp_verification_code: tempVerificationCode,
        event_id: shareToken.event_id,
      });
    }

    if (action === 'temp-sign-in') {
      const { temp_token, verification_code } = body;
      if (!temp_token) return jsonRes({ error: "Token szükséges." }, 400);
      if (!verification_code || typeof verification_code !== 'string' || verification_code.trim().length !== 6) {
        return jsonRes({ error: "Érvénytelen ellenőrző kód.", code: "VERIFICATION_REQUIRED" }, 400);
      }

      const { data: profile } = await admin
        .from('profiles')
        .select('user_id, linked_event_id, temp_access_token, temp_verification_code')
        .eq('temp_access_token', temp_token)
        .eq('is_temporary', true)
        .single();

      if (!profile || !profile.linked_event_id) {
        if (profile?.user_id) {
          await cleanupTemporaryUser(profile.user_id);
        }
        return jsonRes({ error: "Event unavailable" }, 400);
      }

      if (profile.temp_verification_code !== verification_code.trim()) {
        return jsonRes({ error: "Hibás ellenőrző kód.", code: "INVALID_CODE" }, 400);
      }

      const { data: event } = await admin
        .from('events')
        .select('end_date')
        .eq('id', profile.linked_event_id)
        .maybeSingle();

      if (!event || isPastEventRetentionWindow(event.end_date)) {
        await cleanupTemporaryUser(profile.user_id);
        return jsonRes({ error: "Event unavailable" }, 400);
      }

      const tempEmail = `temp_${profile.temp_access_token}@temp.syncfolk.local`;
      const tempPassword = `Sync_${profile.temp_access_token}_folk!1`;

      const anonClient = createClient(supabaseUrl, anonKey);
      const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
        email: tempEmail,
        password: tempPassword,
      });

      if (signInError || !signInData?.session) {
        console.error('Temp sign in error:', signInError);
        return jsonRes({ error: "Bejelentkezési hiba." }, 500);
      }

      return jsonRes({
        success: true,
        session: {
          access_token: signInData.session.access_token,
          refresh_token: signInData.session.refresh_token,
        },
        event_id: profile.linked_event_id,
      });
    }

    if (action === 'resend-email-activation') {
      const { email, redirect_to } = body;
      const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
      if (!normalizedEmail) {
        return jsonRes({ error: 'E-mail cím szükséges.' }, 400);
      }

      try {
        const existingUser = await findAuthUserByEmail(normalizedEmail);
        if (!existingUser?.id || !existingUser.email) {
          return jsonRes({ success: true });
        }

        const { data: profile } = await admin
          .from('profiles')
          .select('is_temporary, preferences')
          .eq('user_id', existingUser.id)
          .maybeSingle();

        if (!profile || profile.is_temporary) {
          return jsonRes({ success: true });
        }

        const pendingActivation = extractPendingEmailActivation(profile.preferences);
        if (!pendingActivation) {
          return jsonRes({ success: true });
        }

        const siteOrigin = appOrigin;
        const safeRedirect = typeof redirect_to === 'string' && redirect_to.startsWith('/') ? redirect_to : '/';
        const activationRedirectUrl = buildActivationRedirectUrl(siteOrigin, pendingActivation.token, safeRedirect);
        const activationError = await sendUpgradeActivationLink(existingUser.email, activationRedirectUrl);

        if (activationError) {
          console.error('Resend activation email error:', activationError);
          return jsonRes({ error: 'Nem sikerült újraküldeni az aktivációs e-mailt.' }, 500);
        }

        return jsonRes({ success: true });
      } catch (resendError) {
        console.error('Resend email activation unexpected error:', resendError);
        return jsonRes({ error: 'Nem sikerült újraküldeni az aktivációs e-mailt.' }, 500);
      }
    }

    // === AUTHENTICATED ACTIONS ===
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonRes({ error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonRes({ error: "Unauthorized" }, 401);

    if (action === 'request-google-oauth-activation') {
      const { redirect_to, oauth_intent } = body;
      const oauthIntent = oauth_intent === 'register' ? 'register' : 'signin';

      if (!user.email) {
        return jsonRes({ error: 'A fiókhoz nincs e-mail cím társítva.' }, 400);
      }

      const providers = Array.isArray((user.app_metadata as Record<string, unknown> | undefined)?.providers)
        ? ((user.app_metadata as Record<string, unknown>).providers as string[])
        : [];

      if (!providers.includes('google')) {
        return jsonRes({ success: true, activation_required: false });
      }

      const { data: profile, error: profileError } = await admin
        .from('profiles')
        .select('is_temporary, preferences')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Google activation profile fetch error:', profileError);
        return jsonRes({ error: 'Nem sikerült ellenőrizni az aktivációs állapotot.' }, 500);
      }

      if (profile?.is_temporary) {
        return jsonRes({ error: 'Temporary felhasználóhoz ez a művelet nem elérhető.' }, 400);
      }

      const preferences = parseProfilePreferences(profile?.preferences);
      const completedAt = typeof preferences.email_activation_completed_at === 'string'
        ? preferences.email_activation_completed_at
        : null;

      const accountCreatedAtMs = user.created_at ? new Date(user.created_at).getTime() : null;
      const LEGACY_BYPASS_ACCOUNT_AGE_MS = 30 * 24 * 60 * 60 * 1000;
      const shouldBypassLegacyActivation =
        oauthIntent !== 'register' &&
        accountCreatedAtMs !== null &&
        Date.now() - accountCreatedAtMs > LEGACY_BYPASS_ACCOUNT_AGE_MS;

      if (completedAt || shouldBypassLegacyActivation) {
        if (!completedAt) {
          const { pending_email_activation: _oldPending, ...restPreferences } = preferences;
          const { error: completeLegacyError } = await admin
            .from('profiles')
            .update({
              preferences: {
                ...restPreferences,
                email_activation_completed_at: new Date().toISOString(),
              },
            })
            .eq('user_id', user.id);

          if (completeLegacyError) {
            console.error('Legacy Google activation bypass update error:', completeLegacyError);
            return jsonRes({ error: 'Nem sikerült frissíteni a belépési állapotot.' }, 500);
          }
        }

        return jsonRes({ success: true, activation_required: false, email: user.email });
      }

      const pendingActivation = await markPendingEmailActivation(user.id, preferences);
      if (!pendingActivation) {
        return jsonRes({ error: 'Nem sikerült előkészíteni az aktivációt.' }, 500);
      }

      const siteOrigin = appOrigin;
      const safeRedirect = typeof redirect_to === 'string' && redirect_to.startsWith('/') ? redirect_to : '/';
      const activationRedirectUrl = buildActivationRedirectUrl(siteOrigin, pendingActivation.token, safeRedirect);
      const activationEmailError = await sendUpgradeActivationLink(user.email, activationRedirectUrl);

      if (activationEmailError) {
        console.error('Google activation email error:', activationEmailError);
        return jsonRes({ error: 'Nem sikerült elküldeni az aktivációs e-mailt.', error_code: 'activation_email_failed' }, 500);
      }

      return jsonRes({
        success: true,
        activation_required: true,
        email: user.email,
      });
    }

    if (action === 'complete-email-activation') {
      const { activation_token } = body;

      const { data: profile, error: profileError } = await admin
        .from('profiles')
        .select('is_temporary, preferences')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Complete activation profile fetch error:', profileError);
        return jsonRes({ error: 'Nem sikerült véglegesíteni az aktivációt.' }, 500);
      }

      if (profile?.is_temporary) {
        return jsonRes({ error: 'Temporary felhasználó nem véglegesítheti ezt az aktivációt.' }, 400);
      }

      const completionResult = await completePendingEmailActivation(
        user.id,
        profile?.preferences,
        typeof activation_token === 'string' ? activation_token : null,
      );

      if (!completionResult.success) {
        return jsonRes({ error: completionResult.error || 'Aktivációs hiba történt.' }, 400);
      }

      return jsonRes({ success: true, already_completed: completionResult.alreadyCompleted || false });
    }


    if (action === 'create-enterprise-instant-user') {
      const workspaceId = typeof body.workspace_id === 'string' ? body.workspace_id.trim() : '';
      if (!workspaceId) return jsonRes({ error: 'Hiányzó workspace azonosító.' }, 400);

      const { data: adminMembership, error: adminMembershipError } = await admin
        .from('enterprise_memberships')
        .select('id, role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (adminMembershipError) {
        console.error('Instant user admin membership check error:', adminMembershipError);
        return jsonRes({ error: 'Nem sikerült ellenőrizni a jogosultságot.' }, 500);
      }

      if (!adminMembership || !['owner', 'resourceAssistant'].includes(adminMembership.role)) {
        return jsonRes({ error: 'Nincs jogosultság instant user létrehozásához.' }, 403);
      }

      const pick = <T,>(items: T[]): T | null => items.length > 0 ? items[Math.floor(Math.random() * items.length)] : null;
      const uniqueNonEmpty = (items: unknown[]) => Array.from(new Set(
        items.filter((v): v is string => typeof v === 'string' && v.trim().length > 0).map(v => v.trim())
      ));
      const randomInt = (min: number, max: number) => Math.floor(min + Math.random() * (max - min + 1));

      const [membersRes, officesRes, roleDefsRes, skillsRes] = await Promise.all([
        admin
          .from('enterprise_memberships')
          .select('team, location, city, office_id, business_role, base_working_hours, working_pattern')
          .eq('workspace_id', workspaceId)
          .eq('status', 'active'),
        admin
          .from('enterprise_offices')
          .select('id, name, city')
          .eq('workspace_id', workspaceId),
        admin
          .from('enterprise_role_definitions')
          .select('role_key, display_name')
          .eq('workspace_id', workspaceId),
        admin
          .from('enterprise_skills')
          .select('id')
          .eq('workspace_id', workspaceId),
      ]);

      if (membersRes.error) {
        console.error('Instant user members fetch error:', membersRes.error);
        return jsonRes({ error: 'Nem sikerült betölteni a meglévő tag értékkészletet.' }, 500);
      }
      if (officesRes.error) {
        console.error('Instant user offices fetch error:', officesRes.error);
        return jsonRes({ error: 'Nem sikerült betölteni a telephelyeket.' }, 500);
      }
      if (roleDefsRes.error) {
        console.error('Instant user role definitions fetch error:', roleDefsRes.error);
        return jsonRes({ error: 'Nem sikerült betölteni a pozíciókat.' }, 500);
      }
      if (skillsRes.error) {
        console.error('Instant user skills fetch error:', skillsRes.error);
        return jsonRes({ error: 'Nem sikerült betölteni a skilleket.' }, 500);
      }

      const existingMembers = (membersRes.data || []) as any[];
      const offices = (officesRes.data || []) as any[];
      const roleDefs = (roleDefsRes.data || []) as any[];
      const skills = (skillsRes.data || []) as any[];

      const selectedOffice = pick(offices);
      const selectedRole = pick(uniqueNonEmpty([
        ...roleDefs.map((r) => r.role_key),
        ...roleDefs.map((r) => r.display_name),
        ...existingMembers.map((m) => m.business_role),
      ]));
      const selectedTeam = pick(uniqueNonEmpty(existingMembers.map((m) => m.team)));
      const selectedLocation = selectedOffice?.name || pick(uniqueNonEmpty(existingMembers.map((m) => m.location)));
      const selectedCity = selectedOffice?.city || pick(uniqueNonEmpty(existingMembers.map((m) => m.city)));
      const selectedPattern = pick(existingMembers.map((m) => m.working_pattern).filter(Boolean));
      const selectedBaseHours = pick(existingMembers.map((m) => m.base_working_hours).filter((v) => typeof v === 'number'));

      const suffix = crypto.randomUUID().slice(0, 8);
      const displayName = `Instant User ${randomInt(1000, 9999)}`;
      const email = `instant-${workspaceId.slice(0, 8)}-${suffix}@instant.syncfolk.local`.toLowerCase();
      const password = `SyncfolkInstant-${crypto.randomUUID()}!1`;

      const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: displayName,
          source: 'enterprise_instant_user',
          workspace_id: workspaceId,
        },
      });

      if (createUserError || !createdUser.user) {
        console.error('Instant user auth create error:', createUserError);
        return jsonRes({ error: createUserError?.message || 'Nem sikerült létrehozni az auth usert.' }, 500);
      }

      const instantUserId = createdUser.user.id;
      const cleanupCreatedUser = async () => {
        try { await admin.auth.admin.deleteUser(instantUserId); } catch (cleanupError) { console.error('Instant user auth cleanup error:', cleanupError); }
      };

      const { error: profileError } = await admin.from('profiles').upsert({
        user_id: instantUserId,
        display_name: displayName,
        preferences: {
          source: 'enterprise_instant_user',
          random_email: email,
          workspace_id: workspaceId,
          created_by: user.id,
          created_at: new Date().toISOString(),
        },
      }, { onConflict: 'user_id' });

      if (profileError) {
        console.error('Instant user profile upsert error:', profileError);
        await cleanupCreatedUser();
        return jsonRes({ error: 'Nem sikerült létrehozni a profilt.' }, 500);
      }

      const membershipPayload: Record<string, unknown> = {
        workspace_id: workspaceId,
        user_id: instantUserId,
        role: 'member',
        status: 'active',
        joined_at: new Date().toISOString(),
        team: selectedTeam,
        business_role: selectedRole,
        office_id: selectedOffice?.id || null,
        city: selectedCity,
        location: selectedLocation,
      };
      if (selectedPattern) membershipPayload.working_pattern = selectedPattern;
      if (typeof selectedBaseHours === 'number') membershipPayload.base_working_hours = selectedBaseHours;

      const { data: membership, error: membershipError } = await admin
        .from('enterprise_memberships')
        .insert(membershipPayload)
        .select('id')
        .single();

      if (membershipError || !membership) {
        console.error('Instant user membership insert error:', membershipError);
        await admin.from('profiles').delete().eq('user_id', instantUserId);
        await cleanupCreatedUser();
        return jsonRes({ error: 'Nem sikerült létrehozni az aktív tagságot.' }, 500);
      }

      if (selectedRole) {
        const { error: allocationError } = await admin.from('enterprise_member_role_allocations').insert({
          workspace_id: workspaceId,
          membership_id: membership.id,
          business_role: selectedRole,
          percentage: 100,
        });
        if (allocationError) console.error('Instant user role allocation insert error:', allocationError);
      }

      if (skills.length > 0) {
        const shuffledSkills = [...skills].sort(() => Math.random() - 0.5).slice(0, Math.min(skills.length, randomInt(1, Math.min(3, skills.length))));
        const skillRows = shuffledSkills.map((skill) => ({
          workspace_id: workspaceId,
          membership_id: membership.id,
          skill_id: skill.id,
          level: randomInt(1, 5),
        }));
        const { error: skillError } = await admin.from('enterprise_member_skills').insert(skillRows);
        if (skillError) console.error('Instant user member skills insert error:', skillError);
      }

      await admin.from('enterprise_audit_events').insert({
        workspace_id: workspaceId,
        actor_id: user.id,
        action: 'membership.instant_user_created',
        affected_user_id: instantUserId,
        metadata: {
          display_name: displayName,
          email,
          membership_id: membership.id,
          business_role: selectedRole,
          team: selectedTeam,
          office_id: selectedOffice?.id || null,
        },
      });

      return jsonRes({
        success: true,
        user: { id: instantUserId, email, display_name: displayName },
        membership_id: membership.id,
      });
    }

    if (action === 'accept-enterprise-invite') {
      const invitationToken =
        typeof body.invitation_token === 'string' ? body.invitation_token.trim() : '';

      if (!invitationToken) {
        return jsonRes({ error: 'Hiányzó meghívó token.' }, 400);
      }

      const { data: acceptanceData, error: acceptanceError } = await admin.rpc(
        'accept_enterprise_invitation',
        {
          _invitation_token: invitationToken,
          _user_id: user.id,
        },
      );

      if (acceptanceError) {
        console.error('Enterprise invite transaction error:', acceptanceError);
        return jsonRes({ error: 'Nem sikerült véglegesíteni a meghívót.' }, 500);
      }

      const acceptance =
        acceptanceData && typeof acceptanceData === 'object' && !Array.isArray(acceptanceData)
          ? (acceptanceData as Record<string, unknown>)
          : {};
      if (acceptance.ok !== true) {
        switch (acceptance.code) {
          case 'INVITE_NOT_FOUND':
            return jsonRes({ error: 'A meghívó nem található vagy már nem érvényes.' }, 404);
          case 'USER_EMAIL_MISSING':
            return jsonRes({ error: 'A fiókhoz nincs e-mail cím társítva.' }, 400);
          case 'EMAIL_MISMATCH':
            return jsonRes({ error: 'Ezzel a fiókkal nem tudod elfogadni ezt a meghívót.' }, 403);
          case 'WORKSPACE_UNAVAILABLE':
            return jsonRes({ error: 'A munkaterület már nem érhető el.' }, 400);
          case 'ALREADY_USED':
            return jsonRes({ error: 'Ez a meghívó már fel lett használva.' }, 409);
          case 'INVITE_EXPIRED':
            return jsonRes({ error: 'Ez a meghívó már lejárt.' }, 400);
          case 'INVALID_PREFILL':
            return jsonRes({ error: 'A meghívóhoz tartozó beállítások érvénytelenek.' }, 409);
          default:
            console.error('Unexpected enterprise invite result:', acceptance);
            return jsonRes({ error: 'Nem sikerült elfogadni a meghívót.' }, 500);
        }
      }

      if (Array.isArray(acceptance.warnings) && acceptance.warnings.length > 0) {
        console.warn('Enterprise invite accepted with warnings:', acceptance.warnings);
      }

      return jsonRes({
        success: true,
        already_member: acceptance.already_member === true,
        workspace_id: acceptance.workspace_id,
      });
    }

    if (action === 'update-temp-name') {
      const { display_name } = body;
      const displayNameResult = resolveRequiredCallerDisplayName(display_name);
      if (!displayNameResult.ok) return jsonRes({ error: "Érvénytelen név." }, 400);
      const normalizedDisplayName = displayNameResult.value;

      const { data: tempProfile, error: tempProfileError } = await admin
        .from('profiles')
        .select('is_temporary, display_name, preferences')
        .eq('user_id', user.id)
        .maybeSingle();

      if (tempProfileError) {
        console.error('Temp profile lookup failed before name update.');
        return jsonRes({ error: 'Nem sikerült betölteni a profilt.' }, 500);
      }

      if (!tempProfile?.is_temporary) {
        return jsonRes({ error: 'Csak temporary felhasználó módosíthatja ezt a nevet.' }, 403);
      }

      const previousProfile = {
        display_name: tempProfile.display_name,
        preferences: tempProfile.preferences,
      };

      if (Object.hasOwn(parseProfilePreferences(tempProfile.preferences), 'temp_upgrade')) {
        return jsonRes({
          error: 'A Google-regisztráció előkészítése közben a név már nem módosítható.',
          error_code: 'temp_upgrade_in_progress',
        }, 409);
      }

      let profileMutation = admin
        .from('profiles')
        .update({ display_name: normalizedDisplayName })
        .eq('user_id', user.id);
      profileMutation = previousProfile.display_name === null
        ? profileMutation.is('display_name', null)
        : profileMutation.eq('display_name', previousProfile.display_name);
      if (previousProfile.preferences === null) {
        profileMutation = profileMutation.is('preferences', null);
      } else {
        profileMutation = profileMutation.eq(
          'preferences',
          JSON.stringify(previousProfile.preferences),
        );
      }
      const { data: updatedProfile, error: profileUpdateError } =
        await profileMutation.select('user_id').maybeSingle();

      if (profileUpdateError) {
        console.error('Temp profile name update error:', profileUpdateError);
        return jsonRes({ error: 'Nem sikerült menteni a nevet.' }, 500);
      }
      if (updatedProfile?.user_id !== user.id) {
        return jsonRes({
          error: 'A profil időközben megváltozott. Próbáld újra.',
          error_code: 'profile_conflict',
        }, 409);
      }

      return jsonRes({ success: true, display_name: normalizedDisplayName });
    }

    if (action === 'prepare-temp-google-upgrade') {
      const { display_name } = body;
      const displayNameResult = resolveRequiredCallerDisplayName(display_name);
      if (!displayNameResult.ok) {
        return jsonRes({ error: 'Add meg a megjelenített nevedet.' }, 400);
      }
      const normalizedName = displayNameResult.value;

      const { data: tempProfile, error: tempProfileError } = await admin
        .from('profiles')
        .select('is_temporary, display_name, preferences')
        .eq('user_id', user.id)
        .maybeSingle();

      if (tempProfileError || !tempProfile || !tempProfile.is_temporary) {
        return jsonRes({ error: 'Csak temporary felhasználó készíthet ilyen regisztrációt.' }, 400);
      }

      const previousProfile = {
        display_name: tempProfile.display_name,
        preferences: tempProfile.preferences,
      };

      if (Object.hasOwn(parseProfilePreferences(tempProfile.preferences), 'temp_upgrade')) {
        return jsonRes({
          error: 'A Google-regisztráció előkészítése már folyamatban van.',
          error_code: 'temp_upgrade_in_progress',
        }, 409);
      }

      const upgradeNonce = crypto.randomUUID().replace(/-/g, '');
      const mergedPreferences = {
        ...parseProfilePreferences(tempProfile.preferences),
        temp_upgrade: {
          nonce: upgradeNonce,
          created_at: new Date().toISOString(),
          method: 'google',
        },
      };

      let profileMutation = admin
        .from('profiles')
        .update({
          display_name: normalizedName,
          preferences: mergedPreferences,
        })
        .eq('user_id', user.id);
      profileMutation = previousProfile.display_name === null
        ? profileMutation.is('display_name', null)
        : profileMutation.eq('display_name', previousProfile.display_name);
      if (previousProfile.preferences === null) {
        profileMutation = profileMutation.is('preferences', null);
      } else {
        profileMutation = profileMutation.eq(
          'preferences',
          JSON.stringify(previousProfile.preferences),
        );
      }
      const { data: updatedProfile, error: profileUpdateError } =
        await profileMutation.select('user_id').maybeSingle();

      if (profileUpdateError) {
        console.error('Prepare Google upgrade profile update error:', profileUpdateError);
        return jsonRes({ error: 'Nem sikerült előkészíteni a Google-regisztrációt.' }, 500);
      }
      if (updatedProfile?.user_id !== user.id) {
        return jsonRes({
          error: 'A profil időközben megváltozott. Indítsd újra a Google-regisztrációt.',
          error_code: 'profile_conflict',
        }, 409);
      }

      return jsonRes({
        success: true,
        upgrade_nonce: upgradeNonce,
        temp_user_id: user.id,
      });
    }

    if (action === 'finalize-temp-google-upgrade') {
      const { upgrade_nonce, temp_user_id } = body;

      if (!upgrade_nonce || !temp_user_id) {
        return jsonRes({ error: 'Hiányzó Google-regisztrációs azonosító.' }, 400);
      }

      if (user.id === temp_user_id) {
        return jsonRes({ error: 'Google-regisztráció nem történt meg.' }, 400);
      }

      const { data: tempProfile, error: tempProfileError } = await admin
        .from('profiles')
        .select('user_id, display_name, linked_event_id, preferences, is_temporary')
        .eq('user_id', temp_user_id)
        .maybeSingle();

      if (tempProfileError || !tempProfile || !tempProfile.is_temporary) {
        return jsonRes({ error: 'A temporary felhasználó már nem elérhető.' }, 400);
      }

      const upgradePayload = extractUpgradePayload(tempProfile.preferences);
      if (!upgradePayload || upgradePayload.nonce !== upgrade_nonce) {
        return jsonRes({ error: 'Lejárt vagy érvénytelen Google-regisztrációs folyamat.' }, 400);
      }

      const displayNameResult = canonicalizeDisplayName(tempProfile.display_name);
      if (!displayNameResult.ok) {
        return jsonRes({
          error: 'A regisztrációhoz tartozó megjelenített név érvénytelen.',
          error_code: 'invalid_display_name_state',
        }, 409);
      }
      const finalizedDisplayName = displayNameResult.value;

      if (upgradePayload.createdAt) {
        const preparedAt = new Date(upgradePayload.createdAt);
        const preparedAtMs = preparedAt.getTime();
        const allowedClockSkewMs = 5000;

        const [authUserResult, oauthProfile, existingEvent, existingParticipant, existingVote] = await Promise.all([
          admin.auth.admin.getUserById(user.id),
          admin
            .from('profiles')
            .select('created_at')
            .eq('user_id', user.id)
            .maybeSingle(),
          admin
            .from('events')
            .select('id')
            .eq('created_by', user.id)
            .lt('created_at', upgradePayload.createdAt)
            .limit(1)
            .maybeSingle(),
          admin
            .from('event_participants')
            .select('id')
            .eq('user_id', user.id)
            .lt('invited_at', upgradePayload.createdAt)
            .limit(1)
            .maybeSingle(),
          admin
            .from('votes')
            .select('id')
            .eq('user_id', user.id)
            .lt('created_at', upgradePayload.createdAt)
            .limit(1)
            .maybeSingle(),
        ]);

        const authoritativeCreatedAt = authUserResult.data?.user?.created_at || user.created_at;
        const oauthUserCreatedAtMs = authoritativeCreatedAt ? new Date(authoritativeCreatedAt).getTime() : null;
        const oauthProfileCreatedAtMs = oauthProfile.data?.created_at ? new Date(oauthProfile.data.created_at).getTime() : null;
        const hasHistoricalActivity = Boolean(existingEvent.data || existingParticipant.data || existingVote.data);

        const isExistingGoogleAccount =
          hasHistoricalActivity ||
          (oauthUserCreatedAtMs !== null && oauthUserCreatedAtMs < preparedAtMs - allowedClockSkewMs) ||
          (oauthProfileCreatedAtMs !== null && oauthProfileCreatedAtMs < preparedAtMs - allowedClockSkewMs);

        if (isExistingGoogleAccount) {
          return jsonRes({
            error: 'Ez a Google-fiók már egy meglévő Syncfolk fiókhoz tartozik. Válassz másik Google-fiókot az adatmigráláshoz.',
            error_code: 'google_account_exists',
          }, 409);
        }
      }

      if (!tempProfile.linked_event_id) {
        await cleanupTemporaryUser(tempProfile.user_id);
        return jsonRes({ error: 'A kapcsolódó eseménynaptár már nem elérhető.' }, 400);
      }

      const { data: linkedEvent } = await admin
        .from('events')
        .select('id, end_date')
        .eq('id', tempProfile.linked_event_id)
        .maybeSingle();

      if (!linkedEvent || isPastEventRetentionWindow(linkedEvent.end_date)) {
        await cleanupTemporaryUser(tempProfile.user_id);
        return jsonRes({ error: 'A kapcsolódó eseménynaptár már nem elérhető.' }, 400);
      }

      const { data: tempVotes } = await admin
        .from('votes')
        .select('vote_date, vote_value')
        .eq('event_id', tempProfile.linked_event_id)
        .eq('user_id', tempProfile.user_id);

      if ((tempVotes || []).length > 0) {
        const mergedVotes = (tempVotes || []).map((vote) => ({
          event_id: tempProfile.linked_event_id,
          user_id: user.id,
          vote_date: vote.vote_date,
          vote_value: vote.vote_value,
        }));

        const { error: mergeVotesError } = await admin
          .from('votes')
          .upsert(mergedVotes, { onConflict: 'event_id,user_id,vote_date' });

        if (mergeVotesError) {
          console.error('Finalize Google upgrade vote merge error:', mergeVotesError);
          return jsonRes({ error: 'Hiba történt a szavazataid átvételekor.' }, 500);
        }
      }

      await admin
        .from('votes')
        .delete()
        .eq('event_id', tempProfile.linked_event_id)
        .eq('user_id', tempProfile.user_id);

      const { data: existingParticipant } = await admin
        .from('event_participants')
        .select('id')
        .eq('event_id', tempProfile.linked_event_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!existingParticipant) {
        const { error: participantError } = await admin
          .from('event_participants')
          .insert({ event_id: tempProfile.linked_event_id, user_id: user.id });

        if (participantError) {
          console.error('Finalize Google upgrade participant insert error:', participantError);
          return jsonRes({ error: 'Hiba történt az eseménynaptárhoz csatlakozáskor.' }, 500);
        }
      }

      const { data: currentProfile } = await admin
        .from('profiles')
        .select('preferences')
        .eq('user_id', user.id)
        .maybeSingle();

      const currentPreferences = parseProfilePreferences(currentProfile?.preferences);
      const {
        temp_upgrade: _ignored,
        pending_email_activation: _ignoredPending,
        email_activation_completed_at: _ignoredCompleted,
        ...cleanedPreferences
      } = currentPreferences;

      const { error: upsertProfileError } = await admin
        .from('profiles')
        .upsert({
          user_id: user.id,
          display_name: finalizedDisplayName,
          is_temporary: false,
          linked_event_id: null,
          temp_access_token: null,
          preferences: cleanedPreferences,
        }, { onConflict: 'user_id' });

      if (upsertProfileError) {
        console.error('Finalize Google upgrade profile upsert error:', upsertProfileError);
        return jsonRes({ error: 'Hiba történt a profil frissítésekor.' }, 500);
      }

      const pendingActivation = await markPendingEmailActivation(user.id, cleanedPreferences);
      if (!pendingActivation) {
        return jsonRes({ error: 'Nem sikerült előkészíteni az e-mail aktivációt.' }, 500);
      }

      const authUpdated = await verifyAuthAdminUpdate(
        user.id,
        () => admin.auth.admin.updateUserById(user.id, {
          user_metadata: {
            ...user.user_metadata,
            display_name: finalizedDisplayName,
            is_temporary: false,
          },
        }),
      );
      if (!authUpdated) {
        console.error('Finalize Google upgrade auth metadata update failed.');
        return jsonRes({
          error: 'Nem sikerült véglegesíteni a fiókadatokat.',
          error_code: 'auth_update_failed',
        }, 500);
      }

      const temporaryUserCleanup = await cleanupTemporaryUserAuthFirst({
        expectedUserId: tempProfile.user_id,
        getAuthUser: () => admin.auth.admin.getUserById(tempProfile.user_id),
        deleteAuthUser: () => admin.auth.admin.deleteUser(tempProfile.user_id),
        deleteDatabaseRows: [
          async () => {
            const { error } = await admin
              .from('votes')
              .delete()
              .eq('user_id', tempProfile.user_id);
            return !error;
          },
          async () => {
            const { error } = await admin
              .from('event_participants')
              .delete()
              .eq('user_id', tempProfile.user_id);
            return !error;
          },
          async () => {
            const { error } = await admin
              .from('profiles')
              .delete()
              .eq('user_id', tempProfile.user_id);
            return !error;
          },
        ],
      });
      if (!temporaryUserCleanup.ok) {
        console.error(
          temporaryUserCleanup.reason === 'database_cleanup_failed'
            ? 'Finalize Google upgrade temporary database cleanup failed after auth cleanup.'
            : 'Finalize Google upgrade temporary auth cleanup state is not authoritative; database cleanup skipped.',
        );
        return jsonRes({
          error: 'Nem sikerült lezárni az ideiglenes fiók átvitelét.',
          error_code: temporaryUserCleanup.reason,
        }, 500);
      }

      const siteOrigin = appOrigin;
      const activationRedirectUrl = buildActivationRedirectUrl(siteOrigin, pendingActivation.token, '/');
      if (user.email) {
        const activationEmailError = await sendUpgradeActivationLink(user.email, activationRedirectUrl);
        if (activationEmailError) {
          console.error('Google upgrade activation email error:', activationEmailError);
          return jsonRes({ error: 'A fiók létrejött, de az aktivációs e-mail küldése sikertelen volt.', error_code: 'activation_email_failed' }, 500);
        }
      }

      return jsonRes({
        success: true,
        event_id: tempProfile.linked_event_id,
        verification_required: true,
        email: user.email,
      });
    }

    if (action === 'delete-event') {
      const { event_id } = body;
      if (!event_id) return jsonRes({ error: "Hiányzó eseményazonosító." }, 400);

      const { data: eventData } = await admin
        .from('events')
        .select('id, created_by')
        .eq('id', event_id)
        .maybeSingle();

      if (!eventData) return jsonRes({ error: "Esemény nem található." }, 404);
      if (eventData.created_by !== user.id) {
        return jsonRes({ error: "Nincs jogosultságod törölni ezt az eseményt." }, 403);
      }

      const { data: tempProfiles, error: tempProfilesError } = await admin
        .from('profiles')
        .select('user_id')
        .eq('is_temporary', true)
        .eq('linked_event_id', event_id);

      if (tempProfilesError) {
        console.error('Temp profile fetch error:', tempProfilesError);
        return jsonRes({ error: "Hiba a temporary felhasználók lekérdezésekor." }, 500);
      }

      let deletedTempUsers = 0;
      for (const tempProfile of tempProfiles || []) {
        const deleted = await cleanupTemporaryUser(tempProfile.user_id);
        if (deleted) deletedTempUsers++;
      }

      await admin.from('votes').delete().eq('event_id', event_id);
      await admin.from('event_participants').delete().eq('event_id', event_id);
      await admin.from('event_share_tokens').delete().eq('event_id', event_id);

      const { error: deleteEventError } = await admin
        .from('events')
        .delete()
        .eq('id', event_id)
        .eq('created_by', user.id);

      if (deleteEventError) {
        console.error('Delete event error:', deleteEventError);
        return jsonRes({ error: "Hiba az esemény törlése során." }, 500);
      }

      return jsonRes({ success: true, deleted_temp_users: deletedTempUsers });
    }

    if (action === 'upgrade-temp-user') {
      const { email, password, keep_data } = body;
      if (!email || !password) return jsonRes({ error: "Email és jelszó szükséges." }, 400);

      // This field is optional for backward compatibility. Absence may use the
      // authoritative stored candidates below; an explicitly invalid value is
      // rejected before any auth or profile mutation and never falls back.
      const callerDisplayName = resolveOptionalCallerDisplayName(body);
      if (!callerDisplayName.ok) {
        return jsonRes({ error: 'Érvénytelen megjelenített név.' }, 400);
      }

      const normalizedEmail = String(email).trim().toLowerCase();

      const { data: profile, error: profileError } = await admin
        .from('profiles')
        .select('is_temporary, linked_event_id, display_name')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError || !profile || !profile.is_temporary) {
        return jsonRes({ error: "Nem temporary felhasználó." }, 400);
      }

      if (!keep_data) {
        return jsonRes({ success: true, proceed_normal_registration: true });
      }

      const displayNameResult = callerDisplayName.provided
        ? canonicalizeDisplayName(callerDisplayName.value)
        : resolveDisplayNameCandidates([
          profile.display_name,
          user.user_metadata?.display_name,
          normalizedEmail,
        ]);
      if (!displayNameResult.ok || displayNameResult.value === null) {
        return jsonRes({
          error: 'A regisztrációhoz tartozó megjelenített név érvénytelen.',
          error_code: 'invalid_display_name_state',
        }, 409);
      }
      const normalizedDisplayName = displayNameResult.value;

      try {
        const existingUserByEmail = await findAuthUserByEmail(normalizedEmail);
        if (existingUserByEmail && existingUserByEmail.id !== user.id) {
          return jsonRes({ error: 'Ez az e-mail cím már regisztrálva van.', error_code: 'email_exists' }, 400);
        }
      } catch (listUsersError) {
        console.error('List users error during temp upgrade:', listUsersError);
        return jsonRes({ error: 'Nem sikerült ellenőrizni az e-mail címet. Kérlek próbáld újra.' }, 500);
      }

      if (!profile.linked_event_id) {
        await cleanupTemporaryUser(user.id);
        return jsonRes({ error: 'A kapcsolódó eseménynaptár már nem elérhető.' }, 400);
      }

      const { data: linkedEvent } = await admin
        .from('events')
        .select('id, end_date')
        .eq('id', profile.linked_event_id)
        .maybeSingle();

      if (!linkedEvent || isPastEventRetentionWindow(linkedEvent.end_date)) {
        await cleanupTemporaryUser(user.id);
        return jsonRes({ error: 'A kapcsolódó eseménynaptár már nem elérhető.' }, 400);
      }

      const { data: newUserData, error: createUserError } = await admin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: false,
        user_metadata: {
          display_name: normalizedDisplayName,
          is_temporary: false,
        },
      });

      if (createUserError || !newUserData?.user) {
        const normalizedError = (createUserError?.message || '').toLowerCase();
        if (
          normalizedError.includes('already been registered') ||
          normalizedError.includes('already exists') ||
          normalizedError.includes('duplicate') ||
          normalizedError.includes('email_exists')
        ) {
          return jsonRes({ error: 'Ez az e-mail cím már regisztrálva van.', error_code: 'email_exists' }, 400);
        }

        if (normalizedError.includes('password')) {
          return jsonRes({ error: 'A jelszó nem felel meg a biztonsági feltételeknek.', error_code: 'weak_password' }, 400);
        }

        if (normalizedError.includes('email')) {
          return jsonRes({ error: 'Érvénytelen e-mail cím.', error_code: 'invalid_email' }, 400);
        }

        console.error('Create permanent user error:', createUserError);
        return jsonRes({ error: 'A regisztráció nem sikerült. Kérlek próbáld újra.', error_code: 'upgrade_failed' }, 500);
      }

      const permanentUser = newUserData.user;

      try {
        const { data: tempVotes, error: tempVotesError } = await admin
          .from('votes')
          .select('vote_date, vote_value')
          .eq('event_id', profile.linked_event_id)
          .eq('user_id', user.id);

        if (tempVotesError) {
          throw tempVotesError;
        }

        if ((tempVotes || []).length > 0) {
          const mergedVotes = (tempVotes || []).map((vote) => ({
            event_id: profile.linked_event_id,
            user_id: permanentUser.id,
            vote_date: vote.vote_date,
            vote_value: vote.vote_value,
          }));

          const { error: mergeVotesError } = await admin
            .from('votes')
            .upsert(mergedVotes, { onConflict: 'event_id,user_id,vote_date' });

          if (mergeVotesError) {
            throw mergeVotesError;
          }
        }

        const { data: existingParticipant } = await admin
          .from('event_participants')
          .select('id')
          .eq('event_id', profile.linked_event_id)
          .eq('user_id', permanentUser.id)
          .maybeSingle();

        if (!existingParticipant) {
          const { error: participantError } = await admin
            .from('event_participants')
            .insert({ event_id: profile.linked_event_id, user_id: permanentUser.id });

          if (participantError) {
            throw participantError;
          }
        }

        const { data: currentProfile } = await admin
          .from('profiles')
          .select('preferences')
          .eq('user_id', permanentUser.id)
          .maybeSingle();

        const currentPreferences = parseProfilePreferences(currentProfile?.preferences);
        const {
          temp_upgrade: _ignored,
          pending_email_activation: _ignoredPending,
          email_activation_completed_at: _ignoredCompleted,
          ...cleanedPreferences
        } = currentPreferences;

        const { error: upsertProfileError } = await admin
          .from('profiles')
          .upsert({
            user_id: permanentUser.id,
            display_name: normalizedDisplayName,
            is_temporary: false,
            linked_event_id: null,
            temp_access_token: null,
            preferences: cleanedPreferences,
          }, { onConflict: 'user_id' });

        if (upsertProfileError) {
          throw upsertProfileError;
        }

        const pendingActivation = await markPendingEmailActivation(permanentUser.id, cleanedPreferences);
        if (!pendingActivation) {
          throw new Error('Nem sikerült előkészíteni az aktivációs állapotot.');
        }

        const siteOrigin = appOrigin;
        const activationRedirectUrl = buildActivationRedirectUrl(siteOrigin, pendingActivation.token, '/');
        const activationEmailError = await sendUpgradeActivationLink(normalizedEmail, activationRedirectUrl);
        if (activationEmailError) {
          console.error('Temp upgrade activation email error:', activationEmailError);
          throw new Error('A fiók létrejött, de az aktivációs e-mail küldése sikertelen volt.');
        }

        const deletedTempUser = await cleanupTemporaryUser(user.id);
        if (!deletedTempUser) {
          throw new Error('Temporary felhasználó törlése sikertelen.');
        }
      } catch (migrationError) {
        console.error('Temp upgrade migration error:', migrationError);
        await admin.auth.admin.deleteUser(permanentUser.id);
        return jsonRes({ error: 'A regisztráció közben adatmigrációs hiba történt. Kérlek próbáld újra.' }, 500);
      }

      return jsonRes({
        success: true,
        verification_required: true,
        email: normalizedEmail,
      });
    }

    // Removed legacy global account-enumeration endpoint. The scoped
    // invite-by-email action below performs lookup only after event authz.
    if (action === 'search-user') {
      return jsonRes({ error: 'Legacy action disabled' }, 410);
    }

    // Invite by email
    if (action === 'invite-by-email') {
      const { event_id, email } = body;
      if (!event_id || !email) return jsonRes({ error: "Hiányzó adatok." }, 400);

      const { data: event } = await admin
        .from("events")
        .select("created_by, allow_participant_sharing, title")
        .eq("id", event_id)
        .single();

      if (!event) return jsonRes({ error: "Esemény nem található." }, 404);

      const isCreator = event.created_by === user.id;
      if (!isCreator) {
        if (!event.allow_participant_sharing) return jsonRes({ error: "Nincs jogosultságod meghívni." }, 403);
        const { data: participant } = await admin
          .from("event_participants").select("id")
          .eq("event_id", event_id).eq("user_id", user.id).maybeSingle();
        if (!participant) return jsonRes({ error: "Nincs jogosultságod meghívni." }, 403);
      }

      const { data: authData } = await admin.auth.admin.listUsers();
      const foundUser = authData?.users.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase() && u.email_confirmed_at
      );

      if (foundUser) {
        if (foundUser.id === event.created_by) return jsonRes({ error: "Ez a felhasználó az esemény létrehozója." });

        const { data: existing } = await admin
          .from("event_participants").select("id")
          .eq("event_id", event_id).eq("user_id", foundUser.id).maybeSingle();
        if (existing) return jsonRes({ error: "Ez a felhasználó már meghívva van." });

        const { error: insertError } = await admin
          .from("event_participants").insert({ event_id, user_id: foundUser.id });
        if (insertError) return jsonRes({ error: "Hiba a meghívás során." }, 500);

        return jsonRes({ success: true });
      }

      // The historical /join/:token page no longer exists in the product, so
      // sending a Supabase invite to that route would guarantee a NotFound and
      // falsely report success. Keep the registered-user flow above; require a
      // product decision before restoring external event invitations with a
      // real post-auth destination.
      return jsonRes({
        error: 'Nem regisztrált felhasználó eseménymeghívása jelenleg nem támogatott.',
        code: 'EXTERNAL_EVENT_INVITE_UNAVAILABLE',
      }, 409);
    }

    // Invite by user ID
    if (action === 'invite-by-user-id') {
      const { event_id, target_user_id } = body;
      if (!event_id || !target_user_id) return jsonRes({ error: "Hiányzó adatok." }, 400);

      const { data: event } = await admin
        .from("events").select("created_by, allow_participant_sharing")
        .eq("id", event_id).single();
      if (!event) return jsonRes({ error: "Esemény nem található." }, 404);

      const isCreator = event.created_by === user.id;
      if (!isCreator) {
        if (!event.allow_participant_sharing) return jsonRes({ error: "Nincs jogosultságod meghívni." }, 403);
        const { data: participant } = await admin
          .from("event_participants").select("id")
          .eq("event_id", event_id).eq("user_id", user.id).maybeSingle();
        if (!participant) return jsonRes({ error: "Nincs jogosultságod meghívni." }, 403);
      }

      const { data: existing } = await admin
        .from("event_participants").select("id")
        .eq("event_id", event_id).eq("user_id", target_user_id).maybeSingle();
      if (existing) return jsonRes({ error: "Ez a felhasználó már meghívva van." });

      const { error: insertError } = await admin
        .from("event_participants").insert({ event_id, user_id: target_user_id });
      if (insertError) return jsonRes({ error: "Hiba a meghívás során." }, 500);

      return jsonRes({ success: true });
    }

    // Legacy caller-controlled recipient/redirect contract is intentionally
    // disabled. Registered users can be added through the scoped actions above.
    if (action === 'send-invite-email') {
      return jsonRes({ error: 'Legacy action disabled' }, 410);
    }

    // Removed global auth.users e-mail disclosure endpoint.
    if (action === 'get-user-emails') {
      return jsonRes({ error: 'Legacy action disabled' }, 410);
    }

    // Default: join event by token
    const { token } = body;

    const { data: shareToken, error: tokenError } = await admin
      .from("event_share_tokens")
      .select("event_id, expires_at, email, max_uses, use_count")
      .eq("token", token)
      .single();

    if (tokenError || !shareToken) return jsonRes({ error: "Invalid token" }, 400);

    if (shareToken.expires_at && new Date(shareToken.expires_at) < new Date()) {
      return jsonRes({ error: "Token expired" }, 400);
    }
    if (shareToken.max_uses !== null && shareToken.use_count >= shareToken.max_uses) {
      return jsonRes({ error: "Token usage limit reached" }, 400);
    }
    if (shareToken.email) {
      const userEmail = user.email?.toLowerCase();
      if (userEmail !== shareToken.email.toLowerCase()) {
        return jsonRes({ error: `Ez a meghívó link csak a(z) ${shareToken.email} e-mail címhez tartozik.` }, 403);
      }
    }

    const actualEventId = shareToken.event_id;

    const { data: eventData } = await admin
      .from("events").select("created_by, end_date").eq("id", actualEventId).maybeSingle();

    if (!eventData || isPastEventRetentionWindow(eventData.end_date)) {
      return jsonRes({ error: "Event unavailable" }, 400);
    }

    if (eventData.created_by === user.id) {
      return jsonRes({ message: "Already a participant", event_id: actualEventId });
    }

    const { data: existing } = await admin
      .from("event_participants").select("id")
      .eq("event_id", actualEventId).eq("user_id", user.id).maybeSingle();

    if (existing) {
      return jsonRes({ message: "Already a participant", event_id: actualEventId });
    }

    const { error: insertError } = await admin
      .from("event_participants").insert({ event_id: actualEventId, user_id: user.id });

    if (insertError) return jsonRes({ error: "Failed to join" }, 500);

    if (!(await consumeShareToken(token, shareToken.use_count || 0, shareToken.max_uses))) {
      await admin.from('event_participants').delete().eq('event_id', actualEventId).eq('user_id', user.id);
      return jsonRes({ error: "Token usage limit reached" }, 409);
    }

    return jsonRes({ success: true, event_id: actualEventId });
  } catch (err) {
    console.error('Error:', err);
    return jsonRes({ error: "Internal error" }, 500);
  }
});
