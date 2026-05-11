import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n/I18nProvider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, MoreVertical, Trash2, ShieldCheck, ShieldOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

type AdminUser = {
  id: string;
  email: string;
  display_name: string;
  is_temporary: boolean;
  linked_event_id: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  roles: string[];
  event_count: number;
  vote_count: number;
  provider: string;
};

const AdminUsers = () => {
  const { t } = useI18n();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('admin', {
      body: { action: 'list-users', search: search || undefined, filter: filter === 'all' ? undefined : filter },
    });
    if (!error && data?.users) {
      setUsers(data.users);
    }
    setLoading(false);
  }, [search, filter]);

  useEffect(() => {
    const timer = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const handleDeleteUser = async (userId: string, name: string) => {
    setActionLoading(userId);
    const { data, error } = await supabase.functions.invoke('admin', {
      body: { action: 'delete-user', user_id: userId },
    });
    if (error || data?.error) {
      toast.error(data?.error || t('admin.delete_user_error'));
    } else {
      toast.success(t('admin.delete_user_success', { name }));
      setUsers(prev => prev.filter(u => u.id !== userId));
    }
    setActionLoading(null);
  };

  const handleToggleAdmin = async (userId: string, currentlyAdmin: boolean) => {
    setActionLoading(userId);
    const { data, error } = await supabase.functions.invoke('admin', {
      body: { action: 'update-role', user_id: userId, role: 'admin', grant: !currentlyAdmin },
    });
    if (error || data?.error) {
      toast.error(data?.error || t('admin.toggle_role_error'));
    } else {
      toast.success(currentlyAdmin ? t('admin.admin_role_removed') : t('admin.admin_role_granted'));
      setUsers(prev => prev.map(u =>
        u.id === userId
          ? { ...u, roles: currentlyAdmin ? u.roles.filter(r => r !== 'admin') : [...u.roles, 'admin'] }
          : u
      ));
    }
    setActionLoading(null);
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <Card className="rounded-2xl shadow-soft">
      <CardHeader className="space-y-4">
        <CardTitle className="text-base font-medium">{t('admin.users_title')}</CardTitle>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('admin.search_placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-full sm:w-44 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.filter_all')}</SelectItem>
              <SelectItem value="registered">{t('admin.filter_registered')}</SelectItem>
              <SelectItem value="temporary">{t('admin.filter_temporary')}</SelectItem>
              <SelectItem value="admin">{t('admin.filter_admin')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t('admin.no_results')}</p>
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground mb-2">{t('admin.users_count', { count: users.length })}</div>
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-xl bg-muted/30 hover:bg-muted/50 px-4 py-3 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{u.display_name || t('admin.anonymous')}</span>
                    {u.is_temporary && (
                      <Badge variant="outline" className="text-[10px] h-5 border-warning text-warning">{t('admin.badge_guest')}</Badge>
                    )}
                    {u.roles.includes('admin') && (
                      <Badge className="text-[10px] h-5 bg-accent text-accent-foreground">Admin</Badge>
                    )}
                    {u.provider === 'google' && (
                      <Badge variant="outline" className="text-[10px] h-5">Google</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
                    <span>{t('admin.registered_short')}: {formatDate(u.created_at)}</span>
                    <span>{t('admin.last_login_short')}: {formatDate(u.last_sign_in_at)}</span>
                    <span>{t('admin.event_count', { count: u.event_count })}</span>
                    <span>{t('admin.vote_count', { count: u.vote_count })}</span>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" disabled={actionLoading === u.id}>
                      {actionLoading === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl">
                    <DropdownMenuItem
                      onClick={() => handleToggleAdmin(u.id, u.roles.includes('admin'))}
                      className="rounded-lg cursor-pointer"
                    >
                      {u.roles.includes('admin') ? (
                        <><ShieldOff className="mr-2 h-4 w-4" /> {t('admin.remove_admin')}</>
                      ) : (
                        <><ShieldCheck className="mr-2 h-4 w-4" /> {t('admin.grant_admin')}</>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem
                          onSelect={(e) => e.preventDefault()}
                          className="rounded-lg cursor-pointer text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> {t('admin.delete_user_action')}
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('admin.delete_user_dialog_title')}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t('admin.delete_user_dialog_description', { name: u.display_name || u.email })}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-xl">{t('admin.cancel')}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteUser(u.id, u.display_name || u.email)}
                            className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {t('admin.delete_confirm')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminUsers;
