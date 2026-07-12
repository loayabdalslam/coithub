import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/lib/workspace";
import {
  fetchPetConfigs,
  petMeta,
  savePetConfigs,
  removeAgentFromWorkspace,
  type PetConfig,
} from "@/lib/pet-configs";
import { MODELS, PROVIDERS, providerForModel, type ProviderId } from "@/lib/providers";
import { ProviderIcon } from "@/components/ProviderIcon";
import { PetAvatar } from "@/components/PetAvatar";

export const Route = createFileRoute("/_authenticated/app/settings/pets")({
  component: AgentSettings,
});

function AgentSettings() {
  const { data: workspace } = useWorkspace();
  const qc = useQueryClient();
  const [configs, setConfigs] = useState<PetConfig[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!workspace) return;
    fetchPetConfigs(workspace.id).then(setConfigs).catch(() => setConfigs([]));
  }, [workspace]);

  function update(idx: number, patch: Partial<PetConfig>) {
    setConfigs((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }

  async function save() {
    if (!workspace) return;
    setBusy(true);
    setMsg(null);
    try {
      await savePetConfigs(configs);
      await qc.invalidateQueries({ queryKey: ["pet_configs", workspace.id] });
      setMsg("Saved.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function fire(slug: string) {
    if (!workspace) return;
    if (!confirm(`Remove ${slug} from your team?`)) return;
    await removeAgentFromWorkspace(workspace.id, slug as PetConfig["pet_slug"]);
    setConfigs((prev) => prev.filter((c) => c.pet_slug !== slug));
    await qc.invalidateQueries({ queryKey: ["pet_configs", workspace.id] });
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto max-w-4xl px-8 py-10">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          Settings · Agent models
        </div>
        <h1 className="mt-2 font-display text-4xl">Your agents</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Pick which model powers each hired agent. Providers marked below are already
          connected via the Lovable AI Gateway — bring your own keys for the rest.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {(Object.keys(PROVIDERS) as ProviderId[]).map((p) => (
            <span key={p} className="badge-pill">
              <ProviderIcon provider={p} className="size-3.5" />
              {PROVIDERS[p].name}
            </span>
          ))}
        </div>

        {configs.length === 0 ? (
          <div className="mt-8 rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              You haven’t hired any agents yet.
            </p>
            <Link to="/app/pets" className="btn-pill mt-4 inline-block">
              Open the Agents Hub
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            {configs.map((c, idx) => {
              const meta = petMeta(c.pet_slug);
              return (
                <div
                  key={c.pet_slug}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <PetAvatar petId={c.pet_slug} size="md" />
                    <div>
                      <div className="font-display text-base">{meta.name}</div>
                      <div className="text-xs text-muted-foreground">{meta.role}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ProviderIcon provider={c.provider} className="size-4" />
                    <select
                      value={c.model}
                      onChange={(e) => {
                        const model = e.target.value;
                        update(idx, { model, provider: providerForModel(model) });
                      }}
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    >
                      {MODELS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label} {m.tag ? `· ${m.tag}` : ""}
                        </option>
                      ))}
                    </select>
                    <label className="ml-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={c.enabled}
                        onChange={(e) => update(idx, { enabled: e.target.checked })}
                      />
                      Enabled
                    </label>
                    <button
                      onClick={() => fire(c.pet_slug)}
                      className="rounded-md border border-border-strong px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 flex items-center gap-3">
          <button
            onClick={save}
            disabled={busy || configs.length === 0}
            className="btn-pill disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
          <Link to="/app" className="btn-outline-pill">
            Back to workspace
          </Link>
          {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
        </div>
      </div>
    </div>
  );
}
