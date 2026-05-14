import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Bot, Send, Loader2, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/I18nProvider';
import { useCopilotMessages, startCopilotConversation, askCopilot, type CopilotMessage } from '@/hooks/useAiCopilot';

interface Props {
  workspaceId: string;
}

/**
 * CopilotPanel — Top-20 Rank 1, v3.27.0.
 *
 * Conversational AI layer over the scheduling engine. Renders a
 * chat-like UI: user types a natural-language scheduling question; the
 * server gathers workspace context + asks Claude; the assistant returns
 * a structured JSON plan (analysis + recommendations + warnings).
 *
 * Gracefully degrades when ANTHROPIC_API_KEY is unset — UI still works,
 * the assistant just returns a "configure key" fallback message.
 */
export function CopilotPanel({ workspaceId }: Props) {
  const { t } = useI18n();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [instruction, setInstruction] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastUsage, setLastUsage] = useState<{ in: number | null; out: number | null } | null>(null);

  const { data: messages, refetch } = useCopilotMessages(conversationId);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages?.length]);

  // Lazily create a conversation on first ask
  const ensureConversation = async (): Promise<string> => {
    if (conversationId) return conversationId;
    const id = await startCopilotConversation(workspaceId);
    setConversationId(id);
    return id;
  };

  const handleSend = async () => {
    const text = instruction.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      const cid = await ensureConversation();
      const res = await askCopilot(workspaceId, cid, text);
      setLastUsage({ in: res.usage?.input_tokens ?? null, out: res.usage?.output_tokens ?? null });
      setInstruction('');
      await refetch();
      if (!res.ai_available) {
        toast.message(t('ai_copilot.not_configured'), { description: res.hint });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(t('ai_copilot.error') + ': ' + msg);
    } finally {
      setSubmitting(false);
    }
  };

  const renderAssistant = (m: CopilotMessage) => {
    const plan = m.structured_plan;
    if (plan?.ai_available === false) {
      return (
        <div className="space-y-1">
          <p className="text-xs">{m.content}</p>
        </div>
      );
    }
    if (plan?.parse_failed || plan?.error) {
      return (
        <div className="space-y-1">
          <p className="text-xs whitespace-pre-wrap">{m.content}</p>
        </div>
      );
    }
    if (plan?.analysis) {
      return (
        <div className="space-y-2">
          <p className="text-xs">{plan.analysis}</p>
          {plan.confidence !== undefined && (
            <Badge variant="outline" className="text-[10px]">
              {t('ai_copilot.confidence', { pct: plan.confidence })}
            </Badge>
          )}
          {(plan.recommendations ?? []).length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">
                {t('ai_copilot.recommendations')}
              </p>
              <ul className="text-xs list-disc list-inside space-y-0.5">
                {(plan.recommendations ?? []).map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}
          {(plan.warnings ?? []).length > 0 && (
            <div className="rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2">
              <p className="text-[10px] uppercase tracking-wide text-amber-700 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {t('ai_copilot.warnings')}
              </p>
              <ul className="text-xs list-disc list-inside space-y-0.5">
                {(plan.warnings ?? []).map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
          {plan.requires_human_review && (
            <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-900 border-amber-400">
              {t('ai_copilot.requires_human_review')}
            </Badge>
          )}
        </div>
      );
    }
    return <p className="text-xs whitespace-pre-wrap">{m.content}</p>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          {t('ai_copilot.title')}
          <Badge variant="outline" className="text-[10px] ml-auto">
            <Sparkles className="h-2.5 w-2.5 mr-1" /> {t('ai_copilot.powered_by')}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Message history */}
        <div
          ref={scrollRef}
          className="max-h-80 overflow-y-auto space-y-2 rounded border bg-background p-2"
        >
          {(messages ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              {t('ai_copilot.empty_prompt')}
            </p>
          ) : (
            (messages ?? []).map((m) => (
              <div
                key={m.id}
                className={`p-2 rounded ${
                  m.role === 'user'
                    ? 'bg-primary/10 ml-6'
                    : 'bg-muted mr-6'
                }`}
              >
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                  {m.role === 'user' ? t('ai_copilot.role_you') : t('ai_copilot.role_assistant')}
                  {m.role === 'assistant' && m.model && ` · ${m.model}`}
                </p>
                {m.role === 'assistant' ? renderAssistant(m) : (
                  <p className="text-xs whitespace-pre-wrap">{m.content}</p>
                )}
              </div>
            ))
          )}
        </div>

        {/* Input row */}
        <div className="space-y-2">
          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder={t('ai_copilot.placeholder')}
            rows={3}
            disabled={submitting}
            maxLength={2000}
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              {lastUsage && lastUsage.in !== null && (
                <span className="tabular-nums">
                  {t('ai_copilot.tokens_used', { input: lastUsage.in, output: lastUsage.out ?? 0 })}
                </span>
              )}
            </div>
            <Button onClick={handleSend} disabled={submitting || !instruction.trim()}>
              {submitting ? (
                <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> {t('ai_copilot.thinking')}</>
              ) : (
                <><Send className="h-4 w-4 mr-1.5" /> {t('ai_copilot.send')}</>
              )}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="h-2.5 w-2.5" /> {t('ai_copilot.privacy_note')}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
