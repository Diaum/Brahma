import { NextResponse } from "next/server";
import { generateImage } from "@/lib/gemini-image";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      shotId,
      characterId,
      prompt,
      referenceImageUrl,
      aspectRatio,
      strength,
    } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: "prompt é obrigatório" },
        { status: 400 }
      );
    }

    if (!shotId && !characterId) {
      return NextResponse.json(
        { error: "shotId ou characterId é obrigatório" },
        { status: 400 }
      );
    }

    // Build the full prompt with strength guidance
    let fullPrompt = prompt;
    if (referenceImageUrl && strength !== undefined) {
      const strengthLabel =
        strength <= 0.3
          ? "loosely inspired by"
          : strength <= 0.6
            ? "maintaining similar style and composition to"
            : "closely matching the style, lighting, and composition of";
      fullPrompt = `${prompt}. Generate this image ${strengthLabel} the reference image provided.`;
    }

    // Fetch reference image as base64 if provided
    let referenceImageBase64: string | undefined;
    let referenceImageMimeType: string | undefined;

    if (referenceImageUrl) {
      const imgRes = await fetch(referenceImageUrl);
      if (imgRes.ok) {
        const buffer = await imgRes.arrayBuffer();
        referenceImageBase64 = Buffer.from(buffer).toString("base64");
        referenceImageMimeType =
          imgRes.headers.get("content-type") || "image/png";
      }
    }

    const result = await generateImage({
      prompt: fullPrompt,
      referenceImageBase64,
      referenceImageMimeType,
      aspectRatio: aspectRatio || "9:16",
    });

    const imageBuffer = Buffer.from(result.imageBase64, "base64");

    // Character image preview flow — return base64, no upload yet
    if (characterId) {
      return NextResponse.json({
        image_base64: result.imageBase64,
        mime_type: result.mimeType,
      });
    }

    // Shot image generation flow (existing behavior)
    const fileName = `shots/${shotId}/${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("brahma-images")
      .upload(fileName, imageBuffer, {
        contentType: result.mimeType,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Erro no upload: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("brahma-images").getPublicUrl(fileName);

    // Update shot with generated image URL and status
    const { data: updatedShot, error: updateError } = await supabase
      .from("shots")
      .update({ image_url: publicUrl, status: "generated" })
      .eq("id", shotId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: `Erro ao atualizar shot: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedShot);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[generate-image] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
