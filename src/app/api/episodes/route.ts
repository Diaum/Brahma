import { supabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { character_id, title, script, format, order } = body;

  if (!character_id || !title) {
    return NextResponse.json(
      { error: "character_id e titulo sao obrigatorios" },
      { status: 400 }
    );
  }

  const validFormats = ["16:9", "9:16", "1:1"];
  if (format && !validFormats.includes(format)) {
    return NextResponse.json(
      { error: "Formato invalido. Use 16:9, 9:16 ou 1:1" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("episodes")
    .insert({
      character_id,
      title,
      script: script || null,
      format: format || "16:9",
      order: order ?? 0,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
