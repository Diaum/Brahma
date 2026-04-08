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
    .order("order", { ascending: true });

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

  const { data, error } = await supabase
    .from("episodes")
    .insert({
      character_id: id,
      title,
      script: script || null,
      format: format || "9:16",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
