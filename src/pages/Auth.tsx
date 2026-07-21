import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import {
  Mail, ArrowLeft, CheckCircle2, KeyRound, Users, BarChart3, CalendarDays,
  ClipboardCheck, LayoutDashboard, Sparkles, Shield, Workflow, ArrowRight,
  HelpCircle, Trophy, Star, Award, Zap, Globe, Lock, Check, X, Clock,
  BadgeCheck, Fingerprint, Server,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { EffectimeLogo } from "@/components/EffectimeLogo";
import { useT } from '@/i18n/I18nProvider';
import { LanguageSelector } from '@/components/i18n/LanguageSelector';
import { resolveInternalPath } from '@/lib/internalPath';
import {
  buildAuthCallbackUrl,
  isAllowedSupabaseOAuthUrl,
  isNativeRuntime,
  readWebImplicitSessionTokens,
} from '@/lib/platform/mobile';
import { getNativeBrowserPlugin } from '@/lib/platform/nativeBridge';
import { SUPABASE_URL } from '@/config/publicRuntime';
import { canonicalizeWorkspaceProfileDisplayName } from '@/lib/profileDisplayName';

type AuthView = "login" | "register" | "verify" | "forgot";

const OTP_LENGTH = 8;
const GOOGLE_OAUTH_QUERY_PARAM = "oauth";
const GOOGLE_OAUTH_PROVIDER = "google";
const EMAIL_ACTIVATION_QUERY_PARAM = "email_activation_token";

const GoogleIcon = () => (
  <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const Auth = () => {
  const t = useT();

  const features = [
    {
      icon: CalendarDays,
      title: t('auth_page.f1_title'),
      desc: t('auth_page.f1_desc'),
    },
    {
      icon: ClipboardCheck,
      title: t('auth_page.f2_title'),
      desc: t('auth_page.f2_desc'),
    },
    {
      icon: LayoutDashboard,
      title: t('auth_page.f3_title'),
      desc: t('auth_page.f3_desc'),
    },
    {
      icon: Sparkles,
      title: t('auth_page.f4_title'),
      desc: t('auth_page.f4_desc'),
    },
    {
      icon: Users,
      title: t('auth_page.f5_title'),
      desc: t('auth_page.f5_desc'),
    },
    {
      icon: CheckCircle2,
      title: t('auth_page.f6_title'),
      desc: t('auth_page.f6_desc'),
    },
  ];

  const trustBadges = [
    {
      icon: Shield,
      label: t('auth_page.tb1_label'),
      sub: t('auth_page.tb1_sub'),
      color: "from-blue-500 to-blue-600",
      bg: "bg-blue-50 dark:bg-blue-900/20",
      border: "border-blue-200 dark:border-blue-500/30",
      text: "text-blue-700 dark:text-blue-300",
    },
    {
      icon: Lock,
      label: t('auth_page.tb2_label'),
      sub: t('auth_page.tb2_sub'),
      color: "from-violet-500 to-violet-600",
      bg: "bg-violet-50 dark:bg-violet-900/20",
      border: "border-violet-200 dark:border-violet-500/30",
      text: "text-violet-700 dark:text-violet-300",
    },
    {
      icon: BadgeCheck,
      label: t('auth_page.tb3_label'),
      sub: t('auth_page.tb3_sub'),
      color: "from-emerald-500 to-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      border: "border-emerald-200 dark:border-emerald-500/30",
      text: "text-emerald-700 dark:text-emerald-300",
    },
    {
      icon: Server,
      label: t('auth_page.tb4_label'),
      sub: t('auth_page.tb4_sub'),
      color: "from-amber-500 to-amber-600",
      bg: "bg-amber-50 dark:bg-amber-900/20",
      border: "border-amber-200 dark:border-amber-500/30",
      text: "text-amber-700 dark:text-amber-300",
    },
    {
      icon: Fingerprint,
      label: t('auth_page.tb5_label'),
      sub: t('auth_page.tb5_sub'),
      color: "from-rose-500 to-rose-600",
      bg: "bg-rose-50 dark:bg-rose-900/20",
      border: "border-rose-200 dark:border-rose-500/30",
      text: "text-rose-700 dark:text-rose-300",
    },
    {
      icon: Trophy,
      label: t('auth_page.tb6_label'),
      sub: t('auth_page.tb6_sub'),
      color: "from-primary to-emerald-500",
      bg: "bg-primary/5 dark:bg-primary/10",
      border: "border-primary/20 dark:border-primary/30",
      text: "text-primary dark:text-emerald-300",
    },
  ];

  const workflowSteps = [
    {
      title: t('auth_page.ws1_title'),
      desc: t('auth_page.ws1_desc'),
    },
    {
      title: t('auth_page.ws2_title'),
      desc: t('auth_page.ws2_desc'),
    },
    {
      title: t('auth_page.ws3_title'),
      desc: t('auth_page.ws3_desc'),
    },
  ];

  const comparisonRows = [
    { label: t('auth_page.cmp1_label'), old: t('auth_page.cmp1_old'), ours: t('auth_page.cmp1_ours') },
    { label: t('auth_page.cmp2_label'), old: t('auth_page.cmp2_old'), ours: t('auth_page.cmp2_ours') },
    { label: t('auth_page.cmp3_label'), old: t('auth_page.cmp3_old'), ours: t('auth_page.cmp3_ours') },
    { label: t('auth_page.cmp4_label'), old: t('auth_page.cmp4_old'), ours: t('auth_page.cmp4_ours') },
    { label: t('auth_page.cmp5_label'), old: t('auth_page.cmp5_old'), ours: t('auth_page.cmp5_ours') },
    { label: t('auth_page.cmp6_label'), old: t('auth_page.cmp6_old'), ours: t('auth_page.cmp6_ours') },
  ];

  const faqItems = [
    {
      question: t('auth_page.faq1_q'),
      answer: t('auth_page.faq1_a'),
    },
    {
      question: t('auth_page.faq2_q'),
      answer: t('auth_page.faq2_a'),
    },
    {
      question: t('auth_page.faq3_q'),
      answer: t('auth_page.faq3_a'),
    },
    {
      question: t('auth_page.faq4_q'),
      answer: t('auth_page.faq4_a'),
    },
    {
      question: t('auth_page.faq5_q'),
      answer: t('auth_page.faq5_a'),
    },
    {
      question: t('auth_page.faq6_q'),
      answer: t('auth_page.faq6_a'),
    },
  ];

  const [view, setView] = useState<AuthView>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [displayNameTouched, setDisplayNameTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const { user, signIn, signUp, signOut, setSessionFromTokens } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const redirectTo = resolveInternalPath(searchParams.get("redirect"), "/app");
  const oauthProvider = searchParams.get(GOOGLE_OAUTH_QUERY_PARAM);
  const emailActivationToken = searchParams.get(EMAIL_ACTIVATION_QUERY_PARAM);
  const isVerifyMode = searchParams.get("verify") === "1";
  const normalizedDisplayName = canonicalizeWorkspaceProfileDisplayName(displayName);
  const displayNameInvalid = view === "register"
    && displayNameTouched
    && normalizedDisplayName === undefined;

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (!isVerifyMode) return;
    setView("verify");
    const emailFromQuery = searchParams.get("email");
    if (emailFromQuery) setEmail(emailFromQuery);
  }, [isVerifyMode, searchParams]);

  useEffect(() => {
    if (oauthProvider !== GOOGLE_OAUTH_PROVIDER) return;
    if (user) return;

    const implicitSession = readWebImplicitSessionTokens(window.location.hash);
    if (!implicitSession) return;

    const restoreSessionFromHash = async () => {
      try {
        setLoading(true);
        await setSessionFromTokens(implicitSession.accessToken, implicitSession.refreshToken);
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      } catch {
        toast.error(t('auth_page.toast_google_session_failed'));
      } finally {
        setLoading(false);
      }
    };

    restoreSessionFromHash();
  }, [oauthProvider, user, setSessionFromTokens, t]);

  useEffect(() => {
    if (!user) return;
    if (oauthProvider !== GOOGLE_OAUTH_PROVIDER && !emailActivationToken) return;

    const handleOAuthCallback = async () => {
      try {
        setLoading(true);

        if (emailActivationToken) {
          const { error: activationError } = await supabase.functions.invoke("join-event", {
            body: {
              action: "complete-email-activation",
              activation_token: emailActivationToken,
            },
          });

          if (activationError) {
            toast.error(t('auth_page.toast_activation_invalid'));
            await signOut();
            navigate("/auth", { replace: true });
            return;
          }

          toast.success(t('auth_page.toast_email_activated'));
        }

        navigate(redirectTo, { replace: true });
      } finally {
        setLoading(false);
      }
    };

    handleOAuthCallback();
  }, [user, oauthProvider, emailActivationToken, redirectTo, navigate, signOut, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (view === "register" && normalizedDisplayName === undefined) {
      setDisplayNameTouched(true);
      return;
    }
    setLoading(true);

    if (view === "login") {
      const { error } = await signIn(email, password);
      if (error) {
        if (error.message.includes("Email not confirmed")) {
          toast.error(t('auth_page.toast_email_unconfirmed'));
        } else {
          toast.error(error.message);
        }
      } else {
        navigate(redirectTo);
      }
    } else if (view === "register") {
      const { error } = await signUp(email, password, normalizedDisplayName, redirectTo);
      if (error) {
        toast.error(error.message);
      } else {
        setView("verify");
        setResendCooldown(60);
        toast.success(t('auth_page.toast_confirm_sent'));
      }
    }

    setLoading(false);
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length < OTP_LENGTH) {
      toast.error(t('auth_page.toast_otp_too_short', { n: String(OTP_LENGTH) }));
      return;
    }

    setVerifying(true);

    const verifyTypes = ["signup", "email", "magiclink", "invite"] as const;
    let verified = false;

    for (const type of verifyTypes) {
      const { error } = await supabase.auth.verifyOtp({ email, token: otpCode, type });
      if (!error) {
        verified = true;
        break;
      }
    }

    if (!verified) {
      toast.error(t('auth_page.toast_invalid_code'));
      setVerifying(false);
      return;
    }

    toast.success(t('auth_page.toast_verified_welcome'));
    navigate(redirectTo);
    setVerifying(false);
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);

    if (isVerifyMode) {
      const { data, error } = await supabase.functions.invoke("join-event", {
        body: { action: "resend-email-activation", email, redirect_to: redirectTo },
      });

      if (error || data?.error) {
        toast.error(t('auth_page.toast_resend_error'));
      } else {
        toast.success(t('auth_page.toast_resend_activation_sent'));
        setResendCooldown(60);
      }

      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: buildAuthCallbackUrl('signup', redirectTo) },
    });

    if (error) {
      toast.error(t('auth_page.toast_resend_error'));
    } else {
      toast.success(t('auth_page.toast_resend_signup_sent'));
      setResendCooldown(60);
    }

    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error(t('auth_page.toast_forgot_missing_email'));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: buildAuthCallbackUrl('recovery', '/reset-password'),
    });

    if (error) {
      toast.error(t('auth_page.toast_forgot_error'));
    } else {
      toast.success(t('auth_page.toast_forgot_sent'));
    }

    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const nativeRuntime = isNativeRuntime();
    const callbackUri = buildAuthCallbackUrl('oauth-google', redirectTo, nativeRuntime);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUri,
        skipBrowserRedirect: nativeRuntime,
        queryParams: { prompt: "select_account" },
      },
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    if (nativeRuntime) {
      if (
        !data.url ||
        !isAllowedSupabaseOAuthUrl(data.url, SUPABASE_URL)
      ) {
        toast.error(t('auth_page.toast_google_session_failed'));
        setLoading(false);
        return;
      }

      try {
        const browser = getNativeBrowserPlugin();
        if (!browser) throw new Error('Native Browser plugin is unavailable.');
        await browser.open({ url: data.url });
      } catch {
        toast.error(t('auth_page.toast_google_session_failed'));
      } finally {
        setLoading(false);
      }
    }
  };

  const renderAuthPanel = () => (
    <AnimatePresence mode="wait">
      <motion.div
        key={view}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.22 }}
        className="w-full"
      >
        {view === "verify" && (
          <div className="space-y-5">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 shadow-glow">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <h2 className="font-display text-2xl font-bold">{t('auth_page.verify_title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('auth_page.verify_subtitle_prefix')}{' '}
                <span className="font-medium text-foreground">{email}</span>{t('auth_page.verify_subtitle_suffix')}
              </p>
            </div>

            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{t('auth_page.verify_methods_title')}</p>
                  <ol className="list-inside list-decimal space-y-1 text-muted-foreground">
                    <li><strong>{t('auth_page.verify_method_1')}</strong></li>
                    <li><strong>{t('auth_page.verify_method_2')}</strong></li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="block text-center">{t('auth_page.verify_code_label')}</Label>
              <div className="flex justify-center">
                <InputOTP maxLength={OTP_LENGTH} value={otpCode} onChange={setOtpCode}>
                  <InputOTPGroup>
                    {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                      <InputOTPSlot key={i} index={i} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button
                onClick={handleVerifyOtp}
                className="h-12 w-full rounded-2xl gradient-primary font-semibold text-primary-foreground shadow-glow"
                disabled={verifying || otpCode.length < OTP_LENGTH}
              >
                {verifying ? t('auth_page.verify_btn_confirming') : t('auth_page.verify_btn_confirm')}
              </Button>
            </div>

            <div className="space-y-2 text-center">
              <p className="text-sm text-muted-foreground">{t('auth_page.verify_no_email')}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResend}
                disabled={resendCooldown > 0 || loading}
                className="rounded-xl"
              >
                {resendCooldown > 0 ? t('auth_page.verify_resend_cooldown', { sec: String(resendCooldown) }) : t('auth_page.verify_resend')}
              </Button>
            </div>

            <button
              onClick={() => { setView("login"); setOtpCode(""); }}
              className="flex w-full items-center justify-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t('auth_page.verify_back')}
            </button>
          </div>
        )}

        {view === "forgot" && (
          <div className="space-y-5">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 shadow-glow">
                <KeyRound className="h-6 w-6 text-primary" />
              </div>
              <h2 className="font-display text-2xl font-bold">{t('auth_page.forgot_title')}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('auth_page.forgot_subtitle')}
              </p>
            </div>

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">{t('auth_page.forgot_email_label')}</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="pelda@ceg.hu"
                  required
                  className="h-12 rounded-2xl"
                />
              </div>
              <Button
                type="submit"
                className="h-12 w-full rounded-2xl gradient-primary font-semibold text-primary-foreground shadow-glow"
                disabled={loading}
              >
                {loading ? t('auth_page.forgot_btn_sending') : t('auth_page.forgot_btn_send')}
              </Button>
            </form>

            <button
              onClick={() => setView("login")}
              className="flex w-full items-center justify-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t('auth_page.forgot_back')}
            </button>
          </div>
        )}

        {(view === "login" || view === "register") && (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="font-display text-[clamp(2rem,2.2vw,2.55rem)] font-bold">
                {view === "login" ? t('auth_page.login_title') : t('auth_page.register_title')}
              </h2>
              <p className="mt-1 text-[0.96rem] text-muted-foreground">
                {view === "login"
                  ? t('auth_page.login_subtitle')
                  : t('auth_page.register_subtitle')}
              </p>
            </div>

            <Button
              variant="outline"
              className="h-13 w-full rounded-2xl text-[0.98rem] font-medium transition-all hover:-translate-y-0.5 hover:shadow-md"
              disabled={loading}
              onClick={handleGoogleSignIn}
            >
              <GoogleIcon />
              {t('auth_page.btn_google')}
            </Button>

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs font-medium text-muted-foreground">{t('auth_page.separator_or')}</span>
              <Separator className="flex-1" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {view === "register" && (
                <div className="space-y-2">
                  <Label htmlFor="displayName">{t('auth_page.label_display_name')}</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    onBlur={() => setDisplayNameTouched(true)}
                    placeholder={t('auth_page.placeholder_display_name')}
                    required
                    aria-invalid={displayNameInvalid}
                    aria-describedby={displayNameInvalid ? 'registration-display-name-error' : undefined}
                    className="h-12 rounded-2xl focus-visible:ring-primary"
                  />
                  {displayNameInvalid && (
                    <p id="registration-display-name-error" role="alert" className="text-xs text-destructive">
                      {t('profile.display_name_validation_error')}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">{t('auth_page.label_email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth_page.placeholder_email')}
                  required
                  className="h-12 rounded-2xl focus-visible:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t('auth_page.label_password')}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="h-12 rounded-2xl focus-visible:ring-primary"
                />
                {view === "login" && (
                  <button
                    type="button"
                    onClick={() => setView("forgot")}
                    className="text-xs text-muted-foreground transition-colors hover:text-primary"
                  >
                    {t('auth_page.forgot_password_link')}
                  </button>
                )}
              </div>

              <Button
                type="submit"
                className="h-13 w-full rounded-2xl gradient-primary font-semibold text-primary-foreground shadow-glow transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_rgba(16,185,129,0.5)]"
                disabled={loading || displayNameInvalid}
              >
                {loading
                  ? t('auth_page.btn_loading')
                  : view === "login"
                    ? t('auth_page.btn_login')
                    : t('auth_page.btn_register')}
              </Button>
            </form>

            <div className="text-center text-sm text-muted-foreground">
              {view === "login" ? t('auth_page.no_account') : t('auth_page.has_account')}{" "}
              <button
                onClick={() => setView(view === "login" ? "register" : "login")}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {view === "login" ? t('auth_page.nav_register') : t('auth_page.nav_signin')}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-950 dark:bg-[#050816] dark:text-white">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl dark:border-white/10 dark:bg-[#050816]/85">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <button type="button" onClick={() => navigate('/')} className="flex items-center">
            <EffectimeLogo size={34} variant="full" />
          </button>
          <div className="flex items-center gap-2">
            <LanguageSelector size="sm" align="end" />
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="rounded-xl">
              {t('auth_page.nav_home')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setView(view === 'login' ? 'register' : 'login')} className="rounded-xl">
              {view === "login" ? t('auth_page.nav_register') : t('auth_page.nav_signin')}
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero: split layout ── */}
        <section className="relative overflow-hidden border-b border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(34,211,188,0.25),transparent_34%),linear-gradient(135deg,#f8fafc_0%,#eefdf9_46%,#ffffff_100%)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,rgba(34,211,188,0.18),transparent_32%),linear-gradient(135deg,#050816_0%,#0f172a_54%,#07111f_100%)]">
          <div className="mx-auto grid max-w-7xl items-start gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(390px,0.92fr)] lg:py-14">

            {/* Left: branding + features */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="flex flex-col gap-7"
            >
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-white/80 px-4 py-2 text-sm font-semibold text-primary shadow-sm dark:border-primary/25 dark:bg-white/8 dark:text-emerald-200">
                <Shield className="h-4 w-4" />
                {t('auth_page.badge_platform')}
              </div>

              <div className="max-w-3xl">
                <h1 className="font-display text-[clamp(2.35rem,5vw,5.25rem)] font-bold leading-[0.95] tracking-[-0.055em] text-slate-950 dark:text-white">
                  {t('auth_page.hero_title_prefix')}{" "}
                  <span className="bg-gradient-to-r from-primary via-emerald-400 to-blue-500 bg-clip-text text-transparent">
                    {t('auth_page.hero_title_accent')}
                  </span>
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">
                  {t('auth_page.hero_subtitle')}
                </p>
              </div>

              {/* Feature grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {features.map((feature) => (
                  <div
                    key={feature.title}
                    className="rounded-3xl border border-slate-200 bg-white/82 p-5 shadow-[0_18px_55px_-42px_rgba(15,23,42,0.55)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-[0_22px_60px_-38px_rgba(15,23,42,0.7)] dark:border-white/10 dark:bg-white/[0.055]"
                  >
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary dark:bg-primary/18 dark:text-emerald-200">
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-display text-base font-bold text-slate-950 dark:text-white">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{feature.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right: auth card */}
            <motion.div
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: 0.05 }}
              className="lg:sticky lg:top-24"
            >
              <div className="rounded-[2rem] border border-slate-200 bg-white/92 p-5 shadow-[0_30px_100px_-42px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-white/10 dark:bg-[#070b18]/92 dark:shadow-[0_30px_100px_-42px_rgba(0,0,0,0.9)] sm:p-8">
                {renderAuthPanel()}
              </div>
              <div className="mt-4 grid grid-cols-1 min-[420px]:grid-cols-3 gap-2 sm:gap-3 text-center text-xs text-slate-500 dark:text-slate-400">
                <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="font-bold text-slate-900 dark:text-white">{t('auth_page.chip_rls_title')}</div>
                  {t('auth_page.chip_rls_desc')}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="font-bold text-slate-900 dark:text-white">{t('auth_page.chip_audit_title')}</div>
                  {t('auth_page.chip_audit_desc')}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="font-bold text-slate-900 dark:text-white">{t('auth_page.chip_jira_title')}</div>
                  {t('auth_page.chip_jira_desc')}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── Trust badges ── */}
        <section className="border-b border-slate-200/70 bg-white py-10 dark:border-white/10 dark:bg-[#060a17]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-7 text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                {t('auth_page.badge_quality')}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {trustBadges.map((badge) => (
                <motion.div
                  key={badge.label}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3 }}
                  className={`flex flex-col items-center gap-2 rounded-2xl border p-4 text-center ${badge.bg} ${badge.border} transition hover:-translate-y-0.5`}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${badge.color} text-white shadow-md`}>
                    <badge.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className={`text-xs font-bold ${badge.text}`}>{badge.label}</div>
                    <div className="mt-0.5 text-[0.7rem] text-slate-500 dark:text-slate-400">{badge.sub}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Three-step workflow ── */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
              <Workflow className="h-4 w-4" />
              {t('auth_page.badge_how')}
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {t('auth_page.how_title')}
            </h2>
            <p className="mt-4 text-slate-600 dark:text-slate-300">
              {t('auth_page.how_desc')}
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {workflowSteps.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: index * 0.08 }}
                className="relative rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.045]"
              >
                {index < workflowSteps.length - 1 && (
                  <div className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 lg:block">
                    <ArrowRight className="h-5 w-5 text-slate-300 dark:text-slate-600" />
                  </div>
                )}
                <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-emerald-400 text-lg font-bold text-white shadow-lg shadow-primary/20">
                  {index + 1}
                </div>
                <h3 className="font-display text-xl font-bold">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── Calendar mockup ── */}
        <section className="border-y border-slate-200 bg-white py-16 dark:border-white/10 dark:bg-[#080d1c]">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
                <BarChart3 className="h-4 w-4" />
                {t('auth_page.badge_example')}
              </div>
              <h2 className="mt-5 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                {t('auth_page.cal_title')}
              </h2>
              <p className="mt-4 leading-relaxed text-slate-600 dark:text-slate-300">
                {t('auth_page.cal_desc')}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {[
                  { icon: CalendarDays, label: t('auth_page.chip_cal') },
                  { icon: Clock, label: t('auth_page.chip_annual') },
                  { icon: Zap, label: t('auth_page.chip_realtime') },
                ].map(({ icon: Icon, label }) => (
                  <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-50 p-4 shadow-[0_24px_80px_-42px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[#0f172a]">
              <div className="rounded-[1.5rem] bg-white p-5 dark:bg-[#111827]">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">{t('auth_page.cal_today_capacity')}</div>
                    <div className="font-display text-2xl font-bold">{t('auth_page.cal_team')}</div>
                  </div>
                  <div className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">{t('auth_page.cal_available_pct')}</div>
                </div>
                <div className="grid grid-cols-7 gap-2 text-center text-xs text-slate-500">
                  {['H','K','Sze','Cs','P','Szo','V'].map((d) => <div key={d}>{d}</div>)}
                  {Array.from({ length: 28 }).map((_, i) => (
                    <div key={i} className={`rounded-xl px-2 py-3 font-semibold ${i % 9 === 0 ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200' : i % 5 === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-100' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100'}`}>
                      {i + 1}
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />{t('auth_page.cal_legend_available')}</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />{t('auth_page.cal_legend_leave')}</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-400" />{t('auth_page.cal_legend_sick')}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Comparison matrix ── */}
        <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <div className="mb-10 text-center">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
              <Star className="h-4 w-4" />
              {t('auth_page.badge_comparison')}
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {t('auth_page.comparison_title')}
            </h2>
            <p className="mt-4 text-slate-600 dark:text-slate-300">
              {t('auth_page.comparison_desc')}
            </p>
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
            {/* Header row */}
            <div className="grid grid-cols-3 gap-0 border-b border-slate-200 dark:border-white/10">
              <div className="p-5 text-sm font-semibold text-slate-500 dark:text-slate-400">{t('auth_page.col_aspect')}</div>
              <div className="border-x border-slate-200 bg-slate-50 p-5 text-center text-sm font-semibold text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
                {t('auth_page.col_old')}
              </div>
              <div className="bg-gradient-to-br from-primary/8 to-emerald-400/8 p-5 text-center text-sm font-bold text-primary dark:from-primary/15 dark:to-emerald-400/15">
                {t('auth_page.col_new')}
              </div>
            </div>

            {comparisonRows.map((row, i) => (
              <div
                key={row.label}
                className={`grid grid-cols-3 gap-0 border-b border-slate-100 last:border-b-0 dark:border-white/[0.06] ${i % 2 === 0 ? '' : 'bg-slate-50/60 dark:bg-white/[0.02]'}`}
              >
                <div className="flex items-center p-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                  {row.label}
                </div>
                <div className="flex items-center gap-2 border-x border-slate-100 p-4 text-sm text-slate-500 dark:border-white/[0.06] dark:text-slate-400">
                  <X className="h-4 w-4 shrink-0 text-rose-400" />
                  {row.old}
                </div>
                <div className="flex items-center gap-2 p-4 text-sm font-medium text-slate-800 dark:text-slate-200">
                  <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                  {row.ours}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
              <HelpCircle className="h-4 w-4" />
              {t('auth_page.badge_faq')}
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {t('auth_page.faq_title')}
            </h2>
          </div>
          <div className="divide-y divide-slate-200 rounded-[2rem] border border-slate-200 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-white/[0.045]">
            {faqItems.map((item) => (
              <details key={item.question} className="group p-6 open:bg-slate-50/70 first:rounded-t-[2rem] last:rounded-b-[2rem] dark:open:bg-white/[0.04]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-bold">
                  {item.question}
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 text-primary transition group-open:rotate-45 dark:border-white/10">
                    +
                  </span>
                </summary>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="px-4 pb-16 sm:px-6">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-gradient-to-r from-primary to-emerald-400 p-8 text-white shadow-xl shadow-primary/20 sm:p-10">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <h2 className="font-display text-3xl font-bold">{t('auth_page.cta_title')}</h2>
                <p className="mt-3 max-w-2xl text-white/85">
                  {t('auth_page.cta_desc')}
                </p>
              </div>
              <Button size="lg" variant="secondary" onClick={() => setView('register')} className="rounded-2xl px-8 font-semibold transition-all hover:-translate-y-0.5 hover:shadow-lg">
                {t('auth_page.btn_cta_register')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        {/* ── Footer links ── */}
        <footer className="border-t border-slate-200/70 bg-white py-8 text-center text-sm text-slate-400 dark:border-white/10 dark:bg-[#060a17]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4">
            <button onClick={() => navigate('/')} className="hover:text-slate-700 dark:hover:text-slate-200">{t('auth_page.footer_home')}</button>
            <span className="text-slate-200 dark:text-slate-700">·</span>
            <span className="cursor-default">{t('auth_page.footer_privacy')}</span>
            <span className="text-slate-200 dark:text-slate-700">·</span>
            <span className="cursor-default">{t('auth_page.footer_terms')}</span>
            <span className="text-slate-200 dark:text-slate-700">·</span>
            <span className="cursor-default">{t('auth_page.footer_support')}</span>
          </div>
          <p className="mt-4 text-xs text-slate-300 dark:text-slate-600">{t('auth_page.footer_copyright', { year: String(new Date().getFullYear()) })}</p>
        </footer>
      </main>
    </div>
  );
};

export default Auth;
