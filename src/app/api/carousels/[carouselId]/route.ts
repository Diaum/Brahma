import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ carouselId: string }> }
) {
  const { carouselId } = await params;
  const { data, error } = await supabase
    .from("carousels")
    .select("*")
    .eq("id", carouselId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ carouselId: string }> }
) {
  const { carouselId } = await params;
  const body = await request.json();

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (body.name !== undefined) updatePayload.name = body.name;
  if (body.slides !== undefined) updatePayload.slides = body.slides;

  const { data, error } = await supabase
    .from("carousels")
    .update(updatePayload)
    .eq("id", carouselId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ carouselId: string }> }
) {
  const { carouselId } = await params;
  const { error } = await supabase
    .from("carousels")
    .delete()
    .eq("id", carouselId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
