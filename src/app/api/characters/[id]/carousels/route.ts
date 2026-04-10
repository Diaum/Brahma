import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

// GET: list all carousels for a character
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("carousels")
    .select("id, name, slides, created_at, updated_at")
    .eq("character_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST: create new carousel
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { slides, name: customName } = body;

  if (!slides || !Array.isArray(slides)) {
    return NextResponse.json(
      { error: "slides e obrigatorio (array)" },
      { status: 400 }
    );
  }

  let name = customName;
  if (!name) {
    // Auto-generate name: {character-slug}-carrosel-{N}
    const { data: char } = await supabase
      .from("characters")
      .select("name")
      .eq("id", id)
      .single();
    const charSlug = (char?.name || "personagem")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const { data: existing } = await supabase
      .from("carousels")
      .select("name")
      .eq("character_id", id);

    const nextNumber = (existing?.length || 0) + 1;
    name = `${charSlug}-carrosel-${nextNumber}`;
  }

  const { data, error } = await supabase
    .from("carousels")
    .insert({ character_id: id, name, slides })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
