import type { CourtOccupancy } from '@/lib/types';

interface OccupancyTableProps {
  data: CourtOccupancy[];
}

function PctCell({ value }: { value: number }) {
  let cls = 'pct-green';
  if (value < 30) cls = 'pct-red';
  else if (value < 60) cls = 'pct-yellow';

  return (
    <span className={`${cls} tabular-nums`}>
      {value.toFixed(1).replace('.', ',')}%
    </span>
  );
}

function BarCell({ value }: { value: number }) {
  let barColor = '#15803d';
  if (value < 30) barColor = '#b91c1c';
  else if (value < 60) barColor = '#b45309';

  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(value, 100)}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}

export default function OccupancyTable({ data }: OccupancyTableProps) {
  const totalAvailable = data.reduce((s, r) => s + r.hoursAvailable, 0);
  const totalOccupied = data.reduce((s, r) => s + r.hoursOccupied, 0);
  const totalPct = totalAvailable > 0 ? (totalOccupied / totalAvailable) * 100 : 0;

  return (
    <div className="overflow-x-auto">
      <table className="report-table">
        <thead>
          <tr>
            <th>Pista</th>
            <th className="text-right">Horas disponibles</th>
            <th className="text-right">Horas ocupadas</th>
            <th className="text-right">Ocupacion %</th>
            <th style={{ width: '120px' }}>Distribucion</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.name}>
              <td className="font-medium text-gray-800">{row.name}</td>
              <td className="text-right tabular-nums text-gray-600">
                {row.hoursAvailable.toLocaleString('es-ES')}h
              </td>
              <td className="text-right tabular-nums text-gray-600">
                {row.hoursOccupied.toLocaleString('es-ES')}h
              </td>
              <td className="text-right">
                <PctCell value={row.percentage} />
              </td>
              <td>
                <BarCell value={row.percentage} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td className="text-right tabular-nums">
              {totalAvailable.toLocaleString('es-ES')}h
            </td>
            <td className="text-right tabular-nums">
              {totalOccupied.toLocaleString('es-ES')}h
            </td>
            <td className="text-right">
              <PctCell value={totalPct} />
            </td>
            <td>
              <BarCell value={totalPct} />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
