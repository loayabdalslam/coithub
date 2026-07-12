import { cn } from "@/lib/utils";
import { AGENTS, AGENT_IMAGES } from "@/lib/agents";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const sizeMap: Record<Size, string> = {
  xs: "size-5 text-[9px]",
  sm: "size-7 text-[10px]",
  md: "size-9 text-xs",
  lg: "size-12 text-sm",
  xl: "size-20 text-base",
};

export function PetAvatar({ petId, size = "md" }: { petId: string; size?: Size }) {
  const agent = AGENTS[petId as keyof typeof AGENTS];
  const src = AGENT_IMAGES[petId];
  const label = agent ? `${agent.name} — ${agent.role}` : petId;
  if (!src) {
    // Fallback initials chip
    const initials = (agent?.name ?? petId).slice(0, 2).toUpperCase();
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full font-medium text-white ring-1 ring-border",
          sizeMap[size],
        )}
        style={{ backgroundColor: agent?.color ?? "#888" }}
        title={label}
      >
        {initials}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={label}
      loading="lazy"
      width={512}
      height={512}
      className={cn("shrink-0 rounded-full object-cover ring-1 ring-border", sizeMap[size])}
      style={{ backgroundColor: agent?.color }}
      title={label}
    />
  );
}

export function HumanAvatar({
  initials,
  size = "md",
}: {
  initials: string;
  size?: Size;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-secondary-foreground",
        sizeMap[size],
      )}
    >
      {initials}
    </div>
  );
}

// Legacy alias used by mock data lists.
export const PET_IMAGES = AGENT_IMAGES;
