import { NextResponse } from 'next/server';
import { fetchOccupancyByCourt } from '@/lib/syltek';
import { getInvoicesForClub } from '@/lib/odoo';

export const maxDuration = 30;

export async function GET() {
  const results: Record<string, unknown> = {};

  // Raw login test to debug cookie issue
  try {
    const username = process.env.SYLTEK_USERNAME || '';
    const password = process.env.SYLTEK_PASSWORD || '';
    const body = new URLSearchParams({ userName: username, password });
    const res = await fetch('https://dreamfitalcorcon.syltek.com/system/account/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      redirect: 'manual',
    });

    const setCookieArr = res.headers.getSetCookie?.() ?? [];
    const rawSetCookie = res.headers.get('set-cookie') ?? '';
    const allHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => { allHeaders[k] = v; });

    results.loginDebug = {
      status: res.status,
      statusText: res.statusText,
      location: res.headers.get('location'),
      setCookieArray: setCookieArr,
      rawSetCookie: rawSetCookie.substring(0, 200),
      allHeaderKeys: Object.keys(allHeaders),
    };
  } catch (e: unknown) {
    results.loginDebug = { error: String(e) };
  }

  // Test Syltek with the lib
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
    odooDb: process.env.ODOO_DB,
  };

  return NextResponse.json(results, { status: 200 });
}
