import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ProfileMenu } from '@/components/ProfileMenu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, User, Save } from 'lucide-react';
import { ChangePasswordCard } from '@/components/ChangePasswordCard';
import { DeleteAccountCard } from '@/components/DeleteAccountCard';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useI18n } from '@/i18n/I18nProvider';
import { canonicalizeWorkspaceProfileDisplayName } from '@/lib/profileDisplayName';

const Profile = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?.id;
  const [displayName, setDisplayName] = useState('');
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveConflict, setSaveConflict] = useState(false);
  const mountedRef = useRef(true);
  const savingRef = useRef(false);
  const saveGenerationRef = useRef(0);
  const currentUserIdRef = useRef(userId);
  const authoritativeDisplayNameRef = useRef<{
    userId: string;
    displayName: string | null;
  } | null>(null);
  currentUserIdRef.current = userId;

  const normalizedDisplayName = canonicalizeWorkspaceProfileDisplayName(displayName);
  const displayNameInvalid = profileLoaded && normalizedDisplayName === undefined;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      saveGenerationRef.current += 1;
      savingRef.current = false;
    };
  }, []);

  useEffect(() => {
    saveGenerationRef.current += 1;
    savingRef.current = false;
    setSaving(false);
    setSaveError(null);
    setSaveConflict(false);
  }, [userId]);

  useEffect(() => {
    let active = true;
    setProfileLoaded(false);
    setLoadError(false);
    setSaveError(null);
    setSaveConflict(false);
    authoritativeDisplayNameRef.current = null;
    if (!userId) {
      setDisplayName('');
      return () => {
        active = false;
      };
    }
    const fetchProfile = async () => {
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', userId)
          .single();
        if (!active) return;
        const rawDisplayName = profile?.display_name;
        if (
          error
          || !profile
          || (rawDisplayName !== null && typeof rawDisplayName !== 'string')
        ) {
          setLoadError(true);
          return;
        }
        authoritativeDisplayNameRef.current = { userId, displayName: rawDisplayName };
        setDisplayName(rawDisplayName || '');
        setProfileLoaded(true);
      } catch {
        if (active) setLoadError(true);
      }
    };
    void fetchProfile();
    return () => {
      active = false;
    };
  }, [userId, loadAttempt]);

  const reloadProfile = () => {
    saveGenerationRef.current += 1;
    savingRef.current = false;
    setSaving(false);
    setSaveError(null);
    setSaveConflict(false);
    setLoadAttempt(attempt => attempt + 1);
  };

  const handleSave = async () => {
    const authoritativeProfile = authoritativeDisplayNameRef.current;
    if (
      !userId
      || !profileLoaded
      || loadError
      || saveConflict
      || normalizedDisplayName === undefined
      || savingRef.current
      || !authoritativeProfile
      || authoritativeProfile.userId !== userId
    ) return;
    savingRef.current = true;
    const generation = ++saveGenerationRef.current;
    setSaving(true);
    setSaveError(null);
    try {
      const updateRequest = supabase
        .from('profiles')
        .update({ display_name: normalizedDisplayName })
        .eq('user_id', userId);
      const guardedUpdate = authoritativeProfile.displayName === null
        ? updateRequest.is('display_name', null)
        : updateRequest.eq('display_name', authoritativeProfile.displayName);
      const { data, error } = await guardedUpdate.select('display_name');

      if (
        !mountedRef.current
        || generation !== saveGenerationRef.current
        || currentUserIdRef.current !== userId
      ) return;
      if (error) {
        const message = t('profile.save_error');
        setSaveError(message);
        toast.error(message);
      } else if (Array.isArray(data) && data.length === 0) {
        const message = t('profile.save_conflict');
        setSaveConflict(true);
        setSaveError(message);
        toast.error(message);
      } else if (
        !Array.isArray(data)
        || data.length !== 1
        || data[0]?.display_name !== normalizedDisplayName
      ) {
        const message = t('profile.save_error');
        setSaveError(message);
        toast.error(message);
      } else {
        authoritativeDisplayNameRef.current = {
          userId,
          displayName: normalizedDisplayName,
        };
        setDisplayName(normalizedDisplayName);
        setSaveError(null);
        toast.success(t('profile.save_success'));
      }
    } catch {
      if (
        mountedRef.current
        && generation === saveGenerationRef.current
        && currentUserIdRef.current === userId
      ) {
        const message = t('profile.save_error');
        setSaveError(message);
        toast.error(message);
      }
    } finally {
      if (mountedRef.current && generation === saveGenerationRef.current) {
        savingRef.current = false;
        setSaving(false);
      }
    }
  };

  return (
    <div className="min-h-dvh bg-background pb-safe">
      <header className="sticky top-0 z-40 glass-strong border-b">
        <div className="flex items-center justify-between px-4 py-3 lg:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/app')} className="rounded-xl">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="font-display text-lg sm:text-xl font-bold">{t('profile.page_title')}</h1>
          </div>
          <ProfileMenu />
        </div>
      </header>

      <div className="mx-auto max-w-lg p-4 lg:p-8 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <Card className="rounded-2xl shadow-card border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2.5 font-display">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                {t('profile.card_title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadError && (
                <div id="profile-load-error" role="alert" className="space-y-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3">
                  <p className="text-sm text-destructive">{t('profile.load_error')}</p>
                  <Button type="button" size="sm" variant="outline" onClick={reloadProfile}>
                    {t('profile.retry_load')}
                  </Button>
                </div>
              )}
              {saveConflict && saveError && (
                <div id="profile-save-conflict" role="alert" className="space-y-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3">
                  <p className="text-sm text-destructive">{saveError}</p>
                  <Button type="button" size="sm" variant="outline" onClick={reloadProfile}>
                    {t('profile.reload_after_conflict')}
                  </Button>
                </div>
              )}
              {saveError && !saveConflict && (
                <p id="profile-save-error" role="alert" className="text-sm text-destructive">
                  {saveError}
                </p>
              )}
              <div className="flex justify-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl gradient-primary text-2xl font-bold text-primary-foreground shadow-glow">
                  {displayName ? displayName.slice(0, 2).toUpperCase() : 'U'}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-display-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('profile.display_name_label')}</Label>
                <Input
                  id="profile-display-name"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  disabled={!profileLoaded || loadError || saving || saveConflict}
                  aria-invalid={displayNameInvalid}
                  aria-describedby={displayNameInvalid ? 'profile-display-name-error' : undefined}
                  className="rounded-xl h-11"
                />
                {displayNameInvalid && (
                  <p id="profile-display-name-error" role="alert" className="text-xs text-destructive">
                    {t('profile.display_name_validation_error')}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('profile.email_label')}</Label>
                <Input value={user?.email || ''} disabled className="rounded-xl h-11" />
              </div>
              <Button
                onClick={handleSave}
                className="w-full rounded-xl h-11 gradient-primary text-primary-foreground shadow-glow hover:opacity-90 transition-opacity font-semibold"
                disabled={saving || !userId || !profileLoaded || loadError || saveConflict || normalizedDisplayName === undefined}
                aria-busy={saving}
                aria-describedby={
                  saveConflict
                    ? 'profile-save-conflict'
                    : saveError
                      ? 'profile-save-error'
                      : displayNameInvalid
                        ? 'profile-display-name-error'
                        : undefined
                }
              >
                <Save className="mr-2 h-4 w-4" />
                {saving ? t('profile.saving') : t('profile.save')}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <ChangePasswordCard />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <DeleteAccountCard />
        </motion.div>
      </div>
    </div>
  );
};

export default Profile;
