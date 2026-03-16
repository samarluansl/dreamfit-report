import Link from 'next/link';
import { CLUBS } from '@/lib/clubs';

function getCurrentPeriod() {
  // Default to previous month (current month is not closed)
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { month: prev.getMonth() + 1, year: prev.getFullYear() };
}

const MONTH_NAMES: Record<number, string> = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
  5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
  9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre',
};

const CLUB_META: Record<string, { description: string; badge: string }> = {
  alcorcon: { description: '16 pistas · Madrid Sur', badge: 'Principal' },
  laspalmas: { description: '3 pistas · Las Palmas de Gran Canaria', badge: '' },
  sanse: { description: '2 pistas · San Sebastián de los Reyes', badge: 'Nuevo' },
};

export default function HomePage() {
  const { month, year } = getCurrentPeriod();
  const periodLabel = `${MONTH_NAMES[month]} ${year}`;

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* Page heading */}
      <div className="mb-10">
        <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">
          Informe mensual
        </p>
        <h1 className="text-3xl font-bold text-gray-900">
          {periodLabel}
        </h1>
        <p className="mt-2 text-gray-500 text-sm">
          Selecciona un club para ver el informe completo del mes.
        </p>
      </div>

      {/* Club cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {Object.values(CLUBS).map((club) => {
          const meta = CLUB_META[club.id];
          return (
            <Link
              key={club.id}
              href={`/report/${club.id}?month=${month}&year=${year}`}
              className="group block bg-white border border-gray-200 rounded-xl p-6 hover:border-blue-400 hover:shadow-md transition-all duration-150"
            >
              {/* Club avatar */}
              <div className="flex items-center justify-between mb-5">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg select-none"
                  style={{ backgroundColor: '#1B2A4A' }}
                >
                  {club.shortName.slice(0, 2).toUpperCase()}
                </div>
                {meta.badge && (
                  <span
                    className="text-xs font-medium px-2.5 py-0.5 rounded-full"
                    style={
                      meta.badge === 'Principal'
                        ? { backgroundColor: '#dbeafe', color: '#1d4ed8' }
                        : { backgroundColor: '#dcfce7', color: '#15803d' }
                    }
                  >
                    {meta.badge}
                  </span>
                )}
              </div>

              {/* Club name */}
              <h2 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                {club.name}
              </h2>
              <p className="text-sm text-gray-500 mt-1">{meta.description}</p>

              {/* Footer */}
              <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  Desde {club.startDate}
                </span>
                <span className="text-xs font-medium text-blue-500 group-hover:text-blue-700 transition-colors">
                  Ver informe &rarr;
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Period note */}
      <p className="mt-8 text-xs text-gray-400 text-center">
        Los informes muestran datos del mes seleccionado. Datos en tiempo real cuando se conecta la fuente.
      </p>
    </div>
  );
}
