import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * AI Scheduling Copilot hooks (Top-20 Rank 1, v3.27.0).
 *
 * Optional Claude integration: when ANTHROPIC_API_KEY is configured in
 * Supabase secrets the edge function returns AI-generated analysis +
 * recommendations; otherwise it returns a friendly fallback so the UI
 * doesn't break.
 */

export interface CopilotMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool_result';
  content: string;
  structured_plan: {
    analysis?: string;
    recommendations?: string[];
    warnings?: string[];
    requires_human_review?: boolean;
    confidence?: number;
    ai_available?: boolean;
    error?: string;
    raw?: string;
    parse_failed?: boolean;
  } | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
}

export interface CopilotResponse {
  ok: boolean;
  ai_available: boolean;
  model?: string;
  content: string;
  structured_plan?: CopilotMessage['structured_plan'];
  usage?: { input_tokens: number | null; output_tokens: number | null };
  hint?: string;
  context_summary?: {
    member_count: number;
    open_leave_requests: number;
    shifts_next_90d: number;
    open_violations: number;
  };
}

export function useCopilotMessages(conversationId: string | null | undefined) {
  return useQuery({
    queryKey: ['ai-copilot', 'messages', conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_copilot_messages')
        .select('id, conversation_id, role, content, structured_plan, model, input_tokens, output_tokens, created_at')
        .eq('conversation_id', conversationId as string)
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as CopilotMessage[];
    },
    enabled: !!conversationId,
    staleTime: 5 * 1000,
  });
}

export async function startCopilotConversation(workspaceId: string, title?: string) {
  const { data, error } = await supabase.rpc('ai_copilot_start_conversation', {
    _workspace_id: workspaceId,
    _title: title ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function askCopilot(workspaceId: string, conversationId: string, instruction: string, model?: string) {
  const { data, error } = await supabase.functions.invoke('ai-copilot', {
    body: { workspace_id: workspaceId, conversation_id: conversationId, instruction, model },
  });
  if (error) throw error;
  return data as CopilotResponse;
}
