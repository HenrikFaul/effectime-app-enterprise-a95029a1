import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Document generator hooks (Top-20 Rank 18, v3.26.0).
 *
 * Two paths:
 *   - `document_generate` RPC for pure template substitution (always works).
 *   - `document-ai-polish` edge fn for optional Claude polish (gated on
 *     ANTHROPIC_API_KEY; returns the original unchanged if unset).
 */

export interface DocumentTemplate {
  id: string;
  workspace_id: string | null;
  name: string;
  doc_type: string;
  language: string;
  body_html: string;
  variables: string[];
  is_system: boolean;
}

export interface GeneratedDocument {
  id: string;
  workspace_id: string;
  template_id: string | null;
  membership_id: string | null;
  doc_type: string;
  language: string;
  content_html: string;
  subject: string | null;
  status: 'draft' | 'final' | 'sent' | 'signed';
  generated_at: string;
}

export function useDocumentTemplates(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: ['documents', 'templates', workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_templates')
        .select('id, workspace_id, name, doc_type, language, body_html, variables, is_system')
        .or(`is_system.eq.true,workspace_id.eq.${workspaceId}`)
        .order('doc_type');
      if (error) throw error;
      return (data ?? []) as DocumentTemplate[];
    },
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useGeneratedDocuments(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: ['documents', 'generated', workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('generated_documents')
        .select('id, workspace_id, template_id, membership_id, doc_type, language, content_html, subject, status, generated_at')
        .eq('workspace_id', workspaceId as string)
        .order('generated_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as GeneratedDocument[];
    },
    enabled: !!workspaceId,
    staleTime: 60 * 1000,
  });
}

export async function generateDocument(args: {
  workspaceId: string;
  templateId: string;
  membershipId?: string;
  extraVars?: Record<string, string>;
  subject?: string;
}) {
  const { data, error } = await supabase.rpc('document_generate', {
    _workspace_id: args.workspaceId,
    _template_id: args.templateId,
    _membership_id: args.membershipId ?? null,
    _extra_vars: args.extraVars ?? {},
    _subject: args.subject ?? null,
  });
  if (error) throw error;
  return data as { ok: boolean; document_id: string; content_html: string; context: Record<string, unknown> };
}

export async function polishDocumentWithAi(documentId: string, instruction?: string) {
  const { data, error } = await supabase.functions.invoke('document-ai-polish', {
    body: { document_id: documentId, instruction },
  });
  if (error) throw error;
  return data as {
    ok: boolean;
    ai_available: boolean;
    polished_html: string;
    hint?: string;
    error?: string;
    model?: string;
  };
}
