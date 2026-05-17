import { useEffect, useRef, useState } from 'react';
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

export function CopilotPanel({ workspaceId }: Props) {
  const { t } = useI18n();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [instruction, setInstruction] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: messages, refetch } = useCopilotMessages(conversationId);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages?.length]);

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
      setInstruction('');
      await refetch();
      if (!res.ai_available) {
        toast.message(t('ai_copilot.not_configured'), { description: res.hint });
      }
    } catch (e: unknown) {
      const msg = (e as any)?.message ?? (e instanceof Error ? e.message : String(e));
      toast.error(t('ai_copilot.error') + ': ' + msg);
    } finally {
      setSubmitting(false);
    }
  };

  const renderAssistant = (m: CopilotMessage) => {
    const plan = m.structured_plan;
    if (plan?.ai_available === false || plan?.parse_failed || plan?.error) {
      return <p className="text-xs whitespace-pre-wrap">{m.content}</p>;
    }
    if (plan?.analysis) {
      return (
        <div className="space-y-1.5">
          <p className="text-xs">{plan.analysis}</p>
          {(plan.recommendations ?? []).length > 0 && (
            <ul className="text-xs list-disc list-inside space-y-0.5">
              {(plan.recommendations as string[]).map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          )}
          {(plan.warnings ?? []).length > 0 && (
            <div className="rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-1.5">
              <p className="text-[10px] uppercase tracking-wide text-amber-700 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {t('ai_copilot.warnings')}
              </p>
              <ul className="text-xs list-disc list-inside space-y-0.5">
                {(plan.warnings as string[]).map((w, i) => <li key={i}>{w}</li>)}
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

  const hasMessages = (messages ?? []).length > 0;

  return (
    <div className="rounded-lg border bg-card px-4 py-3 space-y-2">
      {/* Compact header */}
      <div className="flex items-center gap-2">
        <Bot className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-xs font-medium">{t('ai_copilot.title')}</span>
        <Badge variant="outline" className="text-[10px] ml-auto">
          <Sparkles className="h-2.5 w-2.5 mr-1" /> {t('ai_copilot.powered_by')}
        </Badge>
      </div>

      {/* Message history — only visible when conversation has started */}
      {hasMessages && (
        <div
          ref={scrollRef}
          className="max-h-32 overflow-y-auto space-y-2 rounded border bg-background p-2"
        >
          {(messages ?? []).map((m) => (
            <div
              key={m.id}
              className={`p-2 rounded ${m.role === 'user' ? 'bg-primary/10 ml-6' : 'bg-muted mr-6'}`}
            >
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                {m.role === 'user' ? t('ai_copilot.role_you') : t('ai_copilot.role_assistant')}
                {m.role === 'assistant' && m.model && ` · ${m.model}`}
              </p>
              {m.role === 'assistant' ? renderAssistant(m) : (
                <p className="text-xs whitespace-pre-wrap">{m.content}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className="flex gap-2 items-end">
        <Textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder={t('ai_copilot.placeholder')}
          rows={2}
          disabled={submitting}
          maxLength={2000}
          className="resize-none text-xs"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend();
          }}
        />
        <Button
          onClick={handleSend}
          disabled={submitting || !instruction.trim()}
          size="sm"
          className="shrink-0 self-end"
        >
          {submitting
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Send className="h-4 w-4" />
          }
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
        <CheckCircle2 className="h-2.5 w-2.5 shrink-0" /> {t('ai_copilot.privacy_note')}
      </p>
    </div>
  );
}
