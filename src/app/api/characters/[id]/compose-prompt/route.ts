import { supabase } from "@/lib/supabase";
import { translateScene, composeFullPrompt } from "@/lib/prompt-generator";
import { NextResponse } from "next/server";

function makeYoungPrompt(promptBaseEn: string): string {
  // Transform adult character prompt into younger version
  // Replace age references and add young traits
  let young = promptBaseEn
    .replace(/\d+-year-old/gi, "young late-teens")
    .replace(/unshaven stubble beard/gi, "clean-shaven young face")
    .replace(/stubble/gi, "clean-shaven")
    .replace(/beard/gi, "")
    .replace(/messy greasy hair/gi, "shorter neat hair")
    .replace(/dark circles under his eyes/gi, "youthful eyes")
    .replace(/hopeless defeated gaze/gi, "curious but uncertain gaze")
    .replace(/defeated posture/gi, "slightly slouched youthful posture")
    .replace(/bony arms/gi, "thin young arms");

  // Add young descriptors if not present
  if (!young.includes("younger")) {
    young = young.replace(
      "Cinematic still frame of",
      "Cinematic still frame of a younger version of the same character,"
    );
  }

  return young;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { prompt_scene, episode_number } = body;

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

  // For EP2: use younger version of the character
  const isEp2 = episode_number === 2;
  const basePrompt = isEp2
    ? makeYoungPrompt(character.prompt_base_en)
    : character.prompt_base_en;

  // Translate scene from PT to EN
  const sceneEn = await translateScene(prompt_scene);

  // Compose: character appearance + translated scene + cinematic style
  const prompt_full = composeFullPrompt(basePrompt, sceneEn);

  return NextResponse.json({
    prompt_full,
    scene_en: sceneEn,
  });
}
