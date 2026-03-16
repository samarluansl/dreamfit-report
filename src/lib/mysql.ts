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
  matches: number;
  matchRevenue: number;
  matchHours: number;
  mornings: number;    // punta mañanas
  afternoons: number;  // punta tardes
  nights: number;      // valle noches
  reservations: number;
  reservationRevenue: number;
  whatsappUsers: number;
  totalPlayers: number;
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

    const [rows] = await conn.execute<mysql.RowDataPacket[]>(
      `SELECT Mes, \`Año\`, jpartidos, jreservas, jcursos,
              \`Usuarios acumulados grupos\`, \`Jugadores totales\`
       FROM billing 
       WHERE tenant_id = ?
       ORDER BY STR_TO_DATE(CONCAT('1/', Mes), '%d/%m/%Y') DESC
       LIMIT ?`,
      [tenantId, months]
    );

    const results: MonthlyStats[] = [];

    for (const row of rows) {
      const mesStr = String(row.Mes || '');
      const parts = mesStr.split('/');
      const month = parseInt(parts[0]) || 0;
      const year = parseInt(parts[1] || row['Año'] || '0');
      if (!month || !year) continue;

      const jp = row.jpartidos ? JSON.parse(row.jpartidos) : {};
      const jr = row.jreservas ? JSON.parse(row.jreservas) : {};

      results.push({
        month,
        year,
        label: `${MONTH_SHORT[month - 1]} ${year}`,
        matches: Number(jp.count) || 0,
        matchRevenue: Number(jp.facturacion) || 0,
        matchHours: Number(jp.horas) || 0,
        mornings: Number(jp.mañanas) || 0,
        afternoons: Number(jp.tardes) || 0,
        nights: Number(jp.noches) || 0,
        reservations: Number(jr.count) || 0,
        reservationRevenue: Number(jr.facturacion) || 0,
        whatsappUsers: Number(row['Usuarios acumulados grupos']) || 0,
        totalPlayers: Number(row['Jugadores totales']) || 0,
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
