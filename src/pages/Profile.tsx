import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ProfileMenu } from '@/components/ProfileMenu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, User, Save } from 'lucide-react';
import { ChangePasswordCard } from '@/components/ChangePasswordCard';
import { DeleteAccountCard } from '@/components/DeleteAccountCard';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .single();
      if (profile) setDisplayName(profile.display_name || '');
    };
    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('user_id', user.id);

    if (error) {
      toast.error('Hiba a mentés során.');
    } else {
      toast.success('Profil frissítve!');
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-background pb-safe">
      <header className="sticky top-0 z-40 glass-strong border-b">
        <div className="flex items-center justify-between px-4 py-3 lg:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/enterprise')} className="rounded-xl">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="font-display text-lg sm:text-xl font-bold">Profilom</h1>
          </div>
          <ProfileMenu />
        </div>
      </header>

      <div className="mx-auto max-w-lg p-4 lg:p-8 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <Card className="rounded-2xl shadow-card border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2.5 font-display">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                  <User className="h-5 w-5 text-primary" />
                </div>
                Profil adatok
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl gradient-primary text-2xl font-bold text-primary-foreground shadow-glow">
                  {displayName ? displayName.slice(0, 2).toUpperCase() : 'U'}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Megjelenített név</Label>
                <Input value={displayName} onChange={e => setDisplayName(e.target.value)} className="rounded-xl h-11" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">E-mail</Label>
                <Input value={user?.email || ''} disabled className="rounded-xl h-11" />
              </div>
              <Button
                onClick={handleSave}
                className="w-full rounded-xl h-11 gradient-primary text-primary-foreground shadow-glow hover:opacity-90 transition-opacity font-semibold"
                disabled={saving}
              >
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Mentés...' : 'Mentés'}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <ChangePasswordCard />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <DeleteAccountCard />
        </motion.div>
      </div>
    </div>
  );
};

export default Profile;
