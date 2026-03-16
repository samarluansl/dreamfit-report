import type { CourtOccupancy, OccupancyByDay, DailyBilling } from './types';

interface MockReportData {
  totalBilling: number;
  occupancyPct: number;
  totalPupils: number;
  totalMembers: number;
  mpsCost: number;
  courts: CourtOccupancy[];
  occupancyByDay: OccupancyByDay[];
  billingByDay: DailyBilling[];
  invoicePdfUrl?: string;
}

const ALCORCON_COURTS: CourtOccupancy[] = [
  { name: 'Pista 1', hoursAvailable: 428, hoursOccupied: 303, percentage: 70.79 },
  { name: 'Pista 2', hoursAvailable: 428, hoursOccupied: 265.5, percentage: 62.03 },
  { name: 'Pista 3', hoursAvailable: 428, hoursOccupied: 301.5, percentage: 70.44 },
  { name: 'Pista 4', hoursAvailable: 428, hoursOccupied: 270, percentage: 63.08 },
  { name: 'Pista 5', hoursAvailable: 428, hoursOccupied: 266.5, percentage: 62.27 },
  { name: 'Pista 6', hoursAvailable: 428, hoursOccupied: 231.5, percentage: 54.09 },
  { name: 'Pista 7', hoursAvailable: 418, hoursOccupied: 258.5, percentage: 61.84 },
  { name: 'Pista 8', hoursAvailable: 418, hoursOccupied: 234, percentage: 55.98 },
  { name: 'Pista 9', hoursAvailable: 418, hoursOccupied: 273.5, percentage: 65.43 },
  { name: 'Pista 10', hoursAvailable: 418, hoursOccupied: 230, percentage: 55.02 },
  { name: 'Pista 11', hoursAvailable: 418, hoursOccupied: 299, percentage: 71.53 },
  { name: 'Pista 12', hoursAvailable: 418, hoursOccupied: 208.5, percentage: 49.88 },
  { name: 'Pista 13 EXTERIOR', hoursAvailable: 378, hoursOccupied: 65, percentage: 17.20 },
  { name: 'Pista 14 EXTERIOR', hoursAvailable: 378, hoursOccupied: 54.5, percentage: 14.42 },
  { name: 'Pista 15 EXTERIOR', hoursAvailable: 378, hoursOccupied: 56.5, percentage: 14.95 },
  { name: 'Pista WPT central 16', hoursAvailable: 378, hoursOccupied: 86.5, percentage: 22.88 },
];

const ALCORCON_OCCUPANCY_BY_DAY: OccupancyByDay[] = [
  { type: 'Reserva', color: '#0496FF', total: 11, days: [0, 0, 6, 2, 0, 3, 0] },
  { type: 'Clases Particulares', color: '#679436', total: 11, days: [0, 0, 4, 0, 7, 0, 0] },
  { type: 'Escuela', color: '#1b7d00', total: 662.5, days: [127, 156, 150, 160.5, 69, 0, 0] },
  { type: 'Reserva Gratuita', color: '#94a3b8', total: 53.5, days: [5.5, 0, 7, 10.5, 3.5, 24, 3] },
  { type: 'Reserva Internet', color: '#05B2DC', total: 2492.5, days: [325, 377, 365, 372, 466.5, 277.5, 309.5] },
  { type: 'Torneo', color: '#EFCA08', total: 173.5, days: [0, 0, 0, 0, 0, 28.5, 145] },
];

const ALCORCON_BILLING: DailyBilling[] = [
  { day: 1, amount: 1205.21 }, { day: 2, amount: 1585.11 }, { day: 3, amount: 1692.39 },
  { day: 4, amount: 1363.95 }, { day: 5, amount: 982.91 }, { day: 6, amount: 1082.92 },
  { day: 7, amount: 1462.07 }, { day: 8, amount: 1145.32 }, { day: 9, amount: 319.65 },
  { day: 10, amount: 1670.30 }, { day: 11, amount: 1384.87 }, { day: 12, amount: 1441.93 },
  { day: 13, amount: 724.32 }, { day: 14, amount: 773.41 }, { day: 15, amount: 1239.00 },
  { day: 16, amount: 1133.88 }, { day: 17, amount: 1335.59 }, { day: 18, amount: 1011.50 },
  { day: 19, amount: 1131.84 }, { day: 20, amount: 1382.86 }, { day: 21, amount: 1037.44 },
  { day: 22, amount: 955.40 }, { day: 23, amount: 801.11 }, { day: 24, amount: 1120.99 },
  { day: 25, amount: 1432.84 }, { day: 26, amount: 26917.58 }, { day: 27, amount: 1366.59 },
  { day: 28, amount: 1524.51 },
];

const MOCK_DATA: Record<string, MockReportData> = {
  alcorcon: {
    totalBilling: 59225.49,
    occupancyPct: 50.74,
    totalPupils: 572,
    totalMembers: 265,
    mpsCost: 4192.65,
    courts: ALCORCON_COURTS,
    occupancyByDay: ALCORCON_OCCUPANCY_BY_DAY,
    billingByDay: ALCORCON_BILLING,
    invoicePdfUrl: '/api/invoice/12',
  },
  laspalmas: {
    totalBilling: 8420.00,
    occupancyPct: 30.91,
    totalPupils: 45,
    totalMembers: 20,
    mpsCost: 392.00,
    courts: [
      { name: 'Pista 1', hoursAvailable: 330, hoursOccupied: 240, percentage: 72.73 },
      { name: 'Pista 2', hoursAvailable: 330, hoursOccupied: 247, percentage: 74.85 },
      { name: 'Pista 3', hoursAvailable: 330, hoursOccupied: 227, percentage: 68.79 },
    ],
    occupancyByDay: [
      { type: 'Reserva Internet', color: '#05B2DC', total: 714, days: [100, 110, 105, 108, 130, 90, 71] },
    ],
    billingByDay: Array.from({ length: 28 }, (_, i) => ({ day: i + 1, amount: 250 + Math.random() * 200 })),
    invoicePdfUrl: '/api/invoice/13',
  },
  sanse: {
    totalBilling: 1200.00,
    occupancyPct: 3.27,
    totalPupils: 8,
    totalMembers: 3,
    mpsCost: 0,
    courts: [
      { name: 'Padel 1', hoursAvailable: 336, hoursOccupied: 10.5, percentage: 3.12 },
      { name: 'Padel 2', hoursAvailable: 336, hoursOccupied: 11.5, percentage: 3.42 },
    ],
    occupancyByDay: [
      { type: 'Reserva Internet', color: '#05B2DC', total: 22, days: [3, 4, 3, 4, 4, 2, 2] },
    ],
    billingByDay: Array.from({ length: 28 }, (_, i) => ({ day: i + 1, amount: 20 + Math.random() * 60 })),
  },
};

export function getMockData(clubId: string): MockReportData | null {
  return MOCK_DATA[clubId] ?? null;
}
