import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordRequirements } from '@/components/PasswordRequirements';
import { validatePassword, isPasswordValid } from '@/lib/passwordValidation';
import { KeyRound, Save, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/I18nProvider';

export function ChangePasswordCard() {
  const { t } = useI18n();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const checks = validatePassword(newPassword);
  const valid = isPasswordValid(newPassword);

  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast.error(t('change_password.error_current_required'));
      return;
    }
    if (!valid) {
      toast.error(t('change_password.error_requirements'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('change_password.error_mismatch'));
      return;
    }
    setSaving(true);

    // Verify current password by re-authenticating
    const { data: { user } } = await supabase.auth.getUser();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user?.email || '',
      password: currentPassword,
    });
    if (signInError) {
      toast.error(t('change_password.error_current_wrong'));
      setSaving(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error(t('change_password.error_update') + error.message);
    } else {
      toast.success(t('change_password.success'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    setSaving(false);
  };

  return (
    <Card className="rounded-2xl shadow-card border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 font-display">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <KeyRound className="h-5 w-5 text-primary" />
          </div>
          {t('change_password.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('change_password.current_password')}
          </Label>
          <div className="relative">
            <Input
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="rounded-xl h-11 pr-10"
              placeholder={t('change_password.current_password')}
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('change_password.new_password')}
          </Label>
          <div className="relative">
            <Input
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="rounded-xl h-11 pr-10"
              placeholder={t('change_password.new_password')}
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <PasswordRequirements checks={checks} show={newPassword.length > 0} />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('change_password.confirm_password')}
          </Label>
          <div className="relative">
            <Input
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="rounded-xl h-11 pr-10"
              placeholder={t('change_password.confirm_password')}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {confirmPassword.length > 0 && newPassword !== confirmPassword && (
            <p className="text-xs text-destructive">{t('change_password.error_mismatch')}</p>
          )}
        </div>
        <Button
          onClick={handleChangePassword}
          className="w-full rounded-xl h-11 gradient-primary text-primary-foreground shadow-glow hover:opacity-90 transition-opacity font-semibold"
          disabled={saving || !currentPassword || !valid || newPassword !== confirmPassword}
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? t('change_password.saving') : t('change_password.submit')}
        </Button>
      </CardContent>
    </Card>
  );
}
