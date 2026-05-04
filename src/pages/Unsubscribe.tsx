import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Unsubscribe() {
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
          {status === 'loading' && <p className="text-muted-foreground">Betöltés...</p>}
          {status === 'valid' && (
            <>
              <h2 className="text-xl font-bold">Leiratkozás</h2>
              <p className="text-muted-foreground text-sm">Biztosan le szeretnél iratkozni az email értesítésekről?</p>
              <Button onClick={handleUnsubscribe} disabled={processing}>
                {processing ? 'Feldolgozás...' : 'Leiratkozás megerősítése'}
              </Button>
            </>
          )}
          {status === 'done' && <p className="text-primary font-medium">Sikeresen leiratkoztál. ✅</p>}
          {status === 'already' && <p className="text-muted-foreground">Már korábban leiratkoztál.</p>}
          {status === 'invalid' && <p className="text-destructive">Érvénytelen vagy lejárt token.</p>}
          {status === 'error' && <p className="text-destructive">Hiba történt. Kérjük próbáld újra később.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
