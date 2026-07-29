import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AGENTS, AGENT_LIST, type AgentSlug } from "@/lib/agents";
import { PetAvatar } from "@/components/PetAvatar";
import { toolkitMark } from "@/lib/composio-icons";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import hero3d from "@/assets/landing/hero-3d.jpg";
import panels3d from "@/assets/landing/panels-3d.jpg";
import mesh3d from "@/assets/landing/mesh-3d.jpg";

/* ---------------------------------------------------------------- 3D stage */

export function Hero3DStage() {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setTilt({
          x: ((e.clientY - r.top) / r.height - 0.5) * -10,
          y: ((e.clientX - r.left) / r.width - 0.5) * 14,
        });
      }}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      className="stage-3d relative mt-14 select-none"
    >
      <div
        className="relative transition-transform duration-300 ease-out will-change-transform"
        style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
      >
        <div className="surface-elevated overflow-hidden">
          <img
            src={hero3d}
            alt="Coithub AI agent hub — abstract 3D render"
            width={1280}
            height={960}
            className="h-[280px] w-full object-cover md:h-[420px]"
          />
        </div>

        <div
          className="absolute -left-6 top-10 hidden w-[230px] md:block animate-float-slow"
          style={{ transform: "translateZ(70px)" }}
        >
          <FloatingCard slug="nova" line="PRD v2 drafted · 8 stories" />
        </div>
        <div
          className="absolute -right-6 bottom-10 hidden w-[240px] md:block animate-float-slow"
          style={{ transform: "translateZ(110px)", animationDelay: "1.2s" }}
        >
          <FloatingCard slug="co" line="Gmail → draft sent · via Composio" />
        </div>
      </div>
    </div>
  );
}

function FloatingCard({ slug, line }: { slug: AgentSlug; line: string }) {
  const a = AGENTS[slug];
  return (
    <div className="surface-elevated flex items-center gap-3 p-3 shadow-lg">
      <PetAvatar petId={slug} />
      <div className="min-w-0">
        <div className="text-xs font-medium text-ink">{a.name}</div>
        <div className="truncate text-[11px] text-muted-foreground">{line}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ tools slider */

const TOOLKITS = [
  "gmail", "slack", "notion", "github", "linear", "jira", "trello", "asana",
  "googlecalendar", "googlesheets", "googledocs", "googledrive", "dropbox",
  "hubspot", "salesforce", "stripe", "twitter", "telegram", "discord",
  "zoom", "youtube", "perplexityai", "gitlab", "outlook", "calendly",
];

const TOOL_LABEL: Record<string, string> = {
  googlecalendar: "Google Calendar",
  googlesheets: "Google Sheets",
  googledocs: "Google Docs",
  googledrive: "Google Drive",
  perplexityai: "Perplexity",
  twitter: "X / Twitter",
};

const label = (s: string) =>
  TOOL_LABEL[s] ?? s.charAt(0).toUpperCase() + s.slice(1);

export function ToolsSlider() {
  return (
    <section id="tools" className="relative overflow-hidden border-t border-border py-24">
      <img
        src={mesh3d}
        alt=""
        aria-hidden
        loading="lazy"
        width={1280}
        height={960}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.12]"
      />
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <span className="badge-pill"><Sparkles className="size-3" /> Composio · 250+ tools</span>
          <h2 className="mt-6 font-display text-4xl md:text-5xl">
            Every tool your team already uses.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Connect a toolkit once — then type <span className="font-mono text-ink">!</span> in any
            channel and let <span className="font-mono text-ink">@co</span> run it for you.
          </p>
        </div>
      </div>

      <div className="relative mt-12 space-y-4">
        <ToolRow items={TOOLKITS} />
        <ToolRow items={[...TOOLKITS].reverse()} reverse />
        <div className="edge-fade pointer-events-none absolute inset-0" />
      </div>
    </section>
  );
}

function ToolRow({ items, reverse }: { items: string[]; reverse?: boolean }) {
  const doubled = [...items, ...items];
  return (
    <div className="overflow-hidden">
      <div
        className="flex w-max gap-3 animate-drift-fast"
        style={{ animationDirection: reverse ? "reverse" : "normal" }}
      >
        {doubled.map((slug, i) => {
          const { Icon, color } = toolkitMark(slug);
          return (
            <div
              key={`${slug}-${i}`}
              className="surface-panel flex shrink-0 items-center gap-2.5 px-4 py-3 transition-transform duration-300 hover:-translate-y-1"
            >
              <span
                className="flex size-8 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${color}1a` }}
              >
                <Icon className="size-4" style={{ color }} />
              </span>
              <span className="whitespace-nowrap text-sm text-ink">{label(slug)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- agent slider */

export function AgentsCarousel() {
  const slugs: AgentSlug[] = AGENT_LIST;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % slugs.length), 3200);
    return () => clearInterval(id);
  }, [paused, slugs.length]);

  const go = (d: number) => setIndex((i) => (i + d + slugs.length) % slugs.length);

  return (
    <section
      id="agents"
      className="border-t border-border bg-surface/40 py-24"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex items-end justify-between gap-6">
          <div className="max-w-2xl">
            <h2 className="font-display text-4xl md:text-5xl">Meet the roster.</h2>
            <p className="mt-4 text-muted-foreground">
              Slide through {slugs.length} specialists — mention any of them in a channel and they
              start working.
            </p>
          </div>
          <div className="hidden gap-2 md:flex">
            <button onClick={() => go(-1)} aria-label="Previous agent" className="carousel-btn">
              <ChevronLeft className="size-4" />
            </button>
            <button onClick={() => go(1)} aria-label="Next agent" className="carousel-btn">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        <div className="stage-3d relative mt-14 h-[340px]">
          {slugs.map((slug, i) => {
            const offset = ((i - index + slugs.length + slugs.length / 2) % slugs.length) - slugs.length / 2;
            if (Math.abs(offset) > 3) return null;
            const a = AGENTS[slug];
            return (
              <button
                key={slug}
                onClick={() => setIndex(i)}
                className="absolute left-1/2 top-0 w-[280px] cursor-pointer transition-all duration-500 ease-out"
                style={{
                  transform: `translateX(-50%) translateX(${offset * 190}px) translateZ(${-Math.abs(offset) * 120}px) rotateY(${offset * -18}deg) scale(${1 - Math.abs(offset) * 0.06})`,
                  opacity: 1 - Math.abs(offset) * 0.28,
                  zIndex: 10 - Math.abs(offset),
                }}
              >
                <div className="surface-elevated p-6 text-left">
                  <div className="flex items-center gap-3">
                    <PetAvatar petId={slug} size="lg" />
                    <div>
                      <div className="font-display text-xl leading-none">{a.name}</div>
                      <div className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground">
                        {a.role}
                      </div>
                    </div>
                  </div>
                  <p className="mt-4 line-clamp-3 text-sm text-muted-foreground">{a.mission}</p>
                  <div className="mt-5 flex items-center justify-between text-[11px]">
                    <span className="font-mono text-ink">@{a.slug}</span>
                    <span className="rounded-full bg-surface-strong px-2 py-0.5 text-ink">
                      {a.department}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex justify-center gap-1.5">
          {slugs.map((s, i) => (
            <button
              key={s}
              aria-label={`Show ${AGENTS[s].name}`}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-ink" : "w-1.5 bg-hairline-strong"}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------- screenshot deck */

const SHOTS = [
  { title: "Channels", copy: "Agents reply in-thread, with full context and audit trail." },
  { title: "Tasks", copy: "Every decision auto-captured into a live Kanban board." },
  { title: "Integrations", copy: "Composio toolkits, one click, shared across the workspace." },
];

export function ScreenshotDeck() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % SHOTS.length), 3600);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="border-t border-border py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 md:grid-cols-[1fr_1.25fr]">
        <div>
          <h2 className="font-display text-4xl md:text-5xl">See the system running.</h2>
          <p className="mt-4 text-muted-foreground">
            A workspace that thinks: channels, threads, tasks, shared memory and tools — all in one
            surface.
          </p>
          <ul className="mt-8 space-y-2">
            {SHOTS.map((s, i) => (
              <li key={s.title}>
                <button
                  onClick={() => setActive(i)}
                  className={`w-full rounded-xl border p-4 text-left transition-colors ${
                    i === active
                      ? "border-hairline-strong bg-white"
                      : "border-transparent hover:bg-surface-strong/60"
                  }`}
                >
                  <div className="text-sm font-medium text-ink">{s.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{s.copy}</div>
                </button>
              </li>
            ))}
          </ul>
          <Link to="/auth" className="btn-pill mt-8 inline-flex">Try it free</Link>
        </div>

        <div className="stage-3d">
          <div
            className="relative transition-transform duration-700 ease-out"
            style={{ transform: `rotateY(-14deg) rotateX(6deg) translateZ(${active * 10}px)` }}
          >
            <div className="surface-elevated overflow-hidden">
              <img
                src={panels3d}
                alt="Coithub workspace panels"
                loading="lazy"
                width={1280}
                height={960}
                className="w-full object-cover"
              />
            </div>
            <div className="absolute -bottom-6 -left-6 hidden w-[220px] md:block">
              <div className="surface-elevated p-4 shadow-lg animate-float-slow">
                <div className="caption-label">Now</div>
                <div className="mt-2 text-sm text-ink">{SHOTS[active].title}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{SHOTS[active].copy}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
