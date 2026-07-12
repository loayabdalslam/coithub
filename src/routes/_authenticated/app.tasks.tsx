import { createFileRoute } from "@tanstack/react-router";
import { TASKS } from "@/lib/mock-data";

const COLUMNS = ["Backlog", "In progress", "Blocked", "Done"] as const;

export const Route = createFileRoute("/_authenticated/app/tasks")({
  head: () => ({ meta: [{ title: "Tasks — Coithub" }] }),
  component: TasksPage,
});

function TasksPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-6">
        <div>
          <div className="text-sm font-medium">Tasks</div>
          <div className="text-xs text-muted-foreground">All workspace tasks</div>
        </div>
        <button className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground opacity-60" disabled>
          + New task
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid gap-4 md:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = TASKS.filter((t) => t.status === col);
            return (
              <div key={col} className="surface-panel min-h-[400px] p-3">
                <div className="mb-3 flex items-center justify-between px-1">
                  <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    {col}
                  </span>
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((t) => (
                    <div key={t.id} className="rounded-md border border-border bg-surface-elevated p-3 text-sm">
                      <div className="text-[10px] font-mono text-muted-foreground">{t.id}</div>
                      <div className="mt-0.5">{t.title}</div>
                      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{t.owner}</span>
                        <span className="rounded bg-secondary px-1.5 py-0.5">{t.priority}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
