import { useState } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/I18nProvider';

const MAX_CUSTOM_DELETION_REASON_LENGTH = 800;

async function getDeleteAccountErrorCode(error: unknown): Promise<string | null> {
  if (!(error instanceof FunctionsHttpError) || !(error.context instanceof Response)) return null;

  try {
    const payload: unknown = await error.context.clone().json();
    if (
      typeof payload === 'object'
      && payload !== null
      && 'code' in payload
      && typeof payload.code === 'string'
    ) {
      return payload.code;
    }
  } catch {
    // The generic localized error below remains the safe fallback.
  }

  return null;
}

export function DeleteAccountCard() {
  const { t } = useI18n();
  const { user } = useAuth();

  const DELETION_REASONS = [
    { value: 'not_useful', label: t('delete_account.reason_not_useful') },
    { value: 'too_complicated', label: t('delete_account.reason_too_complicated') },
    { value: 'privacy', label: t('delete_account.reason_privacy') },
    { value: 'alternative', label: t('delete_account.reason_alternative') },
    { value: 'temporary', label: t('delete_account.reason_temporary') },
    { value: 'bugs', label: t('delete_account.reason_bugs') },
    { value: 'other', label: t('delete_account.reason_other') },
  ];
  const [step, setStep] = useState<'closed' | 'reason' | 'confirm'>('closed');
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  const reasonLabel = DELETION_REASONS.find(r => r.value === selectedReason)?.label;
  const trimmedCustomReason = customReason.trim();
  const finalReason = selectedReason === 'other'
    ? `${t('delete_account.reason_other')}: ${trimmedCustomReason}`
    : reasonLabel || '';
  const canProceed = Boolean(
    selectedReason && (selectedReason !== 'other' || trimmedCustomReason.length > 0),
  );

  const handleClose = () => {
    setStep('closed');
    setSelectedReason('');
    setCustomReason('');
  };

  const handleDelete = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-account', {
        body: { reason: finalReason },
      });
      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));
      if (data?.success !== true) throw new Error('Account deletion returned an invalid response');

      // Force clear all auth state before redirect
      localStorage.clear();
      sessionStorage.clear();
      
      // Use replace to prevent back-button returning to deleted session
      window.location.replace('/auth');
      return;
    } catch (err) {
      console.error('Delete account error:', err);
      const errorCode = await getDeleteAccountErrorCode(err);
      const errorKey = errorCode === 'SOLE_WORKSPACE_OWNER'
        ? 'delete_account.owner_transfer_required'
        : errorCode === 'REAUTHENTICATION_REQUIRED'
          ? 'delete_account.reauthentication_required'
          : errorCode === 'ACCOUNT_DATA_REQUIRES_REVIEW'
            ? 'delete_account.data_review_required'
            : 'delete_account.error_deleting';
      toast.error(t(errorKey));
      setDeleting(false);
      handleClose();
    }
  };

  return (
    <>
      <Card className="rounded-2xl shadow-card border border-destructive/10 bg-card/70">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2.5 font-display text-base text-muted-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-destructive/8">
              <Trash2 className="h-4 w-4 text-destructive/75" />
            </div>
            {t('delete_account.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t('delete_account.description')}
          </p>
          <div className="flex justify-end">
            <Button
              variant="outline"
              className="rounded-xl border-destructive/25 text-destructive hover:bg-destructive/8 hover:text-destructive"
              onClick={() => setStep('reason')}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t('delete_account.title')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={step === 'reason'} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              {t('delete_account.reason_dialog_title')}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {t('delete_account.reason_dialog_description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('delete_account.reason_label')}
              </Label>
              <Select value={selectedReason} onValueChange={setSelectedReason}>
                <SelectTrigger className="rounded-xl h-11">
                  <SelectValue placeholder={t('delete_account.reason_placeholder')} />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {DELETION_REASONS.map(r => (
                    <SelectItem key={r.value} value={r.value} className="rounded-lg">
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedReason === 'other' && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('delete_account.custom_reason_label')}
                </Label>
                <Textarea
                  value={customReason}
                  onChange={e => setCustomReason(e.target.value)}
                  placeholder={t('delete_account.custom_reason_placeholder')}
                  className="rounded-xl resize-none"
                  rows={3}
                  maxLength={MAX_CUSTOM_DELETION_REASON_LENGTH}
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="rounded-xl" onClick={handleClose}>
              {t('delete_account.cancel')}
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl font-semibold"
              disabled={!canProceed}
              onClick={() => setStep('confirm')}
            >
              {t('delete_account.next')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={step === 'confirm'} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-destructive">
              {t('delete_account.confirm_title')}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-sm leading-relaxed space-y-3 pt-2">
                <p>{t('delete_account.confirm_sorry')}</p>
                <p>{t('delete_account.confirm_warning')}</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>{t('delete_account.confirm_item_profile')}</li>
                  <li>{t('delete_account.confirm_item_votes')}</li>
                  <li>{t('delete_account.confirm_item_calendars')}</li>
                  <li>{t('delete_account.confirm_item_friends')}</li>
                  <li>{t('delete_account.confirm_item_availability')}</li>
                </ul>
                <p>{t('delete_account.confirm_re_register')}</p>
                <p className="font-medium text-foreground">{t('delete_account.confirm_reason_label')}: {finalReason}</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="rounded-xl" disabled={deleting} onClick={handleClose}>
              {t('delete_account.cancel')}
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl font-semibold"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? t('delete_account.deleting') : t('delete_account.confirm_delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
