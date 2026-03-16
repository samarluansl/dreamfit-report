import type { OccupancyByDay } from '@/lib/types';

interface OccupancyByDayTableProps {
  data: OccupancyByDay[];
}

const DAY_LABELS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

export default function OccupancyByDayTable({ data }: OccupancyByDayTableProps) {
  const dayTotals = DAY_LABELS.map((_, i) =>
    data.reduce((sum, row) => sum + (row.days[i] ?? 0), 0)
  );
  const grandTotal = data.reduce((s, r) => s + r.total, 0);

  return (
    <div className="overflow-x-auto">
      <table className="report-table">
        <thead>
          <tr>
            <th>Tipo de reserva</th>
            {DAY_LABELS.map((d) => (
              <th key={d} className="text-right">{d}</th>
            ))}
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.type}>
              <td>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: row.color }}
                    aria-hidden="true"
                  />
                  <span className="text-gray-800">{row.type}</span>
                </div>
              </td>
              {row.days.map((val, i) => (
                <td key={i} className="text-right tabular-nums text-gray-600">
                  {val > 0 ? val.toLocaleString('es-ES') : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
              ))}
              <td className="text-right tabular-nums font-semibold text-gray-800">
                {row.total.toLocaleString('es-ES')}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            {dayTotals.map((val, i) => (
              <td key={i} className="text-right tabular-nums">
                {val.toLocaleString('es-ES')}
              </td>
            ))}
            <td className="text-right tabular-nums">
              {grandTotal.toLocaleString('es-ES')}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
