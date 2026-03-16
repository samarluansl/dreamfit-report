import type { MonthlyStats } from '@/lib/mysql';

interface HistoryTableProps {
  data: MonthlyStats[];
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

export default function HistoryTable({ data }: HistoryTableProps) {
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
        { label: 'Ingresos por partidos', key: 'matchRevenue' as const, format: fmtEur },
        { label: 'Partidos mañanas (valle)', key: 'mornings' as const, format: fmt },
        { label: 'Partidos tardes (punta)', key: 'afternoons' as const, format: fmt },
        { label: 'Partidos noches (valle)', key: 'nights' as const, format: fmt },
      ],
    },
    {
      title: 'RESERVAS',
      rows: [
        { label: 'Reservas totales', key: 'reservations' as const, format: fmt },
        { label: 'Ingresos por reservas', key: 'reservationRevenue' as const, format: fmtEur },
      ],
    },
    {
      title: 'COMUNIDAD',
      rows: [
        { label: 'Usuarios grupos WhatsApp', key: 'whatsappUsers' as const, format: fmt },
      ],
    },
  ];

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
        </tbody>
      </table>
    </div>
  );
}
