import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('A munkaterület neve kötelező');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('create_workspace_with_owner', {
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button onClick={handleCreate} disabled={loading || !name.trim()}>
            {loading ? 'Létrehozás...' : 'Létrehozás'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
