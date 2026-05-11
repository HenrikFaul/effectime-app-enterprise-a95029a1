import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/I18nProvider';

export default function Unsubscribe() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'valid' | 'already' | 'invalid' | 'done' | 'error'>('loading');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    (async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${token}`,
          { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
        );
        const data = await res.json();
        if (data.valid === false && data.reason === 'already_unsubscribed') setStatus('already');
        else if (data.valid) setStatus('valid');
        else setStatus('invalid');
      } catch { setStatus('error'); }
    })();
  }, [token]);

  const handleUnsubscribe = async () => {
    setProcessing(true);
    try {
      await supabase.functions.invoke('handle-email-unsubscribe', { body: { token } });
      setStatus('done');
    } catch { setStatus('error'); }
    setProcessing(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="py-8 text-center space-y-4">
          {status === 'loading' && <p className="text-muted-foreground">{t('unsubscribe.loading')}</p>}
          {status === 'valid' && (
            <>
              <h2 className="text-xl font-bold">{t('unsubscribe.page_title')}</h2>
              <p className="text-muted-foreground text-sm">{t('unsubscribe.confirm_description')}</p>
              <Button onClick={handleUnsubscribe} disabled={processing}>
                {processing ? t('unsubscribe.processing') : t('unsubscribe.confirm_btn')}
              </Button>
            </>
          )}
          {status === 'done' && <p className="text-primary font-medium">{t('unsubscribe.done')}</p>}
          {status === 'already' && <p className="text-muted-foreground">{t('unsubscribe.already')}</p>}
          {status === 'invalid' && <p className="text-destructive">{t('unsubscribe.invalid')}</p>}
          {status === 'error' && <p className="text-destructive">{t('unsubscribe.error')}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
