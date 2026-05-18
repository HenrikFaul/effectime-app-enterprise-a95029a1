import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock, MapPin, QrCode, Smartphone, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/I18nProvider';
import { useTodayClockEvents, clockEvent } from '@/hooks/useClockIn';

interface Props {
  workspaceId: string;
  membershipId: string;
  compact?: boolean;
}

/**
 * ClockInPanel — Top-20 Rank 10, v3.22.0.
 *
 * Mobile-first clock-in panel with method selector (GPS / QR / NFC /
 * manual). GPS reads navigator.geolocation, sends lat+lng to the
 * `clock_event` RPC, which validates against geofenced sites and
 * inserts an immutable clock_events row.
 *
 * Designed for the deskless-worker persona (retail/factory/healthcare).
 * Large touch targets, big timestamp, clear verification feedback.
 */
export function ClockInPanel({ workspaceId, membershipId, compact }: Props) {
  const { t } = useI18n();
  const { data: events, refetch } = useTodayClockEvents(workspaceId, membershipId);
  const [method, setMethod] = useState<'gps' | 'qr' | 'nfc' | 'manual'>('gps');
  const [qrCode, setQrCode] = useState('');
  const [nfcTag, setNfcTag] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(new Date());

  // Tick clock every second for the prominent live timestamp
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Determine current clock state (last event today)
  const todayEvents = events ?? [];
  const lastEvent = todayEvents[todayEvents.length - 1];
  const isClockedIn = lastEvent?.event_type === 'clock_in';
  const nextType: 'clock_in' | 'clock_out' = isClockedIn ? 'clock_out' : 'clock_in';

  const totalSecondsWorked = useMemo(() => {
    let total = 0;
    let lastIn: Date | null = null;
    for (const e of todayEvents) {
      const at = new Date(e.created_at);
      if (e.event_type === 'clock_in') lastIn = at;
      else if (e.event_type === 'clock_out' && lastIn) {
        total += (at.getTime() - lastIn.getTime()) / 1000;
        lastIn = null;
      }
    }
    if (lastIn) total += (now.getTime() - lastIn.getTime()) / 1000;
    return total;
  }, [todayEvents, now]);

  const hoursWorked = Math.floor(totalSecondsWorked / 3600);
  const minutesWorked = Math.floor((totalSecondsWorked % 3600) / 60);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      let payload: Parameters<typeof clockEvent>[0] = {
        workspaceId, eventType: nextType, method,
      };
      if (method === 'gps') {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          if (!('geolocation' in navigator)) return reject(new Error('Geolocation not available'));
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000 });
        });
        payload.latitude = pos.coords.latitude;
        payload.longitude = pos.coords.longitude;
      } else if (method === 'qr') {
        if (!qrCode.trim()) throw new Error(t('clock_in.qr_required'));
        payload.qrCode = qrCode.trim();
      } else if (method === 'nfc') {
        if (!nfcTag.trim()) throw new Error(t('clock_in.nfc_required'));
        payload.nfcTag = nfcTag.trim();
      }
      const res = await clockEvent(payload);
      toast.success(nextType === 'clock_in'
        ? t('clock_in.clocked_in_at', { time: new Date().toLocaleTimeString() })
        : t('clock_in.clocked_out_at', { time: new Date().toLocaleTimeString() }));
      setQrCode(''); setNfcTag('');
      await refetch();
    } catch (e: unknown) {
      const msg = (e as any)?.message ?? (e instanceof Error ? e.message : String(e));
      toast.error(t('clock_in.error') + ': ' + msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className={isClockedIn ? 'border-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/20' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            {t('clock_in.title')}
          </CardTitle>
          {compact && (
            <span className="text-sm tabular-nums font-mono text-muted-foreground">
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Big live clock — hidden in compact mode */}
        {!compact && (
          <div className="text-center">
            <div className="text-4xl font-bold tabular-nums">
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        )}

        {/* Status + hours worked */}
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className={isClockedIn
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-300'
            : 'bg-muted text-muted-foreground'}>
            {isClockedIn ? t('clock_in.status_clocked_in') : t('clock_in.status_clocked_out')}
          </Badge>
          <span className="text-xs text-muted-foreground tabular-nums">
            {t('clock_in.hours_today', { hours: hoursWorked, minutes: minutesWorked })}
          </span>
        </div>

        {/* Method selector */}
        <div className="grid grid-cols-4 gap-1.5">
          {([
            { key: 'gps' as const, icon: MapPin, label: t('clock_in.method_gps') },
            { key: 'qr' as const, icon: QrCode, label: t('clock_in.method_qr') },
            { key: 'nfc' as const, icon: Smartphone, label: t('clock_in.method_nfc') },
            { key: 'manual' as const, icon: AlertCircle, label: t('clock_in.method_manual') },
          ]).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setMethod(key)}
              className={`flex flex-col items-center gap-1 rounded-lg border p-2 transition-colors ${
                method === key
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:bg-muted'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="text-[10px]">{label}</span>
            </button>
          ))}
        </div>

        {/* Method-specific inputs */}
        {method === 'qr' && (
          <div className="space-y-1">
            <Label htmlFor="qr-input" className="text-xs">{t('clock_in.qr_label')}</Label>
            <Input id="qr-input" value={qrCode} onChange={(e) => setQrCode(e.target.value)} placeholder={t('clock_in.qr_placeholder')} />
          </div>
        )}
        {method === 'nfc' && (
          <div className="space-y-1">
            <Label htmlFor="nfc-input" className="text-xs">{t('clock_in.nfc_label')}</Label>
            <Input id="nfc-input" value={nfcTag} onChange={(e) => setNfcTag(e.target.value)} placeholder={t('clock_in.nfc_placeholder')} />
          </div>
        )}
        {method === 'gps' && (
          <p className="text-[11px] text-muted-foreground">{t('clock_in.gps_hint')}</p>
        )}
        {method === 'manual' && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">{t('clock_in.manual_hint')}</p>
        )}

        {/* Big action button */}
        <Button
          size="lg"
          className="w-full h-14 text-base"
          onClick={handleSubmit}
          disabled={submitting}
          variant={isClockedIn ? 'destructive' : 'default'}
        >
          {submitting ? (
            <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> {t('clock_in.submitting')}</>
          ) : isClockedIn ? (
            t('clock_in.clock_out_button')
          ) : (
            t('clock_in.clock_in_button')
          )}
        </Button>

        {/* Today's timeline — hidden in compact mode */}
        {!compact && todayEvents.length > 0 && (
          <div className="space-y-1 pt-2 border-t">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {t('clock_in.today_timeline')}
            </p>
            {todayEvents.map((e) => (
              <div key={e.id} className="flex items-center gap-2 text-xs">
                {e.verified ? (
                  <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" />
                )}
                <span className="font-mono tabular-nums">
                  {new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {t(`clock_in.event_${e.event_type}` as 'clock_in.event_clock_in')}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {t(`clock_in.method_${e.method}` as 'clock_in.method_gps')}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
