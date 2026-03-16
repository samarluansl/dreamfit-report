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
  LabelList,
} from 'recharts';

interface PupilsChartProps {
  data: Array<{
    label: string;
    alumnos: number;
    socios: number;
  }>;
}

export default function PupilsChart({ data }: PupilsChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
        Sin datos de alumnos disponibles
      </div>
    );
  }

  return (
    <div style={{ minWidth: 0 }} className="h-64">
      <ResponsiveContainer width="100%" height="100%" minHeight={1} minWidth={1}>
        <BarChart
          data={data}
          margin={{ top: 20, right: 16, left: 0, bottom: 4 }}
          barCategoryGap="30%"
          barGap={4}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 6,
              border: '1px solid #e5e7eb',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
            formatter={(value, name) => [
              value,
              name === 'alumnos' ? 'Alumnos escuela' : 'Socios',
            ]}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            formatter={(value) =>
              value === 'alumnos' ? 'Alumnos escuela' : 'Socios'
            }
          />
          <Bar dataKey="alumnos" name="alumnos" fill="#3b82f6" radius={[3, 3, 0, 0]}>
            <LabelList
              dataKey="alumnos"
              position="top"
              style={{ fontSize: 11, fill: '#374151', fontWeight: 500 }}
            />
          </Bar>
          <Bar dataKey="socios" name="socios" fill="#ef4444" radius={[3, 3, 0, 0]}>
            <LabelList
              dataKey="socios"
              position="top"
              style={{ fontSize: 11, fill: '#374151', fontWeight: 500 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
