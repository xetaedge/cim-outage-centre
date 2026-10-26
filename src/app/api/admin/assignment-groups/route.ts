import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET all assignment groups
export async function GET() {
  const auth = await requireSession(['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const groups = await prisma.assignmentGroup.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ success: true, groups });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST create or upsert an assignment group
export async function POST(request: Request) {
  const auth = await requireSession(['ADMIN']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { name, email } = await request.json();
    if (!name || !email) {
      return NextResponse.json({ success: false, error: 'name and email are required' }, { status: 400 });
    }

    const group = await prisma.assignmentGroup.upsert({
      where: { name: name.trim() },
      create: { name: name.trim(), email: email.trim() },
      update: { email: email.trim() },
    });

    return NextResponse.json({ success: true, group });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
