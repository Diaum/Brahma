const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const UPLOAD_URL = "https://generativelanguage.googleapis.com/upload/v1beta/files";
const MODEL = "veo-3.1-fast-generate-preview";

async function uploadToGeminiFiles(
  base64Data: string,
  mimeType: string,
  apiKey: string
): Promise<string | null> {
  try {
    const buffer = Buffer.from(base64Data, "base64");

    // Start resumable upload
    const startRes = await fetch(`${UPLOAD_URL}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": mimeType,
        "X-Goog-Upload-Protocol": "raw",
        "X-Goog-Upload-Command": "upload, finalize",
      },
      body: buffer,
    });

    if (!startRes.ok) {
      const errText = await startRes.text();
      console.error("[veo] File upload error:", errText);
      return null;
    }

    const data = await startRes.json();
    const fileUri = data?.file?.uri;
    if (!fileUri) {
      console.error("[veo] No file URI in upload response:", JSON.stringify(data).slice(0, 300));
      return null;
    }

    // Wait a moment for file processing
    await new Promise((r) => setTimeout(r, 2000));

    return fileUri;
  } catch (err) {
    console.error("[veo] Upload exception:", err);
    return null;
  }
}

interface StartVideoOptions {
  prompt: string;
  imageBase64?: string;
  imageMimeType?: string;
  aspectRatio?: string;
  duration?: number;
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

  // Image-to-video: use bytesBase64Encoded format (Vertex AI style)
  if (options.imageBase64) {
    instance.image = {
      bytesBase64Encoded: options.imageBase64,
      mimeType: options.imageMimeType || "image/png",
    };
  }

  const parameters: Record<string, unknown> = {
    aspectRatio: options.aspectRatio || "16:9",
    personGeneration: instance.image ? "allow_adult" : "allow_all",
    durationSeconds: options.duration ?? 4,
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
  console.log("[veo poll] Response:", JSON.stringify(data).slice(0, 800));

  if (data.done) {
    // Try multiple paths for video URI (response format varies)
    const videoUri =
      data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
      data.response?.videos?.[0]?.uri ||
      data.response?.generatedVideos?.[0]?.video?.uri;

    if (!videoUri) {
      const errorMsg =
        data.error?.message ||
        data.response?.raiMediaFilteredReason ||
        `Nenhum video gerado. Resposta: ${JSON.stringify(data).slice(0, 300)}`;
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
