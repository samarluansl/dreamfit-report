import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getClub, getMonthName, formatCurrency, formatPercentage } from '@/lib/clubs';
import { getMockData } from '@/lib/mockData';
import KpiCard from '@/components/KpiCard';
import OccupancyTable from '@/components/OccupancyTable';
import OccupancyByDayTable from '@/components/OccupancyByDayTable';
import BillingChart from '@/components/BillingChart';
import CostRevenueChart from '@/components/CostRevenueChart';
import MonthSelector from '@/components/MonthSelector';

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
    <div className="section-card">
      <div className="section-card-header">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
          {subtitle && (
            <span className="text-xs text-gray-400">{subtitle}</span>
          )}
        </div>
      </div>
      <div className="section-card-body">{children}</div>
    </div>
  );
}

export default async function ReportPage({ params, searchParams }: PageProps) {
  const { clubId } = await params;
  const sp = await searchParams;

  const club = getClub(clubId);
  if (!club) notFound();

  const now = new Date();
  const month = Number(sp.month ?? now.getMonth() + 1);
  const year = Number(sp.year ?? now.getFullYear());

  const data = getMockData(clubId);
  if (!data) notFound();

  const monthName = getMonthName(month);
  const periodLabel = `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${year}`;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">

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
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm select-none flex-shrink-0"
              style={{ backgroundColor: '#1B2A4A' }}
            >
              {club.shortName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">
                {club.name}
              </h1>
              <p className="text-sm text-gray-500">
                Informe mensual · {periodLabel} · {club.courts} pistas
              </p>
            </div>
          </div>
        </div>

        {/* Month selector */}
        <MonthSelector
          clubId={clubId}
          currentMonth={month}
          currentYear={year}
        />
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Facturacion total"
          value={formatCurrency(data.totalBilling)}
          sublabel={`${club.courts} pistas activas`}
          trend="up"
        />
        <KpiCard
          label="Ocupacion media"
          value={formatPercentage(data.occupancyPct)}
          sublabel="Horas ocupadas / disponibles"
          trend={data.occupancyPct >= 50 ? 'up' : 'neutral'}
        />
        <KpiCard
          label="Total alumnos"
          value={String(data.totalPupils)}
          sublabel={`${data.totalMembers} socios activos`}
          trend="neutral"
        />
        <KpiCard
          label="Coste MPS"
          value={formatCurrency(data.mpsCost)}
          sublabel={`${((data.mpsCost / data.totalBilling) * 100).toFixed(1).replace('.', ',')}% sobre facturacion`}
          trend="neutral"
        />
      </div>

      {/* Occupancy by court */}
      <div className="mb-6">
        <SectionCard
          title="Ocupacion por pista"
          subtitle={`${periodLabel} · horas disponibles 08:00 – 22:00`}
        >
          <OccupancyTable data={data.courts} />
        </SectionCard>
      </div>

      {/* Occupancy by day/type */}
      <div className="mb-6">
        <SectionCard
          title="Reservas por tipo y dia de semana"
          subtitle="Numero de reservas completadas"
        >
          <OccupancyByDayTable data={data.occupancyByDay} />
        </SectionCard>
      </div>

      {/* Billing chart + Cost vs Revenue — side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
        {/* Billing chart — wider */}
        <div className="lg:col-span-3">
          <SectionCard
            title="Facturacion diaria"
            subtitle={periodLabel}
          >
            <div className="p-4">
              <BillingChart data={data.billingByDay} />
            </div>
          </SectionCard>
        </div>

        {/* Cost vs Revenue — narrower */}
        <div className="lg:col-span-2">
          <SectionCard
            title="Facturacion vs Coste MPS"
            subtitle="Margen bruto del mes"
          >
            <div className="p-4">
              <CostRevenueChart
                revenue={data.totalBilling}
                cost={data.mpsCost}
                invoicePdfUrl={data.invoicePdfUrl}
              />
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Footer note */}
      <p className="text-xs text-gray-400 text-center pb-8">
        Datos mock — en produccion se conectara con Syltek y Odoo.
        Periodo: {periodLabel} · Club: {club.odooClient}
      </p>
    </div>
  );
}
