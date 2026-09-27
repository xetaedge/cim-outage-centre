import { NextResponse } from 'next/server';
import { GET as handleGet, PUT as handlePut } from '../me/route';

export async function GET(request: Request) {
  return handleGet();
}

export async function PUT(request: Request) {
  return handlePut(request);
}
