import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AGENTS, type AgentSlug } from "@/lib/agents";
import { PetAvatar } from "@/components/PetAvatar";

export function EditPromptDialog({
  workspaceId,
  agentSlug,
  initialPrompt,
  onClose,
}: {
  workspaceId: string;
  agentSlug: AgentSlug;
  initialPrompt: string | null | undefined;
  onClose: () => void;
}) {
  const agent = AGENTS[agentSlug];
  const [text, setText] = useState(initialPrompt || agent.system);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const qc = useQueryClient();

  async function save(useDefault: boolean) {
    setBusy(true);
    setErr(null);
    const value = useDefault ? null : text.trim();
    const { error } = await supabase
      .from("pet_configs")
      .update({ custom_system: value } as never)
      .eq("workspace_id", workspaceId)
      .eq("pet_slug", agentSlug);
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["pet_configs", workspaceId] });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="surface-panel w-full max-w-xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <PetAvatar petId={agentSlug} size="md" />
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                Personalize prompt
              </div>
              <h2 className="mt-0.5 font-display text-xl">
                {agent.name} — {agent.role}
              </h2>
            </div>
          </div>
          <button onClick={onClose} className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary">
            Close
          </button>
        </div>

        <label className="mt-4 block text-xs text-muted-foreground">
          System prompt (guides how {agent.name} replies in this workspace)
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          className="mt-1 w-full resize-y rounded-md border border-border bg-background px-3 py-2 font-mono text-xs leading-relaxed"
        />
        {err && <div className="mt-2 text-xs text-destructive">{err}</div>}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            onClick={() => save(true)}
            disabled={busy}
            className="btn-outline-pill disabled:opacity-50"
          >
            Reset to default
          </button>
          <button
            onClick={() => save(false)}
            disabled={busy || !text.trim()}
            className="btn-pill disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save prompt"}
          </button>
        </div>
      </div>
    </div>
  );
}
