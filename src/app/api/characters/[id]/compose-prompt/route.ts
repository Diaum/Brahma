import { supabase } from "@/lib/supabase";
import { translateScene, composeFullPrompt } from "@/lib/prompt-generator";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { prompt_scene } = body;

  if (!prompt_scene) {
    return NextResponse.json(
      { error: "prompt_scene é obrigatório" },
      { status: 400 }
    );
  }

  const { data: character, error } = await supabase
    .from("characters")
    .select("prompt_base_en")
    .eq("id", id)
    .single();

  if (error || !character) {
    return NextResponse.json(
      { error: "Personagem não encontrado" },
      { status: 404 }
    );
  }

  const sceneEn = await translateScene(prompt_scene);
  const prompt_full = composeFullPrompt(character.prompt_base_en, sceneEn);

  return NextResponse.json({ prompt_full, scene_en: sceneEn });
}
