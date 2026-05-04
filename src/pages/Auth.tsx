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
import { Mail, ArrowLeft, CheckCircle2, KeyRound, Users, BarChart3, CalendarDays, ClipboardCheck, LayoutDashboard, Sparkles, Shield, Workflow, ArrowRight, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { EffectimeLogo } from "@/components/EffectimeLogo";

type AuthView = "login" | "register" | "verify" | "forgot";

const OTP_LENGTH = 8;
const GOOGLE_OAUTH_QUERY_PARAM = "oauth";
const GOOGLE_OAUTH_PROVIDER = "google";
const EMAIL_ACTIVATION_QUERY_PARAM = "email_activation_token";

const buildAuthRedirectUrl = (redirectPath: string) => {
  const url = new URL("/auth", window.location.origin);
  if (redirectPath.startsWith("/")) {
    url.searchParams.set("redirect", redirectPath);
  }
  return url.toString();
};

const features = [
  {
    icon: CalendarDays,
    title: "Egységes csapatnaptár",
    desc: "Lásd egy nézetben a kollégák elérhetőségét, szabadságokat és projektütemezéseket — automatikus szinkronizációval.",
  },
  {
    icon: ClipboardCheck,
    title: "Szabadság- és kérelemkezelés",
    desc: "Egyszerű igénylés, gyors jóváhagyás. Kvóták, féléves egyenlegek és félnapos szabadságok támogatásával.",
  },
  {
    icon: LayoutDashboard,
    title: "Erőforrás-tervezés",
    desc: "Vizualizáld csapatod kapacitását, kerüld el a túlterheltséget és tartsd egyensúlyban a projekteket.",
  },
  {
    icon: Sparkles,
    title: "Intelligens beosztás varázsló",
    desc: "Automatikus javaslatokat készít szabadságok, ünnepnapok, telephely-prioritás és pozícióegyezés alapján.",
  },
  {
    icon: Users,
    title: "Munkaterületek",
    desc: "Külön munkaterületek cégegységenként, dedikált tagsággal, szabályokkal és audit traillel.",
  },
  {
    icon: CheckCircle2,
    title: "Jóváhagyási munkafolyamatok",
    desc: "Átlátható, követhető folyamatok minden kérelemhez. Értesítések, naplózás és exportálás.",
  },
];

const workflowSteps = [
  {
    title: "Munkaterület létrehozása",
    desc: "Állítsd be a cégegységeket, telephelyeket, pozíciókat és az alap jogosultságokat.",
  },
  {
    title: "Csapat és szabályok felvétele",
    desc: "Hívd meg a kollégákat, rendelj hozzá kvótákat, jóváhagyási láncokat és naptárbeállításokat.",
  },
  {
    title: "Kapacitás optimalizálása",
    desc: "Használd az intelligens beosztás varázslót, riportokat és projekttervezést a napi döntésekhez.",
  },
];

const faqItems = [
  {
    question: "Miben segít az Effectime a mindennapi működésben?",
    answer: "Egy helyre hozza a szabadságkérelmeket, jóváhagyásokat, csapatnaptárat, kapacitástervezést és riportokat, így kevesebb kézi egyeztetésre van szükség.",
  },
  {
    question: "Támogatja a vállalati struktúrát és jogosultságokat?",
    answer: "Igen. Munkaterületekkel, szerepkörökkel, telephelyekkel, pozíciókkal, csapatokkal és auditált jóváhagyási folyamatokkal működik.",
  },
  {
    question: "Miért fontos az intelligens beosztás varázsló?",
    answer: "A varázsló figyelembe veszi a hiányzó helyeket, ünnepnapokat, blokkolt napokat, telephely-prioritást és pozícióegyezést, majd javaslatot készít a beosztásra.",
  },
];

const GoogleIcon = () => (
  <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

const Auth = () => {
  const [view, setView] = useState<AuthView>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const { user, signIn, signUp, signOut, setSessionFromTokens } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const redirectTo = searchParams.get("redirect") || "/app";
  const oauthProvider = searchParams.get(GOOGLE_OAUTH_QUERY_PARAM);
  const emailActivationToken = searchParams.get(EMAIL_ACTIVATION_QUERY_PARAM);
  const isVerifyMode = searchParams.get("verify") === "1";

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

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");

    if (!accessToken || !refreshToken) return;

    const restoreSessionFromHash = async () => {
      try {
        setLoading(true);
        await setSessionFromTokens(accessToken, refreshToken);
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      } catch {
        toast.error("Google bejelentkezési munkamenet helyreállítása sikertelen.");
      } finally {
        setLoading(false);
      }
    };

    restoreSessionFromHash();
  }, [oauthProvider, user, setSessionFromTokens]);

  // Handle return from Google OAuth or email activation link
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
            toast.error("Érvénytelen vagy lejárt aktivációs link. Kérj új aktivációs e-mailt.");
            await signOut();
            navigate("/auth", { replace: true });
            return;
          }

          toast.success("E-mail sikeresen megerősítve!");
        }

        navigate(redirectTo, { replace: true });
      } finally {
        setLoading(false);
      }
    };

    handleOAuthCallback();
  }, [user, oauthProvider, emailActivationToken, redirectTo, navigate, signOut]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (view === "login") {
      const { error } = await signIn(email, password);
      if (error) {
        if (error.message.includes("Email not confirmed")) {
          toast.error("Az e-mail címed még nincs megerősítve. Kérjük, ellenőrizd a postaládádat.");
        } else {
          toast.error(error.message);
        }
      } else {
        navigate(redirectTo);
      }
    } else if (view === "register") {
      const { error } = await signUp(email, password, displayName, redirectTo);
      if (error) {
        toast.error(error.message);
      } else {
        setView("verify");
        setResendCooldown(60);
        toast.success("Megerősítő e-mail elküldve!");
      }
    }

    setLoading(false);
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length < OTP_LENGTH) {
      toast.error(`Kérjük, add meg a ${OTP_LENGTH} jegyű kódot.`);
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
      toast.error("Érvénytelen vagy lejárt kód. Kérjük, próbáld újra.");
      setVerifying(false);
      return;
    }

    toast.success("E-mail sikeresen megerősítve! Üdvözlünk!");
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
        toast.error("Hiba az újraküldés során. Kérjük, próbáld újra később.");
      } else {
        toast.success("Aktivációs e-mail újraküldve!");
        setResendCooldown(60);
      }

      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: buildAuthRedirectUrl(redirectTo) },
    });

    if (error) {
      toast.error("Hiba az újraküldés során. Kérjük, próbáld újra később.");
    } else {
      toast.success("Megerősítő e-mail újraküldve!");
      setResendCooldown(60);
    }

    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Kérjük, add meg az e-mail címedet.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast.error("Hiba történt. Kérjük, próbáld újra később.");
    } else {
      toast.success("Jelszó-visszaállító e-mail elküldve! Ellenőrizd a postaládádat.");
    }

    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);

    const callbackUri = new URL("/auth", window.location.origin);
    callbackUri.searchParams.set(GOOGLE_OAUTH_QUERY_PARAM, GOOGLE_OAUTH_PROVIDER);
    callbackUri.searchParams.set("redirect", redirectTo);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUri.toString(),
        queryParams: { prompt: "select_account" },
      },
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
    }
    // On success the browser is redirected by Supabase — no setLoading(false) needed.
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
              <h2 className="font-display text-2xl font-bold">E-mail megerősítése</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Küldtünk egy megerősítő e-mailt a(z){" "}
                <span className="font-medium text-foreground">{email}</span> címre.
              </p>
            </div>

            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                <div className="space-y-1 text-sm">
                  <p className="font-medium">Kétféleképpen erősítheted meg:</p>
                  <ol className="list-inside list-decimal space-y-1 text-muted-foreground">
                    <li>Kattints az e-mailben kapott <strong>aktivációs linkre</strong></li>
                    <li>Vagy add meg az e-mailben kapott <strong>8 jegyű kódot</strong></li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="block text-center">Megerősítő kód</Label>
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
                {verifying ? "Ellenőrzés..." : "Kód megerősítése"}
              </Button>
            </div>

            <div className="space-y-2 text-center">
              <p className="text-sm text-muted-foreground">Nem kaptál e-mailt?</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResend}
                disabled={resendCooldown > 0 || loading}
                className="rounded-xl"
              >
                {resendCooldown > 0 ? `Újraküldés (${resendCooldown}s)` : "E-mail újraküldése"}
              </Button>
            </div>

            <button
              onClick={() => { setView("login"); setOtpCode(""); }}
              className="flex w-full items-center justify-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Vissza a bejelentkezéshez
            </button>
          </div>
        )}

        {view === "forgot" && (
          <div className="space-y-5">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 shadow-glow">
                <KeyRound className="h-6 w-6 text-primary" />
              </div>
              <h2 className="font-display text-2xl font-bold">Elfelejtett jelszó</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Add meg az e-mail címedet és küldünk egy visszaállító linket.
              </p>
            </div>

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">E-mail</Label>
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
                {loading ? "Küldés..." : "Visszaállító e-mail küldése"}
              </Button>
            </form>

            <button
              onClick={() => setView("login")}
              className="flex w-full items-center justify-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Vissza a bejelentkezéshez
            </button>
          </div>
        )}

        {(view === "login" || view === "register") && (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="font-display text-[clamp(2rem,2.2vw,2.55rem)] font-bold">
                {view === "login" ? "Üdv újra!" : "Csatlakozz hozzánk!"}
              </h2>
              <p className="mt-1 text-[0.96rem] text-muted-foreground">
                {view === "login"
                  ? "Jelentkezz be az Effectime fiókodba"
                  : "Hozd létre az Effectime fiókodat"}
              </p>
            </div>

            <Button
              variant="outline"
              className="h-13 w-full rounded-2xl text-[0.98rem] font-medium"
              disabled={loading}
              onClick={handleGoogleSignIn}
            >
              <GoogleIcon />
              Folytatás Google fiókkal
            </Button>

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs font-medium text-muted-foreground">vagy e-maillel</span>
              <Separator className="flex-1" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {view === "register" && (
                <div className="space-y-2">
                  <Label htmlFor="displayName">Megjelenített név</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Kovács Anna"
                    required
                    className="h-12 rounded-2xl"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="pelda@ceg.hu"
                  required
                  className="h-12 rounded-2xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Jelszó</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="h-12 rounded-2xl"
                />
                {view === "login" && (
                  <button
                    type="button"
                    onClick={() => setView("forgot")}
                    className="text-xs text-muted-foreground transition-colors hover:text-primary"
                  >
                    Elfelejtett jelszó?
                  </button>
                )}
              </div>

              <Button
                type="submit"
                className="h-13 w-full rounded-2xl gradient-primary font-semibold text-primary-foreground shadow-glow"
                disabled={loading}
              >
                {loading ? "Kérlek várj..." : view === "login" ? "Bejelentkezés" : "Regisztráció"}
              </Button>
            </form>

            <div className="text-center text-sm text-muted-foreground">
              {view === "login" ? "Nincs fiókod?" : "Már van fiókod?"}{" "}
              <button
                onClick={() => setView(view === "login" ? "register" : "login")}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {view === "login" ? "Regisztráció" : "Bejelentkezés"}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-[#050816] dark:text-white">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl dark:border-white/10 dark:bg-[#050816]/85">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <button type="button" onClick={() => navigate('/')} className="flex items-center">
            <EffectimeLogo size={34} variant="full" />
          </button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="rounded-xl">
              Főoldal
            </Button>
            <Button variant="outline" size="sm" onClick={() => setView(view === 'login' ? 'register' : 'login')} className="rounded-xl">
              {view === "login" ? "Regisztráció" : "Bejelentkezés"}
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-slate-200/70 bg-[radial-gradient(circle_at_top_left,rgba(34,211,188,0.25),transparent_34%),linear-gradient(135deg,#f8fafc_0%,#eefdf9_46%,#ffffff_100%)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,rgba(34,211,188,0.18),transparent_32%),linear-gradient(135deg,#050816_0%,#0f172a_54%,#07111f_100%)]">
          <div className="mx-auto grid max-w-7xl items-start gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(390px,0.92fr)] lg:py-14">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="flex flex-col gap-7"
            >
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-white/80 px-4 py-2 text-sm font-semibold text-primary shadow-sm dark:border-primary/25 dark:bg-white/8 dark:text-emerald-200">
                <Shield className="h-4 w-4" />
                Enterprise kapacitáskezelő platform
              </div>

              <div className="max-w-3xl">
                <h1 className="font-display text-[clamp(2.35rem,5vw,5.25rem)] font-bold leading-[0.95] tracking-[-0.055em] text-slate-950 dark:text-white">
                  Navigáld vállalkozásod erőforrásait <span className="bg-gradient-to-r from-primary via-emerald-400 to-blue-500 bg-clip-text text-transparent">stratégiával.</span>
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">
                  Intelligens idő-, szabadság- és erőforrás-kezelés egy platformon. Az Effectime segít átlátni a kapacitást, gyorsítani a jóváhagyásokat és stabilan ütemezni a projekteket.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {features.map((feature) => (
                  <div key={feature.title} className="rounded-3xl border border-slate-200 bg-white/82 p-5 shadow-[0_18px_55px_-42px_rgba(15,23,42,0.55)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-[0_22px_60px_-38px_rgba(15,23,42,0.7)] dark:border-white/10 dark:bg-white/[0.055]">
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary dark:bg-primary/18 dark:text-emerald-200">
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-display text-base font-bold text-slate-950 dark:text-white">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{feature.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: 0.05 }}
              className="lg:sticky lg:top-24"
            >
              <div className="rounded-[2rem] border border-slate-200 bg-white/92 p-5 shadow-[0_30px_100px_-42px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-white/10 dark:bg-[#070b18]/92 dark:shadow-[0_30px_100px_-42px_rgba(0,0,0,0.9)] sm:p-8">
                {renderAuthPanel()}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center text-xs text-slate-500 dark:text-slate-400">
                <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="font-bold text-slate-900 dark:text-white">RLS</div>
                  Biztonságos adatelérés
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="font-bold text-slate-900 dark:text-white">Audit</div>
                  Követhető folyamatok
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="font-bold text-slate-900 dark:text-white">Jira</div>
                  Agilis integráció
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
              <Workflow className="h-4 w-4" />
              Így működik
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Három lépés a tiszta kapacitásképig</h2>
            <p className="mt-4 text-slate-600 dark:text-slate-300">
              Gyors indulás, kevesebb adminisztráció, jobb döntések a csapat napi elérhetőségéről és projektterheléséről.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {workflowSteps.map((step, index) => (
              <div key={step.title} className="relative rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.045]">
                <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-emerald-400 text-lg font-bold text-white shadow-lg shadow-primary/20">
                  {index + 1}
                </div>
                <h3 className="font-display text-xl font-bold">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white py-16 dark:border-white/10 dark:bg-[#080d1c]">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
                <BarChart3 className="h-4 w-4" />
                Példa nézet
              </div>
              <h2 className="mt-5 font-display text-3xl font-bold tracking-tight sm:text-4xl">Áttekinthető naptár és kapacitás egy oldalon</h2>
              <p className="mt-4 leading-relaxed text-slate-600 dark:text-slate-300">
                Az éves nézet, csapatnaptár, kapacitástervező és skill riportok együtt segítenek megérteni, hol van valódi lefedettség és hol kell beavatkozni.
              </p>
            </div>
            <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-50 p-4 shadow-[0_24px_80px_-42px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[#0f172a]">
              <div className="rounded-[1.5rem] bg-white p-5 dark:bg-[#111827]">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">Mai kapacitás</div>
                    <div className="font-display text-2xl font-bold">Budapest · Resource team</div>
                  </div>
                  <div className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">82% elérhető</div>
                </div>
                <div className="grid grid-cols-7 gap-2 text-center text-xs text-slate-500">
                  {['H','K','Sze','Cs','P','Szo','V'].map((d) => <div key={d}>{d}</div>)}
                  {Array.from({ length: 28 }).map((_, i) => (
                    <div key={i} className={`rounded-xl px-2 py-3 font-semibold ${i % 9 === 0 ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200' : i % 5 === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-100' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100'}`}>
                      {i + 1}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
              <HelpCircle className="h-4 w-4" />
              Gyakori kérdések
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Amit indulás előtt érdemes tudni</h2>
          </div>
          <div className="divide-y divide-slate-200 rounded-[2rem] border border-slate-200 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-white/[0.045]">
            {faqItems.map((item) => (
              <details key={item.question} className="group p-6 open:bg-slate-50/70 first:rounded-t-[2rem] last:rounded-b-[2rem] dark:open:bg-white/[0.04]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-bold">
                  {item.question}
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 text-primary transition group-open:rotate-45 dark:border-white/10">+</span>
                </summary>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="px-4 pb-16 sm:px-6">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-gradient-to-r from-primary to-emerald-400 p-8 text-white shadow-xl shadow-primary/20 sm:p-10">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <h2 className="font-display text-3xl font-bold">Kezdd el percek alatt</h2>
                <p className="mt-3 max-w-2xl text-white/85">Hozz létre fiókot, állítsd be a munkaterületet és nézd meg, hogyan válik átláthatóbbá a csapatod kapacitása.</p>
              </div>
              <Button size="lg" variant="secondary" onClick={() => setView('register')} className="rounded-2xl px-8 font-semibold">
                Regisztráció
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Auth;
