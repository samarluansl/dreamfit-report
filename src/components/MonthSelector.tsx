'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface MonthSelectorProps {
  clubId: string;
  currentMonth: number;
  currentYear: number;
}

const MONTHS = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

export default function MonthSelector({
  clubId,
  currentMonth,
  currentYear,
}: MonthSelectorProps) {
  const router = useRouter();
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);

  function handleNavigate() {
    router.push(`/report/${clubId}?month=${month}&year=${year}`);
  }

  function handlePrev() {
    let m = month - 1;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    router.push(`/report/${clubId}?month=${m}&year=${y}`);
  }

  function handleNext() {
    let m = month + 1;
    let y = year;
    if (m > 12) { m = 1; y += 1; }
    router.push(`/report/${clubId}?month=${m}&year=${y}`);
  }

  const selectClass =
    'h-8 px-2 text-sm border border-gray-200 rounded-md bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 cursor-pointer';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Prev arrow */}
      <button
        onClick={handlePrev}
        className="flex items-center justify-center w-8 h-8 border border-gray-200 rounded-md bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        aria-label="Mes anterior"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Month select */}
      <select
        value={month}
        onChange={(e) => setMonth(Number(e.target.value))}
        className={selectClass}
      >
        {MONTHS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>

      {/* Year select */}
      <select
        value={year}
        onChange={(e) => setYear(Number(e.target.value))}
        className={selectClass}
      >
        {YEARS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>

      {/* Navigate button */}
      <button
        onClick={handleNavigate}
        className="h-8 px-4 text-sm font-medium text-white rounded-md cursor-pointer transition-all duration-150 hover:shadow-md active:scale-95"
        style={{ backgroundColor: '#0496FF' }}
        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#1B2A4A')}
        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#0496FF')}
      >
        Ir
      </button>

      {/* Next arrow */}
      <button
        onClick={handleNext}
        className="flex items-center justify-center w-8 h-8 border border-gray-200 rounded-md bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        aria-label="Mes siguiente"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
