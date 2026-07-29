// Icons + colors for Composio toolkits, so the integrations gallery and the
// "!" tool palette show a recognisable mark even when Composio has no logo URL.
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

type Mark = { Icon: LucideIcon; color: string };

const MARKS: Record<string, Mark> = {
  gmail: { Icon: Mail, color: "#ea4335" },
  outlook: { Icon: Mail, color: "#0078d4" },
  slack: { Icon: MessageSquare, color: "#611f69" },
  discord: { Icon: MessageSquare, color: "#5865f2" },
  notion: { Icon: FileText, color: "#111111" },
  github: { Icon: Github, color: "#24292f" },
  gitlab: { Icon: GitBranch, color: "#fc6d26" },
  linear: { Icon: GitBranch, color: "#5e6ad2" },
  jira: { Icon: Trello, color: "#0052cc" },
  trello: { Icon: Trello, color: "#0079bf" },
  asana: { Icon: Trello, color: "#f06a6a" },
  googlecalendar: { Icon: Calendar, color: "#1a73e8" },
  google_calendar: { Icon: Calendar, color: "#1a73e8" },
  calendly: { Icon: Calendar, color: "#006bff" },
  googlesheets: { Icon: Table, color: "#0f9d58" },
  googledocs: { Icon: FileText, color: "#4285f4" },
  googledrive: { Icon: HardDrive, color: "#fbbc04" },
  dropbox: { Icon: Cloud, color: "#0061ff" },
  hubspot: { Icon: Users, color: "#ff7a59" },
  salesforce: { Icon: Users, color: "#00a1e0" },
  stripe: { Icon: CreditCard, color: "#635bff" },
  twitter: { Icon: Send, color: "#1d9bf0" },
  telegram: { Icon: Send, color: "#26a5e4" },
  perplexityai: { Icon: Search, color: "#20808d" },
  serpapi: { Icon: Search, color: "#3c8dbc" },
  zoom: { Icon: Video, color: "#2d8cff" },
  youtube: { Icon: Video, color: "#ff0000" },
};

export function toolkitMark(slug: string): Mark {
  return MARKS[slug?.toLowerCase()] ?? { Icon: Plug, color: "#6b7280" };
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
  if (logo) {
    return (
      <img
        src={logo}
        alt={`${slug} logo`}
        loading="lazy"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={`shrink-0 rounded ${className}`}
      />
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
