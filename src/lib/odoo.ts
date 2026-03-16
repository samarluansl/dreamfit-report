/**
 * Odoo XMLRPC service for fetching MPS (Matches Padel Solutions) invoices
 * issued by Padel YVR S.L. to Dreamfit clubs.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const xmlrpc = require('xmlrpc') as XmlRpcModule;

// ---------------------------------------------------------------------------
// Minimal xmlrpc type declarations (no @types/xmlrpc available)
// ---------------------------------------------------------------------------

interface XmlRpcClientOptions {
  host: string;
  port: number;
  path: string;
}

interface XmlRpcClient {
  methodCall(
    method: string,
    params: unknown[],
    callback: (error: Error | null, value: unknown) => void,
  ): void;
}

interface XmlRpcModule {
  createSecureClient(options: XmlRpcClientOptions): XmlRpcClient;
}

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export interface OdooInvoice {
  id: number;
  name: string;
  partner_id: [number, string];
  ref: string | false;
  invoice_date: string;
  amount_total: number;
  amount_untaxed: number;
  state: 'draft' | 'posted' | 'cancel';
}

export interface OdooInvoiceLine {
  id: number;
  name: string;
  quantity: number;
  price_unit: number;
  price_subtotal: number;
}

export interface MonthlyCostEntry {
  year: number;
  month: number;
  total: number;
  invoiceCount: number;
}

// ---------------------------------------------------------------------------
// Club → partner name mapping
// ---------------------------------------------------------------------------

const CLIENT_MAP = {
  alcorcon: 'Dreamfit Alcorcón S.L.',
  laspalmas: 'Dreamfit Villaverde S.L.',
  sanse: 'Dreamfit Jarama S.L.',
} as const;

export type ClubId = keyof typeof CLIENT_MAP;

function getClientName(clubId: string): string {
  if (!(clubId in CLIENT_MAP)) {
    throw new Error(
      `Unknown clubId "${clubId}". Valid values: ${Object.keys(CLIENT_MAP).join(', ')}`,
    );
  }
  return CLIENT_MAP[clubId as ClubId];
}

// ---------------------------------------------------------------------------
// Environment config
// ---------------------------------------------------------------------------

function getConfig() {
  const url = process.env.ODOO_URL ?? 'https://samarluan-sl.odoo.com';
  const db = (process.env.ODOO_DB ?? 'samarluan-sl').trim();
  const username = process.env.ODOO_USERNAME ?? 'samuawp@gmail.com';
  const apiKey = process.env.ODOO_API_KEY ?? '93b054a2616e3f54b467ea9e24ba8a067474718b';
  const host = new URL(url).hostname;
  return { url, db, username, apiKey, host };
}

// ---------------------------------------------------------------------------
// XMLRPC helpers
// ---------------------------------------------------------------------------

function promiseCall<T>(client: XmlRpcClient, method: string, params: unknown[]): Promise<T> {
  return new Promise((resolve, reject) => {
    client.methodCall(method, params, (err, value) => {
      if (err) {
        reject(err);
      } else {
        resolve(value as T);
      }
    });
  });
}

function createCommonClient(host: string): XmlRpcClient {
  return xmlrpc.createSecureClient({ host, port: 443, path: '/xmlrpc/2/common' });
}

function createObjectClient(host: string): XmlRpcClient {
  return xmlrpc.createSecureClient({ host, port: 443, path: '/xmlrpc/2/object' });
}

// ---------------------------------------------------------------------------
// UID cache — authenticate once per process lifetime
// ---------------------------------------------------------------------------

let cachedUid: number | null = null;

async function getUid(): Promise<number> {
  if (cachedUid !== null) return cachedUid;

  const { host, db, username, apiKey } = getConfig();
  const common = createCommonClient(host);

  const uid = await promiseCall<number>(common, 'authenticate', [db, username, apiKey, {}]);

  if (!uid || typeof uid !== 'number') {
    throw new Error('Odoo authentication failed. Check ODOO_USERNAME and ODOO_API_KEY.');
  }

  cachedUid = uid;
  return uid;
}

// ---------------------------------------------------------------------------
// Core execute helper
// ---------------------------------------------------------------------------

async function execute<T>(
  model: string,
  method: string,
  args: unknown[],
  kwargs: Record<string, unknown> = {},
): Promise<T> {
  const { host, db, apiKey } = getConfig();
  const uid = await getUid();
  const object = createObjectClient(host);

  return promiseCall<T>(object, 'execute_kw', [db, uid, apiKey, model, method, args, kwargs]);
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function monthBounds(year: number, month: number): { first: string; last: string } {
  // month is 1-based
  const firstDate = new Date(year, month - 1, 1);
  const lastDate = new Date(year, month, 0); // day 0 of next month = last day of this month

  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  return { first: fmt(firstDate), last: fmt(lastDate) };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch all invoices issued by Padel YVR S.L. to a Dreamfit club in a given month.
 */
export async function getInvoicesForClub(
  clubId: string,
  year: number,
  month: number,
): Promise<OdooInvoice[]> {
  const clientName = getClientName(clubId);
  const { first, last } = monthBounds(year, month);

  const domain = [
    ['move_type', '=', 'out_invoice'],
    ['partner_id.name', 'ilike', clientName],
    ['company_id.name', 'ilike', 'padel yvr'],
    ['invoice_date', '>=', first],
    ['invoice_date', '<=', last],
  ];

  const fields = ['name', 'partner_id', 'ref', 'invoice_date', 'amount_total', 'amount_untaxed', 'state'];

  const records = await execute<Array<Record<string, unknown>>>('account.move', 'search_read', [domain], {
    fields,
    order: 'invoice_date asc',
  });

  return records.map((r) => ({
    id: r['id'] as number,
    name: r['name'] as string,
    partner_id: r['partner_id'] as [number, string],
    ref: r['ref'] as string | false,
    invoice_date: r['invoice_date'] as string,
    amount_total: r['amount_total'] as number,
    amount_untaxed: r['amount_untaxed'] as number,
    state: r['state'] as OdooInvoice['state'],
  }));
}

/**
 * Fetch product line items for a specific invoice.
 */
export async function getInvoiceLines(invoiceId: number): Promise<OdooInvoiceLine[]> {
  const domain = [
    ['move_id', '=', invoiceId],
    ['display_type', '=', 'product'],
  ];

  const fields = ['name', 'quantity', 'price_unit', 'price_subtotal'];

  const records = await execute<Array<Record<string, unknown>>>(
    'account.move.line',
    'search_read',
    [domain],
    { fields, order: 'id asc' },
  );

  return records.map((r) => ({
    id: r['id'] as number,
    name: r['name'] as string,
    quantity: r['quantity'] as number,
    price_unit: r['price_unit'] as number,
    price_subtotal: r['price_subtotal'] as number,
  }));
}

/**
 * Retrieve the PDF of an invoice as a Buffer.
 *
 * Strategy: read the `message_main_attachment_id` field on account.move, then
 * fetch the `datas` (base64) field from `ir.attachment`.
 * Falls back to rendering via `ir.actions.report._render_qweb_pdf` if no
 * attachment is present.
 */
export async function getInvoicePdf(invoiceId: number): Promise<Buffer> {
  // Step 1 – read the main attachment id from the invoice
  const invoiceRecords = await execute<Array<Record<string, unknown>>>(
    'account.move',
    'read',
    [[invoiceId]],
    { fields: ['message_main_attachment_id'] },
  );

  if (!invoiceRecords.length) {
    throw new Error(`Invoice ${invoiceId} not found.`);
  }

  const attachmentField = invoiceRecords[0]['message_main_attachment_id'];

  if (attachmentField && Array.isArray(attachmentField) && attachmentField[0]) {
    // Step 2a – attachment exists, read its base64 data
    const attachmentId = attachmentField[0] as number;
    const attachments = await execute<Array<Record<string, unknown>>>(
      'ir.attachment',
      'read',
      [[attachmentId]],
      { fields: ['datas', 'mimetype', 'name'] },
    );

    if (attachments.length && attachments[0]['datas']) {
      const b64 = attachments[0]['datas'] as string;
      return Buffer.from(b64, 'base64');
    }
  }

  // Step 2b – no attachment, render the PDF on the fly via ir.actions.report
  const reportResult = await execute<[string, string]>(
    'ir.actions.report',
    '_render_qweb_pdf',
    [['account.move', [invoiceId]]],
    {},
  );

  // _render_qweb_pdf returns [pdf_content_bytes_as_string, 'pdf']
  // Over XMLRPC the bytes arrive as a base64 string or raw string depending on version.
  const pdfData = reportResult[0];
  if (Buffer.isBuffer(pdfData)) {
    return pdfData;
  }
  // Odoo 16+ returns bytes serialised as base64 over XMLRPC
  return Buffer.from(pdfData, 'base64');
}

/**
 * Aggregate monthly invoice totals for a club over a consecutive range of months.
 *
 * @param clubId     - one of 'alcorcon' | 'laspalmas' | 'sanse'
 * @param startMonth - 1-based starting month
 * @param startYear  - starting year
 * @param months     - number of months to cover (inclusive)
 */
export async function getMonthlyCostSummary(
  clubId: string,
  startMonth: number,
  startYear: number,
  months: number,
): Promise<MonthlyCostEntry[]> {
  const results: MonthlyCostEntry[] = [];

  let year = startYear;
  let month = startMonth;

  for (let i = 0; i < months; i++) {
    const invoices = await getInvoicesForClub(clubId, year, month);

    const total = invoices.reduce((sum, inv) => sum + inv.amount_total, 0);

    results.push({ year, month, total, invoiceCount: invoices.length });

    // Advance month
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return results;
}
