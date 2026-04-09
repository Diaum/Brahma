import { supabase } from "./supabase";

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function getCharacterSlug(characterId: string): Promise<string> {
  const { data } = await supabase
    .from("characters")
    .select("name")
    .eq("id", characterId)
    .single();
  return data?.name ? slugify(data.name) : characterId.slice(0, 8);
}

interface ShotContext {
  characterSlug: string;
  episodeNumber: number;
  shotNumber: number;
}

export async function getShotContext(shotId: string): Promise<ShotContext | null> {
  const { data: shot } = await supabase
    .from("shots")
    .select("episode_id, order")
    .eq("id", shotId)
    .single();

  if (!shot) return null;

  // Get episode + character
  const { data: ep } = await supabase
    .from("episodes")
    .select("character_id, order")
    .eq("id", shot.episode_id)
    .single();

  if (!ep) return null;

  const characterSlug = await getCharacterSlug(ep.character_id);

  // Episode order is 0-indexed, but we want 1-indexed for filenames
  const episodeNumber = (ep.order ?? 0) + 1;

  // Shot number is its index within the episode (sorted by order)
  const { data: epShots } = await supabase
    .from("shots")
    .select("id, order")
    .eq("episode_id", shot.episode_id)
    .order("order", { ascending: true });

  const shotIdx = epShots?.findIndex((s) => s.id === shotId) ?? 0;
  const shotNumber = shotIdx + 1;

  return { characterSlug, episodeNumber, shotNumber };
}
