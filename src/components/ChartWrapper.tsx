'use client';

import { useState, useEffect, useRef } from 'react';

export default function ChartWrapper({
  children,
  className = 'h-64',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [ready, setReady] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only render chart after mount when container has real dimensions
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setReady(true);
          observer.disconnect();
        }
      }
    });
    observer.observe(el);
    // Fallback: render after a short delay
    const timer = setTimeout(() => setReady(true), 100);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, []);

  return (
    <div ref={ref} className={`w-full ${className}`} style={{ minWidth: 0 }}>
      {ready ? children : null}
    </div>
  );
}
