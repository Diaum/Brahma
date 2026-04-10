import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

// Returns lightweight summary: { episodeId: { total, approved } }
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Get all episodes for this character
  const { data: eps, error: epsError } = await supabase
    .from("episodes")
    .select("id")
    .eq("character_id", id);

  if (epsError) {
    return NextResponse.json({ error: epsError.message }, { status: 500 });
  }

  if (!eps || eps.length === 0) {
    return NextResponse.json({});
  }

  const epIds = eps.map((e) => e.id);

  // Get only id, status, episode_id of all shots — much lighter than full payload
  const { data: shots, error: shotsError } = await supabase
    .from("shots")
    .select("id, status, episode_id")
    .in("episode_id", epIds);

  if (shotsError) {
    return NextResponse.json({ error: shotsError.message }, { status: 500 });
  }

  const summary: Record<string, { total: number; approved: number }> = {};
  for (const epId of epIds) {
    summary[epId] = { total: 0, approved: 0 };
  }

  for (const shot of shots || []) {
    if (!summary[shot.episode_id]) continue;
    summary[shot.episode_id].total++;
    if (shot.status === "approved" || shot.status === "animated") {
      summary[shot.episode_id].approved++;
    }
  }

  return NextResponse.json(summary);
}
