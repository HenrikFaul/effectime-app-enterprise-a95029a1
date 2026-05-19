import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Loader2, User } from 'lucide-react';
import { format } from 'date-fns';
import { EmbedCapacityView } from './EmbedCapacityView';
import { EmbedShiftRosterView } from './EmbedShiftRosterView';
import { EmbedLeaveCalendarView } from './EmbedLeaveCalendarView';
import { EmbedOfficeHeadcountView } from './EmbedOfficeHeadcountView';
import { EmbedMemberScheduleView } from './EmbedMemberScheduleView';
import { cn } from '@/lib/utils';

const TAB_LABELS: Record<string, string> = {
  capacity_planner: 'Kapacitás',
  shift_roster:     'Beosztás',
  leave_calendar:   'Távollétek',
  office_headcount: 'Létszám',
  member_schedule:  'Menetrend',
};

const ALL_VIEWS = ['capacity_planner', 'shift_roster', 'leave_calendar', 'office_headcount', 'member_schedule'];

interface MemberItem { user_id: string; display_name: string; business_role: string | null }

export interface EmbedMultiViewProps {
  token: string;
  views: string[];
  officeFilter?: string;
  initialFrom?: string;
  member?: string;
  mode?: 'weekly' | 'monthly';
}

export function EmbedMultiView({ token, views, officeFilter, initialFrom, member, mode }: EmbedMultiViewProps) {
  const validViews = views.filter(v => ALL_VIEWS.includes(v));

  const [activeView, setActiveView]         = useState(validViews[0] ?? '');
  const [selectedMember, setSelectedMember] = useState(member ?? '');

  // Member picker data (loaded on demand when member_schedule tab is activated without member)
  const [pickerMembers, setPickerMembers]   = useState<MemberItem[] | null>(null);
  const [pickerLoading, setPickerLoading]   = useState(false);

  useEffect(() => {
    if (activeView === 'member_schedule' && !selectedMember && pickerMembers === null && !pickerLoading) {
      setPickerLoading(true);
      const today = format(new Date(), 'yyyy-MM-dd');
      (supabase as any)
        .rpc('get_embed_view_data', { _token: token, _view: 'leave_calendar', _from_date: today, _to_date: today })
        .then(({ data }: { data: { members: MemberItem[] } | null }) => {
          setPickerMembers((data?.members ?? []).sort((a, b) =>
            a.display_name.localeCompare(b.display_name)
          ));
          setPickerLoading(false);
        });
    }
  }, [activeView, selectedMember, pickerMembers, pickerLoading, token]);

  if (validViews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-48 gap-2 text-muted-foreground p-6 text-center">
        <AlertTriangle className="h-8 w-8 opacity-40" />
        <p className="font-semibold text-foreground text-sm">Nincs érvényes nézet megadva</p>
        <p className="text-xs">Add meg a <code>?views=</code> paramétert a beágyazási URL-ben.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Tab bar — no duplicate logo here; each child view's header has it */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b bg-card shrink-0 overflow-x-auto">
        {validViews.map(v => (
          <button
            key={v}
            onClick={() => setActiveView(v)}
            className={cn(
              'px-3 py-1 text-xs font-semibold rounded-md whitespace-nowrap transition-colors shrink-0',
              activeView === v
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
          >
            {TAB_LABELS[v] ?? v}
          </button>
        ))}
      </div>

      {/* Active view */}
      <div className="flex-1 overflow-hidden min-h-0">
        {activeView === 'capacity_planner' && (
          <EmbedCapacityView token={token} officeFilter={officeFilter} initialFrom={initialFrom} mode={mode} />
        )}
        {activeView === 'shift_roster' && (
          <EmbedShiftRosterView token={token} officeFilter={officeFilter} initialFrom={initialFrom} />
        )}
        {activeView === 'leave_calendar' && (
          <EmbedLeaveCalendarView token={token} officeFilter={officeFilter} initialFrom={initialFrom} />
        )}
        {activeView === 'office_headcount' && (
          <EmbedOfficeHeadcountView token={token} officeFilter={officeFilter} initialFrom={initialFrom} />
        )}
        {activeView === 'member_schedule' && selectedMember && (
          <div className="flex flex-col h-full">
            {/* "Change member" bar */}
            <div className="flex items-center gap-2 px-3 py-1 bg-muted/20 border-b shrink-0">
              <User className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground flex-1 truncate">
                {pickerMembers?.find(m => m.user_id === selectedMember)?.display_name ?? selectedMember}
              </span>
              <button
                onClick={() => setSelectedMember('')}
                className="text-[10px] text-primary font-semibold hover:underline shrink-0"
              >
                Csere
              </button>
            </div>
            <div className="flex-1 overflow-hidden min-h-0">
              <EmbedMemberScheduleView token={token} memberId={selectedMember} initialFrom={initialFrom} />
            </div>
          </div>
        )}
        {activeView === 'member_schedule' && !selectedMember && (
          <MemberPicker
            members={pickerMembers}
            loading={pickerLoading}
            onSelect={setSelectedMember}
          />
        )}
      </div>
    </div>
  );
}

function MemberPicker({
  members,
  loading,
  onSelect,
}: {
  members: MemberItem[] | null;
  loading: boolean;
  onSelect: (id: string) => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = (members ?? []).filter(m =>
    m.display_name.toLowerCase().includes(search.toLowerCase()) ||
    (m.business_role ?? '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin opacity-40" />
      <span className="text-xs">Csapattagok betöltése…</span>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Picker header */}
      <div className="px-4 pt-4 pb-3 border-b shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Válassz csapattagot</p>
            <p className="text-[11px] text-muted-foreground">Kattints a névre a menetrend megtekintéséhez</p>
          </div>
        </div>
        {(members ?? []).length > 6 && (
          <input
            type="text"
            placeholder="Keresés…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-8 rounded-lg border bg-muted/30 px-3 text-xs outline-none focus:ring-2 focus:ring-primary/30"
          />
        )}
      </div>

      {/* Member list */}
      <div className="flex-1 overflow-y-auto p-3">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Nincs találat</p>
        ) : (
          <div className="space-y-1">
            {filtered.map(m => (
              <button
                key={m.user_id}
                onClick={() => onSelect(m.user_id)}
                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-primary/5 hover:border-primary/20 border border-transparent transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                    <User className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{m.display_name}</div>
                    {m.business_role && (
                      <div className="text-[11px] text-muted-foreground truncate">{m.business_role}</div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
