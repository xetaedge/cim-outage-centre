import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PUT update an assignment group by id
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const { name, email } = await request.json();

    const group = await prisma.assignmentGroup.update({
      where: { id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(email !== undefined ? { email: email.trim() } : {}),
      },
    });

    return NextResponse.json({ success: true, group });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE an assignment group by id
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    await prisma.assignmentGroup.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
