import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/lib/workspace";
import {
  useMemories,
  createMemory,
  deleteMemory,
  MEMORY_KINDS,
  type MemoryKind,
} from "@/lib/memory";

export const Route = createFileRoute("/_authenticated/app/memory")({
  component: MemoryPage,
  head: () => ({
    meta: [
      { title: "Agent Memory · Coithub" },
      {
        name: "description",
        content:
          "The shared memory every AI agent in your workspace reads before replying — people, business context, preferences and insights.",
      },
      { property: "og:title", content: "Agent Memory · Coithub" },
      {
        property: "og:description",
        content: "One unified memory that makes every workspace agent smarter over time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const KIND_STYLE: Record<string, string> = {
  user: "bg-primary/10 text-primary",
  workspace: "bg-secondary text-foreground",
  business: "bg-accent/10 text-accent-foreground",
  preference: "bg-secondary text-foreground",
  process: "bg-secondary text-foreground",
  fact: "bg-secondary text-foreground",
  insight: "bg-primary/10 text-primary",
};

function MemoryPage() {
  const { data: workspace } = useWorkspace();
  const { data: memories, isLoading } = useMemories(workspace?.id);
  const qc = useQueryClient();

  const [filter, setFilter] = useState<"all" | MemoryKind>("all");
  const [kind, setKind] = useState<MemoryKind>("business");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [importance, setImportance] = useState(3);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const list = (memories ?? []).filter((m) => filter === "all" || m.kind === filter);

  async function add() {
    if (!workspace || !content.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      await createMemory({
        workspaceId: workspace.id,
        kind,
        subject: subject.trim(),
        content: content.trim(),
        importance,
      });
      setSubject("");
      setContent("");
      await qc.invalidateQueries({ queryKey: ["workspace_memories", workspace.id] });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!workspace) return;
    await deleteMemory(id);
    await qc.invalidateQueries({ queryKey: ["workspace_memories", workspace.id] });
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto max-w-4xl px-8 py-10">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          Unified agent memory
        </div>
        <h1 className="mt-2 font-display text-4xl">What your agents know</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Every agent reads this before it replies and writes to it as it learns — about the people
          here, the workspace, and the business. The more it holds, the sharper the recommendations.
        </p>

        <div className="mt-6 rounded-lg border border-border bg-surface p-4">
          <div className="font-display text-base">Teach your agents something</div>
          <div className="mt-3 grid gap-2 md:grid-cols-[140px_1fr_90px]">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as MemoryKind)}
              className="rounded-md border border-border bg-background px-2 py-2 text-sm"
            >
              {MEMORY_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject (who/what it's about)"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <select
              value={importance}
              onChange={(e) => setImportance(Number(e.target.value))}
              className="rounded-md border border-border bg-background px-2 py-2 text-sm"
            >
              {[1, 2, 3, 4, 5].map((i) => (
                <option key={i} value={i}>
                  ★ {i}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="One crisp sentence — e.g. “We ship to EU customers only and invoice in EUR.”"
            rows={2}
            className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <div className="mt-3 flex items-center justify-between">
            {msg && <span className="text-xs text-destructive">{msg}</span>}
            <button
              onClick={add}
              disabled={busy || !content.trim()}
              className="ml-auto btn-pill disabled:opacity-50"
            >
              {busy ? "Saving…" : "Add to memory"}
            </button>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {(["all", ...MEMORY_KINDS] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k as "all" | MemoryKind)}
              className={`rounded-full px-3 py-1 text-xs ${
                filter === k ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}
            >
              {k}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          {isLoading && <div className="text-sm text-muted-foreground">Loading memory…</div>}
          {!isLoading && list.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nothing here yet. Chat with your agents — they’ll start remembering automatically.
            </div>
          )}
          {list.map((m) => (
            <div
              key={m.id}
              className="group flex items-start gap-3 rounded-lg border border-border bg-surface p-3"
            >
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                  KIND_STYLE[m.kind] ?? "bg-secondary"
                }`}
              >
                {m.kind}
              </span>
              <div className="min-w-0 flex-1">
                {m.subject && <div className="text-xs text-muted-foreground">{m.subject}</div>}
                <div className="text-sm">{m.content}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  ★ {m.importance}
                  {m.created_by_agent ? ` · learned by ${m.created_by_agent}` : " · added by a teammate"}
                </div>
              </div>
              <button
                onClick={() => remove(m.id)}
                className="opacity-0 transition group-hover:opacity-100 text-xs text-muted-foreground hover:text-destructive"
              >
                Forget
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
