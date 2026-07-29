import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { HumanAvatar, PetAvatar } from "@/components/PetAvatar";
import { Markdown } from "@/components/Markdown";
import { detectMentionedPets, PET_LIST, PET_PROMPTS, type PetSlug } from "@/lib/pets";
import { invokePet } from "@/lib/pets.functions";
import { useWorkspace } from "@/lib/workspace";
import { usePetConfigs } from "@/lib/pet-configs";
import { RunWidgetDialog } from "@/components/RunWidgetDialog";
import { useChannelTasks, type Task } from "@/lib/tasks";
import { listWorkspaceTools, connectToolkit, refreshIntegration } from "@/lib/composio.functions";
import { RECOMMENDED_TOOLKITS, COMPOSIO_SIGNUP_URL } from "@/lib/composio-util";
import { ToolkitIcon } from "@/lib/composio-icons";

type Message = {
  id: string;
  channel_id: string;
  author_id: string | null;
  pet_id: string | null;
  body: string;
  created_at: string;
  parent_id: string | null;
};

type Profile = { id: string; display_name: string | null; avatar_url: string | null };

export const Route = createFileRoute("/_authenticated/app/channels/$channelId")({
  head: () => ({ meta: [{ title: "Channel — Coithub" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    thread: typeof search.thread === "string" ? search.thread : undefined,
  }),
  component: ChannelView,
  errorComponent: ({ error }) => (
    <div className="p-10 text-destructive">Failed to load channel: {error.message}</div>
  ),
});

function ChannelView() {
  const { channelId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const queryClient = useQueryClient();
  const [threadParentId, setThreadParentId] = useState<string | null>(null);
  const [tasksOpen, setTasksOpen] = useState(false);

  const { data: channel } = useQuery({
    queryKey: ["channel", channelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channels")
        .select("id, name, topic, workspace_id")
        .eq("id", channelId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["messages", channelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, channel_id, author_id, pet_id, body, created_at, parent_id")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: true })
        .limit(400);
      if (error) throw error;
      return data as Message[];
    },
  });

  const topLevel = (messages ?? []).filter((m) => !m.parent_id);
  const replyCounts = new Map<string, number>();
  for (const m of messages ?? []) {
    if (m.parent_id) replyCounts.set(m.parent_id, (replyCounts.get(m.parent_id) ?? 0) + 1);
  }

  const authorIds = Array.from(
    new Set(
      (messages ?? [])
        .map((m) => m.author_id)
        .filter((id): id is string => typeof id === "string"),
    ),
  );
  const { data: profiles } = useQuery({
    queryKey: ["profiles", authorIds.sort().join(",")],
    enabled: authorIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", authorIds);
      if (error) throw error;
      const map: Record<string, Profile> = {};
      (data ?? []).forEach((p) => (map[p.id] = p));
      return map;
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`messages:${channelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["messages", channelId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [channelId, queryClient]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  // Keep direct links from the Threads/Mentions pages in sync with the side panel.
  useEffect(() => setThreadParentId(search.thread ?? null), [channelId, search.thread]);

  function openThread(parentId: string) {
    setThreadParentId(parentId);
    navigate({ search: { thread: parentId } });
  }

  function closeThread() {
    setThreadParentId(null);
    navigate({ search: {}, replace: true });
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-6">
          <div>
            <div className="text-sm font-medium">
              <span className="text-muted-foreground">#</span> {channel?.name ?? "…"}
            </div>
            <div className="text-xs text-muted-foreground">{channel?.topic}</div>
          </div>
          <button
            onClick={() => setTasksOpen((v) => !v)}
            className={`rounded-md border px-2.5 py-1.5 text-xs ${
              tasksOpen
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-secondary"
            }`}
            title="Task updates captured in this channel"
          >
            ✓ Tasks
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-auto px-6 py-6">
          {topLevel.length === 0 ? (
            <div className="mx-auto max-w-md py-20 text-center text-muted-foreground">
              <div className="font-display text-2xl text-foreground">#{channel?.name}</div>
              <p className="mt-2 text-sm">
                This channel is quiet. Say hi below to get things started.
              </p>
            </div>
          ) : (
            <ul className="space-y-5">
              {topLevel.map((m) => (
                <MessageRow
                  key={m.id}
                  m={m}
                  profiles={profiles}
                  replyCount={replyCounts.get(m.id) ?? 0}
                  onOpenThread={() => openThread(m.id)}
                />
              ))}
            </ul>
          )}
        </div>

        <Composer
          channelId={channelId}
          channelName={channel?.name ?? ""}
          workspaceId={channel?.workspace_id ?? ""}
          parentId={null}
        />
      </div>

      {threadParentId && (
        <ThreadPanel
          channelId={channelId}
          workspaceId={channel?.workspace_id ?? ""}
          channelName={channel?.name ?? ""}
          parentId={threadParentId}
          allMessages={messages ?? []}
          profiles={profiles}
          onClose={closeThread}
        />
      )}

      {tasksOpen && <ChannelTasksWidget channelId={channelId} onClose={() => setTasksOpen(false)} />}
    </div>
  );
}

function MessageRow({
  m,
  profiles,
  replyCount,
  onOpenThread,
}: {
  m: Message;
  profiles: Record<string, Profile> | undefined;
  replyCount: number;
  onOpenThread: () => void;
}) {
  const time = new Date(m.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (m.pet_id) {
    const pet = PET_PROMPTS[m.pet_id as PetSlug];
    return (
      <li className="group flex gap-3">
        <PetAvatar petId={m.pet_id as PetSlug} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-medium">{pet?.name ?? m.pet_id}</span>
            <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              AI Agent · {pet?.role}
            </span>
            <span className="text-xs text-muted-foreground">{time}</span>
          </div>
          <div className="mt-1"><Markdown>{m.body}</Markdown></div>
          <ThreadAffordance replyCount={replyCount} onOpenThread={onOpenThread} />
        </div>
      </li>
    );
  }
  const p = m.author_id ? profiles?.[m.author_id] : null;
  const name = p?.display_name ?? "Someone";
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <li className="group flex gap-3">
      <HumanAvatar initials={initials} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-medium">{name}</span>
          <span className="text-xs text-muted-foreground">{time}</span>
        </div>
        <div className="mt-1"><Markdown>{m.body}</Markdown></div>
        <ThreadAffordance replyCount={replyCount} onOpenThread={onOpenThread} />
      </div>
    </li>
  );
}

function ThreadAffordance({
  replyCount,
  onOpenThread,
}: {
  replyCount: number;
  onOpenThread: () => void;
}) {
  return (
    <button
      onClick={onOpenThread}
      className="mt-1 text-[11px] text-muted-foreground transition hover:text-primary"
    >
      {replyCount > 0
        ? `💬 ${replyCount} ${replyCount === 1 ? "reply" : "replies"} in thread`
        : "💬 Reply in thread"}
    </button>

  );
}

function ThreadPanel({
  channelId,
  workspaceId,
  channelName,
  parentId,
  allMessages,
  profiles,
  onClose,
}: {
  channelId: string;
  workspaceId: string;
  channelName: string;
  parentId: string;
  allMessages: Message[];
  profiles: Record<string, Profile> | undefined;
  onClose: () => void;
}) {
  const parent = allMessages.find((m) => m.id === parentId);
  const replies = allMessages.filter((m) => m.parent_id === parentId);
  const threadPets = Array.from(
    new Set(
      [parent, ...replies]
        .filter((m): m is Message => Boolean(m))
        .map((m) => m.pet_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  return (
    <aside className="flex w-[420px] shrink-0 flex-col border-l border-border bg-surface">
      <div className="flex h-12 items-center justify-between border-b border-border px-4">
        <div className="text-sm font-medium">Thread</div>
        <button
          onClick={onClose}
          className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-secondary"
        >
          Close
        </button>
      </div>
      <div className="flex-1 overflow-auto px-4 py-4">
        {parent && (
          <div className="border-b border-border pb-4">
            <MessageRow
              m={parent}
              profiles={profiles}
              replyCount={0}
              onOpenThread={() => {}}
            />
          </div>
        )}
        <ul className="mt-4 space-y-4">
          {replies.map((m) => (
            <MessageRow key={m.id} m={m} profiles={profiles} replyCount={0} onOpenThread={() => {}} />
          ))}
        </ul>
      </div>
      <Composer
        channelId={channelId}
        channelName={`${channelName} thread`}
        workspaceId={workspaceId}
        parentId={parentId}
        threadPets={threadPets}
      />
    </aside>
  );
}

function Composer({
  channelId,
  channelName,
  workspaceId,
  parentId,
  threadPets,
}: {
  channelId: string;
  channelName: string;
  workspaceId: string;
  parentId: string | null;
  threadPets?: string[];
}) {
  const { data: workspace } = useWorkspace();
  const { data: configs } = usePetConfigs(workspaceId || undefined);
  const autoRespond = workspace?.auto_respond !== false;
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState<PetSlug | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [toolQuery, setToolQuery] = useState<string | null>(null);
  const [toolIndex, setToolIndex] = useState(0);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [pending, setPending] = useState<{ toolkit: string; prompt: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();
  const invoke = useServerFn(invokePet);
  const fetchTools = useServerFn(listWorkspaceTools);
  const startConnect = useServerFn(connectToolkit);
  const checkConnect = useServerFn(refreshIntegration);

  // CO is the built-in Composio operator: always mentionable in every workspace.
  const hiredPets = Array.from(
    new Set<PetSlug>([
      "co" as PetSlug,
      ...(configs ?? [])
        .filter((c) => c.enabled)
        .map((c) => c.pet_slug as PetSlug)
        .filter((slug) => PET_LIST.includes(slug)),
    ]),
  );

  const { data: toolData } = useQuery({
    queryKey: ["composio-palette", workspaceId],
    enabled: !!workspaceId,
    staleTime: 5 * 60_000,
    queryFn: async () => (await fetchTools({ data: { workspaceId } })).toolkits,
  });

  // Usage counts are kept per workspace in localStorage so the palette can rank
  // "top used" tools first, before falling back to the curated recommendations.
  const usageKey = `co-tool-usage:${workspaceId}`;
  function readUsage(): Record<string, number> {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(window.localStorage.getItem(usageKey) ?? "{}") as Record<string, number>;
    } catch {
      return {};
    }
  }
  function bumpUsage(slug: string) {
    if (typeof window === "undefined") return;
    const u = readUsage();
    u[slug] = (u[slug] ?? 0) + 1;
    window.localStorage.setItem(usageKey, JSON.stringify(u));
  }

  const connectedToolkits = new Set((toolData ?? []).map((g) => g.toolkit));
  const paletteTools = (toolData ?? []).flatMap((g) =>
    g.tools.map((t) => ({ ...t, toolkit: g.toolkit })),
  );
  const usage = typeof window === "undefined" ? {} : readUsage();
  const rankedTools = [...paletteTools].sort(
    (a, b) => (usage[b.slug] ?? 0) - (usage[a.slug] ?? 0),
  );
  const toolMatches =
    toolQuery === null
      ? []
      : (toolQuery.trim() === "" ? rankedTools : rankedTools.filter((t) =>
            `${t.toolkit} ${t.label} ${t.slug}`.toLowerCase().includes(toolQuery.toLowerCase()),
          ))
          .slice(0, 40);

  // Recommendations shown when a popular toolkit isn't connected yet: picking one
  // starts the Composio authorisation flow and remembers the prompt to run after.
  const recommended = RECOMMENDED_TOOLKITS.filter(
    (r) => !connectedToolkits.has(r.slug),
  ).filter((r) =>
    toolQuery ? `${r.slug} ${r.label}`.toLowerCase().includes(toolQuery.toLowerCase()) : true,
  );




  const mentionMatches =
    mentionQuery === null
      ? []
      : hiredPets.filter(
          (slug) =>
            slug.toLowerCase().includes(mentionQuery.toLowerCase()) ||
            PET_PROMPTS[slug].name.toLowerCase().includes(mentionQuery.toLowerCase()),
        );

  function handleBodyChange(value: string, selectionStart: number) {
    setBody(value);
    const before = value.slice(0, selectionStart);
    const match = before.match(/(?:^|\s)@(\w*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
    const bang = before.match(/(?:^|\s)!([\w ]*)$/);
    if (bang && !match) {
      setToolQuery(bang[1]);
      setToolIndex(0);
    } else {
      setToolQuery(null);
    }
  }

  function insertToolPrompt(example: string, slug?: string) {
    if (slug) bumpUsage(slug);
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? body.length;
    const before = body.slice(0, caret);
    const after = body.slice(caret);
    const newBefore = before.replace(/(^|\s)!([\w ]*)$/, `$1${example}`);
    setBody(newBefore + after);
    setToolQuery(null);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(newBefore.length, newBefore.length);
    });
  }

  /**
   * A recommended toolkit isn't authorised yet: kick off the Composio OAuth
   * flow, drop the permission link into the channel, then poll the connection
   * and auto-run the requested prompt once access is granted.
   */
  async function requestAccess(toolkit: string, label: string, prompt: string) {
    setConnecting(toolkit);
    setErr(null);
    setToolQuery(null);
    try {
      const { redirectUrl, status } = await startConnect({ data: { workspaceId, toolkit } });
      if (status === "ACTIVE") {
        await sendText(prompt);
        return;
      }
      setPending({ toolkit, prompt });
      await sendText(
        `🔐 **${label} access needed** — authorise Composio here: ${redirectUrl ?? COMPOSIO_SIGNUP_URL}\n\nOnce you approve it, I'll automatically run: _${prompt}_`,
        { skipAgents: true },
      );
      // Poll the Composio connection until the user finishes the grant.
      for (let i = 0; i < 75; i++) {
        await new Promise((r) => setTimeout(r, 4000));
        const res = await checkConnect({ data: { workspaceId, toolkit } });
        if (res.status === "ACTIVE") {
          setPending(null);
          queryClient.invalidateQueries({ queryKey: ["composio-palette", workspaceId] });
          await sendText(`✅ ${label} connected. Running your request now.`, { skipAgents: true });
          await sendText(prompt);
          return;
        }
      }
      setErr(`Still waiting for ${label} access. Re-run the tool once you've approved it.`);
    } catch (e) {
      setErr(
        e instanceof Error
          ? `${e.message} — register a Composio API key at ${COMPOSIO_SIGNUP_URL}`
          : String(e),
      );
    } finally {
      setConnecting(null);
    }
  }


  function insertMention(slug: PetSlug) {
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? body.length;
    const before = body.slice(0, caret);
    const after = body.slice(caret);
    const newBefore = before.replace(/(^|\s)@(\w*)$/, `$1@${slug} `);
    const next = newBefore + after;
    setBody(next);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = newBefore.length;
      el?.setSelectionRange(pos, pos);
    });
  }


  async function send(e: FormEvent) {
    e.preventDefault();
    await sendText(body);
  }

  async function sendText(raw: string, opts?: { skipAgents?: boolean }) {
    const text = raw.trim();
    if (!text || sending) return;
    setSending(true);
    setErr(null);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setErr("Not signed in");
      setSending(false);
      return;
    }
    const idem = crypto.randomUUID();
    const { data: inserted, error } = await supabase
      .from("messages")
      .insert({
        channel_id: channelId,
        author_id: userData.user.id,
        body: text,
        idempotency_key: idem,
        parent_id: parentId,
      })
      .select("id")
      .single();
    if (error) {
      setErr(error.message);
      setSending(false);
      return;
    }
    setBody("");
    setMentionQuery(null);
    setToolQuery(null);
    queryClient.invalidateQueries({ queryKey: ["messages", channelId] });
    setSending(false);

    const mentioned = detectMentionedPets(text);
    const enabledPets = (configs ?? []).filter((c) => c.enabled).map((c) => c.pet_slug);
    // Priority: explicit @mentions. Inside a thread with no mention, reply with
    // the agents already participating in that thread so conversations continue.
    // Otherwise fall back to auto-respond (all hired agents).
    const threadResponders = (threadPets ?? []).filter(
      (p): p is PetSlug => PET_LIST.includes(p as PetSlug) && enabledPets.includes(p as PetSlug),
    );
    const pets =
      mentioned.length > 0
        ? mentioned.filter((p) => enabledPets.includes(p))
        : parentId && threadResponders.length > 0
          ? threadResponders
          : autoRespond
            ? enabledPets
            : [];

    if (pets.length > 0 && inserted) {
      // Sequential typing: one agent at a time with a small "thinking" delay
      for (const pet of pets) {
        setTyping(pet);
        // Simulated typing latency (feels human, ~600–1100ms) before real call
        await new Promise((r) => setTimeout(r, 700 + Math.random() * 500));
        try {
          await invoke({
            data: {
              channelId,
              pet,
              triggerMessageId: inserted.id,
              parentId: parentId,
            },
          });
        } catch (petErr) {
          setErr(petErr instanceof Error ? petErr.message : String(petErr));
        }
      }
      setTyping(null);
      queryClient.invalidateQueries({ queryKey: ["messages", channelId] });
      queryClient.invalidateQueries({ queryKey: ["channel-tasks", channelId] });
    }
  }

  return (
    <div className="shrink-0 border-t border-border bg-background p-4">
      <form onSubmit={send} className="surface-panel relative flex items-end gap-3 p-3">
        {toolQuery !== null && (
          <div className="absolute bottom-full left-0 mb-2 w-96 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              <span>Import a tool · CO runs it</span>
              <span>{paletteTools.length} available</span>
            </div>
            {toolMatches.length > 0 ? (
              <ul className="max-h-72 overflow-auto py-1">
                {toolMatches.map((t, i) => (
                  <li key={t.slug}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        insertToolPrompt(t.example);
                      }}
                      onMouseEnter={() => setToolIndex(i)}
                      className={`flex w-full items-start gap-2 px-3 py-2 text-left ${
                        i === toolIndex ? "bg-secondary" : "hover:bg-secondary"
                      }`}
                    >
                      <ToolkitIcon slug={t.toolkit} size={22} className="mt-0.5" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{t.label}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {t.toolkit} · {t.description || t.slug}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-primary">
                          {t.example}…
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-3 py-3 text-xs text-muted-foreground">
                {paletteTools.length === 0
                  ? "No Composio tools connected yet. An admin can add the Composio API key and authorise apps in Settings → Integrations."
                  : "No tool matches that."}
              </div>
            )}
          </div>
        )}

        {mentionQuery !== null && (
          <div className="absolute bottom-full left-0 mb-2 w-72 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
            <div className="border-b border-border px-3 py-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              Mention an agent
            </div>
            {mentionMatches.length > 0 ? (
              <ul className="max-h-64 overflow-auto py-1">
                {mentionMatches.map((slug, i) => (
                  <li key={slug}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        insertMention(slug);
                      }}
                      onMouseEnter={() => setMentionIndex(i)}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                        i === mentionIndex ? "bg-secondary" : "hover:bg-secondary"
                      }`}
                    >
                      <PetAvatar petId={slug} size="xs" />
                      <span className="font-medium">{PET_PROMPTS[slug].name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        @{slug} · {PET_PROMPTS[slug].role}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-3 py-3 text-xs text-muted-foreground">
                {hiredPets.length === 0
                  ? "No agents hired in this workspace yet. Add agents from the Agents Hub to mention them."
                  : "No hired agents match that name."}
              </div>
            )}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => handleBodyChange(e.target.value, e.target.selectionStart)}
          onKeyDown={(e) => {
            if (toolQuery !== null && toolMatches.length > 0) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setToolIndex((i) => (i + 1) % toolMatches.length);
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setToolIndex((i) => (i - 1 + toolMatches.length) % toolMatches.length);
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                insertToolPrompt(toolMatches[toolIndex].example);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setToolQuery(null);
                return;
              }
            }
            if (mentionQuery !== null && mentionMatches.length > 0) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setMentionIndex((i) => (i + 1) % mentionMatches.length);
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setMentionIndex((i) => (i - 1 + mentionMatches.length) % mentionMatches.length);
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                insertMention(mentionMatches[mentionIndex]);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setMentionQuery(null);
                return;
              }
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(e as unknown as FormEvent);
            }
          }}
          className="max-h-40 min-h-[60px] flex-1 resize-none bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
          placeholder={parentId ? "Reply in thread…  (@ agents · ! tools)" : `Message #${channelName}   —  @ to mention, ! to import a tool`}
        />

        <button
          type="button"
          onClick={() => setWidgetOpen(true)}
          className="rounded-md border border-border-strong px-2 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
          title="Run as background widget"
        >
          ⊕ Widget
        </button>
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {sending ? "…" : "Send"}
        </button>
      </form>
      {widgetOpen && workspaceId && (
        <RunWidgetDialog
          workspaceId={workspaceId}
          defaultPrompt={body}
          onClose={() => setWidgetOpen(false)}
        />
      )}
      {typing && (
        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          <PetAvatar petId={typing} size="xs" />
          <span className="font-medium text-foreground">{PET_PROMPTS[typing].name}</span>
          <span>is typing</span>
          <TypingDots />
        </div>
      )}
      {err && <div className="mt-2 text-[11px] text-destructive">{err}</div>}
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-0.5">
      <span className="size-1 animate-pulse rounded-full bg-primary [animation-delay:0ms]" />
      <span className="size-1 animate-pulse rounded-full bg-primary [animation-delay:150ms]" />
      <span className="size-1 animate-pulse rounded-full bg-primary [animation-delay:300ms]" />
    </span>
  );
}

const TASK_STATUS_STYLES: Record<Task["status"], string> = {
  Backlog: "bg-secondary text-muted-foreground",
  "In progress": "bg-primary/10 text-primary",
  Blocked: "bg-destructive/15 text-destructive",
  Done: "bg-emerald-500/15 text-emerald-600",
};

function ChannelTasksWidget({ channelId, onClose }: { channelId: string; onClose: () => void }) {
  const { data: tasks, isLoading } = useChannelTasks(channelId);
  return (
    <div className="flex w-80 shrink-0 flex-col border-l border-border bg-surface">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="text-sm font-medium">Task updates</div>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-auto p-3">
        {isLoading ? (
          <div className="py-10 text-center text-xs text-muted-foreground">Loading…</div>
        ) : (tasks ?? []).length === 0 ? (
          <div className="py-10 text-center text-xs text-muted-foreground">
            No tasks captured from this channel yet. Agents add them automatically as work comes up.
          </div>
        ) : (
          <ul className="space-y-2">
            {(tasks ?? []).map((t) => {
              const agent = t.assigned_to_agent && PET_LIST.includes(t.assigned_to_agent as PetSlug)
                ? (t.assigned_to_agent as PetSlug)
                : null;
              return (
                <li key={t.id} className="rounded-md border border-border bg-surface-elevated p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] ${TASK_STATUS_STYLES[t.status]}`}>
                      {t.status}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{t.priority}</span>
                  </div>
                  <div className="mt-1.5 text-sm font-medium">{t.title}</div>
                  {t.description && (
                    <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {t.description}
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                    {agent ? (
                      <span className="flex items-center gap-1">
                        <PetAvatar petId={agent} size="xs" />
                        {PET_PROMPTS[agent].name}
                      </span>
                    ) : (
                      <span>Unassigned</span>
                    )}
                    {t.due_date && <span>Due {t.due_date}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
