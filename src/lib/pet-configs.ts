// Workspace-scoped list of AI agents the workspace has explicitly added
// from the Agents Hub.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PET_LIST, PET_PROMPTS, type PetSlug } from "./pets";
import { DEFAULT_MODEL, providerForModel, type ProviderId } from "./providers";

export type PetConfig = {
  workspace_id: string;
  pet_slug: PetSlug;
  provider: ProviderId;
  model: string;
  enabled: boolean;
  custom_system: string | null;
};

export function defaultConfigsForWorkspace(_workspaceId: string): PetConfig[] {
  return [];
}

export async function fetchPetConfigs(workspaceId: string): Promise<PetConfig[]> {
  const { data, error } = await supabase
    .from("pet_configs")
    .select("workspace_id, pet_slug, provider, model, enabled, custom_system")
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  return (data ?? []).filter((r) => PET_LIST.includes(r.pet_slug as PetSlug)) as PetConfig[];
}

export async function addAgentToWorkspace(
  workspaceId: string,
  agentSlug: PetSlug,
): Promise<void> {
  const { error } = await supabase.from("pet_configs").upsert(
    {
      workspace_id: workspaceId,
      pet_slug: agentSlug,
      provider: providerForModel(DEFAULT_MODEL),
      model: DEFAULT_MODEL,
      enabled: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id,pet_slug" },
  );
  if (error) throw error;
}

export async function removeAgentFromWorkspace(
  workspaceId: string,
  agentSlug: PetSlug,
): Promise<void> {
  const { error } = await supabase
    .from("pet_configs")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("pet_slug", agentSlug);
  if (error) throw error;
}

export async function savePetConfigs(configs: PetConfig[]): Promise<void> {
  if (configs.length === 0) return;
  const rows = configs.map((c) => ({
    workspace_id: c.workspace_id,
    pet_slug: c.pet_slug,
    provider: c.provider,
    model: c.model,
    enabled: c.enabled,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from("pet_configs")
    .upsert(rows, { onConflict: "workspace_id,pet_slug" });
  if (error) throw error;
}

export async function markWorkspaceOnboarded(workspaceId: string): Promise<void> {
  const { error } = await supabase
    .from("workspaces")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", workspaceId);
  if (error) throw error;
}

export function usePetConfigs(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["pet_configs", workspaceId],
    enabled: !!workspaceId,
    queryFn: () => fetchPetConfigs(workspaceId!),
  });
}

export function petMeta(slug: PetSlug) {
  return PET_PROMPTS[slug];
}
