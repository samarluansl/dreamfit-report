'use client';

import { useEffect } from 'react';

function suppressRechartsWarning() {
  if (typeof window === 'undefined') return;
  const MATCH = 'width(-1)';
  // Recharts logs via console.warn, console.error, and sometimes console.log
  for (const method of ['warn', 'error', 'log'] as const) {
    const orig = console[method];
    console[method] = (...args: unknown[]) => {
      if (typeof args[0] === 'string' && args[0].includes(MATCH)) return;
      orig.apply(console, args);
    };
  }
}

// Run immediately on module load (client-side only)
suppressRechartsWarning();

export default function ChartWrapper({
  children,
  className = 'h-64',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  useEffect(() => { suppressRechartsWarning(); }, []);

  return (
    <div className={`w-full ${className}`} style={{ minWidth: 1, minHeight: 1 }}>
      {children}
    </div>
  );
}
