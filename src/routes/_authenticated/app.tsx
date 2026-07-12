import { createFileRoute, Link, Outlet, useMatchRoute, useNavigate } from "@tanstack/react-router";
import { AGENTS } from "@/lib/agents";
import { PetAvatar, HumanAvatar } from "@/components/PetAvatar";
import { cn } from "@/lib/utils";
import {
  useWorkspace,
  useChannels,
  createChannel,
  createInvite,
  inviteUrl,
} from "@/lib/workspace";
import { usePetConfigs } from "@/lib/pet-configs";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/app")({
  component: WorkspaceShell,
});

function WorkspaceShell() {
  const { data: workspace, isLoading, error } = useWorkspace();
  const navigate = useNavigate();

  useEffect(() => {
    // No workspace selected (or selection no longer valid) → go pick one.
    if (!isLoading && !error && !workspace) {
      navigate({ to: "/workspaces", replace: true });
    }
  }, [isLoading, error, workspace, navigate]);

  useEffect(() => {
    if (workspace && !workspace.onboarded_at) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [workspace, navigate]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading workspace…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-sm text-destructive">
        Failed to load workspace: {error?.message ?? "unknown"}
      </div>
    );
  }
  if (!workspace) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Choosing a workspace…
      </div>
    );
  }
  if (!workspace.onboarded_at) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Redirecting to setup…
      </div>
    );
  }


  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      <TopBar workspaceName={workspace.name} workspaceId={workspace.id} />
      <div className="flex min-h-0 flex-1">
        <Sidebar workspaceId={workspace.id} />
        <main className="flex min-w-0 flex-1 flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function TopBar({ workspaceName, workspaceId }: { workspaceName: string; workspaceId: string }) {
  const navigate = useNavigate();
  const [initials, setInitials] = useState("··");
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const name =
        (data.user?.user_metadata?.full_name as string | undefined) ||
        data.user?.email ||
        "";
      setInitials(
        name
          .split(/\s+|@/)[0]
          .slice(0, 2)
          .toUpperCase() || "··",
      );
    });
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <svg viewBox="0 0 20 20" fill="none" className="size-3.5">
              <path d="M4 6l6-3 6 3v8l-6 3-6-3V6z" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="10" cy="10" r="2.2" fill="currentColor" />
            </svg>
          </div>
          <span className="font-display text-sm">Coithub</span>
        </Link>
        <span className="text-xs text-muted-foreground">/</span>
        <span className="rounded px-2 py-1 text-sm">{workspaceName}</span>
        <Link
          to="/workspaces"
          className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          Switch
        </Link>
      </div>
      <div className="flex flex-1 justify-center">
        <div className="flex w-full max-w-lg items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground">
          <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="9" cy="9" r="6" />
            <path d="M14 14l3 3" />
          </svg>
          <span>Search messages, tasks, decisions…</span>
          <span className="ml-auto rounded border border-border-strong bg-surface px-1.5 py-0.5 text-[10px]">⌘K</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setInviteOpen(true)}
          className="rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20"
        >
          Invite people
        </button>
        <Link
          to="/app/settings/keys"
          className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          API keys
        </Link>
        <Link
          to="/app/settings/pets"
          className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          Models
        </Link>
        <button
          onClick={signOut}
          className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          Sign out
        </button>
        <HumanAvatar initials={initials} size="sm" />
      </div>
      {inviteOpen && (
        <InviteDialog workspaceId={workspaceId} onClose={() => setInviteOpen(false)} />
      )}
    </header>
  );
}

function InviteDialog({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      setBusy(true);
      try {
        const inv = await createInvite(workspaceId);
        setLink(inviteUrl(inv.token));
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    })();
  }, [workspaceId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="surface-panel w-full max-w-md p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Invite people
            </div>
            <h2 className="mt-1 font-display text-xl">Share this link</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary"
          >
            Close
          </button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Anyone with this link can join your workspace as a member. Valid for 14 days,
          up to 25 uses.
        </p>
        <div className="mt-4">
          {busy && <p className="text-sm text-muted-foreground">Creating link…</p>}
          {err && <p className="text-sm text-destructive">{err}</p>}
          {link && (
            <div className="flex gap-2">
              <input
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-xs"
              />
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(link);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const NAV: { label: string; icon: string; to?: "/app/tasks" | "/app/pets" | "/app/dashboard" | "/app/decisions" }[] = [
  { label: "Threads", icon: "💬" },
  { label: "Mentions", icon: "@" },
  { label: "Tasks", to: "/app/tasks", icon: "◇" },
  { label: "Agents", to: "/app/pets", icon: "◈" },
  { label: "Dashboard", to: "/app/dashboard", icon: "▤" },
  { label: "Decisions", to: "/app/decisions", icon: "✓" },
];

function Sidebar({ workspaceId }: { workspaceId: string }) {
  const matchRoute = useMatchRoute();
  const { data: channels } = useChannels(workspaceId);
  const { data: configs } = usePetConfigs(workspaceId);
  const [newChannelOpen, setNewChannelOpen] = useState(false);

  const hired = (configs ?? [])
    .map((c) => AGENTS[c.pet_slug as keyof typeof AGENTS])
    .filter(Boolean);

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <nav className="space-y-0.5 p-3 text-sm">
        {NAV.map((item) => {
          const active = item.to ? !!matchRoute({ to: item.to }) : false;
          const content = (
            <span
              className={cn(
                "flex items-center gap-2 rounded px-2 py-1.5 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                active && "bg-sidebar-accent text-sidebar-accent-foreground",
              )}
            >
              <span className="w-4 text-center text-xs text-muted-foreground">{item.icon}</span>
              {item.label}
            </span>
          );
          return item.to ? (
            <Link key={item.label} to={item.to}>
              {content}
            </Link>
          ) : (
            <div key={item.label}>{content}</div>
          );
        })}
      </nav>

      <SidebarSection
        title="Channels"
        action={
          <button
            onClick={() => setNewChannelOpen(true)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="New channel"
          >
            +
          </button>
        }
      >
        {(channels ?? []).map((c) => {
          const active = !!matchRoute({ to: "/app/channels/$channelId", params: { channelId: c.id } });
          return (
            <Link
              key={c.id}
              to="/app/channels/$channelId"
              params={{ channelId: c.id }}
              className={cn(
                "flex items-center gap-1 rounded px-2 py-1 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                active && "bg-sidebar-accent text-sidebar-accent-foreground",
              )}
            >
              <span className="text-muted-foreground">#</span>
              {c.name}
            </Link>
          );
        })}
        {channels && channels.length === 0 && (
          <div className="px-2 py-1 text-xs text-muted-foreground">No channels yet</div>
        )}
      </SidebarSection>

      <SidebarSection
        title="Your Agents"
        action={
          <Link to="/app/pets" className="text-muted-foreground hover:text-foreground">
            +
          </Link>
        }
      >
        {hired.length === 0 ? (
          <Link
            to="/app/pets"
            className="block rounded px-2 py-1 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            Pick agents in the Hub →
          </Link>
        ) : (
          <>
            {hired.slice(0, 8).map((p) => (
              <Link
                key={p.slug}
                to="/app/pets"
                className="flex items-center gap-2 rounded px-2 py-1 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <PetAvatar petId={p.slug} size="xs" />
                {p.name}
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {p.role.split(" ")[0]}
                </span>
              </Link>
            ))}
            <Link
              to="/app/pets"
              className="mt-1 block rounded px-2 py-1 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              Browse all 20 agents →
            </Link>
          </>
        )}
      </SidebarSection>

      <div className="mt-auto border-t border-sidebar-border p-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-primary" />
          Live · realtime enabled
        </div>
      </div>
      {newChannelOpen && (
        <NewChannelDialog workspaceId={workspaceId} onClose={() => setNewChannelOpen(false)} />
      )}
    </aside>
  );
}

function NewChannelDialog({
  workspaceId,
  onClose,
}: {
  workspaceId: string;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const ch = await createChannel(workspaceId, name, topic);
      await qc.invalidateQueries({ queryKey: ["channels", workspaceId] });
      onClose();
      navigate({ to: "/app/channels/$channelId", params: { channelId: ch.id } });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form onSubmit={submit} className="surface-panel w-full max-w-md p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Create channel
            </div>
            <h2 className="mt-1 font-display text-xl">New channel</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary"
          >
            Close
          </button>
        </div>
        <label className="mt-4 block text-xs text-muted-foreground">Name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. product"
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <label className="mt-3 block text-xs text-muted-foreground">Topic (optional)</label>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="What is this channel for?"
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        {err && <div className="mt-3 text-xs text-destructive">{err}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-outline-pill"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || busy}
            className="btn-pill disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create channel"}
          </button>
        </div>
      </form>
    </div>
  );
}

function SidebarSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-sidebar-border px-3 py-3">
      <div className="mb-2 flex items-center justify-between px-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        <span>{title}</span>
        {action}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
