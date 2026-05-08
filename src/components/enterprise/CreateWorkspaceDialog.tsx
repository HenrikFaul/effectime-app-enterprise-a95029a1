import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Sparkles, Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onCreated: () => void;
}

export function CreateWorkspaceDialog({ open, onOpenChange, userId: _userId, onCreated }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('A munkaterület neve kötelező');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.rpc('create_workspace_with_owner', {
        _name: name.trim(),
        _description: description.trim() || null,
      });

      if (error) throw error;

      toast.success('Munkaterület létrehozva!');
      setName('');
      setDescription('');
      onOpenChange(false);
      onCreated();
    } catch (err: unknown) {
      console.error(err);
      toast.error('Hiba a munkaterület létrehozásakor');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDemo = async () => {
    setDemoLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('seed-demo-workspace', {
        body: {
          name: name.trim() || `Demo munkaterület ${new Date().toLocaleDateString('hu-HU')}`,
        },
      });
      if (error) throw error;
      const payload = data as { ok?: boolean; error?: string; summary?: Record<string, number> } | null;
      if (!payload?.ok) {
        throw new Error(payload?.error ?? 'Ismeretlen hiba a demo seederben');
      }
      const s = payload.summary ?? {};
      toast.success(
        `Demo munkaterület kész! ${s.members ?? 0} tag · ${s.leave_requests ?? 0} kérelem · ${s.skills ?? 0} készség · ${s.holidays ?? 0} ünnepnap`,
      );
      setName('');
      setDescription('');
      onOpenChange(false);
      onCreated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[CreateWorkspaceDialog] demo seed failed', err);
      toast.error('Hiba a demo munkaterület létrehozásakor: ' + msg);
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby="create-ws-description">
        <DialogHeader>
          <DialogTitle>Új munkaterület létrehozása</DialogTitle>
        </DialogHeader>
        <p id="create-ws-description" className="sr-only">
          Hozz létre üres munkaterületet, vagy egy kattintással egy teljesen feltöltött demo munkaterületet.
        </p>
        <div className="space-y-4">
          <div>
            <Label htmlFor="ws-name">Név *</Label>
            <Input
              id="ws-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="pl. Marketing csapat"
              maxLength={100}
            />
          </div>
          <div>
            <Label htmlFor="ws-desc">Leírás</Label>
            <Textarea
              id="ws-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcionális leírás..."
              rows={3}
              maxLength={500}
            />
          </div>

          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" />
              Demo munkaterület
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Egy kattintással létrehoz egy teljesen feltöltött munkaterületet: 7 demo taggal, csapatokkal, irodákkal, készségekkel, szabadság-típusokkal, kvótákkal, ünnepnapokkal és vegyes (jóváhagyott / elutasított / függő) kérelmekkel — minden modul azonnal tesztelhető.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateDemo}
              disabled={demoLoading || loading}
              className="w-full gap-1.5"
            >
              {demoLoading
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Demo létrehozás folyamatban…</>
                : <><Sparkles className="h-3.5 w-3.5" /> Demo munkaterület létrehozása</>}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={demoLoading || loading}>
            Mégse
          </Button>
          <Button onClick={handleCreate} disabled={loading || demoLoading || !name.trim()}>
            {loading ? 'Létrehozás...' : 'Létrehozás'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
