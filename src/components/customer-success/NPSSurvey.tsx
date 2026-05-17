import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/I18nProvider';
import { usePendingNpsSurvey, submitNpsResponse } from '@/hooks/useCustomerSuccess';

interface Props {
  workspaceId: string;
  userId: string;
}

/**
 * NPSSurvey (Top-20 Rank 17, v3.19.0).
 *
 * Slide-up banner shown ONCE the user has an unanswered NPS survey row
 * for the current workspace. After scoring + optional feedback, the
 * survey is marked responded_at and disappears.
 *
 * Trigger logic (creating new surveys) lives elsewhere — typically on a
 * scheduled job or hooked into the onboarding-complete event.
 */
export function NPSSurvey({ workspaceId, userId }: Props) {
  const { t } = useI18n();
  const { data: survey, refetch } = usePendingNpsSurvey(workspaceId, userId);
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dismissedInSession, setDismissedInSession] = useState(false);

  // Reset when survey changes
  useEffect(() => {
    setScore(null);
    setFeedback('');
  }, [survey?.id]);

  if (!survey || dismissedInSession) return null;

  const handleSubmit = async () => {
    if (score === null) return;
    setSubmitting(true);
    try {
      await submitNpsResponse(survey.id, score, feedback || undefined);
      toast.success(t('customer_success.nps_thanks'));
      await refetch();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(t('customer_success.nps_error') + ': ' + msg);
    } finally {
      setSubmitting(false);
    }
  };

  const detractor = score !== null && score <= 6;
  const promoter = score !== null && score >= 9;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)] shadow-elevated animate-in slide-in-from-bottom-4">
      <Card className="border-primary">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm">{t('customer_success.nps_title')}</CardTitle>
            <Button
              variant="ghost" size="icon" className="h-6 w-6 -mt-1"
              onClick={() => setDismissedInSession(true)}
              aria-label={t('common.dismiss')}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('customer_success.nps_question')}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* 0-10 score scale */}
          <div className="flex gap-1 overflow-x-auto pb-0.5">
            {Array.from({ length: 11 }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setScore(i)}
                className={`h-8 w-8 shrink-0 flex-1 min-w-[2rem] rounded text-xs font-medium border transition-colors ${
                  score === i
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-muted border-border'
                }`}
              >
                {i}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{t('customer_success.nps_low_label')}</span>
            <span>{t('customer_success.nps_high_label')}</span>
          </div>

          {score !== null && (
            <>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder={
                  detractor
                    ? t('customer_success.nps_followup_detractor')
                    : promoter
                    ? t('customer_success.nps_followup_promoter')
                    : t('customer_success.nps_followup_passive')
                }
                rows={3}
                maxLength={500}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setDismissedInSession(true)}>
                  {t('common.later')}
                </Button>
                <Button size="sm" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? t('customer_success.nps_submitting') : t('customer_success.nps_submit')}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
