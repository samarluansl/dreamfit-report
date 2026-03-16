import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getClub, getMonthName, formatCurrency, formatPercentage } from '@/lib/clubs';
import type { ClubId } from '@/lib/clubs';
import { fetchClubSnapshot } from '@/lib/syltek';
import type { OccupancyByTypeRow } from '@/lib/syltek';
import { getInvoicesForClub } from '@/lib/odoo';
import { getMonthlyHistory } from '@/lib/mysql';
import KpiCard from '@/components/KpiCard';
import OccupancyTable from '@/components/OccupancyTable';
import OccupancyByDayTable from '@/components/OccupancyByDayTable';
import BillingChart from '@/components/BillingChart';
import CostRevenueChart from '@/components/CostRevenueChart';
import MonthSelector from '@/components/MonthSelector';
import MatchesChart from '@/components/MatchesChart';
import HistoryTable from '@/components/HistoryTable';
import type { OccupancyByDay } from '@/lib/types';

// No cache — always fetch fresh data
export const dynamic = 'force-dynamic';
export const maxDuration = 30; // seconds — Syltek scraping can be slow

interface PageProps {
  params: Promise<{ clubId: string }>;
  searchParams: Promise<{ month?: string; year?: string }>;
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="section-card overflow-hidden">
      <div className="section-card-header">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
          {subtitle && (
            <span className="text-xs text-gray-400">{subtitle}</span>
          )}
        </div>
      </div>
      <div className="section-card-body overflow-x-auto">{children}</div>
    </div>
  );
}

/** Transform flat OccupancyByTypeRow[] into grouped OccupancyByDay[] for the table */
function transformOccupancyByType(rows: OccupancyByTypeRow[]): OccupancyByDay[] {
  const DAY_ORDER = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  const COLORS: Record<string, string> = {
    'Reserva': '#0496FF',
    'Clases Particulares 1,5H': '#679436',
    'Clases Particulares 1H': '#679436',
    'Escuela': '#1b7d00',
    'Escuela Competición': '#1feaed',
    'Intensivos': '#197014',
    'Me apunto!': '#F86624',
    'Ranking': '#F49F0A',
    'Reserva en el dia': '#ff00f2',
    'Reserva Gratuita': '#94a3b8',
    'Reserva Internet': '#05B2DC',
    'Reserva Multiple': '#031A6B',
    'Torneo': '#EFCA08',
  };

  // Group by type
  const grouped = new Map<string, number[]>();
  for (const row of rows) {
    if (!grouped.has(row.type)) {
      grouped.set(row.type, [0, 0, 0, 0, 0, 0, 0]);
    }
    const dayIdx = DAY_ORDER.findIndex(d => row.day.toLowerCase().includes(d));
    if (dayIdx >= 0) {
      grouped.get(row.type)![dayIdx] += row.hours;
    }
  }

  return Array.from(grouped.entries())
    .map(([type, days]) => ({
      type,
      color: COLORS[type] || '#6b7280',
      total: days.reduce((s, v) => s + v, 0),
      days,
    }))
    .filter(r => r.total > 0);
}

export default async function ReportPage({ params, searchParams }: PageProps) {
  const { clubId } = await params;
  const sp = await searchParams;

  const club = getClub(clubId);
  if (!club) notFound();

  const now = new Date();
  const month = Number(sp.month ?? now.getMonth() + 1);
  const year = Number(sp.year ?? now.getFullYear());

  // Calculate date range for the month
  const lastDay = new Date(year, month, 0).getDate();
  const startDate = `01/${String(month).padStart(2, '0')}/${year}`;
  const endDate = `${lastDay}/${String(month).padStart(2, '0')}/${year}`;

  // Fetch all data in parallel — graceful fallback on error
  let snapshot: Awaited<ReturnType<typeof fetchClubSnapshot>>;
  let invoices: Awaited<ReturnType<typeof getInvoicesForClub>>;
  let history: Awaited<ReturnType<typeof getMonthlyHistory>> = [];
  try {
    [snapshot, invoices, history] = await Promise.all([
      fetchClubSnapshot(clubId as 'alcorcon' | 'laspalmas' | 'sanse', startDate, endDate, month, year),
      getInvoicesForClub(clubId as ClubId, year, month).catch((e) => {
        console.error('Odoo fetch error:', e);
        return [];
      }),
      getMonthlyHistory(clubId, 14).catch((e) => {
        console.error('MySQL fetch error:', e);
        return [];
      }),
    ]);
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error('Data fetch error:', err.message, err.stack);
    snapshot = {
      clubId: clubId as 'alcorcon' | 'laspalmas' | 'sanse',
      clubName: club.name,
      occupancyByCourt: null,
      occupancyByDayAndType: null,
      billing: null,
      schoolPupils: null,
    };
    invoices = [];
  }

  // Compute derived data
  const courts = snapshot.occupancyByCourt ?? [];
  const totalOccupied = courts.reduce((s, c) => s + c.hoursOccupied, 0);
  const totalAvailable = courts.reduce((s, c) => s + c.hoursAvailable, 0);
  const occupancyPct = totalAvailable > 0 ? (totalOccupied / totalAvailable) * 100 : 0;

  const billing = snapshot.billing;
  const totalBilling = billing?.total ?? 0;
  const billingByDay = billing?.dailyData ?? [];

  const pupils = snapshot.schoolPupils;
  const totalPupils = pupils?.total ?? 0;
  const totalMembers = pupils?.members ?? 0;

  const mpsCost = invoices.reduce((s, inv) => s + inv.amount_total, 0);
  const mainInvoice = invoices[0];

  const occupancyByDay = snapshot.occupancyByDayAndType
    ? transformOccupancyByType(snapshot.occupancyByDayAndType)
    : [];

  // Current month stats from MySQL
  const currentMonthStats = history.find(h => h.month === month && h.year === year);
  const totalMatches = currentMonthStats?.matches ?? 0;
  const whatsappUsers = currentMonthStats?.whatsappUsers ?? 0;

  const monthName = getMonthName(month);
  const periodLabel = `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${year}`;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-6">
        <Link href="/" className="hover:text-gray-600 transition-colors">
          Clubs
        </Link>
        <span>/</span>
        <span className="text-gray-600">{club.name}</span>
        <span>/</span>
        <span className="text-gray-600">{periodLabel}</span>
      </nav>

      {/* Report header */}
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm select-none flex-shrink-0"
              style={{ backgroundColor: '#1B2A4A' }}
            >
              {club.shortName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 leading-tight truncate">
                {club.name}
              </h1>
              <p className="text-sm text-gray-500">
                Informe mensual · {periodLabel} · {club.courts} pistas
              </p>
            </div>
          </div>
        </div>

        <MonthSelector
          clubId={clubId}
          currentMonth={month}
          currentYear={year}
        />
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <KpiCard
          label="Partidos"
          value={totalMatches > 0 ? String(totalMatches) : '-'}
          sublabel={whatsappUsers > 0 ? `${whatsappUsers} usuarios WhatsApp` : undefined}
        />
        <KpiCard
          label="Facturacion total"
          value={formatCurrency(totalBilling)}
          sublabel={`${billingByDay.length} dias con cobros`}
        />
        <KpiCard
          label="Ocupacion media"
          value={formatPercentage(occupancyPct)}
          sublabel={`${courts.length} pistas`}
          trend={occupancyPct >= 50 ? 'up' : occupancyPct >= 30 ? 'neutral' : 'down'}
        />
        <KpiCard
          label="Total alumnos"
          value={String(totalPupils)}
          sublabel={`${totalMembers} socios activos`}
        />
        <KpiCard
          label="Coste MPS"
          value={formatCurrency(mpsCost)}
          sublabel={totalBilling > 0 ? `${((mpsCost / totalBilling) * 100).toFixed(1).replace('.', ',')}% sobre facturacion` : 'Sin facturacion'}
        />
        <KpiCard
          label="Ingresos partidos"
          value={currentMonthStats ? formatCurrency(currentMonthStats.matchRevenue) : '-'}
          sublabel={currentMonthStats ? `${currentMonthStats.mornings} mañanas / ${currentMonthStats.afternoons} tardes` : undefined}
        />
      </div>

      {/* Matches chart — punta vs valle */}
      {history.length > 0 && (
        <div className="mb-6">
          <SectionCard
            title="Partidos"
            subtitle={`Mañanas (valle) / Tardes (punta) / Noches (valle) — ultimos ${history.length} meses`}
          >
            <div className="p-4">
              <MatchesChart data={history} />
            </div>
          </SectionCard>
        </div>
      )}

      {/* Occupancy by court */}
      {courts.length > 0 && (
        <div className="mb-6">
          <SectionCard
            title="Ocupacion por pista"
            subtitle={`${startDate} al ${endDate}`}
          >
            <OccupancyTable data={courts} />
          </SectionCard>
        </div>
      )}

      {/* Occupancy by day/type */}
      {occupancyByDay.length > 0 && (
        <div className="mb-6">
          <SectionCard
            title="Ocupacion por dias agrupado por tipos de reservas"
            subtitle={periodLabel}
          >
            <OccupancyByDayTable data={occupancyByDay} />
          </SectionCard>
        </div>
      )}

      {/* Billing chart + Cost vs Revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
        <div className="lg:col-span-3 min-w-0">
          <SectionCard
            title="Facturacion diaria"
            subtitle={`Total: ${formatCurrency(totalBilling)}`}
          >
            <div className="p-4">
              <BillingChart data={billingByDay} />
            </div>
          </SectionCard>
        </div>

        <div className="lg:col-span-2 min-w-0">
          <SectionCard
            title="Facturacion vs Coste MPS"
            subtitle="Margen bruto del mes"
          >
            <div className="p-4">
              <CostRevenueChart
                revenue={totalBilling}
                cost={mpsCost}
                invoicePdfUrl={mainInvoice ? `/api/invoice/${mainInvoice.id}` : undefined}
              />
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Invoices detail */}
      {invoices.length > 0 && (
        <div className="mb-6">
          <SectionCard title="Facturas MPS" subtitle="Padel YVR S.L.">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Factura</th>
                  <th>Fecha</th>
                  <th>Referencia</th>
                  <th className="text-right">Importe</th>
                  <th className="text-right">PDF</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id}>
                    <td className="font-medium text-gray-800">{inv.name}</td>
                    <td className="text-gray-600">{inv.invoice_date}</td>
                    <td className="text-gray-500 text-xs">{inv.ref || ''}</td>
                    <td className="text-right tabular-nums font-semibold">{formatCurrency(inv.amount_total)}</td>
                    <td className="text-right">
                      <a
                        href={`/api/invoice/${inv.id}`}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Descargar
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </div>
      )}

      {/* Historic monthly table */}
      {history.length > 0 && (
        <div className="mb-6">
          <SectionCard
            title="Historico mensual"
            subtitle={`Ultimos ${history.length} meses`}
          >
            <HistoryTable data={history} />
          </SectionCard>
        </div>
      )}

      {/* Footer */}
      <p className="text-xs text-gray-400 text-center pb-8">
        Matches Padel Solutions · Datos en tiempo real desde Syltek, Odoo y MySQL · {periodLabel}
      </p>
    </div>
  );
}
