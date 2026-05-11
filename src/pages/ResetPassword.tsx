import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { KeyRound } from 'lucide-react';
import { motion } from 'framer-motion';
import { useT } from '@/i18n/I18nProvider';
import { LanguageSelector } from '@/components/i18n/LanguageSelector';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const navigate = useNavigate();
  const t = useT();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
    });
    if (window.location.hash.includes('type=recovery')) {
      setIsRecovery(true);
    }
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error(t('reset_password.toast_mismatch'));
      return;
    }
    if (password.length < 6) {
      toast.error(t('reset_password.toast_too_short'));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(t('reset_password.toast_error'));
    } else {
      toast.success(t('reset_password.toast_success'));
      navigate('/');
    }
    setLoading(false);
  };

  if (!isRecovery) {
    return (
      <>
        <div className="fixed top-4 right-4 z-50">
          <LanguageSelector size="sm" align="end" />
        </div>
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <Card className="w-full max-w-md rounded-2xl">
            <CardContent className="p-6 text-center text-muted-foreground">
              {t('reset_password.invalid_link')}
              <Button variant="link" className="mt-2" onClick={() => navigate('/auth')}>
                {t('reset_password.back_to_signin')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="fixed top-4 right-4 z-50">
        <LanguageSelector size="sm" align="end" />
      </div>
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="rounded-2xl shadow-elevated border">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary shadow-glow">
                <KeyRound className="h-8 w-8 text-primary-foreground" />
              </div>
              <CardTitle className="font-display text-2xl">{t('reset_password.title')}</CardTitle>
              <CardDescription>{t('reset_password.subtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">{t('reset_password.label_new_password')}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="rounded-xl h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t('reset_password.label_confirm_password')}</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="rounded-xl h-12"
                  />
                </div>
                <Button type="submit" className="w-full h-12 rounded-xl gradient-primary text-primary-foreground shadow-glow hover:opacity-90 transition-opacity font-semibold" disabled={loading}>
                  {loading ? t('reset_password.btn_saving') : t('reset_password.btn_save')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </>
  );
};

export default ResetPassword;
