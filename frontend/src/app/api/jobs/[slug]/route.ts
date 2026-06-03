import { NextResponse } from 'next/server';

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN!;

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const { slug } = params;

  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/jobs?filterByFormula=${encodeURIComponent(`{slug}='${slug}'`)}&maxRecords=1`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'Airtable error' }, { status: 502 });
  }

  const data = await res.json();
  const record = data.records?.[0];

  if (!record) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { status, tour_url, error_message } = record.fields;

  return NextResponse.json({
    status: status ?? 'unknown',
    tour_url: tour_url ?? null,
    error_message: error_message ?? null,
    updated_at: record.fields.updated_at ?? null,
  });
}
