const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent";

interface GenerateImageOptions {
  prompt: string;
  referenceImageBase64?: string;
  referenceImageMimeType?: string;
  aspectRatio?: string;
}

interface GeminiImageResult {
  imageBase64: string;
  mimeType: string;
}

export async function generateImage(
  options: GenerateImageOptions
): Promise<GeminiImageResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não configurada");
  }

  const parts: Record<string, unknown>[] = [{ text: options.prompt }];

  // Image-to-image: add reference image
  if (options.referenceImageBase64) {
    parts.push({
      inline_data: {
        mime_type: options.referenceImageMimeType || "image/png",
        data: options.referenceImageBase64,
      },
    });
  }

  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: options.aspectRatio || "16:9",
      },
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
    ],
  };

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${error}`);
  }

  const data = await res.json();
  console.log("[gemini-image] Response:", JSON.stringify(data).slice(0, 500));
  const candidates = data?.candidates;
  if (!candidates?.length) {
    const blockReason = data?.promptFeedback?.blockReason;
    throw new Error(
      blockReason
        ? `Imagem bloqueada pela API: ${blockReason}`
        : "Nenhuma imagem gerada pela API"
    );
  }

  const responseParts = candidates[0]?.content?.parts;
  if (!responseParts?.length) {
    throw new Error("Resposta da API sem conteúdo");
  }

  // Find the image part in the response
  const imagePart = responseParts.find(
    (p: Record<string, unknown>) => p.inlineData
  );
  if (!imagePart?.inlineData) {
    throw new Error("Nenhuma imagem na resposta da API");
  }

  return {
    imageBase64: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType || "image/png",
  };
}
