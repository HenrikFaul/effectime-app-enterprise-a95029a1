import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Ban,
  CalendarOff,
  Users,
  ShieldAlert,
  TrendingDown,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addDays, isWeekend } from "date-fns";

interface SummaryCard {
  key: string;
  label: string;
  count: number;
  severity: "info" | "warning" | "blocking";
  icon: React.ReactNode;
  emptyLabel: string;
}

interface Props {
  workspaceId: string;
  currentMonth: Date;
  onNavigate?: (tab: string) => void;
}

export function CoverageConflictSummary({ workspaceId, currentMonth, onNavigate }: Props) {
  const [pendingCount, setPendingCount] = useState(0);
  const [blockedDatesInRange, setBlockedDatesInRange] = useState(0);
  const [companyLeaveDatesInRange, setCompanyLeaveDatesInRange] = useState(0);
  const [maxOffBreaches, setMaxOffBreaches] = useState(0);
  const [coverageBreaches, setCoverageBreaches] = useState(0);
  const [upcomingAttention, setUpcomingAttention] = useState(0);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(true);

  const monthStart = useMemo(() => format(startOfMonth(currentMonth), "yyyy-MM-dd"), [currentMonth]);
  const monthEnd = useMemo(() => format(endOfMonth(currentMonth), "yyyy-MM-dd"), [currentMonth]);

  useEffect(() => {
    fetchSummaryData();
  }, [workspaceId, monthStart, monthEnd]);

  const fetchSummaryData = async () => {
    setLoading(true);

    const [pendingRes, blockedRes, holidaysRes, rulesRes, leavesRes, membersRes] = await Promise.all([
      supabase
        .from("leave_requests")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("status", "pending"),
      supabase
        .from("enterprise_blocked_dates")
        .select("blocked_date")
        .eq("workspace_id", workspaceId)
        .gte("blocked_date", monthStart)
        .lte("blocked_date", monthEnd),
      supabase
        .from("enterprise_holidays")
        .select("holiday_date")
        .eq("workspace_id", workspaceId)
        .gte("holiday_date", monthStart)
        .lte("holiday_date", monthEnd),
      supabase.from("enterprise_daily_rules").select("*").eq("workspace_id", workspaceId),
      supabase
        .from("leave_requests")
        .select("id, user_id, start_date, end_date, status")
        .eq("workspace_id", workspaceId)
        .in("status", ["approved", "pending"])
        .or(`start_date.lte.${monthEnd},end_date.gte.${monthStart}`),
      supabase
        .from("enterprise_memberships")
        .select("user_id, team, role")
        .eq("workspace_id", workspaceId)
        .eq("status", "active"),
    ]);

    setPendingCount(pendingRes.count || 0);
    setBlockedDatesInRange((blockedRes.data || []).length);
    setCompanyLeaveDatesInRange((holidaysRes.data || []).length);

    // Calculate max-off breaches and coverage breaches
    const rules = rulesRes.data || [];
    const leaves = leavesRes.data || [];
    const members = membersRes.data || [];
    const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });

    let maxOffBreachCount = 0;
    let coverageBreachCount = 0;

    for (const day of days) {
      if (isWeekend(day)) continue;
      const dateStr = format(day, "yyyy-MM-dd");
      const dayOfWeek = day.getDay() === 0 ? 7 : day.getDay(); // Monday=1

      // Count approved leaves on this day
      const dayLeaves = leaves.filter(
        (l) => l.status === "approved" && dateStr >= l.start_date && dateStr <= l.end_date,
      );

      // Check max-off rules (team-aware)
      const applicableMaxOff = rules.filter(
        (r: any) => r.max_off !== null && (r.rule_date === dateStr || (r.day_of_week === dayOfWeek && !r.rule_date)),
      );

      for (const rule of applicableMaxOff) {
        const teamLeaves = rule.team_filter
          ? dayLeaves.filter((l: any) => {
              const mem = members.find((m: any) => m.user_id === l.user_id);
              return mem && mem.team === rule.team_filter;
            })
          : dayLeaves;
        if (teamLeaves.length >= (rule.max_off || 999)) {
          maxOffBreachCount++;
          break;
        }
      }

      // Check min-coverage rules (team-aware)
      const applicableMinCov = rules.filter(
        (r: any) =>
          r.min_coverage !== null && (r.rule_date === dateStr || (r.day_of_week === dayOfWeek && !r.rule_date)),
      );

      for (const rule of applicableMinCov) {
        const teamMembers = rule.team_filter ? members.filter((m: any) => m.team === rule.team_filter) : members;
        const teamLeaves = rule.team_filter
          ? dayLeaves.filter((l: any) => {
              const mem = members.find((m: any) => m.user_id === l.user_id);
              return mem && mem.team === rule.team_filter;
            })
          : dayLeaves;
        const available = teamMembers.length - teamLeaves.length;
        if (available < (rule.min_coverage || 0)) {
          coverageBreachCount++;
          break;
        }
      }
    }

    setMaxOffBreaches(maxOffBreachCount);
    setCoverageBreaches(coverageBreachCount);

    // Upcoming requests needing attention (next 7 days with pending requests)
    const today = format(new Date(), "yyyy-MM-dd");
    const weekLater = format(addDays(new Date(), 7), "yyyy-MM-dd");
    const urgentPending = leaves.filter(
      (l) => l.status === "pending" && l.start_date <= weekLater && l.start_date >= today,
    );
    setUpcomingAttention(urgentPending.length);

    setLoading(false);
  };

  const cards: SummaryCard[] = [
    {
      key: "pending",
      label: "Függő jóváhagyás",
      count: pendingCount,
      severity: pendingCount > 0 ? "warning" : "info",
      icon: <Clock className="h-4 w-4" />,
      emptyLabel: "Nincs függő kérelem",
    },
    {
      key: "urgent",
      label: "Sürgős (7 napon belüli)",
      count: upcomingAttention,
      severity: upcomingAttention > 0 ? "blocking" : "info",
      icon: <AlertTriangle className="h-4 w-4" />,
      emptyLabel: "Nincs sürgős kérelem",
    },
    {
      key: "maxoff",
      label: "Kapacitás túllépés",
      count: maxOffBreaches,
      severity: maxOffBreaches > 0 ? "blocking" : "info",
      icon: <TrendingDown className="h-4 w-4" />,
      emptyLabel: "Nincs kapacitás túllépés",
    },
    {
      key: "coverage",
      label: "Lefedettségi kockázat",
      count: coverageBreaches,
      severity: coverageBreaches > 0 ? "warning" : "info",
      icon: <ShieldAlert className="h-4 w-4" />,
      emptyLabel: "Nincs lefedettségi probléma",
    },
    {
      key: "blocked",
      label: "Tiltott nap (hónap)",
      count: blockedDatesInRange,
      severity: "info",
      icon: <Ban className="h-4 w-4" />,
      emptyLabel: "Nincs tiltott nap",
    },
    {
      key: "holidays",
      label: "Ünnepnap (hónap)",
      count: companyLeaveDatesInRange,
      severity: "info",
      icon: <CalendarOff className="h-4 w-4" />,
      emptyLabel: "Nincs ünnepnap",
    },
  ];

  const severityColor = (s: string) => {
    switch (s) {
      case "blocking":
        return "text-destructive bg-destructive/10 border-destructive/30";
      case "warning":
        return "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700";
      default:
        return "text-muted-foreground bg-muted/50 border-border";
    }
  };

  const severityDot = (s: string) => {
    switch (s) {
      case "blocking":
        return "bg-destructive";
      case "warning":
        return "bg-amber-500";
      default:
        return "bg-muted-foreground/40";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 flex justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  const hasIssues = pendingCount > 0 || maxOffBreaches > 0 || coverageBreaches > 0 || upcomingAttention > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-primary" />
            Lefedettség & Konfliktusok
            {hasIssues && (
              <Badge variant="destructive" className="text-[10px] h-4 px-1.5">
                {pendingCount + maxOffBreaches + coverageBreaches + upcomingAttention}
              </Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </CardHeader>
      {!collapsed && (
        <CardContent className="space-y-1.5 pb-3">
          {cards.map((card) => (
            <button
              key={card.key}
              type="button"
              className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors hover:bg-accent/30 ${severityColor(card.severity)}`}
              onClick={() => {
                if (card.key === "pending" || card.key === "urgent") onNavigate?.("approvals");
                if (card.key === "blocked") onNavigate?.("rules");
                if (card.key === "holidays") onNavigate?.("rules");
              }}
            >
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${severityDot(card.severity)}`} />
                {card.icon}
                <span className="text-xs font-medium">{card.label}</span>
              </div>
              <span className="text-sm font-bold tabular-nums">
                {card.count > 0 ? card.count : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
              </span>
            </button>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
