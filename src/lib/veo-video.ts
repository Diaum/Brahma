const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const MODEL = "veo-3.1-fast-generate-preview";

interface StartVideoOptions {
  prompt: string;
  imageBase64?: string;
  imageMimeType?: string;
  aspectRatio?: string;
  duration?: string;
}

interface VideoOperationStatus {
  done: boolean;
  operationName: string;
  videoUri?: string;
  error?: string;
}

export async function startVideoGeneration(
  options: StartVideoOptions
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY nao configurada");
  }

  const instance: Record<string, unknown> = {
    prompt: options.prompt,
  };

  // Image-to-video: use shot image as starting frame
  if (options.imageBase64) {
    instance.image = {
      inlineData: {
        mimeType: options.imageMimeType || "image/png",
        data: options.imageBase64,
      },
    };
  }

  const parameters: Record<string, unknown> = {
    aspectRatio: options.aspectRatio || "16:9",
    personGeneration: options.imageBase64 ? "allow_adult" : "allow_all",
    durationSeconds: options.duration || "8",
  };

  const res = await fetch(
    `${BASE_URL}/models/${MODEL}:predictLongRunning?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [instance],
        parameters,
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    console.error("[veo] Start error:", errText);
    throw new Error(`Veo API error (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const operationName = data.name;

  if (!operationName) {
    throw new Error("Veo API nao retornou operation name");
  }

  return operationName;
}

export async function pollVideoOperation(
  operationName: string
): Promise<VideoOperationStatus> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY nao configurada");
  }

  const res = await fetch(
    `${BASE_URL}/${operationName}?key=${apiKey}`,
    { method: "GET" }
  );

  if (!res.ok) {
    const errText = await res.text();
    console.error("[veo] Poll error:", errText);
    return { done: false, operationName, error: `Poll error: ${res.status}` };
  }

  const data = await res.json();

  if (data.done) {
    // Extract video URI
    const videoUri =
      data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;

    if (!videoUri) {
      const errorMsg = data.error?.message || "Nenhum video gerado";
      return { done: true, operationName, error: errorMsg };
    }

    return { done: true, operationName, videoUri };
  }

  return { done: false, operationName };
}

export async function downloadVideo(
  videoUri: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY nao configurada");
  }

  const res = await fetch(videoUri, {
    headers: { "x-goog-api-key": apiKey },
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(`Download error: ${res.status}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const mimeType = res.headers.get("content-type") || "video/mp4";

  return { buffer, mimeType };
}
