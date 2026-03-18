import type { BookerStats } from '@/lib/syltek';

interface ReservationBreakdownProps {
  stats: BookerStats;
}

const SEGMENTS = [
  { key: 'socio', label: 'Socio', color: '#1b7d00' },
  { key: 'noSocio', label: 'No Socio', color: '#0496FF' },
  { key: 'staff', label: 'Staff', color: '#F49F0A' },
  { key: 'playtomic', label: 'Playtomic', color: '#6366f1' },
] as const;

function fmtPct(n: number): string {
  return `${n.toFixed(1).replace('.', ',')}%`;
}

export default function ReservationBreakdown({ stats }: ReservationBreakdownProps) {
  const total = stats.totalReservations;
  if (total === 0) return null;

  const noSocioWithoutPlaytomic = stats.noSocioReservations - stats.playtomicReservations;

  const values: Record<string, number> = {
    socio: stats.socioReservations,
    noSocio: noSocioWithoutPlaytomic,
    staff: stats.staffReservations,
    playtomic: stats.playtomicReservations,
  };

  return (
    <div className="kpi-card">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider leading-none mb-3">
        Desglose reservas
      </p>

      <p className="text-2xl lg:text-3xl font-bold text-gray-900 tabular-nums leading-none mb-4">
        {total}
      </p>

      {/* Stacked bar */}
      <div className="flex h-2.5 rounded-full overflow-hidden mb-3">
        {SEGMENTS.map(({ key, color }) => {
          const pct = (values[key] / total) * 100;
          if (pct <= 0) return null;
          return (
            <div
              key={key}
              className="h-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: color }}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {SEGMENTS.map(({ key, label, color }) => {
          const count = values[key];
          const pct = (count / total) * 100;
          if (count <= 0) return null;
          return (
            <div key={key} className="flex items-center gap-1.5 min-w-0">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-gray-500 truncate">{label}</span>
              <span className="text-xs font-semibold text-gray-800 tabular-nums ml-auto">
                {fmtPct(pct)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
