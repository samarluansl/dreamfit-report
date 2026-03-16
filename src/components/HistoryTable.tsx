import type { MonthlyStats } from '@/lib/mysql';

export interface CurrentMonthExtra {
  schoolHours: number;
  tournamentHours: number;
  totalPupils: number;
  totalMembers: number;
  month: number;
  year: number;
}

interface HistoryTableProps {
  data: MonthlyStats[];
  currentMonthExtra?: CurrentMonthExtra;
}

function fmt(n: number): string {
  if (!n) return '-';
  return n.toLocaleString('es-ES');
}

function fmtEur(n: number): string {
  if (!n) return '-';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtPct(n: number): string {
  if (!n) return '-';
  return `${n.toFixed(1).replace('.', ',')}%`;
}

export default function HistoryTable({ data, currentMonthExtra }: HistoryTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-gray-400 text-sm">
        Sin datos historicos
      </div>
    );
  }

  const sections = [
    {
      title: 'PARTIDOS',
      rows: [
        { label: 'Partidos totales', key: 'matches' as const, format: fmt },
        { label: 'Partidos año anterior', key: 'matchesPrevYear' as const, format: fmt },
        { label: 'Ingresos por partidos', key: 'matchRevenue' as const, format: fmtEur },
        { label: 'Ingresos partidos (IVA)', key: 'matchRevenueIva' as const, format: fmtEur },
        { label: 'Horas partidos', key: 'matchHours' as const, format: fmt },
        { label: 'Coste medio partido', key: 'avgMatchCost' as const, format: fmtEur },
        { label: 'Partidos punta', key: 'punta' as const, format: fmt },
        { label: 'Partidos valle', key: 'valle' as const, format: fmt },
      ],
    },
    {
      title: 'RESERVAS',
      rows: [
        { label: 'Reservas totales', key: 'reservations' as const, format: fmt },
        { label: 'Ingresos por reservas', key: 'reservationRevenue' as const, format: fmtEur },
        { label: 'Ingresos reservas (IVA)', key: 'reservationRevenueIva' as const, format: fmtEur },
      ],
    },
    {
      title: 'COMUNIDAD',
      rows: [
        { label: 'Usuarios grupos WhatsApp', key: 'whatsappUsers' as const, format: fmt },
      ],
    },
  ];

  /** Determine the column index that matches currentMonthExtra's month/year */
  const currentColIdx = currentMonthExtra
    ? data.findIndex(
        (d) =>
          d.month === currentMonthExtra.month &&
          d.year === currentMonthExtra.year
      )
    : -1;

  /** Build per-column values for extra rows: value for current month, '-' otherwise */
  function extraColValue(colIdx: number, value: string): string {
    return colIdx === currentColIdx ? value : '-';
  }

  const membersPct =
    currentMonthExtra && currentMonthExtra.totalPupils > 0
      ? (currentMonthExtra.totalMembers / currentMonthExtra.totalPupils) * 100
      : 0;

  const extraSections = currentMonthExtra
    ? [
        {
          title: 'ESCUELA Y COMPETICION',
          rows: [
            {
              label: 'Horas de ocupación escuela',
              values: data.map((_, i) =>
                extraColValue(i, fmt(currentMonthExtra.schoolHours))
              ),
            },
            {
              label: 'Nº de alumnos',
              values: data.map((_, i) =>
                extraColValue(i, fmt(currentMonthExtra.totalPupils))
              ),
            },
            {
              label: 'Porcentaje de socios',
              values: data.map((_, i) =>
                extraColValue(i, fmtPct(membersPct))
              ),
            },
          ],
        },
        {
          title: 'TORNEOS',
          rows: [
            {
              label: 'Horas de ocupación por torneos',
              values: data.map((_, i) =>
                extraColValue(i, fmt(currentMonthExtra.tournamentHours))
              ),
            },
          ],
        },
      ]
    : [];

  return (
    <div className="overflow-x-auto">
      <table className="report-table text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-[#f9fafb] z-10 min-w-[180px]"></th>
            {data.map((d) => (
              <th key={`${d.month}-${d.year}`} className="text-right whitespace-nowrap min-w-[90px]">
                {d.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => (
            <>
              <tr key={section.title}>
                <td
                  colSpan={data.length + 1}
                  className="bg-[#1B2A4A] text-white font-semibold text-[11px] uppercase tracking-wider py-1.5 px-4"
                >
                  {section.title}
                </td>
              </tr>
              {section.rows.map((row) => (
                <tr key={row.label}>
                  <td className="sticky left-0 bg-white z-10 font-medium text-gray-700 whitespace-nowrap">
                    {row.label}
                  </td>
                  {data.map((d) => (
                    <td
                      key={`${d.month}-${d.year}-${row.key}`}
                      className="text-right tabular-nums text-gray-600 whitespace-nowrap"
                    >
                      {row.format(d[row.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </>
          ))}

          {extraSections.map((section) => (
            <>
              <tr key={section.title}>
                <td
                  colSpan={data.length + 1}
                  className="bg-[#1B2A4A] text-white font-semibold text-[11px] uppercase tracking-wider py-1.5 px-4"
                >
                  {section.title}
                </td>
              </tr>
              {section.rows.map((row) => (
                <tr key={row.label}>
                  <td className="sticky left-0 bg-white z-10 font-medium text-gray-700 whitespace-nowrap">
                    {row.label}
                  </td>
                  {row.values.map((val, colIdx) => (
                    <td
                      key={colIdx}
                      className="text-right tabular-nums text-gray-600 whitespace-nowrap"
                    >
                      {val}
                    </td>
                  ))}
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
