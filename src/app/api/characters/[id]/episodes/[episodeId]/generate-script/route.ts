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

  const prompt = `You are a screenplay writer for a cinematic Instagram Reels mini-series about MEN'S MENTAL HEALTH AND PORNOGRAPHY ADDICTION. The tone is raw, vulnerable, honest — Brazilian neo-realism style. This is NOT explicit content. It's about the EMOTIONAL and PSYCHOLOGICAL struggle: the shame, the compulsion, the isolation, the failed promises to yourself, the impact on relationships and self-worth. Think of it like a visual diary of someone fighting an invisible battle.

The series shows the INTERNAL experience — never explicit imagery. Focus on: the urge building, the ritual of isolation, the guilt after, the mask he puts on for others, the loneliness, the cycle. Use metaphors and emotional cinematography.

CHARACTER:
- Name: ${character.name}
- Age: ${character.age}
- Description: ${character.description_pt}
- Visual prompt base: ${charAppearance}

EPISODE ${epNum} OF 5 — NARRATIVE ARC:
${arc}

THEME/IDEA FROM THE CREATOR:
${theme}

Generate exactly 15 scenes for this episode. Each scene must have:
1. "narration" — short Brazilian Portuguese narration text (1-2 sentences, first person, raw and emotional, like he's confessing to himself). Use informal Brazilian Portuguese, natural speech patterns.
2. "description" — visual scene description in Portuguese (what we see on screen). Be specific about the environment, body language, lighting mood.
3. "image_prompt" — English prompt for AI image generation. MUST include the character's physical appearance naturally woven in. Use cinematic language: shot types (close-up, medium shot, wide shot, extreme close-up, back shot, over-the-shoulder), lighting (warm, cold, dramatic, low-key, monitor glow, phone screen light), shallow depth of field, emotional tone. Format: 16:9 widescreen cinematic. Style: Brazilian neo-realism, City of God / Elite Squad cinematography, Arri Alexa look, teal-green grading, film grain.

STRUCTURE:
- Scene 1: HOOK — grab attention immediately with a powerful visual or statement
- Scenes 2-5: Build the situation, show normalcy cracking
- Scenes 6-10: The tension escalates, the compulsion takes over
- Scenes 11-13: The climax of this episode's arc
- Scenes 14-15: Emotional aftermath / cliffhanger for next episode

RULES:
- NEVER generate explicit or sexual imagery in the prompts. Focus on the EMOTIONAL experience: faces, hands, body language, environments, lighting.
- The image prompts must show the struggle, not the act. Phone screens should be blank/glowing. Focus on the person, not what they're watching.
- Include the character's physical appearance in EVERY image prompt
- Vary shot types throughout (mix close-ups, medium shots, wide shots, detail shots)
- The narration should feel like a real Brazilian man talking honestly about his struggle

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
