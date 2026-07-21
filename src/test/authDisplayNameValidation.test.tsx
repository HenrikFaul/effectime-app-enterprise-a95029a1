import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  setSessionFromTokens: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: null,
    signIn: mocks.signIn,
    signUp: mocks.signUp,
    signOut: mocks.signOut,
    setSessionFromTokens: mocks.setSessionFromTokens,
  }),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mocks.navigate,
  useSearchParams: () => [new URLSearchParams()],
}));

vi.mock("@/i18n/I18nProvider", () => ({
  useT: () => (key: string) => ({
    "auth_page.nav_register": "Register",
    "auth_page.nav_signin": "Sign in",
    "auth_page.btn_register": "Create account",
    "auth_page.btn_login": "Sign in",
    "auth_page.btn_google": "Continue with Google",
    "auth_page.label_display_name": "Display name",
    "auth_page.placeholder_display_name": "Anna Smith",
    "auth_page.label_email": "Email",
    "auth_page.placeholder_email": "name@example.com",
    "auth_page.label_password": "Password",
    "auth_page.toast_confirm_sent": "Confirmation email sent!",
    "profile.display_name_validation_error": "Enter a display name of 1–200 characters without control characters.",
  }[key] ?? key),
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: PropsWithChildren) => <>{children}</>,
  motion: {
    div: ({ children }: PropsWithChildren) => <div>{children}</div>,
  },
}));

vi.mock("@/components/EffectimeLogo", () => ({ EffectimeLogo: () => <span>Effectime</span> }));
vi.mock("@/components/i18n/LanguageSelector", () => ({ LanguageSelector: () => null }));
vi.mock("@/components/ui/input-otp", () => ({
  InputOTP: ({ children }: PropsWithChildren) => <div>{children}</div>,
  InputOTPGroup: ({ children }: PropsWithChildren) => <div>{children}</div>,
  InputOTPSlot: () => null,
}));
vi.mock("@/lib/platform/mobile", () => ({
  buildAuthCallbackUrl: () => "https://effectime.app/auth",
  isAllowedSupabaseOAuthUrl: () => true,
  isNativeRuntime: () => false,
  readWebImplicitSessionTokens: () => null,
}));
vi.mock("@/lib/platform/nativeBridge", () => ({ getNativeBrowserPlugin: () => null }));
vi.mock("@/config/publicRuntime", () => ({ SUPABASE_URL: "https://example.supabase.co" }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      resend: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      signInWithOAuth: vi.fn(),
      verifyOtp: vi.fn(),
    },
    functions: { invoke: vi.fn() },
  },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import Auth from "@/pages/Auth";

function openRegistrationForm() {
  render(<Auth />);
  fireEvent.click(screen.getAllByRole("button", { name: "Register" })[0]);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.test" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secure-password" } });
}

describe("registration display-name boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.signUp.mockResolvedValue({ error: null });
  });

  afterEach(cleanup);

  it("canonicalizes the display name before signup", async () => {
    openRegistrationForm();
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "  Ada Lovelace  " },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(mocks.signUp).toHaveBeenCalledWith(
      "ada@example.test",
      "secure-password",
      "Ada Lovelace",
      "/app",
    ));
  });

  it.each([
    ["blank", "   "],
    ["control-character", `Ada${String.fromCodePoint(127)}Lovelace`],
    ["C1-control-character", `Ada${String.fromCodePoint(0x85)}Lovelace`],
    ["unpaired-surrogate", "Ada\ud800Lovelace"],
    ["overlong", "x".repeat(201)],
  ])("blocks an invalid %s display name with a localized accessible error", (_caseName, displayName) => {
    openRegistrationForm();
    const input = screen.getByLabelText("Display name");
    fireEvent.change(input, { target: { value: displayName } });

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a display name of 1–200 characters without control characters.",
    );
    expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("accepts a 200-code-point astral display name without UTF-16 truncation", async () => {
    openRegistrationForm();
    const displayName = String.fromCodePoint(0x1f600).repeat(200);
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: displayName } });

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(mocks.signUp).toHaveBeenCalledWith(
      "ada@example.test",
      "secure-password",
      displayName,
      "/app",
    ));
  });

  it("matches ECMAScript Unicode edge trimming before signup", async () => {
    openRegistrationForm();
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "\u00a0\ufeffAda Lovelace\u3000" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(mocks.signUp).toHaveBeenCalledWith(
      "ada@example.test",
      "secure-password",
      "Ada Lovelace",
      "/app",
    ));
  });
});
