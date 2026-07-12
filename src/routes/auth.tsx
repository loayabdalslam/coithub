import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { hasSupabaseConfig, supabase } from "@/integrations/supabase/client";
import { ProviderIcon } from "@/components/ProviderIcon";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Coithub" },
      { name: "description", content: "Sign in to your Coithub workspace." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const cloudConfigured = hasSupabaseConfig();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "invalid"
  >("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function afterAuth() {
    const pending =
      typeof window !== "undefined" ? localStorage.getItem("pending_invite") : null;
    if (pending) {
      localStorage.removeItem("pending_invite");
      navigate({ to: "/invite/$token", params: { token: pending } });
    } else {
      navigate({ to: "/workspaces" });
    }
  }

  useEffect(() => {
    if (!cloudConfigured) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) afterAuth();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudConfigured]);

  // Debounced username availability check (signup only)
  useEffect(() => {
    if (mode !== "signup") return;
    const clean = username.trim().toLowerCase();
    if (!clean) {
      setUsernameStatus("idle");
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(clean)) {
      setUsernameStatus("invalid");
      return;
    }
    setUsernameStatus("checking");
    const t = setTimeout(async () => {
      const { data, error } = await (supabase.rpc as any)("is_username_available", {
        _username: clean,
      });
      if (error) {
        setUsernameStatus("idle");
        return;
      }
      setUsernameStatus(data ? "available" : "taken");
    }, 400);
    return () => clearTimeout(t);
  }, [username, mode]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!cloudConfigured) {
      setError("Lovable Cloud is required for sign in. Enable Cloud once workspace credits are available.");
      return;
    }
    setError(null);

    if (mode === "signup") {
      const clean = username.trim().toLowerCase();
      if (!/^[a-z0-9_]{3,20}$/.test(clean)) {
        setError("Username must be 3–20 characters: letters, numbers, or underscore.");
        return;
      }
      if (usernameStatus === "taken") {
        setError("That username is already taken. Please choose another.");
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const clean = username.trim().toLowerCase();
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name || clean, username: clean },
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      afterAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <svg viewBox="0 0 20 20" fill="none" className="size-4">
              <path d="M4 6l6-3 6 3v8l-6 3-6-3V6z" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="10" cy="10" r="2.2" fill="currentColor" />
            </svg>
          </div>
          <span className="font-display text-xl">Coithub</span>
        </Link>

        <div className="surface-panel p-6">
          <h1 className="font-display text-2xl">
            {mode === "signin" ? "Sign in" : "Create your account"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Welcome back. Enter your workspace."
              : "Start collaborating with your team and AI agents."}
          </p>
          {!cloudConfigured && (
            <div className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
              Sign-in needs Lovable Cloud. Cloud activation was blocked because this workspace has no remaining credits.
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-3">
            {mode === "signup" && (
              <>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
                <div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username (unique)"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                  {usernameStatus === "checking" && (
                    <p className="mt-1 text-xs text-muted-foreground">Checking availability…</p>
                  )}
                  {usernameStatus === "available" && (
                    <p className="mt-1 text-xs text-emerald-600">Username is available ✓</p>
                  )}
                  {usernameStatus === "taken" && (
                    <p className="mt-1 text-xs text-destructive">Username is already taken</p>
                  )}
                  {usernameStatus === "invalid" && (
                    <p className="mt-1 text-xs text-destructive">
                      3–20 chars: letters, numbers, underscore
                    </p>
                  )}
                </div>
              </>
            )}
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={busy || (mode === "signup" && usernameStatus === "taken")}
              className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <button
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
            }}
            className="mt-4 text-xs text-muted-foreground hover:text-foreground"
          >
            {mode === "signin"
              ? "No account? Create one →"
              : "Already have an account? Sign in →"}
          </button>
        </div>
        <div className="mt-6 flex items-center justify-center gap-3 text-[11px] text-muted-foreground">
          <span>AI powered by</span>
          <span className="flex items-center gap-1"><ProviderIcon provider="google" className="size-3.5" /> Google</span>
          <span className="flex items-center gap-1"><ProviderIcon provider="openai" className="size-3.5" /> OpenAI</span>
        </div>
      </div>
    </div>
  );
}
