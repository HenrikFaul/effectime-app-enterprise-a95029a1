import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { FileText, Sparkles, Loader2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/I18nProvider';
import {
  useDocumentTemplates,
  useGeneratedDocuments,
  generateDocument,
  polishDocumentWithAi,
} from '@/hooks/useDocumentGenerator';

interface Props {
  workspaceId: string;
}

/**
 * DocumentGeneratorPanel — Top-20 Rank 18, v3.26.0.
 *
 * Pick a template, optionally a member, optionally provide a few extra
 * variable values, generate → preview the HTML, optionally polish with
 * Claude. Pure template substitution always works; AI polish only fires
 * when ANTHROPIC_API_KEY is configured in Supabase secrets.
 */
export function DocumentGeneratorPanel({ workspaceId }: Props) {
  const { t } = useI18n();
  const { data: templates } = useDocumentTemplates(workspaceId);
  const { data: history, refetch: refetchHistory } = useGeneratedDocuments(workspaceId);

  const [templateId, setTemplateId] = useState('');
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [lastDocId, setLastDocId] = useState<string | null>(null);
  const [extraVarsText, setExtraVarsText] = useState('');

  const selectedTemplate = useMemo(
    () => (templates ?? []).find((t) => t.id === templateId) ?? null,
    [templates, templateId],
  );

  const handleGenerate = async () => {
    if (!templateId) {
      toast.error(t('documents.template_required'));
      return;
    }
    let extras: Record<string, string> = {};
    if (extraVarsText.trim()) {
      try {
        extras = JSON.parse(extraVarsText);
      } catch {
        toast.error(t('documents.extras_invalid_json'));
        return;
      }
    }
    setGenerating(true);
    try {
      const res = await generateDocument({
        workspaceId,
        templateId,
        extraVars: extras,
      });
      setPreviewHtml(res.content_html);
      setLastDocId(res.document_id);
      toast.success(t('documents.generate_success'));
      await refetchHistory();
    } catch (e: unknown) {
      toast.error(t('documents.generate_error') + ': ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setGenerating(false);
    }
  };

  const handlePolish = async () => {
    if (!lastDocId) return;
    setPolishing(true);
    try {
      const res = await polishDocumentWithAi(lastDocId);
      setPreviewHtml(res.polished_html);
      if (res.ai_available) {
        toast.success(t('documents.polish_success'));
      } else {
        toast.message(t('documents.polish_unavailable'), {
          description: res.hint ?? '',
        });
      }
    } catch (e: unknown) {
      toast.error(t('documents.polish_error') + ': ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPolishing(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            {t('documents.generator_title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="tpl-select" className="text-xs">
              {t('documents.template_label')}
            </Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger id="tpl-select">
                <SelectValue placeholder={t('documents.template_placeholder')} />
              </SelectTrigger>
              <SelectContent>
                {(templates ?? []).map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id}>
                    {tpl.name} ({tpl.language}) — {tpl.doc_type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedTemplate && selectedTemplate.variables.length > 0 && (
            <div className="space-y-1">
              <Label htmlFor="extras-input" className="text-xs">
                {t('documents.extras_label')}
              </Label>
              <Input
                id="extras-input"
                value={extraVarsText}
                onChange={(e) => setExtraVarsText(e.target.value)}
                placeholder='{"leave.start_date":"2026-05-20","leave.end_date":"2026-05-25"}'
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                {t('documents.extras_hint', { vars: selectedTemplate.variables.join(', ') })}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleGenerate} disabled={generating || !templateId}>
              {generating ? (
                <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> {t('documents.generating')}</>
              ) : (
                <><FileText className="h-4 w-4 mr-1.5" /> {t('documents.generate')}</>
              )}
            </Button>
            {lastDocId && (
              <Button variant="outline" onClick={handlePolish} disabled={polishing}>
                {polishing ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> {t('documents.polishing')}</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-1.5" /> {t('documents.polish_with_ai')}</>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {previewHtml && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              {t('documents.preview_title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="prose prose-sm dark:prose-invert max-w-none rounded border bg-background p-4"
              // eslint-disable-next-line react/no-danger -- HTML comes from a SECURITY DEFINER RPC that
              // substitutes pre-declared variables; no user-supplied raw HTML beyond curated templates.
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </CardContent>
        </Card>
      )}

      {(history ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{t('documents.history_title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {(history ?? []).slice(0, 10).map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{d.subject ?? d.doc_type}</span>
                  <span className="text-muted-foreground ml-2">
                    {new Date(d.generated_at).toLocaleString()}
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {d.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
