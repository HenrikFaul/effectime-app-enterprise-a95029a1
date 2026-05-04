import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { User, LogOut, Moon, Sun, Pencil, Copy, Check, Save, ShieldCheck, Building2 } from 'lucide-react';
import { toast } from 'sonner';

export function ProfileMenu({ showLabel = false }: { showLabel?: boolean } = {}) {
  const { user, signOut, isTemporary, tempAccessToken } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const isTemporarySession = isTemporary;
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tempDisplayName, setTempDisplayName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user || isTemporarySession) return;
    const checkAdmin = async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      setIsAdmin(!!data);
    };
    checkAdmin();
  }, [user, isTemporarySession]);

  useEffect(() => {
    if (!user || !isTemporarySession) {
      setTempDisplayName(null);
      return;
    }

    let cancelled = false;

    const loadTemporaryDisplayName = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled) return;

      setTempDisplayName(
        data?.display_name || (typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : null)
      );
    };

    loadTemporaryDisplayName();

    return () => {
      cancelled = true;
    };
  }, [user, isTemporarySession]);

  const displayName = isTemporarySession
    ? tempDisplayName || user?.user_metadata?.display_name || user?.email || 'Felhasználó'
    : user?.user_metadata?.display_name || user?.email || 'Felhasználó';
  const initials = displayName.slice(0, 2).toUpperCase();

  const handleEditName = () => {
    setNewName(displayName);
    setEditingName(true);
  };

  const handleSaveName = async () => {
    if (!newName.trim() || !user) return;
    setSavingName(true);

    const normalizedName = newName.trim();
    const { data, error } = await supabase.functions.invoke('join-event', {
      body: { action: 'update-temp-name', display_name: normalizedName },
    });

    if (error || data?.error) {
      toast.error(data?.error || 'Hiba a név mentésekor.');
      setSavingName(false);
      return;
    }

    setTempDisplayName(data?.display_name || normalizedName);
    await supabase.auth.updateUser({
      data: {
        ...((user.user_metadata as Record<string, unknown> | undefined) || {}),
        display_name: data?.display_name || normalizedName,
      },
    });

    toast.success('Név frissítve!');
    setEditingName(false);
    setSavingName(false);
  };

  const handleCopyReturnLink = async () => {
    if (!tempAccessToken) return;
    const link = `${window.location.origin}/temp/${tempAccessToken}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Visszatérési link vágólapra másolva!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Temp user menu
  if (isTemporarySession) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger className="outline-none">
          <div className="flex items-center gap-2 cursor-pointer">
            <Avatar className="h-10 w-10 rounded-xl border-2 border-transparent transition-all hover:border-primary/50 hover:shadow-glow">
              <AvatarFallback className="rounded-xl gradient-primary text-primary-foreground text-sm font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            {showLabel && <span className="font-display font-semibold text-sm hidden sm:inline">{displayName}</span>}
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 rounded-xl p-1.5">
          <div className="px-3 py-2">
            {editingName ? (
              <div className="flex items-center gap-1.5">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="h-8 text-sm rounded-lg"
                  maxLength={50}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                />
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={handleSaveName} disabled={savingName}>
                  <Save className="h-3.5 w-3.5 text-primary" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{displayName}</p>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleEditName}>
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Vendég felhasználó</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleCopyReturnLink} className="rounded-lg cursor-pointer">
            {copied ? <Check className="mr-2 h-4 w-4 text-primary" /> : <Copy className="mr-2 h-4 w-4" />}
            Visszatérési link másolása
          </DropdownMenuItem>
          <DropdownMenuItem onClick={toggleTheme} className="rounded-lg cursor-pointer">
            {theme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
            {theme === 'dark' ? 'Világos mód' : 'Sötét mód'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut} className="rounded-lg cursor-pointer text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Kijelentkezés
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Regular user menu
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="outline-none">
        <div className="flex items-center gap-2 cursor-pointer">
          <Avatar className="h-10 w-10 rounded-xl border-2 border-transparent transition-all hover:border-primary/50 hover:shadow-glow">
            <AvatarFallback className="rounded-xl gradient-primary text-primary-foreground text-sm font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {showLabel && <span className="font-display font-semibold text-sm hidden sm:inline">Profilom</span>}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5">
        <div className="px-3 py-2">
          <p className="text-sm font-semibold">{displayName}</p>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/profile')} className="rounded-lg cursor-pointer">
          <User className="mr-2 h-4 w-4" />
          Profilom
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem onClick={() => navigate('/admin')} className="rounded-lg cursor-pointer">
            <ShieldCheck className="mr-2 h-4 w-4" />
            Admin Panel
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => navigate('/enterprise')} className="rounded-lg cursor-pointer">
          <Building2 className="mr-2 h-4 w-4" />
          Enterprise
        </DropdownMenuItem>
        <DropdownMenuItem onClick={toggleTheme} className="rounded-lg cursor-pointer">
          {theme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
          {theme === 'dark' ? 'Világos mód' : 'Sötét mód'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="rounded-lg cursor-pointer text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Kijelentkezés
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
