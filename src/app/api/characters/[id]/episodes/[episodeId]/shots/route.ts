import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; episodeId: string }> }
) {
  const { episodeId } = await params;

  const { data, error } = await supabase
    .from("shots")
    .select("*")
    .eq("episode_id", episodeId)
    .order("order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; episodeId: string }> }
) {
  const { episodeId } = await params;
  const body = await request.json();
  const { prompt_scene, prompt_full, reference_image_url, order } = body;

  if (!prompt_scene || !prompt_full) {
    return NextResponse.json(
      { error: "prompt_scene e prompt_full sao obrigatorios" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("shots")
    .insert({
      episode_id: episodeId,
      prompt_scene,
      prompt_full,
      reference_image_url: reference_image_url || null,
      order: order ?? 0,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
