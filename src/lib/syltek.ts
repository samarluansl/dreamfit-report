/**
 * syltek.ts
 *
 * Handles all data fetching from Syltek CRM instances via HTML scraping.
 *
 * Each club has its own subdomain. Authentication is done via form POST and
 * the resulting session cookie is cached in-memory for the lifetime of the
 * Node process (server-side only). If a subsequent request receives a redirect
 * back to the login page the cached cookie is evicted and a fresh login is
 * performed transparently.
 */

import * as cheerio from 'cheerio';

// ---------------------------------------------------------------------------
// Club configuration
// ---------------------------------------------------------------------------

export type ClubId = keyof typeof CLUBS;

export const CLUBS = {
  alcorcon: {
    name: 'Dreamfit Alcorcón',
    baseUrl: 'https://dreamfitalcorcon.syltek.com',
    pathPrefix: '',
  },
  laspalmas: {
    name: 'Dreamfit Las Palmas',
    baseUrl: 'https://dreamfitlaspalmas.syltek.com',
    pathPrefix: '',
  },
  sanse: {
    name: 'Dreamfit Sanse',
    baseUrl: 'https://dreamfitsanse.syltek.com',
    pathPrefix: '',
  },
} as const;

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export interface CourtOccupancyRow {
  /** Court / installation name as shown in the CRM */
  name: string;
  hoursAvailable: number;
  hoursOccupied: number;
  /** Percentage 0-100 */
  percentage: number;
}

export interface OccupancyByTypeRow {
  /** Day label (e.g. "Lunes", "1", date string) */
  day: string;
  /** Reservation type label (e.g. "Reserva", "Escuela", "Torneo") */
  type: string;
  hours: number;
}

export interface BillingDayEntry {
  day: number;
  amount: number;
}

export interface BillingBreakdownRow {
  day: number;
  method: string;
  amount: number;
}

export interface BillingByMonth {
  /** Grand total for the period */
  total: number;
  dailyData: BillingDayEntry[];
  breakdown: BillingBreakdownRow[];
}

export interface SchoolPupils {
  total: number;
  members: number;
}

// ---------------------------------------------------------------------------
// Internal session cache
// ---------------------------------------------------------------------------

/** Cookie name used by all Syltek instances */
const SESSION_COOKIE_NAME = '4358260989987';

/** In-memory store: clubId -> session cookie value */
const sessionCache = new Map<ClubId, string>();

// ---------------------------------------------------------------------------
// Credentials helpers
// ---------------------------------------------------------------------------

function getCredentials(): { username: string; password: string } {
  const username = process.env.SYLTEK_USERNAME;
  const password = process.env.SYLTEK_PASSWORD;

  if (!username || !password) {
    throw new Error(
      'Missing SYLTEK_USERNAME or SYLTEK_PASSWORD environment variables.'
    );
  }

  return { username, password };
}

// ---------------------------------------------------------------------------
// Login / session management
// ---------------------------------------------------------------------------

/**
 * Perform a fresh login for a club and cache the resulting session cookie.
 * Throws if login fails or the expected cookie is not returned.
 */
async function login(clubId: ClubId): Promise<string> {
  const { baseUrl } = CLUBS[clubId];
  const { username, password } = getCredentials();

  const body = new URLSearchParams({
    userName: username,
    password: password,
  });

  const response = await fetch(`${baseUrl}/system/account/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent':
        'Mozilla/5.0 (compatible; DreamfitReport/1.0)',
    },
    body: body.toString(),
    redirect: 'manual',
  });

  // The server usually responds with a redirect after a successful login.
  const setCookieHeaders = response.headers.getSetCookie?.() ?? [];

  // Fallback for environments where getSetCookie is not available.
  let cookieValue: string | null = null;

  if (setCookieHeaders.length > 0) {
    for (const header of setCookieHeaders) {
      const match = header.match(
        new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`)
      );
      if (match) {
        cookieValue = match[1];
        break;
      }
    }
  }

  // Some Node versions expose the raw header string instead of an array.
  if (!cookieValue) {
    const rawCookie = response.headers.get('set-cookie') ?? '';
    const match = rawCookie.match(
      new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`)
    );
    if (match) cookieValue = match[1];
  }

  if (!cookieValue) {
    throw new Error(
      `Login to ${baseUrl} did not return the expected session cookie ` +
        `(${SESSION_COOKIE_NAME}). Status: ${response.status}`
    );
  }

  sessionCache.set(clubId, cookieValue);
  return cookieValue;
}

/**
 * Return the cached session cookie for a club, or perform login first.
 */
async function getSession(clubId: ClubId): Promise<string> {
  const cached = sessionCache.get(clubId);
  if (cached) return cached;
  return login(clubId);
}

/**
 * True when a response is a redirect pointing back to the login page.
 */
function isLoginRedirect(response: Response): boolean {
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location') ?? '';
    return location.includes('/account/login') || location.includes('/login');
  }
  // Also check for soft redirects where the body is a login page
  return false;
}

// ---------------------------------------------------------------------------
// Authenticated fetch wrapper
// ---------------------------------------------------------------------------

interface FetchOptions {
  method?: 'GET' | 'POST';
  formData?: Record<string, string>;
}

/**
 * Perform an authenticated GET/POST request for a club. If the server redirects
 * to the login page the session is evicted, a fresh login is attempted, and the
 * request is retried once.
 *
 * Returns the response text, or null if an unrecoverable error occurs.
 */
async function syltekFetch(
  clubId: ClubId,
  path: string,
  options: FetchOptions = {},
  retry = true
): Promise<string | null> {
  const { baseUrl } = CLUBS[clubId];
  const cookieValue = await getSession(clubId);

  const headers: Record<string, string> = {
    Cookie: `${SESSION_COOKIE_NAME}=${cookieValue}`,
    'User-Agent': 'Mozilla/5.0 (compatible; DreamfitReport/1.0)',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9',
  };

  let body: string | undefined;
  if (options.method === 'POST' && options.formData) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(options.formData).toString();
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body,
      redirect: 'manual',
    });
  } catch (err) {
    console.error(`[syltek] Network error fetching ${baseUrl}${path}:`, err);
    return null;
  }

  if (isLoginRedirect(response)) {
    if (!retry) {
      console.error(
        `[syltek] Session expired for ${clubId} and re-login failed.`
      );
      return null;
    }
    // Evict stale session and retry
    sessionCache.delete(clubId);
    try {
      await login(clubId);
    } catch (err) {
      console.error(`[syltek] Re-login failed for ${clubId}:`, err);
      return null;
    }
    return syltekFetch(clubId, path, options, false);
  }

  if (!response.ok && response.status !== 200) {
    console.error(
      `[syltek] Unexpected status ${response.status} for ${baseUrl}${path}`
    );
    return null;
  }

  try {
    return await response.text();
  } catch (err) {
    console.error(`[syltek] Failed to read response body:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Utility: parse numbers from strings with Spanish locale ("1.234,56" -> 1234.56)
// ---------------------------------------------------------------------------

function parseSpanishNumber(raw: string): number {
  // Remove thousand separators (dots) then replace decimal comma with dot
  const clean = raw.replace(/\./g, '').replace(',', '.').trim();
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

/**
 * Extract a JS variable assignment from raw HTML:
 *   var <varName> = <value>;
 * Returns the matched value string or null.
 */
function extractScriptVar(html: string, varName: string): string | null {
  // Matches both single-line and compact assignments
  const pattern = new RegExp(
    `var\\s+${varName}\\s*=\\s*([\\s\\S]*?);\\s*(?:var\\s|\\n|$)`
  );
  const match = html.match(pattern);
  return match ? match[1].trim() : null;
}

// ---------------------------------------------------------------------------
// 1. Occupancy by court
// ---------------------------------------------------------------------------

/**
 * Fetch occupancy statistics broken down by court/installation.
 *
 * @param clubId  Target club
 * @param startDate  "DD/MM/YYYY"
 * @param endDate    "DD/MM/YYYY"
 */
export async function fetchOccupancyByCourt(
  clubId: ClubId,
  startDate: string,
  endDate: string
): Promise<CourtOccupancyRow[] | null> {
  const params = new URLSearchParams({
    startDate,
    endDate,
  });

  const html = await syltekFetch(
    clubId,
    `/reporting/occupancyByDates?${params.toString()}`
  );
  if (!html) return null;

  try {
    const $ = cheerio.load(html);
    const rows: CourtOccupancyRow[] = [];

    $('table.reportData tbody tr').each((_i, el) => {
      const cells = $(el).find('td');
      if (cells.length < 4) return;

      const name = $(cells[0]).text().trim();
      const hoursAvailable = parseSpanishNumber($(cells[1]).text());
      const hoursOccupied = parseSpanishNumber($(cells[2]).text());
      const percentage = parseSpanishNumber(
        $(cells[3]).text().replace('%', '')
      );

      if (!name) return; // Skip empty rows / totals without a name

      rows.push({ name, hoursAvailable, hoursOccupied, percentage });
    });

    return rows;
  } catch (err) {
    console.error('[syltek] Error parsing occupancy-by-court HTML:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 2. Occupancy by day / reservation type
// ---------------------------------------------------------------------------

/**
 * Fetch occupancy breakdown by day of week and reservation type.
 *
 * The CRM page at /reporting/occupancybyday accepts optional POST form data
 * for date filtering (startDate / endDate). When called without filters the
 * server returns the current week.
 *
 * @param clubId
 * @param startDate  Optional "DD/MM/YYYY"
 * @param endDate    Optional "DD/MM/YYYY"
 */
export async function fetchOccupancyByDayAndType(
  clubId: ClubId,
  startDate?: string,
  endDate?: string
): Promise<OccupancyByTypeRow[] | null> {
  const formData: Record<string, string> = {};
  if (startDate) formData.startDate = startDate;
  if (endDate) formData.endDate = endDate;

  const hasFilters = Object.keys(formData).length > 0;

  const html = await syltekFetch(
    clubId,
    '/reporting/occupancybyday',
    hasFilters ? { method: 'POST', formData } : {}
  );
  if (!html) return null;

  try {
    const $ = cheerio.load(html);
    const rows: OccupancyByTypeRow[] = [];

    // The table with class "chartData" has a header row with type columns.
    // Structure:
    //   <thead> <tr> <th>Día</th> <th>Reserva</th> <th>Escuela</th> ... </tr> </thead>
    //   <tbody> <tr> <td>Lunes</td> <td>3.5</td> ... </tr> ... </tbody>

    const table = $('table.chartData');
    if (table.length === 0) {
      // Fallback: try to read chartOccupancyByHour from embedded JS
      return parseOccupancyByHourFromScript(html);
    }

    const typeHeaders: string[] = [];
    table.find('thead tr th').each((_i, th) => {
      typeHeaders.push($(th).text().trim());
    });

    // typeHeaders[0] is the day column label; the rest are type labels.
    table.find('tbody tr').each((_i, tr) => {
      const cells = $(tr).find('td');
      if (cells.length === 0) return;

      const day = $(cells[0]).text().trim();
      if (!day) return;

      cells.each((colIdx, td) => {
        if (colIdx === 0) return; // skip day label column
        const typeLabel = typeHeaders[colIdx] ?? `Tipo ${colIdx}`;
        const hours = parseSpanishNumber($(td).text());
        if (hours > 0) {
          rows.push({ day, type: typeLabel, hours });
        }
      });
    });

    // If we got no rows from the table try the JS fallback
    if (rows.length === 0) {
      return parseOccupancyByHourFromScript(html) ?? rows;
    }

    return rows;
  } catch (err) {
    console.error('[syltek] Error parsing occupancy-by-day HTML:', err);
    return null;
  }
}

/**
 * Secondary parser: reads `scriptVars.chartOccupancyByHour` from the page JS.
 */
function parseOccupancyByHourFromScript(
  html: string
): OccupancyByTypeRow[] | null {
  try {
    // Look for: scriptVars.chartOccupancyByHour = {...};
    const match = html.match(
      /scriptVars\.chartOccupancyByHour\s*=\s*(\{[\s\S]*?\});/
    );
    if (!match) return null;

    // The value is a JS object literal; attempt JSON parse after light cleanup.
    const raw = match[1]
      .replace(/'/g, '"')                 // single -> double quotes
      .replace(/(\w+)\s*:/g, '"$1":');    // unquoted keys -> quoted

    const parsed: Record<string, Record<string, number>> = JSON.parse(raw);
    const rows: OccupancyByTypeRow[] = [];

    for (const [type, dayMap] of Object.entries(parsed)) {
      for (const [day, hours] of Object.entries(dayMap)) {
        if (typeof hours === 'number' && hours > 0) {
          rows.push({ day, type, hours });
        }
      }
    }

    return rows;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 3. Billing by month
// ---------------------------------------------------------------------------

/**
 * Fetch billing totals for a given month and year.
 *
 * Primary data comes from `scriptVars.chartModel` embedded in the page JS.
 * HTML tables are also scraped for the breakdown by payment method.
 *
 * @param clubId
 * @param month  1-based month number (1 = January)
 * @param year   Full year (e.g. 2024)
 */
export async function fetchBillingByMonth(
  clubId: ClubId,
  month: number,
  year: number
): Promise<BillingByMonth | null> {
  const path =
    `/system/report/show/BookingsModule/paymentsbymonthreport` +
    `?reportControl_month=${month}&reportControl_year=${year}`;

  const html = await syltekFetch(clubId, path);
  if (!html) return null;

  try {
    // --- Parse chartModel from embedded JS --------------------------------
    const dailyData: BillingDayEntry[] = [];
    let total = 0;

    const chartModelRaw = extractScriptVar(html, 'chartModel');
    if (chartModelRaw) {
      // chartModel is a JSON array: [{series:[{data:[[day, amount], ...]}]}]
      // Attempt direct JSON parse first (it may already be valid JSON).
      let parsed: Array<{
        series: Array<{ data: Array<[number, number]> }>;
      }> | null = null;

      try {
        parsed = JSON.parse(chartModelRaw);
      } catch {
        // Try with single-quote normalisation
        try {
          parsed = JSON.parse(chartModelRaw.replace(/'/g, '"'));
        } catch {
          console.warn(
            '[syltek] Could not JSON.parse chartModel, falling back to HTML tables.'
          );
        }
      }

      if (parsed && Array.isArray(parsed) && parsed[0]?.series?.[0]?.data) {
        for (const [day, amount] of parsed[0].series[0].data) {
          dailyData.push({ day, amount });
          total += amount;
        }
      }
    }

    // --- Parse HTML tables for breakdown by payment method ----------------
    const $ = cheerio.load(html);
    const breakdown: BillingBreakdownRow[] = [];

    // The "desglose" (breakdown) table usually follows a "sumatorio" totals table.
    // Both are plain <table> elements. We look for any table that has a day
    // column plus payment method and amount columns.
    $('table').each((_tableIdx, tableEl) => {
      const headers: string[] = [];
      $(tableEl)
        .find('thead tr th')
        .each((_i, th) => {
          headers.push($(th).text().trim().toLowerCase());
        });

      // Heuristic: a breakdown table has "día" (or "dia") and a currency column
      const hasDayCol = headers.some(
        (h) => h === 'día' || h === 'dia' || h === 'day'
      );
      if (!hasDayCol) return;

      $(tableEl)
        .find('tbody tr')
        .each((_i, tr) => {
          const cells = $(tr).find('td');
          if (cells.length < 3) return;

          const dayRaw = $(cells[0]).text().trim();
          const day = parseInt(dayRaw, 10);
          if (isNaN(day)) return;

          // Remaining columns alternate or represent: method, amount
          // We accept two layouts:
          //   [day, method, amount]
          //   [day, amount, method] — less common
          const col1 = $(cells[1]).text().trim();
          const col2 = $(cells[2]).text().trim();

          const col1IsNum = !isNaN(parseSpanishNumber(col1));
          const method = col1IsNum ? col2 : col1;
          const amountRaw = col1IsNum ? col1 : col2;
          const amount = parseSpanishNumber(amountRaw);

          if (!method) return;

          breakdown.push({ day, method, amount });

          // If dailyData was not populated from JS, accumulate from the table
          if (dailyData.length === 0) {
            total += amount;
          }
        });
    });

    // Final fallback total: sum all breakdown rows if dailyData still empty
    if (dailyData.length === 0 && breakdown.length > 0 && total === 0) {
      total = breakdown.reduce((acc, r) => acc + r.amount, 0);
    }

    // If nothing was found, attempt to read the "sumatorio" total span/cell
    if (total === 0) {
      // Common pattern: <td class="total">1.234,56</td> or <span class="grand-total">
      const totalCandidates = [
        $('td.total').last().text(),
        $('[class*="total"]').last().text(),
      ];
      for (const candidate of totalCandidates) {
        const t = parseSpanishNumber(candidate.replace(/[€$]/g, ''));
        if (t > 0) {
          total = t;
          break;
        }
      }
    }

    return { total, dailyData, breakdown };
  } catch (err) {
    console.error('[syltek] Error parsing billing HTML:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 4. School pupils count
// ---------------------------------------------------------------------------

/**
 * Fetch the total number of school pupils and how many are club members.
 *
 * The CRM paginates results; the total count is read from the pagination header
 * "1-N de N" (Spanish) or similar. No need to iterate all pages.
 */
export async function fetchSchoolPupils(
  clubId: ClubId
): Promise<SchoolPupils | null> {
  const [totalHtml, membersHtml] = await Promise.all([
    syltekFetch(clubId, '/pupils/coursePupils'),
    syltekFetch(clubId, '/pupils/coursePupils?customertype=socio'),
  ]);

  if (!totalHtml) return null;

  function extractRowCount(html: string): number {
    const $ = cheerio.load(html);

    // Pattern 1: "1-25 de 137" anywhere in text
    const pageText = $('body').text();
    const deMatch = pageText.match(/\bde\s+(\d[\d.,]*)\b/i);
    if (deMatch) {
      const n = parseInt(deMatch[1].replace(/[.,]/g, ''), 10);
      if (!isNaN(n)) return n;
    }

    // Pattern 2: data attribute on a pagination element
    const paginationTotal = $('[data-total], [data-count]').first();
    if (paginationTotal.length) {
      const attr =
        paginationTotal.attr('data-total') ??
        paginationTotal.attr('data-count') ??
        '';
      const n = parseInt(attr, 10);
      if (!isNaN(n)) return n;
    }

    // Pattern 3: count the actual tbody rows as a last resort
    const rowCount = $('table tbody tr').length;
    return rowCount;
  }

  const total = extractRowCount(totalHtml);
  const members = membersHtml ? extractRowCount(membersHtml) : 0;

  return { total, members };
}

// ---------------------------------------------------------------------------
// Convenience: fetch all data for a club in parallel
// ---------------------------------------------------------------------------

export interface ClubSnapshot {
  clubId: ClubId;
  clubName: string;
  occupancyByCourt: CourtOccupancyRow[] | null;
  occupancyByDayAndType: OccupancyByTypeRow[] | null;
  billing: BillingByMonth | null;
  schoolPupils: SchoolPupils | null;
}

/**
 * Fetch every metric for a single club within a date range.
 * All requests run in parallel; individual failures return null for that metric.
 *
 * @param clubId
 * @param startDate   "DD/MM/YYYY"
 * @param endDate     "DD/MM/YYYY"
 * @param billingMonth  1-based month
 * @param billingYear   Full year
 */
export async function fetchClubSnapshot(
  clubId: ClubId,
  startDate: string,
  endDate: string,
  billingMonth: number,
  billingYear: number
): Promise<ClubSnapshot> {
  const [occupancyByCourt, occupancyByDayAndType, billing, schoolPupils] =
    await Promise.all([
      fetchOccupancyByCourt(clubId, startDate, endDate),
      fetchOccupancyByDayAndType(clubId, startDate, endDate),
      fetchBillingByMonth(clubId, billingMonth, billingYear),
      fetchSchoolPupils(clubId),
    ]);

  return {
    clubId,
    clubName: CLUBS[clubId].name,
    occupancyByCourt,
    occupancyByDayAndType,
    billing,
    schoolPupils,
  };
}

/**
 * Fetch snapshots for all clubs in parallel.
 */
export async function fetchAllClubSnapshots(
  startDate: string,
  endDate: string,
  billingMonth: number,
  billingYear: number
): Promise<ClubSnapshot[]> {
  const clubIds = Object.keys(CLUBS) as ClubId[];
  return Promise.all(
    clubIds.map((id) =>
      fetchClubSnapshot(id, startDate, endDate, billingMonth, billingYear)
    )
  );
}
