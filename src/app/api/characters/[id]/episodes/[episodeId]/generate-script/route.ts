import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

const EPISODE_ARCS: Record<number, string> = {
  1: "The beginning of the conflict — the character faces temptation and loses. Start with a normal, seemingly happy moment (HOOK), then gradually build tension as the urge takes over. End with the character giving in.",
  2: "Consequences — guilt, emptiness, shame. The character deals with the aftermath of what happened in EP1. Emotional weight, isolation, trying to act normal but failing inside.",
  3: "Attempt to stop — and failure. The character tries to resist, makes promises to himself, uses strategies to avoid falling again. But the tension builds until he breaks again.",
  4: "Rock bottom — the lowest point. Everything collapses. The addiction/conflict affects relationships, self-image, daily life. The character is at his worst, hopeless.",
  5: "The turning point — recovery begins. A moment of clarity, seeking help, a small victory. Not a fairy tale ending, but a real, raw first step toward change.",
};

export async function POST(
  request: Request,
  {
    params,
  }: { params: Promise<{ id: string; episodeId: string }> }
) {
  const { id, episodeId } = await params;
  const body = await request.json();
  const { theme, episode_number } = body;

  if (!theme) {
    return NextResponse.json(
      { error: "Tema e obrigatorio" },
      { status: 400 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY nao configurada" },
      { status: 500 }
    );
  }

  // Get character info
  const { data: character, error: charError } = await supabase
    .from("characters")
    .select("name, age, description_pt, prompt_base_en")
    .eq("id", id)
    .single();

  if (charError || !character) {
    return NextResponse.json(
      { error: "Personagem nao encontrado" },
      { status: 404 }
    );
  }

  const epNum = Math.min(Math.max(episode_number || 1, 1), 5);
  const arc = EPISODE_ARCS[epNum] || EPISODE_ARCS[1];

  // Extract character appearance from prompt_base_en (first sentence)
  const charAppearance = character.prompt_base_en
    .split("\n")[0]
    ?.replace(/\.\s*$/, "") || character.prompt_base_en.slice(0, 300);

  const prompt = `You are a screenplay writer for a cinematic Instagram Reels mini-series. You write in a raw, emotional, Brazilian neo-realism style.

CHARACTER:
- Name: ${character.name}
- Age: ${character.age}
- Description: ${character.description_pt}
- Visual prompt base: ${charAppearance}

EPISODE ${epNum} OF 5:
Narrative arc: ${arc}

THEME/IDEA FROM THE CREATOR:
${theme}

Generate exactly 15 scenes for this episode. Each scene must have:
1. "narration" — short Brazilian Portuguese narration text (1-2 sentences, raw and emotional, first person)
2. "description" — visual scene description in Portuguese (what we see on screen)
3. "image_prompt" — English prompt for AI image generation. MUST include the character's appearance naturally. Use cinematic language: shot types (close-up, medium shot, wide shot, extreme close-up, back shot), lighting (warm, cold, dramatic, low-key), depth of field, emotional tone. Format: 16:9 widescreen cinematic.

The first scene should be a HOOK — something that grabs attention immediately.
The last 2-3 scenes should be the emotional climax and resolution for this episode's arc.
Build tension gradually through the middle scenes.

IMPORTANT:
- The image prompts must be detailed and cinematic, suitable for AI image generation
- Include the character's physical appearance in EVERY image prompt
- Vary shot types (don't use only close-ups)
- The narration should feel like a real person talking, raw and vulnerable

Respond ONLY with a valid JSON array. No markdown, no explanation. Format:
[{"narration":"...","description":"...","image_prompt":"..."},...]`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("[generate-script] Gemini error:", errText);
      return NextResponse.json(
        { error: `Erro na API Gemini: ${res.status}` },
        { status: 500 }
      );
    }

    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    // Parse JSON from response (strip markdown code fences if present)
    let scenes;
    try {
      const jsonStr = text
        .replace(/^```json?\s*/i, "")
        .replace(/```\s*$/, "")
        .trim();
      scenes = JSON.parse(jsonStr);
    } catch {
      console.error("[generate-script] Failed to parse:", text.slice(0, 500));
      return NextResponse.json(
        { error: "Erro ao interpretar resposta da IA" },
        { status: 500 }
      );
    }

    if (!Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma cena gerada" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      episode_id: episodeId,
      character_name: character.name,
      episode_number: epNum,
      scenes,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[generate-script] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
