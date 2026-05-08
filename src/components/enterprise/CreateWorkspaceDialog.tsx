import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onCreated: () => void;
}

export function CreateWorkspaceDialog({ open, onOpenChange, userId, onCreated }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);

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
    setSeedingDemo(true);
    const toastId = toast.loading('Demo munkaterület készítése folyamatban... ez 5-10 másodperc');
    try {
      const { data, error } = await supabase.functions.invoke('seed-demo-workspace', {
        body: {
          name: name.trim() || `Demo munkaterület ${new Date().toLocaleDateString('hu-HU')}`,
          description: description.trim() || null,
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'Ismeretlen hiba');
      toast.success(`Demo munkaterület készen áll (${data.members_created} tag)`, { id: toastId });
      setName('');
      setDescription('');
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      console.error(err);
      toast.error(`Hiba a demo munkaterület létrehozásakor: ${err?.message || err}`, { id: toastId });
    } finally {
      setSeedingDemo(false);
    }
  };

  const busy = loading || seedingDemo;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Új munkaterület létrehozása</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="ws-name">Név *</Label>
            <Input
              id="ws-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="pl. Marketing csapat"
              maxLength={100}
              disabled={busy}
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
              disabled={busy}
            />
          </div>

          <Separator />

          <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" />
              Demo munkaterület
            </div>
            <p className="text-xs text-muted-foreground">
              Egy kattintással létrehoz egy teljesen feltöltött munkaterületet:
              3 demo taggal, csapatokkal, irodákkal, készségekkel, szabadság-típusokkal,
              kvótákkal, ünnepnapokkal és vegyes (jóváhagyott / elutasított / függő)
              kérelmekkel — minden modul azonnal tesztelhető.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full gap-1.5"
              onClick={handleCreateDemo}
              disabled={busy}
            >
              <Sparkles className="h-4 w-4" />
              {seedingDemo ? 'Generálás...' : 'Demo munkaterület létrehozása'}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Mégse
          </Button>
          <Button onClick={handleCreate} disabled={busy || !name.trim()}>
            {loading ? 'Létrehozás...' : 'Létrehozás'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
