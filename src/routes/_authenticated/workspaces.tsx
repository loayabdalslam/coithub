import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useWorkspaces,
  createWorkspace,
  setSelectedWorkspaceId,
} from "@/lib/workspace";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/workspaces")({
  head: () => ({
    meta: [{ title: "Choose a workspace — Coithub" }],
  }),
  component: WorkspacesPage,
});

function WorkspacesPage() {
  const { data: workspaces, isLoading, error } = useWorkspaces();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function selectWorkspace(id: string, onboarded: boolean) {
    setSelectedWorkspaceId(id);
    qc.invalidateQueries({ queryKey: ["workspace"] });
    navigate({ to: onboarded ? "/app" : "/onboarding", replace: true });
  }

  async function create() {
    setBusy(true);
    setErr(null);
    try {
      const ws = await createWorkspace(newName || undefined);
      await qc.invalidateQueries({ queryKey: ["workspaces"] });
      await qc.invalidateQueries({ queryKey: ["workspace"] });
      navigate({ to: "/onboarding", replace: true });
      void ws;
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="atmospheric-bg absolute inset-0 -z-0 opacity-60" />
      <div className="relative z-10 mx-auto max-w-2xl px-6 py-16">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Coithub
            </div>
            <h1 className="mt-1 font-display text-3xl">Choose a workspace</h1>
          </div>
          <button
            onClick={signOut}
            className="rounded px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            Sign out
          </button>
        </div>

        <section className="surface-panel p-6">
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading your workspaces…</p>
          )}
          {error && (
            <p className="text-sm text-destructive">
              {error instanceof Error ? error.message : String(error)}
            </p>
          )}

          {workspaces && workspaces.length > 0 && (
            <ul className="space-y-2">
              {workspaces.map((w) => (
                <li key={w.id}>
                  <button
                    onClick={() => selectWorkspace(w.id, !!w.onboarded_at)}
                    className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-4 py-3 text-left hover:border-primary hover:bg-accent/10"
                  >
                    <span>
                      <span className="block text-sm font-medium">{w.name}</span>
                      <span className="block text-xs text-muted-foreground">/{w.slug}</span>
                    </span>
                    <span className="text-xs text-primary">Open →</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {workspaces && workspaces.length === 0 && (
            <p className="text-sm text-muted-foreground">
              You’re not part of any workspace yet. Create one to get started.
            </p>
          )}

          <div className="mt-6 border-t border-border pt-6">
            {!creating ? (
              <button
                onClick={() => setCreating(true)}
                className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                + Create a new workspace
              </button>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Workspace name"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
                {err && <p className="text-xs text-destructive">{err}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={create}
                    disabled={busy}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                  >
                    {busy ? "Creating…" : "Create"}
                  </button>
                  <button
                    onClick={() => {
                      setCreating(false);
                      setErr(null);
                    }}
                    className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
