import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Upload, Trash2, Save } from 'lucide-react';

interface Props { workspaceId: string }

interface Branding {
  brand_color: string | null;
  brand_logo_light_url: string | null;
  brand_logo_dark_url: string | null;
  favicon_url: string | null;
  white_label: boolean;
}

export function BrandingManager({ workspaceId }: Props) {
  const [b, setB] = useState<Branding | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const lightRef = useRef<HTMLInputElement>(null);
  const darkRef = useRef<HTMLInputElement>(null);
  const favRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('enterprise_workspaces')
      .select('brand_color,brand_logo_light_url,brand_logo_dark_url,favicon_url,white_label')
      .eq('id', workspaceId).single();
    setB(data as Branding);
    setLoading(false);
  };
  useEffect(() => { load(); }, [workspaceId]);

  const upload = async (file: File, kind: 'light' | 'dark' | 'favicon') => {
    const ext = file.name.split('.').pop() || 'png';
    const path = `${workspaceId}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('workspace-branding').upload(path, file, { upsert: true });
    if (error) { toast.error('Feltöltési hiba'); return; }
    const { data } = supabase.storage.from('workspace-branding').getPublicUrl(path);
    const url = data.publicUrl;
    if (b) {
      const updates: Partial<Branding> =
        kind === 'light' ? { brand_logo_light_url: url } :
        kind === 'dark' ? { brand_logo_dark_url: url } :
        { favicon_url: url };
      await (supabase as any).from('enterprise_workspaces').update(updates).eq('id', workspaceId);
      setB({ ...b, ...updates });
      toast.success('Feltöltve');
    }
  };

  const removeAsset = async (kind: 'light' | 'dark' | 'favicon') => {
    if (!b) return;
    const updates: Partial<Branding> =
      kind === 'light' ? { brand_logo_light_url: null } :
      kind === 'dark' ? { brand_logo_dark_url: null } :
      { favicon_url: null };
    await (supabase as any).from('enterprise_workspaces').update(updates).eq('id', workspaceId);
    setB({ ...b, ...updates });
  };

  const save = async () => {
    if (!b) return;
    setSaving(true);
    const { error } = await (supabase as any).from('enterprise_workspaces').update({ brand_color: b.brand_color, white_label: b.white_label }).eq('id', workspaceId);
    if (error) toast.error('Mentési hiba'); else toast.success('Brand mentve');
    setSaving(false);
  };

  if (loading || !b) return <div className="flex justify-center py-4"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  const LogoSlot = ({ label, url, kind, refEl }: { label: string; url: string | null; kind: 'light' | 'dark' | 'favicon'; refEl: React.RefObject<HTMLInputElement> }) => (
    <div className="rounded-md border p-3 space-y-2">
      <Label className="text-xs">{label}</Label>
      {url ? (
        <div className="flex items-center gap-2">
          <img src={url} alt={label} className="h-12 max-w-[120px] object-contain bg-muted rounded p-1" />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeAsset(kind)}>
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      ) : <p className="text-[10px] text-muted-foreground">Nincs feltöltve</p>}
      <input
        ref={refEl}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f, kind); }}
      />
      <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => refEl.current?.click()}>
        <Upload className="h-3 w-3 mr-1" /> Feltöltés
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <LogoSlot label="Logó (világos téma)" url={b.brand_logo_light_url} kind="light" refEl={lightRef} />
        <LogoSlot label="Logó (sötét téma)" url={b.brand_logo_dark_url} kind="dark" refEl={darkRef} />
        <LogoSlot label="Favicon" url={b.favicon_url} kind="favicon" refEl={favRef} />
      </div>

      <div>
        <Label className="text-xs">Brand szín (accent)</Label>
        <div className="flex items-center gap-2 mt-1">
          <input type="color" value={b.brand_color || '#3b82f6'} onChange={e => setB({ ...b, brand_color: e.target.value })} className="h-9 w-12 rounded border cursor-pointer" />
          <Input value={b.brand_color || ''} onChange={e => setB({ ...b, brand_color: e.target.value })} placeholder="#3b82f6" className="w-32 text-xs" />
        </div>
      </div>

      <div className="flex items-start justify-between rounded-md border p-3 gap-3">
        <div className="flex-1">
          <Label className="text-sm cursor-pointer">White-label mód</Label>
          <p className="text-[11px] text-muted-foreground mt-0.5">Eltávolítja a SyncFolk brandinget az e-mailekből és iCal feedekből.</p>
        </div>
        <Switch checked={b.white_label} onCheckedChange={v => setB({ ...b, white_label: v })} />
      </div>

      <Button onClick={save} disabled={saving}>
        <Save className="h-3 w-3 mr-1" /> {saving ? 'Mentés...' : 'Brand mentése'}
      </Button>
    </div>
  );
}
