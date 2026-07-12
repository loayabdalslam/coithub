import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useWorkspace } from "@/lib/workspace";
import { PET_LIST, PET_PROMPTS, type PetSlug } from "@/lib/pets";
import { HumanAvatar, PetAvatar } from "@/components/PetAvatar";
import {
  TASK_STATUSES,
  TASK_PRIORITIES,
  createTask,
  updateTask,
  deleteTask,
  useWorkspaceTasks,
  useWorkspaceMembers,
  type Task,
  type TaskStatus,
  type TaskPriority,
  type WorkspaceMember,
} from "@/lib/tasks";

export const Route = createFileRoute("/_authenticated/app/tasks")({
  head: () => ({ meta: [{ title: "Tasks — Coithub" }] }),
  component: TasksPage,
});

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  Low: "bg-secondary text-muted-foreground",
  Medium: "bg-primary/10 text-primary",
  High: "bg-destructive/15 text-destructive",
};

function initialsOf(name: string | null): string {
  return (name ?? "?").trim().slice(0, 2).toUpperCase() || "?";
}

function TasksPage() {
  const { data: workspace } = useWorkspace();
  const workspaceId = workspace?.id;
  const queryClient = useQueryClient();
  const { data: tasks } = useWorkspaceTasks(workspaceId);
  const { data: members } = useWorkspaceMembers(workspaceId);

  const [editing, setEditing] = useState<Task | "new" | null>(null);
  const [selected, setSelected] = useState<Task | null>(null);

  const memberMap = useMemo(() => {
    const m: Record<string, WorkspaceMember> = {};
    (members ?? []).forEach((x) => (m[x.id] = x));
    return m;
  }, [members]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["tasks", workspaceId] });

  async function move(task: Task, status: TaskStatus) {
    await updateTask(task.id, { status });
    refresh();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-6">
        <div>
          <div className="text-sm font-medium">Tasks</div>
          <div className="text-xs text-muted-foreground">
            All workspace tasks · auto-captured from chats
          </div>
        </div>
        <button
          onClick={() => setEditing("new")}
          disabled={!workspaceId}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          + New task
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid gap-4 md:grid-cols-4">
          {TASK_STATUSES.map((col) => {
            const items = (tasks ?? []).filter((t) => t.status === col);
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
                    <TaskCard
                      key={t.id}
                      task={t}
                      member={t.assigned_to ? memberMap[t.assigned_to] : undefined}
                      onOpen={() => setSelected(t)}
                      onMove={(s) => move(t, s)}
                    />
                  ))}
                  {items.length === 0 && (
                    <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-[11px] text-muted-foreground">
                      Nothing here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {editing && workspaceId && (
        <TaskFormDialog
          workspaceId={workspaceId}
          members={members ?? []}
          task={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}

      {selected && (
        <TaskDetail
          task={selected}
          member={selected.assigned_to ? memberMap[selected.assigned_to] : undefined}
          fromMember={selected.assigned_from ? memberMap[selected.assigned_from] : undefined}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditing(selected);
            setSelected(null);
          }}
          onDelete={async () => {
            await deleteTask(selected.id);
            setSelected(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function assigneeLabel(task: Task, member?: WorkspaceMember): { node: React.ReactNode } {
  if (task.assigned_to_agent && PET_LIST.includes(task.assigned_to_agent as PetSlug)) {
    const slug = task.assigned_to_agent as PetSlug;
    return {
      node: (
        <span className="flex items-center gap-1">
          <PetAvatar petId={slug} size="xs" />
          {PET_PROMPTS[slug].name}
        </span>
      ),
    };
  }
  if (member) {
    return {
      node: (
        <span className="flex items-center gap-1">
          <HumanAvatar initials={initialsOf(member.display_name)} size="xs" />
          {member.display_name ?? "Member"}
        </span>
      ),
    };
  }
  return { node: <span className="text-muted-foreground">Unassigned</span> };
}

function TaskCard({
  task,
  member,
  onOpen,
  onMove,
}: {
  task: Task;
  member?: WorkspaceMember;
  onOpen: () => void;
  onMove: (s: TaskStatus) => void;
}) {
  const a = assigneeLabel(task, member);
  return (
    <div className="rounded-md border border-border bg-surface-elevated p-3 text-sm">
      <button onClick={onOpen} className="w-full text-left">
        <div className="font-medium">{task.title}</div>
        {task.description && (
          <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{task.description}</div>
        )}
        <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{a.node}</span>
          <span className={`rounded px-1.5 py-0.5 ${PRIORITY_STYLES[task.priority]}`}>
            {task.priority}
          </span>
        </div>
        {task.due_date && (
          <div className="mt-1 text-[10px] text-muted-foreground">Due {task.due_date}</div>
        )}
        {task.source_message_id && (
          <div className="mt-1 text-[10px] text-primary">⚡ captured from chat</div>
        )}
      </button>
      <select
        value={task.status}
        onChange={(e) => onMove(e.target.value as TaskStatus)}
        className="mt-2 w-full rounded border border-border bg-background px-1.5 py-1 text-[10px]"
      >
        {TASK_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}

function TaskFormDialog({
  workspaceId,
  members,
  task,
  onClose,
  onSaved,
}: {
  workspaceId: string;
  members: WorkspaceMember[];
  task: Task | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "Backlog");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "Medium");
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");
  // Assignee is either a human (member id) or an agent (agent:slug).
  const initialAssignee = task?.assigned_to_agent
    ? `agent:${task.assigned_to_agent}`
    : task?.assigned_to ?? "";
  const [assignee, setAssignee] = useState(initialAssignee);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!title.trim()) return;
    setBusy(true);
    setErr(null);
    const isAgent = assignee.startsWith("agent:");
    const patch = {
      title: title.trim(),
      description,
      status,
      priority,
      due_date: dueDate || null,
      assigned_to: isAgent ? null : assignee || null,
      assigned_to_agent: isAgent ? assignee.slice("agent:".length) : null,
    };
    try {
      if (task) await updateTask(task.id, patch);
      else await createTask(workspaceId, patch);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-border bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl">{task ? "Edit task" : "New task"}</h2>
        <div className="mt-4 space-y-3">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            rows={4}
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-muted-foreground">
              Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Priority
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
              >
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Assigned to
              <select
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
              >
                <option value="">Unassigned</option>
                <optgroup label="People">
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name ?? "Member"}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Agents">
                  {PET_LIST.map((slug) => (
                    <option key={slug} value={`agent:${slug}`}>
                      {PET_PROMPTS[slug].name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Due date
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
              />
            </label>
          </div>
          {err && <div className="text-xs text-destructive">{err}</div>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-3 py-2 text-xs">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={busy || !title.trim()}
            className="rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Saving…" : task ? "Save changes" : "Create task"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TaskDetail({
  task,
  member,
  fromMember,
  onClose,
  onEdit,
  onDelete,
}: {
  task: Task;
  member?: WorkspaceMember;
  fromMember?: WorkspaceMember;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const a = assigneeLabel(task, member);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-auto border-l border-border bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-2xl">{task.title}</h2>
          <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] ${PRIORITY_STYLES[task.priority]}`}>
            {task.priority}
          </span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{task.status}</div>

        <div className="mt-4 whitespace-pre-wrap text-sm text-foreground">
          {task.description || <span className="text-muted-foreground">No description.</span>}
        </div>

        <dl className="mt-6 space-y-3 text-sm">
          <Field label="Assigned to">{a.node}</Field>
          <Field label="Assigned from">
            {fromMember ? (
              <span className="flex items-center gap-1">
                <HumanAvatar initials={initialsOf(fromMember.display_name)} size="xs" />
                {fromMember.display_name ?? "Member"}
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </Field>
          <Field label="Due date">{task.due_date ?? "—"}</Field>
          <Field label="Created">{new Date(task.created_at).toLocaleString()}</Field>
          <Field label="Source">
            {task.source_message_id ? "⚡ Auto-captured from chat" : "Created manually"}
          </Field>
        </dl>

        <div className="mt-8 flex gap-2">
          <button onClick={onEdit} className="rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground">
            Edit
          </button>
          <button onClick={onDelete} className="rounded-md border border-destructive px-4 py-2 text-xs text-destructive">
            Delete
          </button>
          <button onClick={onClose} className="ml-auto rounded-md border border-border px-4 py-2 text-xs">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border pb-2">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
