import { NextResponse } from 'next/server';
import { fetchOccupancyByCourt } from '@/lib/syltek';
import { getInvoicesForClub } from '@/lib/odoo';

export const maxDuration = 30;

export async function GET() {
  const results: Record<string, unknown> = {};

  // Test Syltek
  try {
    const courts = await fetchOccupancyByCourt('alcorcon', '01/02/2026', '28/02/2026');
    results.syltek = { ok: true, courts: courts?.length ?? 0, first: courts?.[0] ?? null };
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e));
    results.syltek = { ok: false, error: err.message };
  }

  // Test Odoo
  try {
    const invoices = await getInvoicesForClub('alcorcon', 2026, 2);
    results.odoo = { ok: true, count: invoices.length, first: invoices[0] ?? null };
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e));
    results.odoo = { ok: false, error: err.message };
  }

  // Env check
  results.env = {
    hasSyltekUser: !!process.env.SYLTEK_USERNAME,
    hasSyltekPass: !!process.env.SYLTEK_PASSWORD,
    hasOdooUrl: !!process.env.ODOO_URL,
    hasOdooKey: !!process.env.ODOO_API_KEY,
  };

  return NextResponse.json(results, { status: 200 });
}
