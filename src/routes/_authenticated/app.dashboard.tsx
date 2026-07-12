import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/lib/workspace";
import { useWidgets, WIDGET_KINDS, deleteWidget, type Widget, type WidgetKind } from "@/lib/widgets";
import { AGENTS } from "@/lib/agents";
import { PetAvatar } from "@/components/PetAvatar";
import { Markdown } from "@/components/Markdown";
import { RunWidgetDialog } from "@/components/RunWidgetDialog";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Coithub" }] }),
  component: DashboardView,
});

function DashboardView() {
  const { data: workspace } = useWorkspace();
  const { data: widgets } = useWidgets(workspace?.id);
  const qc = useQueryClient();
  const [runOpen, setRunOpen] = useState(false);
  const [filter, setFilter] = useState<WidgetKind | "all">("all");

  useEffect(() => {
    if (!workspace?.id) return;
    const ch = supabase
      .channel(`widgets:${workspace.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "widgets", filter: `workspace_id=eq.${workspace.id}` },
        () => qc.invalidateQueries({ queryKey: ["widgets", workspace.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [workspace?.id, qc]);

  const filtered = (widgets ?? []).filter((w) => filter === "all" || w.kind === filter);
  const counts = WIDGET_KINDS.map((k) => ({
    ...k,
    count: (widgets ?? []).filter((w) => w.kind === k.kind).length,
  }));

  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto max-w-6xl px-8 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Workspace</div>
            <h1 className="mt-2 font-display text-4xl">Dashboard</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Widgets are agent tasks that run in the background and post their output here — dashboards, files, docs, or workflows. Everything renders as ready-to-read Markdown.
            </p>
          </div>
          <button onClick={() => setRunOpen(true)} className="btn-pill" disabled={!workspace}>
            + Run widget
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          {counts.map((k) => (
            <button
              key={k.kind}
              onClick={() => setFilter(filter === k.kind ? "all" : k.kind)}
              className={`surface-panel flex items-center justify-between p-4 text-left transition ${
                filter === k.kind ? "ring-2 ring-primary" : ""
              }`}
            >
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{k.label}</div>
                <div className="font-display text-2xl">{k.count}</div>
              </div>
              <div className="text-2xl text-muted-foreground">{k.icon}</div>
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-full px-3 py-1 ${
              filter === "all" ? "bg-primary text-primary-foreground" : "border border-border-strong text-muted-foreground"
            }`}
          >
            All
          </button>
          <span className="text-muted-foreground">{filtered.length} widgets</span>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {filtered.map((w) => (
            <WidgetCard
              key={w.id}
              w={w}
              onDelete={async () => {
                await deleteWidget(w.id);
                qc.invalidateQueries({ queryKey: ["widgets", workspace?.id] });
              }}
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No widgets yet. Click <span className="text-foreground">Run widget</span> to have an agent generate a dashboard, file, doc, or workflow in the background.
            </div>
          )}
        </div>
      </div>

      {runOpen && workspace && (
        <RunWidgetDialog workspaceId={workspace.id} onClose={() => setRunOpen(false)} />
      )}
    </div>
  );
}

function WidgetCard({ w, onDelete }: { w: Widget; onDelete: () => void }) {
  const agent = AGENTS[w.agent_slug as keyof typeof AGENTS];
  const kindMeta = WIDGET_KINDS.find((k) => k.kind === w.kind);
  return (
    <article className="surface-panel flex flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3">
        <PetAvatar petId={w.agent_slug} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{w.title}</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {kindMeta?.label} · {agent?.name ?? w.agent_slug}
          </div>
        </div>
        <StatusPill status={w.status} />
        <button
          onClick={onDelete}
          className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          Delete
        </button>
      </header>
      <div className="max-h-[420px] overflow-auto p-4">
        {w.status === "running" || w.status === "pending" ? (
          <div className="text-sm text-muted-foreground">
            {agent?.name ?? "Agent"} is working on this…
          </div>
        ) : w.status === "error" ? (
          <div className="text-sm text-destructive">{w.error || "Failed."}</div>
        ) : w.content?.markdown ? (
          <Markdown>{String(w.content.markdown)}</Markdown>
        ) : (
          <div className="text-sm text-muted-foreground">No output.</div>
        )}
      </div>
    </article>
  );
}

function StatusPill({ status }: { status: Widget["status"] }) {
  const map: Record<Widget["status"], string> = {
    pending: "bg-muted text-muted-foreground",
    running: "bg-primary/15 text-primary",
    ready: "bg-emerald-500/15 text-emerald-500",
    error: "bg-destructive/15 text-destructive",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest ${map[status]}`}>
      {status}
    </span>
  );
}
