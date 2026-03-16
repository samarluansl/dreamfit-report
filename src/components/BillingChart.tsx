'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { DailyBilling } from '@/lib/types';

interface BillingChartProps {
  data: DailyBilling[];
}

interface TooltipPayload {
  value: number;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const amount = payload[0].value;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="text-gray-500 mb-0.5">Dia {label}</p>
      <p className="font-semibold text-gray-900">
        {new Intl.NumberFormat('es-ES', {
          style: 'currency',
          currency: 'EUR',
          minimumFractionDigits: 0,
        }).format(amount)}
      </p>
    </div>
  );
}

function formatYAxis(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
  return String(value);
}

export default function BillingChart({ data }: BillingChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center text-gray-400 text-sm">
        Sin datos de facturacion para este periodo
      </div>
    );
  }

  const maxAmount = Math.max(...data.map((d) => d.amount));

  return (
    <div className="w-full h-64" style={{ minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
          barCategoryGap="30%"
        >
          <CartesianGrid
            vertical={false}
            stroke="#f3f4f6"
            strokeDasharray="0"
          />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            interval={2}
          />
          <YAxis
            tickFormatter={formatYAxis}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: '#f9fafb' }}
          />
          <Bar dataKey="amount" radius={[3, 3, 0, 0]} maxBarSize={24}>
            {data.map((entry) => (
              <Cell
                key={entry.day}
                fill={entry.amount === maxAmount ? '#0496FF' : '#93c5fd'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
