import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PUT update a closure tag by id
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { name, description, color, active, order } = body;

    const data: any = {};
    if (name !== undefined) data.name = name.trim();
    if (description !== undefined) data.description = description ? description.trim() : null;
    if (color !== undefined) data.color = color.trim();
    if (active !== undefined) data.active = Boolean(active);
    if (order !== undefined) data.order = Number(order);

    const tag = await prisma.closureTag.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, tag });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE a closure tag by id
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    await prisma.closureTag.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
