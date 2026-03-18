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

export interface BookerStats {
  /** Total reservations in the period (Status != cancelled) */
  totalReservations: number;
  /** Reservations by socios */
  socioReservations: number;
  /** Reservations by no-socios */
  noSocioReservations: number;
  /** Reservations by staff */
  staffReservations: number;
  /** Reservations from Playtomic (Name = Playtomic) */
  playtomicReservations: number;
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

  const bodyStr = body.toString();
  const response = await fetch(`${baseUrl}/system/account/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': String(Buffer.byteLength(bodyStr)),
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-ES,es;q=0.9',
      'Origin': baseUrl,
      'Referer': `${baseUrl}/system/account/login`,
    },
    body: bodyStr,
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
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9',
  };

  let body: string | undefined;
  if (options.method === 'POST' && options.formData) {
    body = new URLSearchParams(options.formData).toString();
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    headers['Content-Length'] = String(Buffer.byteLength(body));
    headers['Referer'] = `${baseUrl}${path}`;
    headers['Origin'] = baseUrl;
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

    $('table.reportData tr').each((_i, el) => {
      const $row = $(el);
      // Skip header row and totals row
      if ($row.hasClass('headerRow') || $row.hasClass('totalsRow')) return;

      const cells = $row.find('td');
      if (cells.length < 4) return;

      const name = $(cells[0]).text().trim();
      // Skip header-like rows (when there's no explicit thead)
      if (!name || name === 'Instalación' || name === 'Total') return;

      const hoursAvailable = parseSpanishNumber($(cells[1]).text());
      const hoursOccupied = parseSpanishNumber($(cells[2]).text());
      const percentage = parseSpanishNumber(
        $(cells[3]).text().replace('%', '')
      );

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
  // Syltek requires a GET to the page first (establishes session context),
  // then a POST with advanced search filters to get the data.
  // Filter 0: StartDate >= startDate (comparer 6)
  // Filter 1: StartDate <= endDate   (comparer 7)

  // Step 1: GET the page (session setup / CSRF)
  await syltekFetch(clubId, '/reporting/occupancybyday');

  // Step 2: POST with filters
  const formFields: Record<string, string> = {
    'Reservations_metaview_gridName': 'Reservations',
    'Reservations_advancedSearch': 'true',
    'Monday': 'on',
    'Tuesday': 'on',
    'Wednesday': 'on',
    'Thursday': 'on',
    'Friday': 'on',
    'Saturday': 'on',
    'Sunday': 'on',
  };
  if (startDate) {
    formFields['Reservations_searchProperty_0'] = 'StartDate';
    formFields['Reservations_searchComparer_0'] = '6'; // >= (greater than or equal)
    formFields['Reservations_searchValue_0'] = startDate;
  }
  if (endDate) {
    formFields['Reservations_searchProperty_1'] = 'StartDate';
    formFields['Reservations_searchComparer_1'] = '7'; // <= (less than or equal)
    formFields['Reservations_searchValue_1'] = endDate;
  }

  const html = await syltekFetch(
    clubId,
    '/reporting/occupancybyday',
    { method: 'POST', formData: formFields }
  );
  if (!html) return null;

  try {
    // Try JS data first (most reliable when available)
    const jsResult = parseOccupancyByHourFromScript(html);
    if (jsResult && jsResult.length > 0) return jsResult;

    // Fallback: parse HTML table with class "chartData"
    const $ = cheerio.load(html);
    const rows: OccupancyByTypeRow[] = [];

    const table = $('table.chartData');
    if (table.length === 0) return rows.length > 0 ? rows : null;

    // Get type headers from first row (th or td)
    const typeHeaders: string[] = [];
    table.find('tr').first().find('th, td').each((_i, el) => {
      typeHeaders.push($(el).text().trim());
    });

    // Data rows
    table.find('tr').slice(1).each((_i, tr) => {
      const cells = $(tr).find('td');
      if (cells.length === 0) return;

      const day = $(cells[0]).text().trim();
      if (!day || day === 'Total') return;

      cells.each((colIdx, td) => {
        if (colIdx === 0) return;
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
    // chartOccupancyByHour is inside scriptVars as:
    //   chartOccupancyByHour:[{"key":"Reserva","color":{...},"points":[[0, val], [1, val], ...]}, ...]
    // columnsOccupancyByHour:["lunes","martes",...]
    const dataMatch = html.match(
      /chartOccupancyByHour:\s*(\[[\s\S]*?\])\s*,\s*columnsOccupancyByHour/
    );
    const colsMatch = html.match(
      /columnsOccupancyByHour:\s*(\[[\s\S]*?\])\s*,/
    );

    if (!dataMatch) return null;

    interface ChartSeries {
      key: string;
      points: Array<[number, number]>;
    }

    const series: ChartSeries[] = JSON.parse(dataMatch[1]);
    const dayLabels: string[] = colsMatch ? JSON.parse(colsMatch[1]) : [];

    const rows: OccupancyByTypeRow[] = [];

    for (const s of series) {
      for (const [dayIdx, hours] of s.points) {
        if (hours > 0) {
          const day = dayLabels[dayIdx] ?? String(dayIdx);
          rows.push({ day, type: s.key, hours });
        }
      }
    }

    return rows;
  } catch (err) {
    console.error('[syltek] Error parsing chartOccupancyByHour:', err);
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

    // chartModel is inside scriptVars: var scriptVars = { ..., chartModel: [...], ... }
    // Extract it with a regex that matches the array
    let chartModelRaw = extractScriptVar(html, 'chartModel');
    if (!chartModelRaw) {
      const cmMatch = html.match(/chartModel:\s*(\[[\s\S]*?\])\s*,\s*menuNodes/);
      if (cmMatch) chartModelRaw = cmMatch[1];
    }
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
  // Single request — count socios from the "Tipo Cliente" column in HTML
  const html = await syltekFetch(clubId, '/pupils/coursePupils');
  if (!html) return null;

  try {
    const $ = cheerio.load(html);

    // Total from pagination header "1-N de N"
    let total = 0;
    const rowCountSpan = $('.rowCount').text();
    const deMatch = rowCountSpan.match(/de\s+(\d+)/);
    if (deMatch) {
      total = parseInt(deMatch[1], 10);
    } else {
      // Fallback: count content rows (exclude tag rows)
      total = $('table.listGrid tr.contentRow').length;
    }

    // Count members by finding ">Socio<" in the Tipo Cliente column
    let members = 0;
    $('table.listGrid tr.contentRow td').each((_i, el) => {
      const text = $(el).text().trim();
      if (text === 'Socio') members++;
    });

    return { total, members };
  } catch (err) {
    console.error('[syltek] Error parsing pupils:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 5. Total socios count (from Customers page)
// ---------------------------------------------------------------------------

/**
 * Fetch the total number of "Socio" customers from the CRM.
 * Only reads the pagination header — no need to iterate pages.
 */
export async function fetchTotalSocios(clubId: ClubId): Promise<number> {
  const params = new URLSearchParams({
    'Customers_metaview_gridName': 'Customers',
    'Customers_searchProperty_0': 'IdCustomerType',
    'Customers_searchComparer_0': '=',
    'Customers_searchValue_0': 'socio',
    'Customers_advancedSearch': 'true',
    'Customers_metaview_pageSize': '20',
  });

  const html = await syltekFetch(clubId, `/bookings/customers/browse?${params.toString()}`);
  if (!html) return 0;

  try {
    const $ = cheerio.load(html);
    // Pagination shows "1-20 de 41.032" — extract the total
    const rowCountText = $('.rowCount').text();
    const deMatch = rowCountText.match(/de\s+([\d.]+)/);
    if (deMatch) {
      return parseInt(deMatch[1].replace(/\./g, ''), 10);
    }
    // Fallback: "Los N Clientes" link
    const losMatch = html.match(/Los\s+([\d.]+)\s+Clientes/);
    if (losMatch) {
      return parseInt(losMatch[1].replace(/\./g, ''), 10);
    }
    return 0;
  } catch (err) {
    console.error('[syltek] Error parsing total socios:', err);
    return 0;
  }
}

// ---------------------------------------------------------------------------
// 6. Reservation stats by customer type (socios que reservan)
// ---------------------------------------------------------------------------

/**
 * Read the total count from a Syltek browse page pagination header.
 * Expects "1-20 de N" or "Los N ..." format.
 */
function parsePaginationTotal(html: string): number {
  const $ = cheerio.load(html);
  const rowCountText = $('.rowCount').text();
  const deMatch = rowCountText.match(/de\s+([\d.]+)/);
  if (deMatch) return parseInt(deMatch[1].replace(/\./g, ''), 10);
  // Fallback: "Los N Reservas" link
  const losMatch = html.match(/Los\s+([\d.]+)\s+/);
  if (losMatch) return parseInt(losMatch[1].replace(/\./g, ''), 10);
  return 0;
}

/**
 * Map a target month/year to the Syltek date preset comparer.
 *
 * Syltek browse pages use numeric preset comparers for date fields:
 *   5 = this month
 *   6 = last month
 *   11 = 2 months ago
 *
 * Returns the comparer string, or null if the target month is too old.
 */
function getDateComparer(targetMonth: number, targetYear: number): string | null {
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-based
  const currentYear = now.getFullYear();

  const monthsBack =
    (currentYear - targetYear) * 12 + (currentMonth - targetMonth);

  if (monthsBack === 0) return '5';  // this month
  if (monthsBack === 1) return '6';  // last month
  if (monthsBack === 2) return '11'; // 2 months ago
  return null; // not supported for older months
}

/**
 * Fetch reservation counts broken down by customer type for a given month.
 *
 * Uses Syltek date presets (comparer 5/6/11) since the browse page doesn't
 * accept explicit date ranges. Makes 4 lightweight requests reading only
 * pagination totals.
 */
export async function fetchBookerStats(
  clubId: ClubId,
  _startDate: string,
  _endDate: string,
  month?: number,
  year?: number
): Promise<BookerStats | null> {
  // Determine the correct date preset comparer
  const dateComparer = month && year ? getDateComparer(month, year) : '6';
  if (!dateComparer) return null; // month too old for browse page presets

  // Base filters: Status != 2 (cancelled) + date preset
  const baseFilters: Record<string, string> = {
    'Reservations_metaview_gridName': 'Reservations',
    'Reservations_advancedSearch': 'true',
    'Reservations_metaview_pageSize': '20',
    'Reservations_searchProperty_0': 'Status',
    'Reservations_searchComparer_0': '!=',
    'Reservations_searchValue_0': '2',
    'Reservations_searchOperator_1': 'and',
    'Reservations_searchProperty_1': 'StartDate',
    'Reservations_searchComparer_1': dateComparer,
  };

  // GET the page first (session setup)
  await syltekFetch(clubId, '/bookings/reservations/browse');

  // Query 1: Total reservations
  const htmlTotal = await syltekFetch(clubId, '/bookings/reservations/browse', {
    method: 'POST', formData: baseFilters,
  });
  const totalReservations = htmlTotal ? parsePaginationTotal(htmlTotal) : 0;
  if (totalReservations === 0) return null;

  // Query 2: Socio reservations (add filter IdCustomerType = Socio)
  await syltekFetch(clubId, '/bookings/reservations/browse');
  const socioFilters = {
    ...baseFilters,
    'Reservations_searchOperator_2': 'and',
    'Reservations_searchProperty_2': 'IdCustomerType',
    'Reservations_searchComparer_2': '=',
    'Reservations_searchValue_2': 'Socio',
  };
  const htmlSocio = await syltekFetch(clubId, '/bookings/reservations/browse', {
    method: 'POST', formData: socioFilters,
  });
  const socioReservations = htmlSocio ? parsePaginationTotal(htmlSocio) : 0;

  // Query 3: Staff reservations
  await syltekFetch(clubId, '/bookings/reservations/browse');
  const staffFilters = {
    ...baseFilters,
    'Reservations_searchOperator_2': 'and',
    'Reservations_searchProperty_2': 'IdCustomerType',
    'Reservations_searchComparer_2': '=',
    'Reservations_searchValue_2': 'Staff',
  };
  const htmlStaff = await syltekFetch(clubId, '/bookings/reservations/browse', {
    method: 'POST', formData: staffFilters,
  });
  const staffReservations = htmlStaff ? parsePaginationTotal(htmlStaff) : 0;

  // Query 4: Playtomic reservations (Name = Playtomic)
  await syltekFetch(clubId, '/bookings/reservations/browse');
  const playtomicFilters = {
    ...baseFilters,
    'Reservations_searchOperator_2': 'and',
    'Reservations_searchProperty_2': 'Name',
    'Reservations_searchComparer_2': '=',
    'Reservations_searchValue_2': 'Playtomic',
  };
  const htmlPlaytomic = await syltekFetch(clubId, '/bookings/reservations/browse', {
    method: 'POST', formData: playtomicFilters,
  });
  const playtomicReservations = htmlPlaytomic ? parsePaginationTotal(htmlPlaytomic) : 0;

  const noSocioReservations = totalReservations - socioReservations - staffReservations;

  return {
    totalReservations,
    socioReservations,
    noSocioReservations,
    staffReservations,
    playtomicReservations,
  };
}

// ---------------------------------------------------------------------------
// 6. Aggregate type hours from OccupancyByTypeRow[]
// ---------------------------------------------------------------------------

export interface MonthTypeOccupancy {
  schoolHours: number;
  tournamentHours: number;
  leagueHours: number;
  totalHours: number;
}

/**
 * Aggregate OccupancyByTypeRow[] into school, tournament and league hour totals.
 *
 * Matching logic (case-insensitive):
 *   - "escuela" or "competición" -> schoolHours
 *   - "torneo"                   -> tournamentHours
 *   - "liga" or "ranking"        -> leagueHours
 *   - everything else            -> counted in totalHours only
 */
export function aggregateTypeHours(rows: OccupancyByTypeRow[]): MonthTypeOccupancy {
  let schoolHours = 0;
  let tournamentHours = 0;
  let leagueHours = 0;
  let totalHours = 0;

  for (const r of rows) {
    totalHours += r.hours;
    const t = r.type.toLowerCase();
    if (t.includes('escuela') || t.includes('competición') || t.includes('competicion')) {
      schoolHours += r.hours;
    } else if (t.includes('torneo')) {
      tournamentHours += r.hours;
    } else if (t.includes('liga') || t.includes('ranking')) {
      leagueHours += r.hours;
    }
  }

  return { schoolHours, tournamentHours, leagueHours, totalHours };
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
  bookerStats: BookerStats | null;
  totalSocios: number;
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
  const [occupancyByCourt, occupancyByDayAndType, billing, schoolPupils, bookerStats, totalSocios] =
    await Promise.all([
      fetchOccupancyByCourt(clubId, startDate, endDate),
      fetchOccupancyByDayAndType(clubId, startDate, endDate),
      fetchBillingByMonth(clubId, billingMonth, billingYear),
      fetchSchoolPupils(clubId),
      fetchBookerStats(clubId, startDate, endDate, billingMonth, billingYear),
      fetchTotalSocios(clubId),
    ]);

  return {
    clubId,
    clubName: CLUBS[clubId].name,
    occupancyByCourt,
    occupancyByDayAndType,
    billing,
    schoolPupils,
    bookerStats,
    totalSocios,
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
