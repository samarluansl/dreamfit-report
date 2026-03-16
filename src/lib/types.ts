export interface CourtOccupancy {
  name: string;
  hoursAvailable: number;
  hoursOccupied: number;
  percentage: number;
}

export interface OccupancyByDay {
  type: string;
  color: string;
  total: number;
  days: number[]; // [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
}

export interface DailyBilling {
  day: number;
  amount: number;
}

export interface BillingBreakdown {
  day: number;
  method: string;
  amount: number;
}

export interface BillingData {
  total: number;
  dailyData: DailyBilling[];
  breakdown: BillingBreakdown[];
}

export interface PupilsData {
  total: number;
  members: number;
}

export interface OdooInvoice {
  id: number;
  name: string;
  partnerName: string;
  ref: string;
  invoiceDate: string;
  amountTotal: number;
  amountUntaxed: number;
  state: string;
}

export interface OdooInvoiceLine {
  id: number;
  name: string;
  quantity: number;
  priceUnit: number;
  priceSubtotal: number;
}

export interface MonthlyCost {
  month: number;
  year: number;
  total: number;
  invoiceCount: number;
}

export interface ReportData {
  club: {
    id: string;
    name: string;
    startDate: string;
  };
  period: {
    month: number;
    year: number;
    monthName: string;
  };
  occupancyByCourt: CourtOccupancy[];
  occupancyByDay: OccupancyByDay[];
  billing: BillingData;
  pupils: PupilsData;
  mpsCost: {
    total: number;
    invoices: OdooInvoice[];
  };
}
