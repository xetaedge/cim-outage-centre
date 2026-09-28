import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const DEFAULT_CLOSURE_TAGS = [
  {
    name: 'Power Issue',
    color: '#f59e0b', // Amber
    description: 'Electrical utility, UPS backup, or generator failure',
    order: 1,
  },
  {
    name: 'Internet Issue',
    color: '#3b82f6', // Blue
    description: 'ISP outage, transit provider link down, or WAN failure',
    order: 2,
  },
  {
    name: 'Fiber Cut',
    color: '#ef4444', // Red
    description: 'Physical terrestrial fiber optic cable severance',
    order: 3,
  },
  {
    name: 'Server Issue',
    color: '#8b5cf6', // Purple
    description: 'Compute host, OS kernel panic, hypervisor, or hardware fault',
    order: 4,
  },
  {
    name: 'Network Issue',
    color: '#06b6d4', // Cyan
    description: 'Switch, router, firewall, BGP/OSPF, or VLAN anomaly',
    order: 5,
  },
  {
    name: 'Application Issue',
    color: '#6366f1', // Indigo
    description: 'Software defect, API regression, deadlock, or deployment bug',
    order: 6,
  },
  {
    name: 'CDM Issue',
    color: '#10b981', // Emerald
    description: 'Critical Data Management, database cluster, or replication delay',
    order: 7,
  },
  {
    name: 'Services Issue',
    color: '#ec4899', // Pink
    description: 'Third-party SaaS integration, cloud provider, or auth service outage',
    order: 8,
  },
];

// GET all closure tags (auto-seeds defaults if empty)
export async function GET() {
  try {
    let tags = await prisma.closureTag.findMany({
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });

    if (tags.length === 0) {
      // Auto-seed default 8 tags
      for (const def of DEFAULT_CLOSURE_TAGS) {
        await prisma.closureTag.upsert({
          where: { name: def.name },
          create: {
            name: def.name,
            color: def.color,
            description: def.description,
            order: def.order,
            active: true,
          },
          update: {},
        });
      }
      tags = await prisma.closureTag.findMany({
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
      });
    }

    return NextResponse.json({ success: true, tags });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST create tag or reset to defaults
export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.action === 'reset_defaults') {
      for (const def of DEFAULT_CLOSURE_TAGS) {
        await prisma.closureTag.upsert({
          where: { name: def.name },
          create: {
            name: def.name,
            color: def.color,
            description: def.description,
            order: def.order,
            active: true,
          },
          update: {
            color: def.color,
            description: def.description,
            order: def.order,
            active: true,
          },
        });
      }
      const tags = await prisma.closureTag.findMany({
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
      });
      return NextResponse.json({ success: true, tags, message: 'Defaults restored successfully' });
    }

    const { name, description, color, active, order } = body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Tag name is required' }, { status: 400 });
    }

    const trimmedName = name.trim();

    const tag = await prisma.closureTag.upsert({
      where: { name: trimmedName },
      create: {
        name: trimmedName,
        description: description ? description.trim() : null,
        color: color || '#3b82f6',
        active: active !== undefined ? Boolean(active) : true,
        order: typeof order === 'number' ? order : 0,
      },
      update: {
        description: description !== undefined ? (description ? description.trim() : null) : undefined,
        color: color || undefined,
        active: active !== undefined ? Boolean(active) : undefined,
        order: typeof order === 'number' ? order : undefined,
      },
    });

    return NextResponse.json({ success: true, tag });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
