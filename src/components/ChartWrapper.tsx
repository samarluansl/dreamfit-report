'use client';

import { useState, useEffect, useRef } from 'react';

export default function ChartWrapper({
  children,
  className = 'h-64',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function measure() {
      const rect = el!.getBoundingClientRect();
      if (rect.width > 10 && rect.height > 10) {
        setDimensions({ w: rect.width, h: rect.height });
      }
    }

    // Try immediately
    measure();

    // If not ready, observe for changes
    if (!dimensions) {
      const observer = new ResizeObserver(() => measure());
      observer.observe(el);
      // Also try on next animation frame
      const raf = requestAnimationFrame(() => measure());
      return () => {
        observer.disconnect();
        cancelAnimationFrame(raf);
      };
    }
  });

  return (
    <div ref={ref} className={`w-full ${className}`} style={{ minWidth: 1, minHeight: 1 }}>
      {dimensions ? children : <div style={{ width: '100%', height: '100%' }} />}
    </div>
  );
}
