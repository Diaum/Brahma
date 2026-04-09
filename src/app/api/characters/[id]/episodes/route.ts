import { supabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("episodes")
    .select("*")
    .eq("character_id", id)
    .order("order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { title, script, format } = body;

  if (!title) {
    return NextResponse.json(
      { error: "Titulo e obrigatorio" },
      { status: 400 }
    );
  }

  // Determine next order
  const { data: existing } = await supabase
    .from("episodes")
    .select("order")
    .eq("character_id", id)
    .order("order", { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0
    ? (existing[0].order ?? 0) + 1
    : 0;

  const { data, error } = await supabase
    .from("episodes")
    .insert({
      character_id: id,
      title,
      script: script || null,
      format: format || "16:9",
      order: nextOrder,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
