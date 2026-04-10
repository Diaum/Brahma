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

    const prompt = `Voce e um social media brasileiro especializado em saude masculina e bem-estar digital. Escreva uma descricao para acompanhar esse post no Instagram.

CONTEUDO DOS SLIDES DO POST:
${slideTexts}

REGRAS OBRIGATORIAS:
1. A descricao deve ter entre 400 e 600 caracteres (sem contar hashtags e fonte)
2. NAO copie os titulos dos slides — escreva um TEXTO ORIGINAL que COMENTA sobre o tema do post
3. Comece com uma frase de impacto que gere curiosidade (pode ser pergunta ou afirmacao forte)
4. Desenvolva o tema em 3-4 paragrafos curtos — cada um separado por linha em branco
5. Use emoji com moderacao (3-5 no total, nunca no inicio de paragrafo)
6. Inclua 1 CTA claro no final do texto (ex: "Salva esse post e manda pra alguem que precisa ler isso 🔖")
7. Tom: conversacional, vulneravel, direto, sem julgamento, como se fosse um amigo falando a verdade
8. NAO use palavras explicitas — fale do tema de forma SFW
9. NAO use cliches como "voce nao esta sozinho" ou "quebre o silencio"
${source_url ? `
10. OBRIGATORIAMENTE adicione esta linha ANTES das hashtags (em linha separada):

📰 Fonte: ${source_url}` : `
10. NAO inclua nenhuma linha de fonte/referencia`}

11. Termine com 8-12 hashtags relevantes em linha separada (saude masculina, dependencia digital, bem estar, habitos, etc)

FORMATO DA RESPOSTA (apenas o texto, nada mais):
[frase de impacto]

[paragrafo 1]

[paragrafo 2]

[CTA]
${source_url ? `\n📰 Fonte: ${source_url}` : ""}
#hashtag1 #hashtag2 ...`;

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
      return NextResponse.json({ error: `Gemini ${res.status}` }, { status: 500 });
    }

    const data = await res.json();

    const finishReason = data?.candidates?.[0]?.finishReason;
    if (finishReason === "SAFETY") {
      console.error("[caption] Blocked by safety filter");
      return NextResponse.json(
        { error: "Descricao bloqueada pelo filtro. Tente novamente." },
        { status: 500 }
      );
    }

    const caption =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    if (!caption) {
      console.error("[caption] Empty response. Finish reason:", finishReason);
      return NextResponse.json({ error: "Resposta vazia" }, { status: 500 });
    }

    console.log("[caption] Generated:", caption.length, "chars, finishReason:", finishReason);

    return NextResponse.json({ caption });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
