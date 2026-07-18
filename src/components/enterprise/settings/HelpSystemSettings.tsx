import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { CircleHelp, Sparkles } from 'lucide-react';
import { useT } from '@/i18n/I18nProvider';

interface Props {
  workspaceId: string;
}

export function HelpSystemSettings({ workspaceId }: Props) {
  const t = useT();
  const [aiEnabled, setAiEnabled] = useState(true);
  const [lastRegenerated, setLastRegenerated] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load current settings from workspace
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from('enterprise_workspaces')
        .select('help_ai_enabled, help_last_regenerated_at')
        .eq('id', workspaceId)
        .maybeSingle();
      if (cancelled || !data) return;
      setAiEnabled(data.help_ai_enabled ?? true);
      setLastRegenerated(data.help_last_regenerated_at ?? null);
    })();
    return () => { cancelled = true; };
  }, [workspaceId]);

  const handleToggle = async (checked: boolean) => {
    setAiEnabled(checked);
    setSaving(true);
    try {
      await (supabase as any)
        .from('enterprise_workspaces')
        .update({ help_ai_enabled: checked })
        .eq('id', workspaceId);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <CircleHelp className="h-4 w-4 text-primary" />
          {t('help_settings.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* AI toggle */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="help-ai-toggle" className="text-sm font-medium">
              {t('help_settings.ai_toggle_label')}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t('help_settings.ai_toggle_description')}
            </p>
          </div>
          <Switch
            id="help-ai-toggle"
            checked={aiEnabled}
            onCheckedChange={handleToggle}
            disabled={saving}
          />
        </div>

        {/* Last regenerated info */}
        {lastRegenerated && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            {t('help_settings.last_regenerated')}{' '}
            {new Date(lastRegenerated).toLocaleString()}
          </p>
        )}

      </CardContent>
    </Card>
  );
}
