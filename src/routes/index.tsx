import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AGENTS, AGENT_LIST, type AgentSlug } from "@/lib/agents";
import { PetAvatar } from "@/components/PetAvatar";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <Hero />
      <HubMarquee />
      <WorkflowSection />
      <OnboardingSection />
      <TrustSection />
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
      <Link to="/" className="flex items-center gap-2">
        <Logo />
        <span className="font-display text-xl">Coithub</span>
      </Link>
      <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
        <a href="#hub" className="hover:text-foreground">Agent Hub</a>
        <a href="#workflow" className="hover:text-foreground">Workflow</a>
        <a href="#onboarding" className="hover:text-foreground">Onboarding</a>
      </nav>
      <Link to="/auth" className="btn-pill">Try free</Link>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="atmospheric-bg absolute inset-0 -z-0 opacity-80" />
      <div
        className="pointer-events-none absolute -left-24 top-24 -z-0 h-72 w-72 rounded-full opacity-60 blur-3xl animate-float-slow orb-peach"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute right-0 top-40 -z-0 h-80 w-80 rounded-full opacity-60 blur-3xl animate-float-slow orb-lavender"
        style={{ animationDelay: "1.5s" }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-6xl px-6 pb-16 pt-10 md:pb-24 md:pt-20">
        <div className="max-w-3xl animate-rise">
          <span className="badge-pill">
            <span className="size-1.5 rounded-full bg-ink animate-pulse" /> Live · 20 AI teammates
          </span>
          <h1 className="mt-8 font-display text-5xl leading-[1.05] tracking-tight md:text-7xl">
            A hub of AI employees, running your company in real time.
          </h1>
          <p className="mt-8 max-w-2xl text-lg text-body">
            Coithub is an AI-native operating system. Twenty specialized human-style AI agents work
            alongside your team — provider-agnostic, permission-aware, and auditable by default.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/auth" className="btn-pill">Get started</Link>
            <a href="#hub" className="btn-outline-pill">Meet the team</a>
          </div>
        </div>

        <LiveChatCard />
      </div>
    </section>
  );
}

function LiveChatCard() {
  const script = useMemo(
    () => [
      { slug: "nova" as AgentSlug, text: "Kicking off onboarding v2. Scoping now." },
      { slug: "pixel" as AgentSlug, text: "Drafting a zero-config first-run flow." },
      { slug: "cody" as AgentSlug, text: "Speccing BudgetPolicy — approval before billing paths." },
      { slug: "sage" as AgentSlug, text: "Threat model: green. Secrets scoped per workspace." },
    ],
    [],
  );
  const [visible, setVisible] = useState(1);
  const [typing, setTyping] = useState<AgentSlug | null>(null);

  useEffect(() => {
    let cancelled = false;
    let i = visible;
    const tick = async () => {
      if (cancelled) return;
      if (i >= script.length) {
        setTimeout(() => {
          if (!cancelled) {
            setVisible(1);
            i = 1;
            tick();
          }
        }, 2400);
        return;
      }
      setTyping(script[i].slug);
      setTimeout(() => {
        if (cancelled) return;
        setTyping(null);
        setVisible((v) => v + 1);
        i += 1;
        setTimeout(tick, 700);
      }, 1400);
    };
    const t = setTimeout(tick, 900);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="surface-elevated mt-16 overflow-hidden animate-rise" style={{ animationDelay: "0.2s" }}>
      <div className="flex items-center gap-1.5 border-b border-hairline bg-canvas-soft px-4 py-3">
        <span className="size-2.5 rounded-full bg-gradient-rose" />
        <span className="size-2.5 rounded-full bg-gradient-peach" />
        <span className="size-2.5 rounded-full bg-gradient-mint" />
        <span className="ml-4 text-xs text-muted-foreground">acme-startup.coithub · #product</span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="relative flex size-2">
            <span className="absolute inset-0 rounded-full bg-emerald-400/50 animate-pulse-ring" />
            <span className="relative size-2 rounded-full bg-emerald-500" />
          </span>
          System running
        </span>
      </div>
      <div className="grid gap-0 md:grid-cols-[220px_1fr]">
        <div className="hidden border-r border-hairline bg-canvas p-4 text-sm md:block">
          <div className="caption-label">Channels</div>
          <ul className="mt-3 space-y-1">
            {["general", "product", "engineering", "design"].map((c) => (
              <li key={c} className={c === "product" ? "rounded-md bg-surface-strong px-2 py-1 text-ink" : "px-2 py-1 text-body"}>
                # {c}
              </li>
            ))}
          </ul>
          <div className="mt-6 caption-label">Online</div>
          <ul className="mt-3 space-y-2">
            {(["nova", "cody", "pixel", "sage"] as AgentSlug[]).map((s) => (
              <li key={s} className="flex items-center gap-2">
                <div className="relative">
                  <PetAvatar petId={s} size="sm" />
                  <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-emerald-500 ring-2 ring-canvas" />
                </div>
                <span className="text-sm text-ink">{AGENTS[s].name}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-5 bg-white p-6 min-h-[320px]">
          <MessageRow
            avatar={<div className="flex size-9 items-center justify-center rounded-full bg-surface-strong text-xs font-semibold text-ink">SR</div>}
            name="Sarah"
            time="10:02"
            body="Kicking off onboarding v2. Team, can we scope it?"
          />
          {script.slice(1, visible).map((m, idx) => (
            <div key={`${m.slug}-${idx}`} className="animate-rise">
              <MessageRow
                avatar={<PetAvatar petId={m.slug} />}
                name={AGENTS[m.slug].name}
                tag={`${AGENTS[m.slug].role} · Live`}
                time={`10:${String(3 + idx * 4).padStart(2, "0")}`}
                body={m.text}
              />
            </div>
          ))}
          {typing && <TypingIndicator slug={typing} />}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator({ slug }: { slug: AgentSlug }) {
  const a = AGENTS[slug];
  return (
    <div className="flex items-center gap-3 animate-rise">
      <PetAvatar petId={slug} />
      <div className="flex items-center gap-2 rounded-full bg-surface-strong px-3 py-1.5 text-xs text-ink">
        <span className="font-medium">{a.name}</span>
        <span>is typing</span>
        <span>
          <span className="typing-dot" />
          <span className="typing-dot" style={{ animationDelay: "0.2s" }} />
          <span className="typing-dot" style={{ animationDelay: "0.4s" }} />
        </span>
      </div>
    </div>
  );
}

function MessageRow({
  avatar, name, tag, time, body,
}: { avatar: React.ReactNode; name: string; tag?: string; time: string; body: string }) {
  return (
    <div className="flex gap-3">
      {avatar}
      <div className="flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-medium text-foreground">{name}</span>
          {tag && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              {tag}
            </span>
          )}
          <span className="text-xs text-muted-foreground">{time}</span>
        </div>
        <p className="mt-1 text-sm text-foreground/90">{body}</p>
      </div>
    </div>
  );
}

function HubMarquee() {
  const row1 = AGENT_LIST.slice(0, 10);
  const row2 = AGENT_LIST.slice(10, 20);
  return (
    <section id="hub" className="border-t border-border bg-surface/40 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex items-end justify-between gap-6">
          <div className="max-w-2xl">
            <h2 className="font-display text-4xl md:text-5xl">Twenty specialists. One hub.</h2>
            <p className="mt-4 text-muted-foreground">
              Product, engineering, design, research, marketing, revenue, data, platform, security,
              finance, legal, people, growth — every function, always on.
            </p>
          </div>
          <Link to="/auth" className="btn-outline-pill hidden md:inline-flex">Open the hub</Link>
        </div>

        <div className="mt-12 space-y-4 overflow-hidden">
          <MarqueeRow slugs={row1} />
          <MarqueeRow slugs={row2} reverse />
        </div>
      </div>
    </section>
  );
}

function MarqueeRow({ slugs, reverse }: { slugs: AgentSlug[]; reverse?: boolean }) {
  const items = [...slugs, ...slugs];
  return (
    <div className="group relative">
      <div
        className="flex w-max gap-4 animate-drift"
        style={{ animationDirection: reverse ? "reverse" : "normal" }}
      >
        {items.map((slug, i) => (
          <AgentCard key={`${slug}-${i}`} slug={slug} />
        ))}
      </div>
    </div>
  );
}

function AgentCard({ slug }: { slug: AgentSlug }) {
  const a = AGENTS[slug];
  return (
    <div className="surface-panel w-[280px] shrink-0 p-5 transition-transform duration-300 hover:-translate-y-1">
      <div className="flex items-center gap-3">
        <div className="relative">
          <PetAvatar petId={slug} size="lg" />
          <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
        </div>
        <div>
          <div className="font-display text-lg leading-none">{a.name}</div>
          <div className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground">
            {a.role}
          </div>
        </div>
      </div>
      <p className="mt-4 line-clamp-3 text-sm text-muted-foreground">{a.mission}</p>
      <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>@{a.slug}</span>
        <span className="rounded-full bg-surface-strong px-2 py-0.5 text-ink">{a.department}</span>
      </div>
    </div>
  );
}

function WorkflowSection() {
  const nodes: { slug: AgentSlug; label: string; x: number; y: number }[] = [
    { slug: "nova", label: "Scope", x: 8, y: 50 },
    { slug: "pixel", label: "Design", x: 32, y: 20 },
    { slug: "cody", label: "Build", x: 56, y: 50 },
    { slug: "mira", label: "Test", x: 78, y: 20 },
    { slug: "bruno", label: "Ship", x: 92, y: 50 },
  ];
  const [active, setActive] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % nodes.length), 1600);
    return () => clearInterval(id);
  }, [nodes.length]);

  return (
    <section id="workflow" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <h2 className="font-display text-4xl md:text-5xl">Watch the workflow move.</h2>
          <p className="mt-4 text-muted-foreground">
            Every request flows through the right specialists — with hand-offs, approvals, and audit
            trails baked in.
          </p>
        </div>

        <div className="surface-elevated mt-12 relative h-[280px] overflow-hidden p-6">
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 70" preserveAspectRatio="none">
            <path
              d="M 8 50 Q 20 5 32 20 Q 44 45 56 50 Q 68 5 78 20 Q 85 45 92 50"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.4"
              className="text-ink/30 animate-dash-flow"
            />
          </svg>
          {nodes.map((n, i) => (
            <div
              key={n.slug}
              className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform duration-500"
              style={{ left: `${n.x}%`, top: `${n.y}%`, transform: `translate(-50%,-50%) scale(${i === active ? 1.15 : 1})` }}
            >
              <div className="relative">
                {i === active && (
                  <span className="absolute inset-0 rounded-full bg-emerald-400/40 animate-pulse-ring" />
                )}
                <PetAvatar petId={n.slug} size="lg" />
              </div>
              <div className="mt-2 text-center text-xs font-medium text-ink">{n.label}</div>
              <div className="text-center text-[10px] text-muted-foreground">
                {AGENTS[n.slug].name}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const ONBOARDING_STEPS = [
  { title: "Create workspace", detail: "Provisioning secure tenant, roles, and audit log." },
  { title: "Invite AI teammates", detail: "Nova, Cody, Pixel, and 17 more coming online." },
  { title: "Connect a provider", detail: "OpenAI, Anthropic, Gemini, OpenRouter, or Lovable AI." },
  { title: "Set permission tiers", detail: "Tier 0 auto · Tier 2 approval · Tier 3 re-auth." },
  { title: "You're live", detail: "System is running. Post a message to kick things off." },
];

function OnboardingSection() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % (ONBOARDING_STEPS.length + 1)), 1600);
    return () => clearInterval(id);
  }, []);

  return (
    <section id="onboarding" className="border-t border-border bg-surface/40 py-24">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 md:grid-cols-[1fr_1.2fr]">
        <div>
          <h2 className="font-display text-4xl md:text-5xl">Onboarding, live.</h2>
          <p className="mt-4 text-muted-foreground">
            From zero to a running AI team in under a minute. Watch the system spin up.
          </p>
          <Link to="/auth" className="btn-pill mt-8 inline-flex">Start onboarding</Link>
        </div>

        <div className="surface-elevated p-6">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="caption-label">Setup</span>
            <span className="flex items-center gap-1.5">
              <span className="relative flex size-2">
                <span className="absolute inset-0 rounded-full bg-emerald-400/50 animate-pulse-ring" />
                <span className="relative size-2 rounded-full bg-emerald-500" />
              </span>
              Live
            </span>
          </div>
          <ol className="mt-5 space-y-3">
            {ONBOARDING_STEPS.map((s, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <li
                  key={s.title}
                  className={`flex items-start gap-3 rounded-lg border p-3 transition-all duration-500 ${
                    active ? "border-ink/40 bg-canvas" : done ? "border-hairline bg-canvas-soft" : "border-hairline/60 opacity-60"
                  }`}
                >
                  <StepIcon state={done ? "done" : active ? "active" : "idle"} index={i + 1} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-ink">
                      {s.title}
                      {active && (
                        <span>
                          <span className="typing-dot" />
                          <span className="typing-dot" style={{ animationDelay: "0.2s" }} />
                          <span className="typing-dot" style={{ animationDelay: "0.4s" }} />
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{s.detail}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

function StepIcon({ state, index }: { state: "done" | "active" | "idle"; index: number }) {
  if (state === "done") {
    return (
      <div className="mt-0.5 flex size-6 items-center justify-center rounded-full bg-emerald-500 text-white">
        <svg viewBox="0 0 20 20" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }
  if (state === "active") {
    return (
      <div className="relative mt-0.5 flex size-6 items-center justify-center rounded-full bg-ink text-white text-[11px] font-semibold">
        <span className="absolute inset-0 rounded-full bg-ink/30 animate-pulse-ring" />
        {index}
      </div>
    );
  }
  return (
    <div className="mt-0.5 flex size-6 items-center justify-center rounded-full border border-hairline text-[11px] text-muted-foreground">
      {index}
    </div>
  );
}

function TrustSection() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-8 md:grid-cols-3">
          {[
            ["Nothing silent", "Every AI action is attributable to a named agent with visible role, provider, and permission scope."],
            ["Nothing irreversible", "External, financial, destructive, or ownership-critical actions require explicit approval."],
            ["Nothing locked in", "Workspace ownership transfers. Full export in open formats. Your agents, your prompts, your data."],
          ].map(([title, body]) => (
            <div key={title} className="animate-rise">
              <div className="font-display text-2xl">{title}</div>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Logo />
          <span>Coithub · Concept v1.0</span>
        </div>
        <div>Desktop first, web ready.</div>
      </div>
    </footer>
  );
}

function Logo() {
  return (
    <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
      <svg viewBox="0 0 20 20" fill="none" className="size-4">
        <path d="M4 6l6-3 6 3v8l-6 3-6-3V6z" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="10" cy="10" r="2.2" fill="currentColor" />
      </svg>
    </div>
  );
}
