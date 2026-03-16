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

interface CostRevenueChartProps {
  revenue: number;
  cost: number;
  invoicePdfUrl?: string;
}

function formatEur(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
  }).format(value);
}

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm space-y-1">
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-gray-600">{p.name}:</span>
          <span className="font-semibold text-gray-900">{formatEur(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function CostRevenueChart({
  revenue,
  cost,
  invoicePdfUrl,
}: CostRevenueChartProps) {
  const margin = revenue - cost;
  const marginPct = revenue > 0 ? ((margin / revenue) * 100).toFixed(1) : '0.0';

  const chartData = [
    {
      name: 'Este mes',
      'Facturacion': revenue,
      'Coste MPS': cost,
    },
  ];

  return (
    <div>
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <p className="text-xs text-gray-500 mb-1">Facturacion</p>
          <p className="text-xl font-bold tabular-nums" style={{ color: '#1b7d00' }}>
            {formatEur(revenue)}
          </p>
        </div>
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <p className="text-xs text-gray-500 mb-1">Coste MPS</p>
          <p className="text-xl font-bold tabular-nums" style={{ color: '#1B2A4A' }}>
            {formatEur(cost)}
          </p>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500 mb-1">Margen bruto</p>
          <p className="text-xl font-bold tabular-nums text-gray-900">
            {formatEur(margin)}{' '}
            <span className="text-sm font-normal text-gray-500">({marginPct}%)</span>
          </p>
        </div>
      </div>

      {/* Grouped bar chart */}
      <div className="w-full h-48" style={{ minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 8, right: 24, left: 0, bottom: 8 }}
            barCategoryGap="40%"
          >
            <CartesianGrid horizontal={false} stroke="#f3f4f6" />
            <XAxis
              type="number"
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              width={64}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
            <Legend
              iconType="square"
              iconSize={10}
              wrapperStyle={{ fontSize: '12px', color: '#6b7280' }}
            />
            <Bar
              dataKey="Facturacion"
              fill="#1b7d00"
              radius={[0, 3, 3, 0]}
              maxBarSize={28}
            />
            <Bar
              dataKey="Coste MPS"
              fill="#1B2A4A"
              radius={[0, 3, 3, 0]}
              maxBarSize={28}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Invoice download */}
      {invoicePdfUrl && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <a
            href={invoicePdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2 12.5V14h12v-1.5M8 2v8M5 7l3 3 3-3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Descargar factura MPS (PDF)
          </a>
        </div>
      )}
    </div>
  );
}
