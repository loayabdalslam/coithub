// Real brand SVG marks for Composio toolkits (served from the Simple Icons CDN),
// with a lucide glyph fallback for toolkits that have no brand mark.
import { useEffect, useState } from "react";
import {
  Mail,
  MessageSquare,
  FileText,
  Github,
  GitBranch,
  Calendar,
  Table,
  HardDrive,
  Trello,
  Users,
  CreditCard,
  Send,
  Cloud,
  Search,
  Video,
  Plug,
  type LucideIcon,
} from "lucide-react";

type Mark = { Icon: LucideIcon; color: string; si?: string };

// si = Simple Icons slug -> https://cdn.simpleicons.org/<si>/<hex>
const MARKS: Record<string, Mark> = {
  gmail: { Icon: Mail, color: "#ea4335", si: "gmail" },
  outlook: { Icon: Mail, color: "#0078d4", si: "maildotru" },
  slack: { Icon: MessageSquare, color: "#611f69", si: "slack" },
  discord: { Icon: MessageSquare, color: "#5865f2", si: "discord" },
  notion: { Icon: FileText, color: "#111111", si: "notion" },
  github: { Icon: Github, color: "#24292f", si: "github" },
  gitlab: { Icon: GitBranch, color: "#fc6d26", si: "gitlab" },
  linear: { Icon: GitBranch, color: "#5e6ad2", si: "linear" },
  jira: { Icon: Trello, color: "#0052cc", si: "jira" },
  trello: { Icon: Trello, color: "#0079bf", si: "trello" },
  asana: { Icon: Trello, color: "#f06a6a", si: "asana" },
  googlecalendar: { Icon: Calendar, color: "#1a73e8", si: "googlecalendar" },
  google_calendar: { Icon: Calendar, color: "#1a73e8", si: "googlecalendar" },
  calendly: { Icon: Calendar, color: "#006bff", si: "calendly" },
  googlesheets: { Icon: Table, color: "#0f9d58", si: "googlesheets" },
  googledocs: { Icon: FileText, color: "#4285f4", si: "googledocs" },
  googledrive: { Icon: HardDrive, color: "#fbbc04", si: "googledrive" },
  dropbox: { Icon: Cloud, color: "#0061ff", si: "dropbox" },
  hubspot: { Icon: Users, color: "#ff7a59", si: "hubspot" },
  salesforce: { Icon: Users, color: "#00a1e0", si: "salesforce" },
  stripe: { Icon: CreditCard, color: "#635bff", si: "stripe" },
  twitter: { Icon: Send, color: "#000000", si: "x" },
  x: { Icon: Send, color: "#000000", si: "x" },
  linkedin: { Icon: Users, color: "#0a66c2", si: "linkedin" },
  telegram: { Icon: Send, color: "#26a5e4", si: "telegram" },
  whatsapp: { Icon: Send, color: "#25d366", si: "whatsapp" },
  perplexityai: { Icon: Search, color: "#20808d", si: "perplexity" },
  serpapi: { Icon: Search, color: "#3c8dbc", si: "googlesearchconsole" },
  zoom: { Icon: Video, color: "#2d8cff", si: "zoom" },
  youtube: { Icon: Video, color: "#ff0000", si: "youtube" },
  airtable: { Icon: Table, color: "#18bfff", si: "airtable" },
  figma: { Icon: FileText, color: "#f24e1e", si: "figma" },
  clickup: { Icon: Trello, color: "#7b68ee", si: "clickup" },
  shopify: { Icon: CreditCard, color: "#7ab55c", si: "shopify" },
  supabase: { Icon: HardDrive, color: "#3ecf8e", si: "supabase" },
  openai: { Icon: Search, color: "#412991", si: "openai" },
};

export function toolkitMark(slug: string): Mark {
  return MARKS[slug?.toLowerCase()] ?? { Icon: Plug, color: "#6b7280" };
}

/** Real brand SVG URL for a toolkit slug, or null when there is no brand mark. */
export function toolkitSvgUrl(slug: string): string | null {
  const { si, color } = toolkitMark(slug);
  return si ? `https://cdn.simpleicons.org/${si}/${color.replace("#", "")}` : null;
}

export function ToolkitIcon({
  slug,
  logo,
  size = 24,
  className = "",
}: {
  slug: string;
  logo?: string | null;
  size?: number;
  className?: string;
}) {
  const { Icon, color } = toolkitMark(slug);
  const src = logo || toolkitSvgUrl(slug);
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  if (src && !failed) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded ${className}`}
        style={{ width: size, height: size, backgroundColor: `${color}14` }}
      >
        <img
          src={src}
          alt={`${slug} logo`}
          loading="lazy"
          width={Math.round(size * 0.66)}
          height={Math.round(size * 0.66)}
          style={{ width: Math.round(size * 0.66), height: Math.round(size * 0.66) }}
          onError={() => setFailed(true)}
        />
      </span>
    );
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded ${className}`}
      style={{ width: size, height: size, backgroundColor: `${color}1a`, color }}
      aria-hidden
    >
      <Icon size={Math.round(size * 0.65)} />
    </span>
  );
}
