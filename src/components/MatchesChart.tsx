'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { MonthlyStats } from '@/lib/mysql';

interface MatchesChartProps {
  data: MonthlyStats[];
}

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + p.value, 0);
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="text-gray-500 mb-1 font-medium">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-gray-600">{p.name}:</span>
          <span className="font-semibold text-gray-900">{p.value}</span>
        </div>
      ))}
      <div className="border-t border-gray-100 mt-1 pt-1 font-semibold text-gray-900">
        Total: {total}
      </div>
    </div>
  );
}

export default function MatchesChart({ data }: MatchesChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-72 flex items-center justify-center text-gray-400 text-sm">
        Sin datos de partidos
      </div>
    );
  }

  const chartData = data.map((d) => ({
    label: d.label,
    'Mañanas (valle)': d.mornings,
    'Tardes (punta)': d.afternoons,
    'Noches (valle)': d.nights,
    total: d.matches,
  }));

  return (
    <div className="w-full h-72" style={{ minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
          barCategoryGap="20%"
        >
          <CartesianGrid vertical={false} stroke="#f3f4f6" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={-45}
            textAnchor="end"
            height={50}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
          <Legend
            iconType="square"
            iconSize={10}
            wrapperStyle={{ fontSize: '11px', color: '#6b7280' }}
          />
          <Bar dataKey="Mañanas (valle)" stackId="a" fill="#EFCA08" maxBarSize={32} />
          <Bar dataKey="Tardes (punta)" stackId="a" fill="#1b7d00" maxBarSize={32} />
          <Bar dataKey="Noches (valle)" stackId="a" fill="#1B2A4A" radius={[3, 3, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
