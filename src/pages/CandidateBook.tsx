import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/I18nProvider';
import { bookSlotPublic } from '@/hooks/useCandidates';

/**
 * Public candidate self-booking page — Top-20 Rank 20, v3.31.0.
 *
 * Route: /book/:token (no auth required). The token is matched against
 * `interview_slots.booking_token`; the SECURITY DEFINER RPC validates,
 * upserts a candidate row, and marks the slot booked.
 */
export default function CandidateBook() {
  const { token } = useParams<{ token: string }>();
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked] = useState<{ slot_start: string; slot_end: string } | null>(null);

  const handleSubmit = async () => {
    if (!token) return;
    if (!name.trim() || !email.trim()) {
      toast.error(t('book.fields_required'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await bookSlotPublic(token, name.trim(), email.trim());
      setBooked({ slot_start: res.slot_start, slot_end: res.slot_end });
      toast.success(t('book.success'));
    } catch (e: unknown) {
      toast.error(t('book.error') + ': ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSubmitting(false);
    }
  };

  if (booked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <CardTitle className="text-base">{t('book.confirmed_title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-center">
            <p className="text-sm">
              {t('book.confirmed_at', {
                start: new Date(booked.slot_start).toLocaleString(),
                end: new Date(booked.slot_end).toLocaleTimeString(),
              })}
            </p>
            <p className="text-xs text-muted-foreground">{t('book.confirmation_email_sent')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="text-base">{t('book.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{t('book.subtitle')}</p>
          <div className="space-y-1">
            <Label htmlFor="book-name" className="text-xs">{t('book.name_label')}</Label>
            <Input id="book-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="book-email" className="text-xs">{t('book.email_label')}</Label>
            <Input id="book-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button onClick={handleSubmit} disabled={submitting || !name.trim() || !email.trim()} className="w-full">
            {submitting ? (
              <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> {t('book.booking')}</>
            ) : (
              t('book.confirm')
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
