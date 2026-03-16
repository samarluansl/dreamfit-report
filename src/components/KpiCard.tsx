interface KpiCardProps {
  label: string;
  value: string;
  sublabel?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
}

function TrendIndicator({ trend }: { trend: 'up' | 'down' | 'neutral' }) {
  if (trend === 'up') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M5 8V2M2 5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Subida
      </span>
    );
  }
  if (trend === 'down') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M5 2v6M2 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Bajada
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
      Estable
    </span>
  );
}

export default function KpiCard({ label, value, sublabel, trend, icon }: KpiCardProps) {
  return (
    <div className="kpi-card">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider leading-none">
          {label}
        </p>
        {icon && (
          <div className="text-gray-300">
            {icon}
          </div>
        )}
      </div>

      <p className="text-3xl font-bold text-gray-900 tabular-nums leading-none mb-2">
        {value}
      </p>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        {sublabel && (
          <p className="text-xs text-gray-500">{sublabel}</p>
        )}
        {trend && <TrendIndicator trend={trend} />}
      </div>
    </div>
  );
}
