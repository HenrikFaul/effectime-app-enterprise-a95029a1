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
  Mail, ArrowLeft, CheckCircle2, KeyRound,
  Users, BarChart3, CalendarDays, Shield,
  Clock, Zap, ChevronDown, ChevronUp,
  Building2, Star, Check, X as XIcon,
  ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Auth logic constants (unchanged) ───────────────────────────────────────
type AuthView = "login" | "register" | "verify" | "forgot";
const OTP_LENGTH = 8;
const GOOGLE_OAUTH_QUERY_PARAM = "oauth";
const GOOGLE_OAUTH_PROVIDER = "google";
const EMAIL_ACTIVATION_QUERY_PARAM = "email_activation_token";

const buildAuthRedirectUrl = (redirectPath: string) => {
  const url = new URL("/auth", window.location.origin);
  if (redirectPath.startsWith("/")) url.searchParams.set("redirect", redirectPath);
  return url.toString();
};

// ─── Static UI data ──────────────────────────────────────────────────────────
const TRUST_BADGES = [
  { icon: Shield,     label: "GDPR-megfelelő",       sub: "Adatbiztonság EU-szinten" },
  { icon: Star,       label: "Top Rated 2026",        sub: "Felhasználói visszajelzés alapján" },
  { icon: Zap,        label: "2 perces beállítás",    sub: "Azonnali indulás, IT nélkül" },
  { icon: Users,      label: "Csapatközpontú",        sub: "Tervezett csapat-szintű lefedettség" },
  { icon: Clock,      label: "Valós idejű adatok",    sub: "Naprakész kapacitás & jelenlét" },
  { icon: Building2,  label: "Vállalati szintű",      sub: "Skálázható több munkaterületre" },
];

const STEPS = [
  {
    n: "1",
    title: "Fiók létrehozása",
    body: "Regisztrálj 60 másodperc alatt Google fiókkal vagy e-maillel — bankkártya nem szükséges.",
    icon: Mail,
  },
  {
    n: "2",
    title: "Csapat felépítése",
    body: "Hívd meg a kollégákat, definiálj pozíciókat és jelenlét-típusokat (szabadság, home office, betegség).",
    icon: Users,
  },
  {
    n: "3",
    title: "Valós idejű menedzsment",
    body: "Kövesd a csapatkapacitást, hagyj jóvá kérelmeket és generálj riportokat — mindezt egy nézetben.",
    icon: BarChart3,
  },
];

const COMPARISON = [
  {
    traditional: "Manuális Excel-táblázatok",
    ours: "Automatizált jóváhagyási munkafolyamatok",
  },
  {
    traditional: "Szétszórt e-mail kommunikáció",
    ours: "Valós idejű csapatkommunikáció & értesítések",
  },
  {
    traditional: "Nincs csapatkapacitás-áttekintés",
    ours: "Vizuális lefedettség- & kapacitástervező",
  },
  {
    traditional: "Riportok napokig tartanak",
    ours: "Ütemezett és egyéni riportok másodpercek alatt",
  },
  {
    traditional: "Nincsenek szerepkör-szintű jogosultságok",
    ours: "Granulált jogosultságok szerepkörtől függően",
  },
];

const FAQS = [
  {
    q: "Testreszabhatók a jóváhagyási munkafolyamatok?",
    a: "Igen. A Szabályok fülön multi-szintű jóváhagyási láncokat konfigurálhatsz csapatonként. Lineáris és párhuzamos jóváhagyási módot is támogatunk.",
  },
  {
    q: "Mobilon is elérhető a platform?",
    a: "Az Effectime teljesen reszponzív — laptopról, tabletről és okostelefonról is kezelheted a szabadságkérelmeket és a csapatnaptárt.",
  },
  {
    q: "Hogyan működnek a szerepkör-alapú jogosultságok?",
    a: "Tulajdonos, Erőforrás-asszisztens és egyéni szerepkörök hozhatók létre. Minden funkcióhoz (naptár, kérelmek, riportok, beállítások) önállóan állítható be az olvasási és szerkesztési jog.",
  },
  {
    q: "Integrálható a Jira-val vagy Azure DevOps-szal?",
    a: "Igen. Az Erőforrások → Integrációk menüponton API-kulcsot konfigurálhatsz, majd az Agile modulból backlogot böngészhetsz, issue-kat hozhatsz létre és frissíthetsz.",
  },
  {
    q: "Exportálhatók az adatok?",
    a: "Természetesen. A Riportok és Audit fülön CSV és más formátumokban exportálható minden szabadság-, kvóta- és kapacitásadat.",
  },
  {
    q: "Hogyan kezelitek az adatbiztonságot?",
    a: "Az összes vállalati adat row-level security (RLS) védelemmel tárolódik. A hozzáférés-ellenőrzés SECURITY DEFINER funkciókkal van kikényszerítve, így adatszivárgás nem lehetséges munkaterületek között.",
  },
];

// ─── Google icon ─────────────────────────────────────────────────────────────
const GoogleIcon = () => (
  <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

// ─── FAQ item ─────────────────────────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/10 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-3 py-3.5 text-left text-sm font-medium text-primary-foreground transition-colors hover:text-white"
      >
        <span>{q}</span>
        {open
          ? <ChevronUp className="h-4 w-4 shrink-0 opacity-70" />
          : <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <p className="pb-3.5 text-sm leading-relaxed text-primary-foreground/72">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Team calendar mockup ────────────────────────────────────────────────────
const MOCK_MEMBERS = [
  { name: "Kovács Anna",   roles: [1,1,0,0,1,1,0] },
  { name: "Nagy Péter",    roles: [0,2,2,0,0,1,1] },
  { name: "Tóth Béla",    roles: [1,0,1,1,0,0,3] },
  { name: "Varga Eszter",  roles: [3,3,0,1,1,0,0] },
];
const DAY_LABELS = ["H","K","Sz","Cs","P","Sz","V"];
const STATUS_COLORS = [
  "bg-white/10",
  "bg-emerald-400/80",
  "bg-amber-400/80",
  "bg-sky-400/80",
];
const STATUS_LABELS = ["–", "Jelenlét", "Szabadság", "Home office"];

function CalendarMockup() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-white/80">Csapatnaptár — Május 2026</span>
        <div className="flex gap-2">
          {STATUS_LABELS.slice(1).map((l, i) => (
            <div key={l} className="flex items-center gap-1">
              <div className={`h-2.5 w-2.5 rounded-sm ${STATUS_COLORS[i + 1]}`} />
              <span className="text-[9px] text-white/60">{l}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[minmax(80px,auto)_repeat(7,1fr)] gap-px text-xs">
        <div />
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center font-semibold text-white/50">{d}</div>
        ))}
        {MOCK_MEMBERS.map(m => (
          <>
            <div key={m.name + "name"} className="truncate pr-2 text-[10px] text-white/70 leading-7">{m.name}</div>
            {m.roles.map((r, i) => (
              <div
                key={i}
                className={`mx-px my-0.5 h-6 rounded-sm ${STATUS_COLORS[r]} transition-opacity`}
              />
            ))}
          </>
        ))}
      </div>
    </div>
  );
}

// ─── Main Auth component ──────────────────────────────────────────────────────
const Auth = () => {
  // ── All state is identical to the original — zero logic changes ──────────
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

  useEffect(() => {
    if (!user) return;
    if (oauthProvider !== GOOGLE_OAUTH_PROVIDER && !emailActivationToken) return;
    const handleOAuthCallback = async () => {
      try {
        setLoading(true);
        if (emailActivationToken) {
          const { error: activationError } = await supabase.functions.invoke("join-event", {
            body: { action: "complete-email-activation", activation_token: emailActivationToken },
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
      if (!error) { verified = true; break; }
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
    if (!email) { toast.error("Kérjük, add meg az e-mail címedet."); return; }
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
      options: { redirectTo: callbackUri.toString(), queryParams: { prompt: "select_account" } },
    });
    if (error) { toast.error(error.message); setLoading(false); }
  };

  // ── Auth card content (all logic preserved) ──────────────────────────────
  const renderAuthCard = () => (
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
              <Button onClick={handleVerifyOtp} className="h-12 w-full rounded-2xl gradient-primary font-semibold text-primary-foreground shadow-glow" disabled={verifying || otpCode.length < OTP_LENGTH}>
                {verifying ? "Ellenőrzés..." : "Kód megerősítése"}
              </Button>
            </div>
            <div className="space-y-2 text-center">
              <p className="text-sm text-muted-foreground">Nem kaptál e-mailt?</p>
              <Button variant="outline" size="sm" onClick={handleResend} disabled={resendCooldown > 0 || loading} className="rounded-xl">
                {resendCooldown > 0 ? `Újraküldés (${resendCooldown}s)` : "E-mail újraküldése"}
              </Button>
            </div>
            <button onClick={() => { setView("login"); setOtpCode(""); }} className="flex w-full items-center justify-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Vissza a bejelentkezéshez
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
              <p className="mt-1 text-sm text-muted-foreground">Add meg az e-mail címedet és küldünk egy visszaállító linket.</p>
            </div>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">E-mail</Label>
                <Input id="forgot-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="pelda@ceg.hu" required className="h-12 rounded-2xl" />
              </div>
              <Button type="submit" className="h-12 w-full rounded-2xl gradient-primary font-semibold text-primary-foreground shadow-glow" disabled={loading}>
                {loading ? "Küldés..." : "Visszaállító e-mail küldése"}
              </Button>
            </form>
            <button onClick={() => setView("login")} className="flex w-full items-center justify-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Vissza a bejelentkezéshez
            </button>
          </div>
        )}

        {(view === "login" || view === "register") && (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="font-display text-[clamp(1.75rem,2.2vw,2.4rem)] font-bold">
                {view === "login" ? "Üdv újra!" : "Csatlakozz hozzánk!"}
              </h2>
              <p className="mt-1 text-[0.95rem] text-muted-foreground">
                {view === "login" ? "Jelentkezz be az Effectime fiókodba" : "Hozd létre az Effectime fiókodat — ingyenes"}
              </p>
            </div>

            <Button variant="outline" className="h-12 w-full rounded-2xl text-[0.98rem] font-medium hover:-translate-y-px hover:shadow-md transition-all" disabled={loading} onClick={handleGoogleSignIn}>
              <GoogleIcon /> Folytatás Google fiókkal
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
                  <Input id="displayName" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Kovács Anna" required className="h-12 rounded-2xl focus-visible:ring-primary" />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="pelda@ceg.hu" required className="h-12 rounded-2xl focus-visible:ring-primary" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Jelszó</Label>
                  {view === "login" && (
                    <button type="button" onClick={() => setView("forgot")} className="text-xs text-muted-foreground transition-colors hover:text-primary">
                      Elfelejtett jelszó?
                    </button>
                  )}
                </div>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="h-12 rounded-2xl focus-visible:ring-primary" />
              </div>
              <Button type="submit" className="h-12 w-full rounded-2xl gradient-primary font-semibold text-primary-foreground shadow-glow hover:-translate-y-px hover:shadow-xl transition-all" disabled={loading}>
                {loading ? "Kérlek várj..." : view === "login" ? "Bejelentkezés" : "Regisztráció"}
              </Button>
            </form>

            <div className="text-center text-sm text-muted-foreground">
              {view === "login" ? "Nincs fiókod?" : "Már van fiókod?"}{" "}
              <button onClick={() => setView(view === "login" ? "register" : "login")} className="font-medium text-primary underline-offset-4 hover:underline">
                {view === "login" ? "Regisztráció" : "Bejelentkezés"}
              </button>
            </div>

            <p className="text-center text-[10px] text-muted-foreground/60 leading-relaxed">
              A folytatással elfogadod az{" "}
              <a href="#" className="underline hover:text-muted-foreground">Általános Szerződési Feltételeket</a>
              {" "}és az{" "}
              <a href="#" className="underline hover:text-muted-foreground">Adatkezelési Tájékoztatót</a>.
            </p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );

  // ─── Page layout ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">

      {/* ── DESKTOP: split screen ────────────────────────────────────────────── */}
      <div className="hidden h-screen lg:grid lg:grid-cols-[minmax(0,0.46fr)_minmax(0,0.54fr)]">

        {/* LEFT — Trust & brand panel (sticky) */}
        <aside className="gradient-primary flex h-full flex-col overflow-y-auto px-10 py-8 text-primary-foreground">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-primary-foreground/14 backdrop-blur-sm">
              <span className="font-display text-xl font-bold">E</span>
            </div>
            <div>
              <div className="font-display text-[1.7rem] font-bold leading-none">Effectime</div>
              <div className="text-[0.72rem] font-medium tracking-widest uppercase text-primary-foreground/60">Enterprise Platform</div>
            </div>
          </div>

          {/* Headline */}
          <div className="mt-8">
            <h1 className="font-display text-[clamp(1.85rem,2.6vw,3rem)] font-bold leading-[1.02] tracking-[-0.04em]">
              Szervezze meg csapata idejét &amp; erőforrásait egyetlen platformon
            </h1>
            <p className="mt-4 text-[0.92rem] leading-relaxed text-primary-foreground/78">
              Valós idejű csapatkapacitás, jóváhagyási munkafolyamatok, Jira-integráció és granulált jogosultságok — mind egy helyen, azonnal indítható.
            </p>
          </div>

          {/* 3 feature highlights */}
          <div className="mt-7 space-y-3">
            {[
              { icon: CalendarDays, label: "Egységes csapatnaptár", sub: "Szabadságok, jelenlétek és konfliktusok egy nézetben" },
              { icon: Shield, label: "Jóváhagyási láncok", sub: "Lineáris és párhuzamos munkafolyamatok, értesítésekkel" },
              { icon: BarChart3, label: "Riportok és Audit", sub: "Exportálható adatok, ütemezett küldés, teljes napló" },
            ].map(f => (
              <div key={f.label} className="flex items-start gap-3 rounded-xl bg-primary-foreground/8 px-4 py-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/14">
                  <f.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-snug">{f.label}</p>
                  <p className="mt-0.5 text-[11px] text-primary-foreground/64">{f.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* 6 Trust badges */}
          <div className="mt-7">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-primary-foreground/50">Miért az Effectime?</p>
            <div className="grid grid-cols-2 gap-2">
              {TRUST_BADGES.map(b => (
                <div key={b.label} className="flex items-center gap-2.5 rounded-xl border border-primary-foreground/12 bg-primary-foreground/6 px-3 py-2.5">
                  <b.icon className="h-4 w-4 shrink-0 text-primary-foreground/80" />
                  <div>
                    <p className="text-[11px] font-semibold leading-none">{b.label}</p>
                    <p className="mt-0.5 text-[9px] text-primary-foreground/56 leading-snug">{b.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Team calendar mockup */}
          <div className="mt-7">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-primary-foreground/50">Valós idejű csapatnézet</p>
            <CalendarMockup />
          </div>

          <div className="mt-auto pt-6 text-[11px] text-primary-foreground/36">
            © 2026 Effectime. Minden jog fenntartva. &nbsp;·&nbsp;
            <a href="#" className="hover:text-primary-foreground/60 underline">Adatvédelem</a> &nbsp;·&nbsp;
            <a href="#" className="hover:text-primary-foreground/60 underline">ÁSZF</a>
          </div>
        </aside>

        {/* RIGHT — Scrollable: auth card + rich content */}
        <main className="h-full overflow-y-auto bg-background px-10 py-8">

          {/* Back link */}
          <a href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Vissza a főoldalra
          </a>

          {/* Auth card */}
          <div className="mx-auto max-w-md rounded-3xl border border-border/60 bg-card p-8 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.12)] dark:shadow-[0_24px_80px_-24px_rgba(0,0,0,0.6)]">
            {renderAuthCard()}
          </div>

          {/* ── 3-step workflow ───────────────────────────────────────────────── */}
          <section className="mx-auto mt-14 max-w-md">
            <h2 className="mb-1 text-center text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Hogyan kezdd el</h2>
            <h3 className="mb-6 text-center text-xl font-bold">3 lépés az átlátható csapatmenedzsmenthez</h3>
            <div className="relative space-y-6">
              {/* connector line */}
              <div className="absolute left-[18px] top-8 bottom-8 w-px bg-border" />
              {STEPS.map((s, i) => (
                <motion.div
                  key={s.n}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12 }}
                  className="flex gap-4"
                >
                  <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-glow">
                    {s.n}
                  </div>
                  <div className="pt-0.5">
                    <p className="font-semibold text-sm">{s.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">{s.body}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* ── Comparison table ──────────────────────────────────────────────── */}
          <section className="mx-auto mt-14 max-w-md">
            <h2 className="mb-1 text-center text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Összehasonlítás</h2>
            <h3 className="mb-6 text-center text-xl font-bold">Effectime vs. hagyományos megoldások</h3>
            <div className="overflow-hidden rounded-2xl border border-border/60">
              <div className="grid grid-cols-2 bg-muted/40">
                <div className="border-r border-border/60 px-4 py-2.5">
                  <span className="text-xs font-semibold text-muted-foreground">Hagyományos eszközök</span>
                </div>
                <div className="px-4 py-2.5">
                  <span className="text-xs font-semibold text-primary">Effectime</span>
                </div>
              </div>
              {COMPARISON.map((row, i) => (
                <div key={i} className={`grid grid-cols-2 ${i % 2 === 0 ? '' : 'bg-muted/20'}`}>
                  <div className="flex items-start gap-2 border-r border-border/60 px-4 py-3">
                    <XIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                    <span className="text-xs text-muted-foreground leading-snug">{row.traditional}</span>
                  </div>
                  <div className="flex items-start gap-2 px-4 py-3">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="text-xs text-foreground leading-snug">{row.ours}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── FAQ ───────────────────────────────────────────────────────────── */}
          <section className="mx-auto mt-14 max-w-md">
            <h2 className="mb-1 text-center text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Kérdések & válaszok</h2>
            <h3 className="mb-6 text-center text-xl font-bold">Gyakran ismételt kérdések</h3>
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-muted/20 px-5 gradient-primary">
              {FAQS.map(f => <FaqItem key={f.q} {...f} />)}
            </div>
          </section>

          {/* ── CTA footer ─────────────────────────────────────────────────────── */}
          <section className="mx-auto mt-14 max-w-md text-center pb-10">
            <h3 className="text-lg font-bold">Készen állsz az első lépésre?</h3>
            <p className="mt-1 text-sm text-muted-foreground">Próbáld ingyen — bankkártya nem szükséges.</p>
            <button
              onClick={() => setView("register")}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow hover:-translate-y-0.5 hover:shadow-xl transition-all"
            >
              Ingyenes fiók létrehozása <ArrowRight className="h-4 w-4" />
            </button>
            <div className="mt-4 text-xs text-muted-foreground">
              <a href="#" className="hover:text-foreground underline">Adatvédelmi tájékoztató</a>
              {" · "}
              <a href="#" className="hover:text-foreground underline">Általános feltételek</a>
              {" · "}
              <a href="#" className="hover:text-foreground underline">Támogatás</a>
            </div>
          </section>
        </main>
      </div>

      {/* ── MOBILE layout ──────────────────────────────────────────────────────── */}
      <div className="flex min-h-screen flex-col lg:hidden">
        {/* Brand strip */}
        <div className="gradient-primary px-5 py-5 text-primary-foreground">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-foreground/16">
              <span className="font-display text-lg font-bold">E</span>
            </div>
            <div>
              <div className="font-display text-[1.75rem] font-bold leading-none">Effectime</div>
              <div className="text-[0.68rem] font-medium tracking-widest uppercase text-primary-foreground/60">Enterprise</div>
            </div>
          </div>
          <h1 className="mt-4 font-display text-[1.55rem] font-bold leading-[1.05] tracking-[-0.03em]">
            Szervezze meg csapata idejét hatékonyan
          </h1>
          <p className="mt-2 text-sm text-primary-foreground/78 leading-relaxed">
            Valós idejű kapacitástervezés, jóváhagyások és riportok — egy helyen.
          </p>
        </div>

        {/* Auth card */}
        <div className="bg-background px-4 py-6">
          <a href="/" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3 w-3" /> Vissza a főoldalra
          </a>
          <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.1)]">
            {renderAuthCard()}
          </div>
        </div>

        {/* Steps (mobile) */}
        <div className="bg-background px-5 pb-8 pt-2">
          <h3 className="mb-5 text-center text-lg font-bold">3 lépés az induláshoz</h3>
          <div className="space-y-4">
            {STEPS.map(s => (
              <div key={s.n} className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  {s.n}
                </div>
                <div>
                  <p className="font-semibold text-sm">{s.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ (mobile) */}
        <div className="gradient-primary px-5 py-6 text-primary-foreground">
          <h3 className="mb-4 text-center text-lg font-bold">Gyakori kérdések</h3>
          <div>
            {FAQS.slice(0, 4).map(f => <FaqItem key={f.q} {...f} />)}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-background px-5 py-5 text-center text-xs text-muted-foreground">
          <a href="#" className="hover:text-foreground underline">Adatvédelem</a>
          {" · "}
          <a href="#" className="hover:text-foreground underline">ÁSZF</a>
          {" · "}
          <a href="#" className="hover:text-foreground underline">Támogatás</a>
          <p className="mt-2">© 2026 Effectime</p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
