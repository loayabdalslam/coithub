import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkspace, renameWorkspace } from "@/lib/workspace";
import { markWorkspaceOnboarded } from "@/lib/pet-configs";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: OnboardingPage,
});

function OnboardingPage() {
  const { data: workspace, isLoading } = useWorkspace();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [wsName, setWsName] = useState("");
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

  async function finish() {
    if (!workspace) return;
    setSaving(true);
    setError(null);
    try {
      if (wsName.trim() && wsName.trim() !== workspace.name) {
        await renameWorkspace(workspace.id, wsName.trim());
      }
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
