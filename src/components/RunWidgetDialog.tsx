import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { AGENTS } from "@/lib/agents";
import { PetAvatar } from "@/components/PetAvatar";
import { usePetConfigs } from "@/lib/pet-configs";
import { runAgentWidget } from "@/lib/widgets.functions";
import { WIDGET_KINDS, type WidgetKind } from "@/lib/widgets";

export function RunWidgetDialog({
  workspaceId,
  defaultPrompt = "",
  defaultAgent,
  onClose,
}: {
  workspaceId: string;
  defaultPrompt?: string;
  defaultAgent?: string;
  onClose: () => void;
}) {
  const { data: configs } = usePetConfigs(workspaceId);
  const hired = (configs ?? []).map((c) => AGENTS[c.pet_slug as keyof typeof AGENTS]).filter(Boolean);
  const [agent, setAgent] = useState<string>(defaultAgent ?? hired[0]?.slug ?? "");
  const [kind, setKind] = useState<WidgetKind>("dashboard");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = useServerFn(runAgentWidget);
  const qc = useQueryClient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!agent || !title.trim() || !prompt.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await run({
        data: {
          workspaceId,
          agentSlug: agent as never,
          kind,
          title: title.trim(),
          prompt: prompt.trim(),
        },
      });
      await qc.invalidateQueries({ queryKey: ["widgets", workspaceId] });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form onSubmit={submit} className="surface-panel w-full max-w-lg p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Widget</div>
            <h2 className="mt-1 font-display text-xl">Run agent in background</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary">
            Close
          </button>
        </div>

        {hired.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Hire an agent from the Agents Hub first.
          </p>
        ) : (
          <>
            <label className="mt-4 block text-xs text-muted-foreground">Agent</label>
            <select
              value={agent}
              onChange={(e) => setAgent(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {hired.map((a) => (
                <option key={a.slug} value={a.slug}>
                  {a.name} — {a.role}
                </option>
              ))}
            </select>

            <label className="mt-3 block text-xs text-muted-foreground">Widget type</label>
            <div className="mt-1 grid grid-cols-4 gap-2">
              {WIDGET_KINDS.map((k) => (
                <button
                  key={k.kind}
                  type="button"
                  onClick={() => setKind(k.kind)}
                  className={`rounded-md border px-2 py-2 text-xs ${
                    kind === k.kind
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  <div className="text-base">{k.icon}</div>
                  <div className="mt-0.5 font-medium">{k.label}</div>
                  <div className="text-[10px]">{k.hint}</div>
                </button>
              ))}
            </div>

            <label className="mt-3 block text-xs text-muted-foreground">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 marketing dashboard"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />

            <label className="mt-3 block text-xs text-muted-foreground">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              placeholder="What should the agent produce?"
              className="mt-1 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm"
            />

            {err && <div className="mt-3 text-xs text-destructive">{err}</div>}

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="btn-outline-pill">
                Cancel
              </button>
              <button type="submit" disabled={busy || !title.trim() || !prompt.trim() || !agent} className="btn-pill disabled:opacity-50">
                {busy ? "Running…" : "Run widget"}
              </button>
            </div>
            {agent && (
              <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                <PetAvatar petId={agent} size="xs" />
                Runs in background · appears in Dashboard when ready
              </div>
            )}
          </>
        )}
      </form>
    </div>
  );
}
