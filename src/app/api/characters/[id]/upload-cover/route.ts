import { supabase } from "@/lib/supabase";
import { getCharacterSlug } from "@/lib/storage-paths";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { image_base64, mime_type } = body;

  if (!image_base64) {
    return NextResponse.json(
      { error: "image_base64 e obrigatorio" },
      { status: 400 }
    );
  }

  const imageBuffer = Buffer.from(image_base64, "base64");
  const ext = mime_type?.includes("jpeg") ? "jpg" : "png";
  const charSlug = await getCharacterSlug(id);
  const fileName = `${charSlug}/cover-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("brahma-images")
    .upload(fileName, imageBuffer, {
      contentType: mime_type || "image/png",
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

  // Save as cover and reference
  await Promise.all([
    supabase
      .from("characters")
      .update({ cover_image_url: publicUrl })
      .eq("id", id),
    supabase
      .from("character_references")
      .insert({ character_id: id, image_url: publicUrl, approved: true }),
  ]);

  return NextResponse.json({ image_url: publicUrl }, { status: 201 });
}
