import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

const MIN_SLIDES = 4;
const MAX_SLIDES = 8;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { text, max_pages, theme_hint } = body;

  if (!text || typeof text !== "string" || text.trim().length < 20) {
    return NextResponse.json(
      { error: "Texto e obrigatorio (minimo 20 caracteres)" },
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

  // Sanitize input to avoid content filter triggers
  const sanitizedText = text
    .replace(/pornografi[ao]/gi, "conteudo adulto online")
    .replace(/porn[ôo]/gi, "conteudo adulto")
    .replace(/masturba[çc][aã]o?/gi, "habito compulsivo")
    .replace(/vicio/gi, "dependencia")
    .replace(/v[ií]cio/gi, "dependencia");

  const maxPages = Math.min(Math.max(max_pages || MAX_SLIDES, MIN_SLIDES), MAX_SLIDES);

  // Get character for context
  const { data: character } = await supabase
    .from("characters")
    .select("name, age, description_pt")
    .eq("id", id)
    .single();

  const charContext = character
    ? `Character for imagery: ${character.name}, ${character.age} anos. ${character.description_pt}`
    : "";

  const prompt = `Voce e um social media manager especializado em saude masculina e apps de bem-estar. Voce cria carrosseis impactantes para Instagram sobre o Diaum — um app que ajuda homens a combater dependencia de conteudo adulto online de forma anonima e acolhedora.

Tom de voz: vulneravel, honesto, sem julgamento. Linguagem coloquial brasileira, primeira pessoa quando fizer sentido. Frases curtas e impactantes. Como se fosse um amigo conversando. NADA de texto academico ou palavras complicadas.

${charContext}

${theme_hint ? `Tema especifico: ${theme_hint}\n` : ""}

CONTEUDO DE REFERENCIA (artigo/ideia/noticia):
${sanitizedText}

Sua tarefa:
1. Leia o conteudo acima e extraia os insights mais impactantes
2. Crie um carrossel com ${MIN_SLIDES} a ${maxPages} slides (voce decide o numero ideal)
3. Estruture:
   - Slide 1 (CAPA): titulo curto e impactante (max 46 chars) + subtitulo explicativo (max 88 chars)
   - Slides intermediarios: cada um com titulo (max 80 chars) e body (max 280 chars) desenvolvendo um ponto
   - NAO inclua slide CTA — ele sera adicionado automaticamente no final
4. Cada slide deve ter um proposito claro (gancho, problema, dados, reflexao, virada)
5. Use os dados/citacoes/fatos do conteudo quando possivel

IMPORTANTE:
- Linguagem SFW (safe for work) — fale do tema SEM palavras explicitas
- Seja direto e humano, nao moralista
- O objetivo e despertar identificacao e curiosidade sobre o app
- Titulos em frases curtas, nao em perguntas longas
- Evite clichês como "voce nao esta sozinho"

Responda APENAS com JSON valido neste formato:
{
  "cover": {
    "title": "...",
    "subtitle": "..."
  },
  "slides": [
    { "title": "...", "body": "..." },
    { "title": "...", "body": "..." }
  ]
}`;

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
            maxOutputTokens: 4096,
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
      console.error("[carousel-gen] Gemini error:", errText);
      return NextResponse.json(
        { error: `Erro na API Gemini: ${res.status}` },
        { status: 500 }
      );
    }

    const data = await res.json();

    if (!data?.candidates?.length) {
      const blockReason = data?.promptFeedback?.blockReason || "unknown";
      return NextResponse.json(
        { error: `Bloqueado pela IA (${blockReason}). Tente reformular o texto.` },
        { status: 500 }
      );
    }

    const responseText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    if (!responseText) {
      return NextResponse.json(
        { error: "Resposta vazia da IA" },
        { status: 500 }
      );
    }

    let parsed;
    try {
      const jsonStr = responseText
        .replace(/^```json?\s*/i, "")
        .replace(/```\s*$/, "")
        .trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("[carousel-gen] Failed to parse:", responseText.slice(0, 500));
      return NextResponse.json(
        { error: "Erro ao interpretar resposta da IA" },
        { status: 500 }
      );
    }

    if (!parsed.cover || !parsed.slides || !Array.isArray(parsed.slides)) {
      return NextResponse.json(
        { error: "Formato invalido retornado pela IA" },
        { status: 500 }
      );
    }

    // Fetch random approved/animated shots for cover + text slide backgrounds
    const { data: eps } = await supabase
      .from("episodes")
      .select("id")
      .eq("character_id", id);

    const epIds = eps?.map((e) => e.id) || [];
    const { data: shots } = await supabase
      .from("shots")
      .select("id, image_url, status")
      .in("episode_id", epIds)
      .in("status", ["approved", "animated", "generated"])
      .not("image_url", "is", null);

    const availableShots =
      shots?.filter((s) => s.image_url) || [];

    // Shuffle shots for random assignment
    const shuffled = [...availableShots].sort(() => Math.random() - 0.5);

    // Pick cover image (first shot)
    const coverImageUrl = shuffled[0]?.image_url || "";
    // Remaining shots for text slide backgrounds (optional)
    const bgShots = shuffled.slice(1);

    return NextResponse.json({
      cover: {
        title: parsed.cover.title || "",
        subtitle: parsed.cover.subtitle || "",
        imageUrl: coverImageUrl,
      },
      slides: parsed.slides.map((s: { title: string; body: string }, i: number) => ({
        title: s.title || "",
        body: s.body || "",
        imageUrl: bgShots[i]?.image_url || undefined,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[carousel-gen] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
