import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, color_palette } = body;

    if (!text || text.trim().length < 20) {
      return NextResponse.json(
        { error: "Texto com minimo 20 caracteres" },
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

    const palette = color_palette || "dark green gradient";

    // Sanitize
    const sanitized = text
      .replace(/pornografi[ao]/gi, "conteudo adulto online")
      .replace(/porn[ôo]/gi, "conteudo adulto")
      .replace(/masturba[çc][aã]o?/gi, "habito compulsivo")
      .replace(/vicio/gi, "dependencia")
      .replace(/v[ií]cio/gi, "dependencia");

    const prompt = `Voce e um social media designer que cria posts ilustrados no estilo Scratch AI para Instagram. O estilo e: cartoon vector, flat colors, bold outlines, personagens simples com proporcoes exageradas, fundo com gradiente solido e formas geometricas simples.

CONTEUDO DE REFERENCIA:
${sanitized}

Crie um plano de 4 ilustracoes sobre esse tema para Instagram (formato 4:5):

1. HOOK (capa): a mais impactante, com headline sensacionalista que para o scroll
2. SLIDE 2: desenvolve o primeiro ponto/dado do artigo
3. SLIDE 3: aprofunda com outro insight do artigo
4. SLIDE 4: reflexao final ou dado de impacto que fecha a narrativa

TODAS as 4 ilustracoes devem ser sobre o CONTEUDO do artigo. NAO inclua CTA sobre nenhum app — o CTA sera adicionado automaticamente como 5o slide.

Para cada ilustracao retorne:
- "headline": titulo CURTO em PORTUGUES que aparece NA imagem (max 50 chars). CAPSLOCK. Sensacionalista.
- "subtext": texto menor em PORTUGUES que complementa o headline (max 100 chars)
- "scene": descricao da cena em INGLES para geracao de imagem. NAO inclua texto/headline/subtext na scene. Descreva APENAS os elementos visuais: personagem, acao, objetos, composicao.

REGRAS para headline e subtext:
- Sempre em PORTUGUES BRASILEIRO
- headline em CAPSLOCK
- Frases curtas e impactantes

REGRAS para scene:
- APENAS descricao visual em INGLES (personagem, objetos, composicao, metafora)
- NAO repita o headline ou subtext na scene
- Descreva um personagem masculino cartoon em alguma situacao visual
- Use metaforas visuais (correntes, tela brilhando, sombras, etc)
- NUNCA conteudo explicito — foque em emocao, solidao, habito, celular
- Inclua detalhes visuais: posicao do personagem, objetos na cena, iluminacao
- Paleta de cores: ${palette}
- Se a paleta for preto e branco: TODA a cena deve ser monocromatica, tons de cinza, sem NENHUMA cor

Responda APENAS JSON valido:
[
  { "headline": "...", "subtext": "...", "scene": "..." },
  { "headline": "...", "subtext": "...", "scene": "..." },
  { "headline": "...", "subtext": "...", "scene": "..." },
  { "headline": "...", "subtext": "...", "scene": "..." }
]`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 4096 },
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
      return NextResponse.json(
        { error: `Gemini ${res.status}` },
        { status: 500 }
      );
    }

    const data = await res.json();
    if (!data?.candidates?.length) {
      const reason = data?.promptFeedback?.blockReason || "unknown";
      return NextResponse.json(
        { error: `Bloqueado (${reason}). Reformule o texto.` },
        { status: 500 }
      );
    }

    const responseText = data.candidates[0]?.content?.parts?.[0]?.text?.trim() || "";
    let slides;
    try {
      const jsonStr = responseText
        .replace(/^```json?\s*/i, "")
        .replace(/```\s*$/, "")
        .trim();
      slides = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        { error: "Erro ao interpretar resposta da IA" },
        { status: 500 }
      );
    }

    if (!Array.isArray(slides) || slides.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma ilustracao gerada" },
        { status: 500 }
      );
    }

    return NextResponse.json({ slides });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[illustration-plan] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
