import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AGENTS, AGENT_LIST, agentImage, type Agent } from "@/lib/agents";
import { PetAvatar } from "@/components/PetAvatar";
import { useWorkspace } from "@/lib/workspace";
import {
  addAgentToWorkspace,
  removeAgentFromWorkspace,
  usePetConfigs,
  type PetConfig,
} from "@/lib/pet-configs";
import { ProviderIcon } from "@/components/ProviderIcon";
import { PROVIDERS } from "@/lib/providers";
import { EditPromptDialog } from "@/components/EditPromptDialog";
import type { PetSlug } from "@/lib/pets";

export const Route = createFileRoute("/_authenticated/app/pets")({
  head: () => ({ meta: [{ title: "Agents Hub — Coithub" }] }),
  component: AgentsHub,
});

function AgentsHub() {
  const { data: workspace } = useWorkspace();
  const { data: configs } = usePetConfigs(workspace?.id);
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState<string>("All");
  const [busy, setBusy] = useState<string | null>(null);

  const chosen = useMemo(
    () => new Set((configs ?? []).map((c) => c.pet_slug)),
    [configs],
  );

  const departments = useMemo(() => {
    const s = new Set<string>();
    AGENT_LIST.forEach((s0) => s.add(AGENTS[s0].department));
    return ["All", ...Array.from(s).sort()];
  }, []);

  const filtered = useMemo(() => {
    return AGENT_LIST.map((s) => AGENTS[s]).filter((a) => {
      if (dept !== "All" && a.department !== dept) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        a.name.toLowerCase().includes(q) ||
        a.role.toLowerCase().includes(q) ||
        a.mission.toLowerCase().includes(q)
      );
    });
  }, [dept, query]);

  async function toggle(slug: PetSlug) {
    if (!workspace) return;
    setBusy(slug);
    try {
      if (chosen.has(slug)) await removeAgentFromWorkspace(workspace.id, slug);
      else await addAgentToWorkspace(workspace.id, slug);
      await qc.invalidateQueries({ queryKey: ["pet_configs", workspace.id] });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto max-w-6xl px-8 py-10">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Workspace</div>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl">Agents Hub</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              A directory of 20 AI human-style employees. Hire the ones you want on your team —
              they’ll appear in your sidebar and respond in channels when mentioned by
              <span className="font-medium text-foreground"> @slug</span>. You can remove them any
              time.
            </p>
          </div>
          <div className="flex gap-2">
            <span className="badge-pill">
              {chosen.size} / {AGENT_LIST.length} hired
            </span>
            <Link to="/app/settings/pets" className="btn-outline-pill">
              Configure models
            </Link>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agents…"
            className="w-64 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <div className="flex flex-wrap gap-1">
            {departments.map((d) => (
              <button
                key={d}
                onClick={() => setDept(d)}
                className={`rounded-full px-3 py-1 text-xs transition ${
                  dept === d
                    ? "bg-primary text-primary-foreground"
                    : "border border-border-strong text-muted-foreground hover:bg-secondary"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs text-muted-foreground">
            {filtered.length} showing
          </span>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => (
            <AgentCard
              key={a.slug}
              agent={a}
              workspaceId={workspace?.id}
              config={(configs ?? []).find((c) => c.pet_slug === a.slug)}
              hired={chosen.has(a.slug)}
              busy={busy === a.slug}
              onToggle={() => toggle(a.slug)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function AgentCard({
  agent,
  workspaceId,
  config,
  hired,
  busy,
  onToggle,
}: {
  agent: Agent;
  workspaceId: string | undefined;
  config: PetConfig | undefined;
  hired: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  const img = agentImage(agent.slug);
  const [editing, setEditing] = useState(false);
  const isCustom = !!config?.custom_system;
  return (
    <article className="surface-panel flex flex-col overflow-hidden">
      <div className="relative h-56 w-full overflow-hidden" style={{ backgroundColor: agent.color }}>
        {img && (
          <img src={img} alt={`${agent.name}, ${agent.role}`} loading="lazy" width={512} height={512} className="h-full w-full object-cover" />
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3">
          <div className="font-display text-xl leading-tight text-white">{agent.name}</div>
          <div className="text-[10px] uppercase tracking-widest text-white/85">{agent.role}</div>
        </div>
        <span className="absolute right-2 top-2 rounded-full bg-black/40 px-2 py-0.5 text-[10px] uppercase tracking-widest text-white/90">
          {agent.department}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-sm text-muted-foreground">{agent.mission}</p>
        <details className="mt-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer text-foreground/80">
            Personality prompt {isCustom && <span className="ml-1 rounded bg-primary/15 px-1.5 py-0.5 text-[9px] uppercase text-primary">custom</span>}
          </summary>
          <p className="mt-2 whitespace-pre-wrap">{config?.custom_system || agent.system}</p>
        </details>
        <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
          <PetAvatar petId={agent.slug} size="xs" />
          <span className="text-[11px] text-muted-foreground">
            @<span className="font-medium text-foreground">{agent.slug}</span>
          </span>
          {hired && workspaceId && (
            <button
              onClick={() => setEditing(true)}
              className="ml-auto rounded-full border border-border-strong px-3 py-1 text-xs text-muted-foreground hover:bg-secondary"
            >
              Edit prompt
            </button>
          )}
          <button
            onClick={onToggle}
            disabled={busy}
            className={`${hired && workspaceId ? "" : "ml-auto"} rounded-full px-3 py-1 text-xs font-medium transition disabled:opacity-60 ${
              hired
                ? "border border-border-strong text-foreground hover:bg-secondary"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {busy ? "…" : hired ? "Remove" : "Hire"}
          </button>
        </div>
      </div>
      {editing && workspaceId && (
        <EditPromptDialog
          workspaceId={workspaceId}
          agentSlug={agent.slug}
          initialPrompt={config?.custom_system ?? null}
          onClose={() => setEditing(false)}
        />
      )}
    </article>
  );
}

// Ensure providers list is referenced.
void PROVIDERS;
