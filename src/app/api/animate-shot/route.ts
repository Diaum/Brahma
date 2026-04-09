import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";
import {
  startVideoGeneration,
  pollVideoOperation,
  downloadVideo,
} from "@/lib/veo-video";

// POST: Start video generation for a shot
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { shotId, prompt, duration } = body;

    if (!shotId) {
      return NextResponse.json(
        { error: "shotId e obrigatorio" },
        { status: 400 }
      );
    }

    // Get the shot's image
    const { data: shot, error: shotError } = await supabase
      .from("shots")
      .select("image_url, prompt_full, prompt_scene")
      .eq("id", shotId)
      .single();

    if (shotError || !shot) {
      return NextResponse.json(
        { error: "Shot nao encontrado" },
        { status: 404 }
      );
    }

    // Fetch the shot image as base64
    let imageBase64: string | undefined;
    let imageMimeType: string | undefined;

    if (shot.image_url) {
      try {
        const imgRes = await fetch(shot.image_url);
        if (imgRes.ok) {
          const buffer = await imgRes.arrayBuffer();
          imageBase64 = Buffer.from(buffer).toString("base64");
          imageMimeType = imgRes.headers.get("content-type") || "image/png";
        }
      } catch (err) {
        console.error("[animate-shot] Failed to fetch image:", err);
      }
    }

    const rawPrompt = prompt || shot.prompt_full || shot.prompt_scene;

    // Sanitize prompt — Veo is stricter than image generation
    let visualPrompt = rawPrompt
      .replace(/pornografi[ao]/gi, "compulsive screen behavior")
      .replace(/porn[ôo]/gi, "screen content")
      .replace(/sexu/gi, "compulsive")
      .replace(/masturba[çc][aã]o?/gi, "isolation behavior")
      .replace(/v[ií]cio/gi, "compulsion")
      .replace(/addiction/gi, "compulsion")
      .replace(/pornography/gi, "compulsive screen behavior");

    // Minimal animation prompt — just bring the image to life subtly
    const videoPrompt = `Subtly animate the provided image. No dialogue, no speech, no text, no audio. Only gentle, minimal motion: slow camera push-in, subtle pan, or slight handheld sway. The subject barely moves — only natural micro-movements like breathing, blinking, hair drifting, ambient light shifts. Keep everything else in the image identical. Context for reference: ${visualPrompt}`;

    // Start Veo generation
    const operationName = await startVideoGeneration({
      prompt: videoPrompt,
      imageBase64,
      imageMimeType,
      aspectRatio: "16:9",
      duration: duration ?? 4,
    });

    // Save operation name to shot
    await supabase
      .from("shots")
      .update({ video_operation: operationName, status: "animated" })
      .eq("id", shotId);

    return NextResponse.json({ operationName, shotId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[animate-shot] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET: Poll video status and download when ready
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shotId = searchParams.get("shotId");
    const operationName = searchParams.get("operation");

    if (!shotId || !operationName) {
      return NextResponse.json(
        { error: "shotId e operation sao obrigatorios" },
        { status: 400 }
      );
    }

    console.log("[animate-shot GET] Polling:", operationName);
    const status = await pollVideoOperation(operationName);
    console.log("[animate-shot GET] Status:", JSON.stringify(status));

    if (!status.done) {
      return NextResponse.json({ done: false, shotId });
    }

    if (status.error) {
      console.error("[animate-shot GET] Status error:", status.error);
      // Clear video_operation so polling doesn't auto-retry on next page load
      await supabase
        .from("shots")
        .update({ video_operation: null, status: "approved" })
        .eq("id", shotId);
      return NextResponse.json(
        { done: true, error: status.error },
        { status: 500 }
      );
    }

    // Video is ready — download and upload to Supabase Storage
    if (status.videoUri) {
      const { buffer, mimeType } = await downloadVideo(status.videoUri);

      const fileName = `videos/${shotId}/${Date.now()}.mp4`;
      const { error: uploadError } = await supabase.storage
        .from("brahma-images")
        .upload(fileName, buffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadError) {
        return NextResponse.json(
          { error: `Upload error: ${uploadError.message}` },
          { status: 500 }
        );
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("brahma-images").getPublicUrl(fileName);

      // Update shot with video URL
      await supabase
        .from("shots")
        .update({ video_url: publicUrl, video_operation: null })
        .eq("id", shotId);

      return NextResponse.json({ done: true, video_url: publicUrl, shotId });
    }

    return NextResponse.json({ done: true, error: "No video URI" }, { status: 500 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[animate-shot] Poll error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
