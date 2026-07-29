import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace, renameWorkspace } from "@/lib/workspace";
import { markWorkspaceOnboarded } from "@/lib/pet-configs";
import { PROVIDERS } from "@/lib/providers";
import { ProviderIcon } from "@/components/ProviderIcon";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: OnboardingPage,
});

function OnboardingPage() {
  const { data: workspace, isLoading } = useWorkspace();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [wsName, setWsName] = useState("");
  const [groqKey, setGroqKey] = useState("");
  const [composioKey, setComposioKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (workspace) setWsName(workspace.name);
  }, [workspace]);

  if (isLoading || !workspace) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  async function saveKey(provider: string, value: string) {
    if (!workspace || !value.trim()) return;
    const { data: user } = await supabase.auth.getUser();
    const { error: e } = await supabase.from("workspace_api_keys" as never).upsert(
      {
        workspace_id: workspace.id,
        provider,
        api_key: value.trim(),
        updated_at: new Date().toISOString(),
        updated_by: user.user?.id ?? null,
      } as never,
      { onConflict: "workspace_id,provider" },
    );
    if (e) throw e;
  }

  async function finish() {
    if (!workspace) return;
    setSaving(true);
    setError(null);
    try {
      if (wsName.trim() && wsName.trim() !== workspace.name) {
        await renameWorkspace(workspace.id, wsName.trim());
      }
      await saveKey("groq", groqKey);
      await saveKey("composio", composioKey);
      await markWorkspaceOnboarded(workspace.id);
      await qc.invalidateQueries({ queryKey: ["workspace"] });
      navigate({ to: "/app/pets" });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="atmospheric-bg absolute inset-0 -z-0 opacity-60" />
      <div className="relative z-10 mx-auto max-w-2xl px-6 py-16">
        <section className="surface-panel p-8">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Set up your workspace
          </div>
          <h1 className="mt-2 font-display text-3xl">Name your workspace</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This is where your team — real people and hand-picked AI agents — collaborate.
            After this, you’ll pick which agents to hire from the Agents Hub.
          </p>
          <input
            value={wsName}
            onChange={(e) => setWsName(e.target.value)}
            placeholder="Acme Inc."
            className="mt-6 w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none"
          />

          <div className="mt-8 rounded-lg border border-border bg-surface p-4">
            <div className="flex items-start gap-3">
              <ProviderIcon provider="groq" className="mt-0.5 size-5" />
              <div className="flex-1">
                <div className="font-display text-base">{PROVIDERS.groq.name} — powers your agents</div>
                <div className="text-xs text-muted-foreground">
                  Groq is the default engine for every agent in this workspace. Paste your key once
                  and everyone here can chat with the agents. You can change it later in Settings →
                  API Keys.
                </div>
                <a
                  href={PROVIDERS.groq.keyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs underline decoration-dotted"
                >
                  Get a Groq key →
                </a>
                <input
                  type="password"
                  value={groqKey}
                  onChange={(e) => setGroqKey(e.target.value)}
                  placeholder="gsk_…"
                  className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-border bg-surface p-4">
            <div className="font-display text-base">Composio — give agents real tools</div>
            <div className="text-xs text-muted-foreground">
              Optional. Connect Gmail, Slack, Notion, GitHub, Linear and 250+ apps so agents can act
              across your workspace, not just talk. Add it later in Settings → Integrations.
            </div>
            <a
              href="https://app.composio.dev/developers"
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs underline decoration-dotted"
            >
              Get a Composio key →
            </a>
            <input
              type="password"
              value={composioKey}
              onChange={(e) => setComposioKey(e.target.value)}
              placeholder="Composio API key (optional)"
              className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          {error && (
            <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
          <div className="mt-8 flex justify-end">
            <button
              disabled={!wsName.trim() || saving}
              onClick={finish}
              className="btn-pill disabled:opacity-50"
            >
              {saving ? "Setting up…" : "Continue to Agents Hub →"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
