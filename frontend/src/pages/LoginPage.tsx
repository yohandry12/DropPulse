import { lazy, Suspense, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { login, register } from "../services/authService";
import { apiErrorCode } from "../services/httpClient";
import { hasSeenIntro, markIntroSeen } from "../services/introStorage";

// Lazy so Three.js only downloads when the first-login intro actually plays.
const WelcomeIntro = lazy(() => import("../components/WelcomeIntro"));

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "E-mail ou mot de passe incorrect.",
  invalid_credentials_format:
    "Format d'identifiants invalide (mot de passe : 8 caractères min).",
  email_taken: "Cet e-mail est déjà utilisé.",
  missing_name: "Le nom est requis.",
  network_error: "Serveur injoignable. Réessayez.",
};

// Neobrutalist input/button share the same slate border + hard shadow.
const INPUT_CLASS =
  "h-11 w-[250px] rounded-[5px] border-2 border-[#323232] bg-white px-2.5 py-1.5 " +
  "text-[15px] font-semibold text-[#323232] shadow-[4px_4px_#323232] outline-none " +
  "transition-colors placeholder:text-[#666] placeholder:opacity-80 focus:border-accent";

const BTN_CLASS =
  "mt-1.5 mb-2.5 h-11 w-[140px] rounded-[5px] border-2 border-[#323232] bg-accent " +
  "text-base font-bold text-white shadow-[4px_4px_#323232] cursor-pointer " +
  "transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none " +
  "disabled:opacity-55 disabled:cursor-not-allowed";

const TITLE_CLASS =
  "mt-2.5 mb-1.5 text-center font-heading text-[25px] font-bold text-[#323232]";

const FACE_CLASS =
  "flip-card-face absolute inset-0 flex flex-col justify-start gap-5 rounded-[5px] " +
  "border-2 border-[#323232] bg-[#d3d3d3] p-5 shadow-[4px_4px_#323232]";

// Password input with a show/hide toggle. Eye icon is inline SVG (no emoji).
function PasswordField({
  value,
  onChange,
  placeholder,
  autoComplete,
  minLength,
  visible,
  onToggle,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete: string;
  minLength?: number;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="relative w-[250px]">
      <input
        className={`${INPUT_CLASS} w-full pr-10`}
        name="password"
        placeholder={placeholder}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        required
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={
          visible ? "Masquer le mot de passe" : "Afficher le mot de passe"
        }
        aria-pressed={visible}
        className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-[#666] transition-colors hover:text-[#323232] focus:outline-none focus-visible:text-accent"
      >
        {visible ? (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  // Sign-up form state
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  // Password visibility, per side.
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [showSignupPwd, setShowSignupPwd] = useState(false);

  function messageFor(err: unknown): string {
    return ERROR_MESSAGES[apiErrorCode(err)] ?? "Une erreur est survenue.";
  }

  // Shared success path: play the 3D welcome on the first-ever login, else go home.
  function onAuthSuccess() {
    if (!hasSeenIntro()) {
      setShowIntro(true);
    } else {
      navigate("/", { replace: true });
    }
  }

  function finishIntro() {
    markIntroSeen();
    navigate("/", { replace: true });
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(loginEmail, loginPassword);
      onAuthSuccess();
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSignup(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register(signupEmail, signupPassword, signupName);
      // Auto-login after successful registration.
      await login(signupEmail, signupPassword);
      onAuthSuccess();
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  if (showIntro) {
    return (
      <Suspense fallback={<div className="fixed inset-0 z-50 bg-[#0f172a]" />}>
        <WelcomeIntro onDone={finishIntro} />
      </Suspense>
    );
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-[url('/mountain.webp')] bg-cover bg-fixed bg-center p-6">
      <div className="absolute inset-0 z-0 bg-[rgba(15,23,42,0.35)]" />

      <div className="relative z-10 flex flex-col items-center gap-7">
        <div className="font-heading text-[34px] font-bold tracking-[0.5px] text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.4)]">
          DropPulse
        </div>

        {/* Fixed-size box reserves flow space for the 300x350 flip-card that
            overflows the tiny toggle label below it. */}
        <div className="relative flex h-[420px] w-[300px] justify-center">
          {/* Toggle + card live in one label so the checkbox combinators
              (`.flip-toggle:checked + .flip-slider` / `~ .flip-card-side` / `~ .flip-card-inner`)
              reach the card. Column layout: 50x20 toggle on top, card 50px below. */}
          <label className="flip-switch">
            <input
              type="checkbox"
              className="flip-toggle"
              aria-label="Basculer entre connexion et inscription"
            />
            <span className="flip-slider" />
            <span className="flip-card-side" />

            <div className="flip-card-inner relative bg-transparent text-center">
              <div className={FACE_CLASS}>
                <div className={TITLE_CLASS}>Connexion</div>
                <form
                  className="flex flex-col items-center gap-5"
                  onSubmit={handleLogin}
                >
                  <input
                    className={INPUT_CLASS}
                    name="email"
                    placeholder="E-mail"
                    type="email"
                    autoComplete="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                  />
                  <PasswordField
                    value={loginPassword}
                    onChange={setLoginPassword}
                    placeholder="Mot de passe"
                    autoComplete="current-password"
                    visible={showLoginPwd}
                    onToggle={() => setShowLoginPwd((v) => !v)}
                  />
                  <button className={BTN_CLASS} type="submit" disabled={busy}>
                    {busy ? "…" : "C'est parti !"}
                  </button>
                </form>
              </div>

              <div className={`${FACE_CLASS} flip-card-face--back`}>
                <div className={TITLE_CLASS}>Inscription</div>
                <form
                  className="flex flex-col items-center gap-5"
                  onSubmit={handleSignup}
                >
                  <input
                    className={INPUT_CLASS}
                    name="name"
                    placeholder="Nom"
                    type="text"
                    autoComplete="name"
                    required
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                  />
                  <input
                    className={INPUT_CLASS}
                    name="email"
                    placeholder="E-mail"
                    type="email"
                    autoComplete="email"
                    required
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                  />
                  <PasswordField
                    value={signupPassword}
                    onChange={setSignupPassword}
                    placeholder="Mot de passe (8+ caractères)"
                    autoComplete="new-password"
                    minLength={8}
                    visible={showSignupPwd}
                    onToggle={() => setShowSignupPwd((v) => !v)}
                  />
                  <button className={BTN_CLASS} type="submit" disabled={busy}>
                    {busy ? "…" : "Confirmer !"}
                  </button>
                </form>
              </div>
            </div>
          </label>
        </div>

        {error && (
          <p
            role="alert"
            className="max-w-[300px] rounded-[5px] bg-[rgba(220,38,38,0.95)] px-3.5 py-2.5 text-center text-sm font-semibold text-white"
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
