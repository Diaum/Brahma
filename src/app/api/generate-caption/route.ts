import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { slides, source_url } = body;

    if (!slides || !Array.isArray(slides) || slides.length === 0) {
      return NextResponse.json(
        { error: "slides e obrigatorio" },
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

    // Extract text content from slides
    const slideTexts = slides
      .map((s: Record<string, unknown>, i: number) => {
        const title =
          (s.title as string) || (s.headline as string) || "";
        const body =
          (s.body as string) || (s.subtext as string) || (s.subtitle as string) || "";
        if (!title && !body) return null;
        return `Slide ${i + 1}: ${title}${body ? ` — ${body}` : ""}`;
      })
      .filter(Boolean)
      .join("\n");

    const prompt = `Voce e um social media brasileiro especializado em saude masculina. Escreva uma descricao para Instagram para acompanhar esse post (carrossel ou ilustracao).

CONTEUDO DOS SLIDES:
${slideTexts}

REGRAS:
- NAO copie e cole o texto dos slides — faca um RESUMO em tom conversacional
- Escreva como social media: direto, humano, sem formalidade
- Use emoji com moderacao (2-4 no maximo)
- Inclua 1 CTA sutil (ex: "salva pra lembrar", "manda pra quem precisa ouvir isso")
- Maximo 5-8 linhas
- Inclua 5-8 hashtags relevantes no final (saude masculina, bem-estar, etc)
- NAO use palavras explicitas — fale do tema de forma SFW
- Tom: vulneravel, honesto, sem julgamento
${source_url ? `\n- No final, antes das hashtags, adicione:\n📰 Fonte: ${source_url}` : "- NAO inclua fonte/referencia"}

Responda APENAS com o texto da descricao, nada mais.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 1024 },
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
      return NextResponse.json({ error: `Gemini ${res.status}` }, { status: 500 });
    }

    const data = await res.json();
    const caption =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    if (!caption) {
      return NextResponse.json({ error: "Resposta vazia" }, { status: 500 });
    }

    return NextResponse.json({ caption });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
