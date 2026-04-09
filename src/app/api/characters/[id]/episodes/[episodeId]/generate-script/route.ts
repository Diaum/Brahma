import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

const EPISODE_ARCS: Record<number, string> = {
  1: "The beginning of the conflict — the character faces temptation and loses. Start with a normal, seemingly happy moment (HOOK), then gradually build tension as the urge takes over. End with the character giving in.",
  2: "ORIGIN STORY — This episode shows the CHARACTER AS A YOUNGER VERSION OF HIMSELF. We go back in time to show how the compulsive digital habit started. The first time he discovered something online that felt forbidden, the curiosity, the confusion, the secrecy. Show the loss of innocence through metaphor and emotion. Flashback scenes of a younger version — same features but younger face, shorter hair, clean-shaven. Mix between the past (younger self) and brief flashes of the present (adult) to show the connection across time.",
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

  // Sanitize theme to avoid triggering content filters
  const sanitizedTheme = theme
    .replace(/pornografi[ao]/gi, "conteudo adulto online")
    .replace(/porn[ôo]/gi, "conteudo adulto")
    .replace(/sexu/gi, "compulsivo")
    .replace(/masturba[çc]/gi, "habito compulsivo")
    .replace(/vício/gi, "dependencia")
    .replace(/vicio/gi, "dependencia");

  // Extract character appearance from prompt_base_en (first sentence)
  const charAppearance = character.prompt_base_en
    .split("\n")[0]
    ?.replace(/\.\s*$/, "") || character.prompt_base_en.slice(0, 300);

  // For EP2: create a younger version of the character
  const youngCharAppearance = epNum === 2
    ? `Younger version of the same character (late teens), same facial features but younger — shorter hair, rounder younger face, clean-shaven, thinner frame, slightly shorter, wearing casual clothes. Same skin tone and eye color as the adult version.`
    : null;

  const prompt = `You are a screenplay writer for a cinematic Instagram Reels mini-series about a man's battle with a compulsive digital behavior — a screen dependency that became a hidden habit controlling his life. This is a MENTAL HEALTH awareness story. The tone is raw, vulnerable, honest — Brazilian neo-realism style.

This is about the EMOTIONAL and PSYCHOLOGICAL journey: the shame of a secret habit, the compulsive need to isolate, the guilt afterward, the broken promises to himself, the impact on self-worth and relationships. Think of it as a visual confession — someone fighting an invisible battle that nobody around him sees.

The series focuses on the INTERNAL experience through cinematic metaphors. Show: the tension building inside, the ritual of sneaking away to be alone with a screen, the empty feeling after, the mask he wears for others, the loneliness of a secret life. NEVER show what's on any screen — screens are always blank, glowing, or turned away from camera. Focus entirely on the PERSON: their face, hands, body language, eyes, breathing, posture, environment.

CHARACTER:
- Name: ${character.name}
- Age: ${character.age}
- Description: ${character.description_pt}
- Visual prompt base (adult): ${charAppearance}${youngCharAppearance ? `
- Visual prompt base (YOUNGER VERSION): ${youngCharAppearance}
- NOTE: This episode explores the character's past. Most scenes show the younger version. Use the adult version only in 2-3 present-day reflection moments. Always specify which version in the image_prompt.` : ""}

EPISODE ${epNum} OF 5 — NARRATIVE ARC:
${arc}

THEME/IDEA FROM THE CREATOR:
${sanitizedTheme}

Generate exactly 15 scenes for this episode. Each scene must have:
1. "narration" — short Brazilian Portuguese narration text (1-2 sentences, first person, raw and emotional, like he's confessing). Informal Brazilian Portuguese, natural speech.
2. "description" — visual scene description in Portuguese (what we see on screen). Be specific about environment, body language, lighting mood.
3. "image_prompt" — English prompt for AI image generation. Include the character's physical appearance naturally. Use cinematic language: shot types (close-up, medium shot, wide shot, extreme close-up, back shot), lighting (warm, cold, dramatic, low-key, screen glow), shallow depth of field, emotional tone. Format: 16:9 widescreen cinematic. Style: Brazilian neo-realism, City of God / Elite Squad cinematography, Arri Alexa, teal-green grading, film grain.

STRUCTURE:
- Scene 1: HOOK — grab attention with a powerful visual or statement
- Scenes 2-5: Build the situation, show normalcy cracking
- Scenes 6-10: Tension escalates, the compulsion takes over
- Scenes 11-13: Climax of this episode's arc
- Scenes 14-15: Emotional aftermath / cliffhanger

CRITICAL RULES:
- ALL image prompts must be SAFE FOR WORK. No suggestive content whatsoever.
- Show the PERSON and their EMOTIONS, never screen content
- Screens in images: always blank white/blue glow, or phone face-down, or seen from behind
- Focus on: faces, hands, eyes, posture, environments, lighting, shadows
- Include character appearance in EVERY image prompt
- Vary shot types (mix close-ups, medium shots, wide shots, detail shots)

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
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
          ],
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

    // Check for safety blocks or empty response
    if (!data?.candidates?.length) {
      const blockReason = data?.promptFeedback?.blockReason || "unknown";
      console.error("[generate-script] No candidates. Block reason:", blockReason, JSON.stringify(data).slice(0, 500));
      return NextResponse.json(
        { error: `Roteiro bloqueado pela IA (${blockReason}). Tente reformular o tema.` },
        { status: 500 }
      );
    }

    const finishReason = data.candidates[0]?.finishReason;
    if (finishReason === "SAFETY") {
      console.error("[generate-script] Blocked by safety filter");
      return NextResponse.json(
        { error: "Roteiro bloqueado pelo filtro de seguranca. Tente reformular o tema." },
        { status: 500 }
      );
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    if (!text) {
      console.error("[generate-script] Empty response. Finish reason:", finishReason);
      return NextResponse.json(
        { error: "Resposta vazia da IA. Tente novamente." },
        { status: 500 }
      );
    }

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
        { error: "Erro ao interpretar resposta da IA. Tente novamente." },
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
