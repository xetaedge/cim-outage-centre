import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET all assignment groups
export async function GET() {
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
