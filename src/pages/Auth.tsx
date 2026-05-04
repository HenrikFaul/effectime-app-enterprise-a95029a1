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
import { Mail, ArrowLeft, CheckCircle2, KeyRound, Users, BarChart3, CalendarDays } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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

const latinQuotes = [
  {
    text: "Tempus una actum pretiosissimum es",
    cls: "left-[6%] top-[10%] rotate-[-6deg] text-[clamp(0.86rem,0.95vw,0.98rem)] [font-family:'Brush_Script_MT','Segoe_Print','Comic_Sans_MS',cursive]",
  },
  {
    text: "Nihil est pretiosius quam tempus tecum.",
    cls: "right-[8%] top-[40%] rotate-[4deg] text-[clamp(0.84rem,0.92vw,0.95rem)] [font-family:'Lucida_Handwriting','Segoe_Print','Comic_Sans_MS',cursive]",
  },
  {
    text: "In tempore una acto, amor crescit.",
    cls: "left-[18%] bottom-[10%] rotate-[-2deg] text-[clamp(0.84rem,0.9vw,0.94rem)] [font-family:'Segoe_Script','Comic_Sans_MS',cursive]",
  },
];

const features = [
  {
    icon: CalendarDays,
    title: "Szabadság & jelenlét kezelés",
    desc: "Kérelmek, jóváhagyási láncok és naptárintegráció egy helyen.",
  },
  {
    icon: Users,
    title: "Csapatkapacitás tervezés",
    desc: "Valós idejű lefedettség, kvóták és helyettesítési szabályok.",
  },
  {
    icon: BarChart3,
    title: "Riporting & agilis integráció",
    desc: "Egyéni riportok, ütemezett küldés és Jira-kapcsolat.",
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

    const callbackUri = new URL("/", window.location.origin);
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
    <div className="h-screen overflow-hidden bg-background">
      {/* Desktop layout */}
      <div className="hidden h-full grid-cols-[minmax(0,0.52fr)_minmax(0,0.48fr)] lg:grid">
        <section className="h-full overflow-hidden gradient-primary px-[18px] py-[18px] text-primary-foreground">
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-primary-foreground/14 backdrop-blur-sm">
                <span className="font-display text-2xl font-bold">E</span>
              </div>
              <div>
                <div className="font-display text-[1.8rem] font-bold leading-none">Effectime</div>
                <div className="text-[0.78rem] font-medium text-primary-foreground/70 tracking-wide uppercase">Enterprise</div>
              </div>
            </div>

            <div className="mt-5 max-w-[520px]">
              <h1 className="font-display text-[clamp(1.9rem,2.9vw,3.25rem)] font-bold leading-[0.97] tracking-[-0.04em]">
                Szervezze meg csapata szabadságát és idejét hatékonyan
              </h1>
              <p className="mt-4 max-w-[600px] text-[clamp(0.88rem,0.96vw,1rem)] leading-relaxed text-primary-foreground/82">
                Kezeld a szabadságkérelmeket, tervezd a csapatkapacitást és generálj riportokat — mindezt egy helyen, a csapatod méretéhez igazítva.
              </p>
            </div>

            <div className="mt-6 grid max-w-[840px] grid-cols-3 gap-4">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-[22px] border border-primary-foreground/24 bg-primary-foreground/8 p-5 backdrop-blur-sm"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/14">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <div className="text-[0.98rem] font-semibold leading-snug">{feature.title}</div>
                  <div className="mt-2 text-[0.84rem] leading-relaxed text-primary-foreground/72">{feature.desc}</div>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-2 text-xs text-primary-foreground/48">
              © 2026 Effectime. Minden jog fenntartva.
            </div>
          </div>
        </section>

        <section className="h-full overflow-hidden bg-slate-50 px-[24px] py-[18px] dark:bg-[#040814]">
          <div className="grid h-full grid-rows-[minmax(0,0.78fr)_minmax(0,0.22fr)] gap-3">
            <div className="min-h-0 overflow-hidden rounded-[34px] border border-slate-200 bg-white px-[40px] py-[24px] shadow-[0_24px_80px_-36px_rgba(15,23,42,0.18)] dark:border-white/8 dark:bg-[#050816] dark:shadow-[0_24px_80px_-36px_rgba(2,8,23,0.8)]">
              {renderAuthPanel()}
            </div>

            <div className="relative min-h-0 overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.08)] dark:border-white/7 dark:bg-[#050816] dark:shadow-none">
              {latinQuotes.map((quote) => (
                <div
                  key={quote.text}
                  className={`absolute max-w-[44%] whitespace-normal leading-[1.18] text-slate-600 dark:text-white/92 ${quote.cls}`}
                >
                  {quote.text}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Mobile layout */}
      <div className="flex h-full flex-col overflow-hidden lg:hidden">
        <div className="gradient-primary px-4 py-4 text-primary-foreground">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-foreground/16">
              <span className="font-display text-xl font-bold">E</span>
            </div>
            <div>
              <div className="font-display text-[2rem] font-bold leading-none">Effectime</div>
              <div className="text-[0.72rem] font-medium text-primary-foreground/70 tracking-wide uppercase">Enterprise</div>
            </div>
          </div>

          <h1 className="mt-4 font-display text-[1.65rem] font-bold leading-[0.98] tracking-[-0.03em]">
            Szervezze meg csapata szabadságát és idejét
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-primary-foreground/80">
            Szabadságkezelés, kapacitástervezés és riporting — mindezt egy helyen.
          </p>
        </div>

        <div className="flex-1 overflow-hidden bg-[#040814] p-3">
          <div className="grid h-full grid-rows-[minmax(0,0.82fr)_minmax(0,0.18fr)] gap-3">
            <div className="min-h-0 overflow-auto rounded-[28px] border border-slate-200 bg-white/96 p-4 shadow-[0_12px_35px_rgba(15,23,42,0.08)] dark:border-white/8 dark:bg-[#050816] dark:shadow-none">
              {renderAuthPanel()}
            </div>

            <div className="relative overflow-hidden rounded-[24px] border border-slate-200 bg-white/92 shadow-[0_10px_30px_rgba(15,23,42,0.06)] dark:border-white/8 dark:bg-[#050816] dark:shadow-none">
              <div className="absolute left-[7%] top-[10%] max-w-[70%] rotate-[-5deg] text-[0.8rem] text-slate-600 dark:text-white/90 [font-family:'Brush_Script_MT','Segoe_Print','Comic_Sans_MS',cursive]">
                Tempus una actum pretiosissimum es
              </div>
              <div className="absolute right-[6%] top-[38%] max-w-[66%] rotate-[4deg] text-[0.77rem] text-slate-600 dark:text-white/90 [font-family:'Lucida_Handwriting','Segoe_Print','Comic_Sans_MS',cursive]">
                Nihil est pretiosius quam tempus tecum.
              </div>
              <div className="absolute left-[13%] bottom-[12%] max-w-[70%] rotate-[-2deg] text-[0.77rem] text-slate-600 dark:text-white/90 [font-family:'Segoe_Script','Comic_Sans_MS',cursive]">
                In tempore una acto, amor crescit.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
