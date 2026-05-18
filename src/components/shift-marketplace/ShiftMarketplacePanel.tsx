import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Handshake, Calendar, ClipboardList, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/I18nProvider';
import {
  useOpenTradeOffers,
  useMyTradeOffers,
  acceptTradeOffer,
  cancelTradeOffer,
  type ShiftTradeOffer,
} from '@/hooks/useShiftMarketplace';
import { OpenShiftPanel } from './OpenShiftPanel';

interface Props {
  workspaceId: string;
  /** Current user's membership id in this workspace (so "my offers" tab works). */
  membershipId: string;
}

/**
 * ShiftMarketplacePanel — Top-20 Rank 12, v3.21.0.
 *
 * Peer-to-peer shift trading: browse open offers + see your own offers'
 * status. Accept triggers `shift_trade_accept` RPC (which creates a
 * pending acceptance + flips the offer to 'accepted'; manager approval
 * follows unless workspace policy auto-approves).
 */
export function ShiftMarketplacePanel({ workspaceId, membershipId }: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState<'shifts' | 'open' | 'mine'>('shifts');
  const { data: openOffers, isLoading: loadingOpen, refetch: refetchOpen } = useOpenTradeOffers(workspaceId);
  const { data: myOffers, isLoading: loadingMine, refetch: refetchMine } = useMyTradeOffers(workspaceId, membershipId);
  const [pending, setPending] = useState<string | null>(null);

  const handleAccept = async (offer: ShiftTradeOffer) => {
    if (offer.offering_membership_id === membershipId) {
      toast.error(t('shift_marketplace.cannot_accept_own'));
      return;
    }
    setPending(offer.id);
    try {
      await acceptTradeOffer(offer.id);
      toast.success(t('shift_marketplace.accept_success'));
      await refetchOpen();
    } catch (e: unknown) {
      toast.error(t('shift_marketplace.accept_error') + ': ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPending(null);
    }
  };

  const handleCancel = async (offer: ShiftTradeOffer) => {
    setPending(offer.id);
    try {
      await cancelTradeOffer(offer.id);
      toast.success(t('shift_marketplace.cancel_success'));
      await refetchMine();
    } catch (e: unknown) {
      toast.error(t('shift_marketplace.cancel_error') + ': ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPending(null);
    }
  };

  const renderOffer = (offer: ShiftTradeOffer, isMine: boolean) => {
    const statusClass = offer.status === 'open' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300'
      : offer.status === 'accepted' ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200 border-amber-400'
      : offer.status === 'approved' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-300'
      : 'bg-muted text-muted-foreground';
    return (
      <div key={offer.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-background/60">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs font-mono">{offer.shift_assignment_id.slice(0, 8)}</span>
            <Badge variant="outline" className={`text-[10px] ${statusClass}`}>
              {t(`shift_marketplace.status_${offer.status}` as 'shift_marketplace.status_open')}
            </Badge>
          </div>
          {offer.reason && (
            <p className="text-xs text-muted-foreground mt-1 truncate" title={offer.reason}>{offer.reason}</p>
          )}
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {new Date(offer.created_at).toLocaleString()}
          </p>
        </div>
        <div className="shrink-0">
          {isMine ? (
            offer.status === 'open' && (
              <Button variant="outline" size="sm" disabled={pending === offer.id} onClick={() => handleCancel(offer)}>
                {pending === offer.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('shift_marketplace.cancel')}
              </Button>
            )
          ) : (
            <Button size="sm" disabled={pending === offer.id} onClick={() => handleAccept(offer)}>
              {pending === offer.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('shift_marketplace.accept')}
            </Button>
          )}
        </div>
      </div>
    );
  };

  const shownOffers = tab === 'open' ? (openOffers ?? []).filter((o) => o.offering_membership_id !== membershipId) : (myOffers ?? []);
  const isLoading = tab === 'open' ? loadingOpen : loadingMine;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Handshake className="h-4 w-4 text-primary" />
          {t('shift_marketplace.title')}
        </CardTitle>
        <div className="inline-flex rounded-md border bg-background overflow-hidden self-start">
          <button
            type="button"
            onClick={() => setTab('shifts')}
            className={`px-3 py-1.5 text-xs flex items-center gap-1 ${tab === 'shifts' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          >
            <ClipboardList className="h-3 w-3" />
            {t('open_shifts.title')}
          </button>
          <button
            type="button"
            onClick={() => setTab('open')}
            className={`px-3 py-1.5 text-xs ${tab === 'open' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          >
            {t('shift_marketplace.tab_open')}
          </button>
          <button
            type="button"
            onClick={() => setTab('mine')}
            className={`px-3 py-1.5 text-xs ${tab === 'mine' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          >
            {t('shift_marketplace.tab_mine')}
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {tab === 'shifts' ? (
          <OpenShiftPanel workspaceId={workspaceId} membershipId={membershipId} noCard />
        ) : isLoading ? (
          <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
        ) : shownOffers.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            {tab === 'open' ? t('shift_marketplace.empty_open') : t('shift_marketplace.empty_mine')}
          </p>
        ) : (
          <div className="space-y-2">
            {shownOffers.map((o) => renderOffer(o, tab === 'mine'))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
