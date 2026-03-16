export type ClubId = 'alcorcon' | 'laspalmas' | 'sanse';

export interface ClubConfig {
  id: ClubId;
  name: string;
  shortName: string;
  baseUrl: string;
  odooClient: string;
  courts: number;
  startDate: string;
}

export const CLUBS: Record<ClubId, ClubConfig> = {
  alcorcon: {
    id: 'alcorcon',
    name: 'Dreamfit Alcorcón',
    shortName: 'Alcorcón',
    baseUrl: 'https://dreamfitalcorcon.syltek.com',
    odooClient: 'Dreamfit Alcorcón S.L.',
    courts: 16,
    startDate: '15/12/2020',
  },
  laspalmas: {
    id: 'laspalmas',
    name: 'Dreamfit Las Palmas',
    shortName: 'Las Palmas',
    baseUrl: 'https://dreamfitlaspalmas.syltek.com',
    odooClient: 'Dreamfit Villaverde S.L.',
    courts: 3,
    startDate: '01/01/2023',
  },
  sanse: {
    id: 'sanse',
    name: 'Dreamfit Sanse',
    shortName: 'Sanse',
    baseUrl: 'https://dreamfitsanse.syltek.com',
    odooClient: 'Dreamfit Jarama S.L.',
    courts: 2,
    startDate: '01/01/2025',
  },
} as const;

export function getClub(id: string): ClubConfig | null {
  return CLUBS[id as ClubId] ?? null;
}

export function getMonthName(month: number): string {
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  return months[month - 1] ?? '';
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1).replace('.', ',')}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-ES').format(value);
}
