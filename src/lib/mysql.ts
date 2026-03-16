import mysql from 'mysql2/promise';

const TENANT_MAP: Record<string, string> = {
  alcorcon: '391288ff-24db-4038-822e-2a7afe4e18ca',
  laspalmas: '59cc4563-82f3-489f-896f-665a21997cce',
  sanse: '2d45c6b7-542a-4a48-97d6-8cd0eb48a56f',
};

export interface MonthlyStats {
  month: number;
  year: number;
  label: string;
  // Partidos
  matches: number;
  matchRevenue: number;
  matchRevenueIva: number;
  matchHours: number;
  mornings: number;
  afternoons: number;
  nights: number;
  valle: number;
  punta: number;
  // Partidos año anterior
  matchesPrevYear: number;
  // Reservas
  reservations: number;
  reservationRevenue: number;
  reservationRevenueIva: number;
  // Comunidad
  whatsappUsers: number;
  totalPlayers: number;
  // Coste medio partido (calculated)
  avgMatchCost: number;
}

async function getConnection() {
  return mysql.createConnection({
    host: process.env.MYSQL_HOST || 'assistantbot.es',
    user: process.env.MYSQL_USER || 'grafana_user',
    password: process.env.MYSQL_PASSWORD || 'Playtomic2023&',
    database: process.env.MYSQL_DB || 'admin_assistantbot',
    connectTimeout: 10000,
  });
}

/**
 * Fetch monthly stats for a club from the billing table.
 * Returns data ordered chronologically (oldest first).
 */
export async function getMonthlyHistory(
  clubId: string,
  months: number = 14
): Promise<MonthlyStats[]> {
  const tenantId = TENANT_MAP[clubId];
  if (!tenantId) return [];

  let conn;
  try {
    conn = await getConnection();

    // Use billing_all which has more complete data
    const [rows] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT Mes, \`Año\`, jpartidos, jpartidos0, jreservas, jreservas0,
              \`Usuarios acumulados grupos\`, \`Jugadores totales\`
       FROM billing_all
       WHERE tenant_id = ?
       ORDER BY \`Año\` DESC, CAST(Mes AS UNSIGNED) DESC
       LIMIT ?`,
      [tenantId, months]
    );

    const results: MonthlyStats[] = [];

    for (const row of rows) {
      const month = parseInt(String(row.Mes)) || 0;
      const year = parseInt(String(row['Año'])) || 0;
      if (!month || !year) continue;

      const jp = row.jpartidos ? JSON.parse(row.jpartidos) : {};
      const jp0 = row.jpartidos0 ? JSON.parse(row.jpartidos0) : {};
      const jr = row.jreservas ? JSON.parse(row.jreservas) : {};

      const matchCount = Number(jp.count) || 0;
      const matchRev = Number(jp.facturacion) || 0;

      results.push({
        month,
        year,
        label: `${MONTH_SHORT[month - 1]} ${year}`,
        matches: matchCount,
        matchRevenue: matchRev,
        matchRevenueIva: Number(jp.facturacion_iva) || 0,
        matchHours: Number(jp.horas) || 0,
        mornings: Number(jp.mañanas) || 0,
        afternoons: Number(jp.tardes) || 0,
        nights: Number(jp.noches) || 0,
        valle: Number(jp.valle) || 0,
        punta: Number(jp.punta) || 0,
        matchesPrevYear: Number(jp0.count) || 0,
        reservations: Number(jr.count) || 0,
        reservationRevenue: Number(jr.facturacion) || 0,
        reservationRevenueIva: Number(jr.facturacion_iva) || 0,
        whatsappUsers: Number(row['Usuarios acumulados grupos']) || 0,
        totalPlayers: Number(row['Jugadores totales']) || 0,
        avgMatchCost: matchCount > 0 ? matchRev / matchCount : 0,
      });
    }

    // Reverse to chronological order (oldest first)
    results.reverse();
    return results;
  } catch (err) {
    console.error('[mysql] Error fetching monthly history:', err);
    return [];
  } finally {
    if (conn) await conn.end();
  }
}

const MONTH_SHORT = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];
