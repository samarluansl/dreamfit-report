'use client';

import { useEffect } from 'react';

// Suppress Recharts width/height warning globally
const SUPPRESSED = 'The width(-1) and height(-1)';
if (typeof window !== 'undefined') {
  const origError = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes(SUPPRESSED)) return;
    origError.apply(console, args);
  };
}

export default function ChartWrapper({
  children,
  className = 'h-64',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  // Ensure suppression is active on mount
  useEffect(() => {}, []);

  return (
    <div className={`w-full ${className}`} style={{ minWidth: 1, minHeight: 1 }}>
      {children}
    </div>
  );
}
