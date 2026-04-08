import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; episodeId: string }> }
) {
  const { episodeId } = await params;

  const { data, error } = await supabase
    .from("episodes")
    .select("*")
    .eq("id", episodeId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; episodeId: string }> }
) {
  const { episodeId } = await params;
  const body = await request.json();

  const { data, error } = await supabase
    .from("episodes")
    .update(body)
    .eq("id", episodeId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; episodeId: string }> }
) {
  const { episodeId } = await params;

  const { error } = await supabase
    .from("episodes")
    .delete()
    .eq("id", episodeId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
