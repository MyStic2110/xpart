const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("token");
  // Only declare a JSON content-type when we actually send a body. A bodyless
  // POST (e.g. refresh queue, complete job card) with this header makes Fastify
  // reject with FST_ERR_CTP_EMPTY_JSON_BODY → 400 Bad Request.
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || data.error || "request failed");
  return data as T;
}

export interface SignupInput {
  orgName: string;
  branchName: string;
  city: string;
  ownerName: string;
  ownerPhone: string;
  password: string;
}

export interface MeResponse {
  user: { id: string; name: string; phone: string };
  org: { id: string; name: string; plan: string; status: string; walletEnabled: boolean };
  roles: string[];
  branches: { id: string; name: string; city: string }[];
}

export interface WorkingDay {
  day: string; // "monday" … "sunday"
  open: string; // "09:00"
  close: string; // "19:00"
  closed: boolean;
}

export interface Branch {
  id: string;
  orgId: string;
  name: string;
  salonName: string;
  city: string;
  address: string | null;
  logoUrl: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  gstNumber: string | null;
  workingHours: string | null;
  status: "active" | "inactive";
  loyaltyPointsEnabled: boolean;
  pointsPerThousand: number; // points earned per ₹1000 collected
  redeemPaisePerPoint: number; // value of 1 point on redemption, in paise
  facebookUrl: string | null;
  instagramUrl: string | null;
  youtubeUrl: string | null;
  googleMapsUrl: string | null;
  loginBgUrl: string | null;
  openingTime: string | null;
  closingTime: string | null;
  workingDays: WorkingDay[] | null;
  extraHoursEnabled: boolean;
  dayEndReportTime: string | null;
  createdAt: string;
}

export interface BranchInput {
  name: string;
  salonName: string;
  city: string;
  address?: string;
  logoUrl?: string;
  phone?: string;
  email?: string;
  website?: string;
  gstNumber?: string;
  workingHours?: string;
  status: "active" | "inactive";
  loyaltyPointsEnabled?: boolean;
  pointsPerThousand?: number;
  redeemPaisePerPoint?: number;
  facebookUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  googleMapsUrl?: string;
  loginBgUrl?: string;
  openingTime?: string;
  closingTime?: string;
  workingDays?: WorkingDay[];
  extraHoursEnabled?: boolean;
  dayEndReportTime?: string;
}

export interface StaffProfile {
  id: string;
  userId: string;
  category: "mechanic" | "staff";
  dateOfBirth: string | null;
  gender: "male" | "female";
  workingHoursStart: string;
  workingHoursEnd: string;
  monthlySalary: number;
  dateOfJoining: string;
  emergencyContactNumber: string | null;
  emergencyContactPerson: string | null;
  address: string | null;
  idProofUrl: string | null;
  photoUrl: string | null;
  mechanicType: string | null;
  serviceCommissionPct: string | null;
  productCommissionPct: string | null;
  userType: string | null;
  department: string | null;
}

export interface StaffListItem {
  userId: string;
  name: string;
  phone: string;
  email: string | null;
  username: string | null;
  profile: StaffProfile | null;
  branchId: string | null;
  branchName: string | null;
}

interface BaseStaffFormInput {
  name: string;
  phone: string;
  email?: string;
  username?: string;
  password: string;
  confirmPassword: string;
  gender: "male" | "female";
  dateOfBirth?: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  monthlySalary: number;
  dateOfJoining: string;
  emergencyContactNumber?: string;
  emergencyContactPerson?: string;
  address?: string;
  idProofUrl?: string;
  photoUrl?: string;
  branchId: string;
}

export interface MechanicFormInput extends BaseStaffFormInput {
  mechanicType: string;
  serviceCommissionPct?: number;
  productCommissionPct?: number;
}

export interface StaffMemberFormInput extends BaseStaffFormInput {
  userType: string;
  department: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  status: "present" | "half_day" | "absent" | "leave" | "lop";
  checkIn: string | null;
  checkOut: string | null;
  hoursWorked: string;
  notes: string | null;
}

export interface AttendanceMonthSummary {
  month: string;
  presentDays: number;
  lopDays: number;
  leaveDays: number;
  absentDays: number;
  totalHours: number;
  avgHoursPerDay: number;
}

export interface MarkAttendanceInput {
  userId: string;
  date: string;
  status: AttendanceRecord["status"];
  checkIn?: string;
  checkOut?: string;
  hoursWorked?: number;
  notes?: string;
}

export interface PayrollBreakdown {
  userId: string;
  month: string;
  baseSalary: number;
  presentDays: number;
  lopDays: number;
  leaveDays: number;
  lopDeduction: number;
  revenueGenerated: number;
  serviceCommissionEarned: number;
  productCommissionEarned: number;
  bonus: number;
  otherDeductions: number;
  netPayout: number;
}

export interface PayrollRecord extends PayrollBreakdown {
  id: string;
  status: "draft" | "paid";
  paidAt: string | null;
}

export interface ClientRecord {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  gender: "male" | "female" | "other" | "unknown";
  dateOfBirth: string | null;
  anniversary: string | null;
  sourceOfClient: string | null;
  clientType: "customer" | "third_party";
  referralCode: string;
}

export interface CreateClientInput {
  name: string;
  phone: string;
  address?: string;
  gender?: "male" | "female" | "other" | "unknown";
  dateOfBirth?: string;
  sourceOfClient?: string;
  clientType?: "customer" | "third_party";
  referredByCode?: string;
}

export interface ReferralEntry {
  id: string;
  name: string;
  phone: string;
  joinedOn: string;
  hasBilled: boolean;
  firstBilledOn: string | null;
}

export interface CreditInvoice {
  invoiceId: string;
  invoiceNo: string | null;
  status: string;
  total: number;
  paid: number;
  balance: number;
  invoiceDate: string;
  jobDate: string;
  plateNumber: string;
}

export interface ClientCredit {
  clientId: string;
  clientType: string;
  openInvoices: CreditInvoice[];
  totalOutstanding: number;
}

export interface Client360 {
  branch: string | null;
  lastVisitOn: string | null;
  totalVisits: number;
  totalSpendings: number;
  membership: string | null;
  activePackages: string | null;
  lastFeedback: string | null;
  walletBalance: number;
  rewardPoints: number;
  gender: string;
  dateOfBirth: string | null;
  anniversary: string | null;
  sourceOfClient: string | null;
  offers?: Offer[];
}

export interface Service {
  id: string;
  name: string;
  defaultPrice: number;
  isActive: boolean;
}

export interface JobCardLineItemInput {
  serviceId: string;
  qty: number;
  price: number;
}

export interface CreateJobCardInput {
  branchId: string;
  jobDate: string;
  serviceAdvisorId?: string;
  client: {
    phone: string;
    name: string;
    address?: string;
    gender?: "male" | "female" | "other" | "unknown";
    dateOfBirth?: string;
    anniversary?: string;
    sourceOfClient?: string;
  };
  vehicle: {
    plateNumber: string;
    makeId?: string;
    modelId?: string;
    segment?: string;
    year?: number;
    color?: string;
    fuelType?: "petrol" | "diesel" | "cng" | "electric" | "hybrid";
    odometerReading?: number;
    nextServiceDate?: string;
  };
  lineItems: JobCardLineItemInput[];
  productItems?: { productId?: string; productName: string; qty: number; price: number }[];
  discount: number;
  taxPercent: number;
  images?: string[];
  appliedOfferId?: string;
}

export interface Offer {
  id: string;
  code: string;
  title: string;
  description: string;
  discountType: "flat" | "percentage";
  value: number;
  maxDiscount: number;
  minBillingAmount: number;
  targetType: string;
  isActive: boolean;
  restrictedDays?: string[] | null;
  startTime?: string | null;
  endTime?: string | null;
  usageCount?: number;
  totalDiscount?: number;
  totalRevenue?: number;
}

export type SalesActionStatus = "pending" | "contacted" | "appointment_booked" | "rescheduled" | "declined" | "closed" | "expired";

export interface SalesAction {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  vehicleId: string | null;
  plateNumber: string | null;
  serviceId: string;
  serviceName: string;
  lastServiceDate: string;
  dueDate: string;
  potentialRevenue: number;
  status: SalesActionStatus;
  nextFollowUpDate: string | null;
  appointmentId: string | null;
  createdAt: string;
  lastVisitDate: string;
  lastVisitServices: string;
}

export interface SalesActionLog {
  id: string;
  outcome: string;
  byUserId: string | null;
  createdAt: string;
}

export interface AppointmentRecord {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  branchId: string;
  branchName: string;
  serviceName: string | null;
  scheduledDate: string;
  scheduledTime: string | null;
  status: "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";
}

export interface ClientListItem {
  id: string;
  name: string;
  phone: string;
  gender: string;
  sourceOfClient: string | null;
  clientType: "customer" | "third_party";
  outstanding: number;
  totalVisits: number;
  totalSpend: number;
  lastVisit: string | null;
  vehicleCount: number;
  walletBalance: number;
  points: number;
}

export interface ClientVisit {
  jobCardId: string;
  jobDate: string;
  status: string;
  total: number;
  services: string[];
}

export interface ClientDetail {
  client: ClientRecord & { createdAt: string };
  summary: Client360;
  vehicles: { id: string; plateNumber: string; segment: string | null }[];
  visits: ClientVisit[];
  appointments: {
    id: string;
    branchId: string;
    branchName: string;
    scheduledDate: string;
    scheduledTime: string | null;
    status: "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";
    serviceName: string | null;
    notes: string | null;
  }[];
  credit: ClientCredit | null;
  referredBy: { id: string; name: string; phone: string } | null;
  referrals: ReferralEntry[];
}

export interface Product {
  id: string;
  name: string;
  mrp: number;
  volume: string | null;
  barcode: string | null;
  category: string | null;
  subCategory: string | null;
  sku: string | null;
  isActive: boolean;
}

export interface ProductInput {
  name: string;
  mrp: number;
  volume?: string;
  barcode?: string;
  category?: string;
  subCategory?: string;
  sku?: string;
}

export interface InventoryItem {
  id: string;
  productName: string;
  quantity: number;
  unit: string | null;
  salePrice: number;
  expiryDate: string | null;
  lotNo: string;
  sourceType: "vendor" | "client" | "mechanic" | "unknown";
  sourceName: string | null;
  invoiceNo: string | null;
  isCredit: boolean;
  expired: boolean;
}

export interface InventorySummary {
  availableItems: number;
  availableValue: number;
  expiredItems: number;
  creditOutstanding: number;
}

export interface InventoryConsumption {
  id: string;
  itemId: string;
  productName: string;
  quantity: string;
  consumedBy: string | null;
  notes: string | null;
  createdAt: string;
}

export interface PurchaseInput {
  lotNo: string;
  sourceType: "vendor" | "client" | "mechanic" | "unknown";
  sourceName?: string;
  vendorId?: string | null;
  invoiceNo?: string;
  purchaseDate?: string;
  isCredit: boolean;
  totalAmount: number;
  amountPaid: number;
  items: { productName: string; quantity: number; unit?: string; purchasePrice?: number; salePrice: number; vehicleId?: string | null; expiryDate?: string }[];
}

export interface Feedback {
  id: string;
  source: "in_app" | "google" | "whatsapp" | "manual";
  reviewerName: string | null;
  rating: number | null;
  comment: string | null;
  reply: string | null;
  reviewDate: string | null;
  createdAt: string;
}

export interface FeedbackSummary {
  total: number;
  avgRating: number;
  positive: number;
  negative: number;
  googleCount: number;
}

export type LeadStatus = "pending" | "contacted" | "follow_up" | "converted" | "lost";

export interface Enquiry {
  id: string;
  contactNumber: string;
  clientName: string;
  email: string | null;
  address: string | null;
  enquiryFor: string;
  enquiryType: string;
  response: string | null;
  dateToFollow: string;
  sourceOfEnquiry: string;
  leadStatus: LeadStatus;
  channel: "sms" | "whatsapp";
  vehicleNumber: string | null;
  makeId: string | null;
  modelId: string | null;
  segment: string | null;
  year: number | null;
  color: string | null;
  fuelType: string | null;
  leadRepName: string | null;
  leadRepId: string | null;
  createdAt: string;
}

export interface EnquiryInput {
  branchId?: string;
  contactNumber: string;
  clientName: string;
  email?: string;
  address?: string;
  enquiryFor: string;
  enquiryType: string;
  response?: string;
  dateToFollow: string;
  sourceOfEnquiry: string;
  leadRepresentativeId?: string;
  leadStatus: LeadStatus;
  channel: "sms" | "whatsapp";
  vehicleNumber?: string;
  makeId?: string;
  modelId?: string;
  segment?: string;
  year?: number;
  color?: string;
  fuelType?: string;
}

export interface ExpenseCategory {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface ExpenseCategoryInput {
  name: string;
  description?: string;
}

export interface Expense {
  id: string;
  branchId: string | null;
  categoryId: string | null;
  categoryName: string | null;
  expenseDate: string;
  amount: number; // paise
  paymentMode: string; // free text: "Cash", "Online payment", "UPI"…
  recipient: string | null;
  paidBy: string | null;
  notes: string | null;
  createdAt: string;
}

export interface ExpenseInput {
  branchId?: string;
  categoryId?: string;
  expenseDate: string;
  amount: number; // rupees; ×100 to paise on the wire is done server-side
  paymentMode: string;
  recipient?: string;
  paidBy?: string;
  notes?: string;
}

export interface ExpenseSummary {
  count: number;
  total: number; // paise
  monthTotal: number; // paise
}

export interface DashboardMetrics {
  jobCardsToday: number;
  jobCardsTotal: number;
  revenueToday: number;
  revenueWeek: number;
  revenueMonth: number;
  expenseToday: number;
  expenseWeek: number;
  expenseMonth: number;
  totalClients: number;
  pendingInvoices: number;
  pendingAmount: number;
  openFollowUps: number;
  potentialToday: number;
  potentialOpen: number;
  upcomingAppointments: number;
  thirdPartyClients: number;
  thirdPartyOutstanding: number;
  thirdPartyCollectedMonth: number;
  segmentation: {
    existing: number;
    active: number;
    churnRisk: number;
    defected: number;
  };
  staffCount: number;
  branchCount: number;
  dailyRevenueTrend: { date: string; revenue: number }[];
  statusDistribution: { status: string; count: number }[];
  topServices: { name: string; count: number }[];
  partsMarginToday: number;
  partsMarginWeek: number;
  partsMarginMonth: number;
}

export interface CameraProvider {
  provider: string;
  label: string;
  urlTemplate: string;
  hint: string;
  browserPlayable: boolean;
}

export interface BranchCamera {
  id: string;
  branchId: string;
  name: string;
  placement: "inside" | "outside";
  provider: string;
  streamUrl: string;
  username: string | null;
  password: string | null;
  aiEnabled: boolean;
  notes: string | null;
  status: "active" | "disabled";
}

export interface CameraInput {
  branchId: string;
  name: string;
  placement: "inside" | "outside";
  provider: string;
  streamUrl: string;
  username?: string;
  password?: string;
  aiEnabled?: boolean;
  notes?: string;
  status?: "active" | "disabled";
}

export interface CalendarDay {
  date: string;
  revenue: number;
  expenses: number;
  jobCards: number;
  appointments: number;
  enquiries: number;
}

export interface CalendarResponse {
  month: string;
  today: string;
  city: string;
  days: CalendarDay[];
  dowStats: { dow: number; name: string; avgRevenue: number; index: number }[];
  holidays: { date: string; name: string; kind: string; washRush?: boolean; longWeekend: boolean }[];
  weather: { date: string; rainProbability: number; tempMax: number; summary: string }[] | null;
  demand: { date: string; score: number; level: "low" | "normal" | "high" | "peak"; drivers: string[]; tip: string | null; expectedRevenue: number | null }[];
  insights: { date: string; endDate?: string; type: "rush" | "rain" | "longweekend" | "pattern"; title: string; detail: string }[];
  avgDailyRevenue: number;
  summary: {
    monthToDate: number;
    projected: number;
    prevMonthRevenue: number;
    bestDay: { date: string; revenue: number } | null;
    next7Expected: number;
  };
}

export interface CalendarDayDetail {
  date: string;
  jobCards: { id: string; status: string; total: number; clientName: string; plateNumber: string }[];
  appointments: { id: string; scheduledTime: string | null; status: string; clientName: string; phone: string; serviceName: string | null }[];
  expenses: { id: string; amount: number; recipient: string | null; category: string }[];
  payments: { mode: string; amount: number }[];
  revenue: number;
  expenseTotal: number;
}

export interface ForecastPoint {
  period: string;
  label: string;
  value: number;
}
export interface ForecastBandPoint extends ForecastPoint {
  lower: number;
  upper: number;
}
export interface ForecastMetric {
  history: ForecastPoint[];
  forecast: ForecastBandPoint[];
  forecastTotal: number;
  growthPct: number;
  trend: "up" | "down" | "flat";
}
export interface ForecastResponse {
  granularity: "day" | "week" | "month";
  horizon: number;
  revenue: ForecastMetric;
  acquisitions: ForecastMetric;
  expenses: ForecastMetric;
}

export interface ConnectorField {
  key: string;
  label: string;
  type: "text" | "password" | "select";
  placeholder?: string;
  secret?: boolean;
  options?: { value: string; label: string }[];
}

export interface Connector {
  provider: string;
  name: string;
  category: "telephony" | "messaging" | "localization" | "automation";
  description: string;
  region: string;
  capabilities: string[];
  fields: ConnectorField[];
  connected: boolean;
  status: "active" | "inactive" | null;
  config: Record<string, string> | null;
  connectedAt: string | null;
}

export interface InvoiceListItem {
  id: string;
  invoiceNo: string | null;
  total: number;
  status: "draft" | "paid" | "partial" | "cancelled";
  createdAt: string;
  finalizedAt: string | null;
  clientName: string;
  clientPhone: string;
  plateNumber: string;
}

export interface Payment {
  id: string;
  mode: "cash" | "upi" | "card" | "wallet" | "points";
  amount: number;
  txnRef: string | null;
  paidAt: string;
}

export interface InvoiceDetail {
  invoice: {
    id: string;
    invoiceNo: string | null;
    subtotal: number;
    discount: number;
    total: number;
    status: string;
    createdAt: string;
    finalizedAt: string | null;
    appliedOfferCode?: string | null;
    appliedOfferTitle?: string | null;
  };
  client: ClientRecord | null;
  vehicle: { plateNumber: string } | null;
  lineItems: { id: string; serviceName: string; qty: number; price: number }[];
  payments: Payment[];
  paidSoFar: number;
  balanceDue: number;
  walletBalance: number;
  pointsBalance: number;
  loyaltyEnabled: boolean;
  redeemPaisePerPoint: number;
}

export interface Notification {
  id: string;
  orgId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export interface JobCardListItem {
  id: string;
  jobDate: string;
  status: "draft" | "in_progress" | "completed" | "billed" | "cancelled";
  total: number;
  clientId: string;
  clientName: string;
  clientPhone: string;
  vehicleId: string;
  plateNumber: string;
  branchId: string;
  createdAt: string;
  hasInvoice: string | null;
}

export interface JobCardDetail {
  jobCard: {
    id: string;
    jobDate: string;
    status: string;
    subtotal: number;
    discount: number;
    taxPercent: number;
    total: number;
    images: string[] | null;
    completedAt: string | null;
  };
  client: ClientRecord | null;
  vehicle: {
    plateNumber: string;
    makeName: string | null;
    modelName: string | null;
    segment: string | null;
    year: number | null;
    color: string | null;
    fuelType: string | null;
    odometerReading: number | null;
  } | null;
  lineItems: { id: string; serviceName: string; qty: number; price: number }[];
  serviceAdvisorName: string | null;
  invoice: { id: string; status: string; total: number; finalizedAt: string | null } | null;
}

export interface VehicleMake {
  id: string;
  orgId: string | null;
  name: string;
  createdAt: string;
}

export interface VehicleModel {
  id: string;
  orgId: string | null;
  name: string;
  segment: string;
  makeId: string;
  makeName: string;
}

export interface VehicleSearchResult {
  id: string;
  plateNumber: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
}

export interface Vendor {
  id: string;
  orgId: string;
  name: string;
  contactNumber: string;
  email: string | null;
  address: string | null;
  createdAt: string;
}

export interface VendorInput {
  name: string;
  contactNumber: string;
  email?: string;
  address?: string;
}

export interface VendorLedgerItem {
  id: string;
  productName: string;
  quantity: number;
  unit: string | null;
  purchasePrice: number;
  salePrice: number;
  vendorAmountPaid: number;
  vendorPaidStatus: "unpaid" | "paid" | "n_a";
  vehicleId: string;
  plateNumber: string;
  clientName: string;
  clientPhone: string;
  jobCardId: string;
  customerInvoiceStatus: string;
  customerInvoiceNo: string;
  lotNo: string;
  supplierInvoiceNo: string | null;
}

export interface VendorLedgerGroup {
  vehicleId: string;
  plateNumber: string;
  clientName: string;
  clientPhone: string;
  customerInvoiceStatus: string;
  customerInvoiceNo: string;
  totalPurchaseDue: number;
  totalSaleAmount: number;
  totalPaidToVendor: number;
  margin: number;
  items: VendorLedgerItem[];
}

export interface VendorLedgerResponse {
  data: VendorLedgerGroup[];
  total: number;
  page: number;
  limit: number;
  totals: {
    creditOwed: number;
    settled: number;
    outstanding: number;
    margin: number;
    readyToSettle: number;
  };
}

// --- Diagnostics (PDF report intelligence) ---
export interface DiagnosticSummary {
  totalReports: number;
  activeFaults: number;
  criticalFaults: number;
  vehiclesNeedingAttention: number;
  avgHealthScore: number | null;
  needsAiCount: number;
  topCodes: { code: string; description: string; count: number }[];
}

export interface DiagnosticReportListItem {
  id: string;
  branchId: string | null;
  vehicleId: string | null;
  clientId: string | null;
  fileName: string;
  fileUrl: string;
  reportType: string;
  status: "processed" | "needs_ai" | "failed";
  engine: "parser" | "ocr" | "parser+llm" | "ocr+llm" | null;
  reportDate: string | null;
  odometerKm: number | null;
  plateNumber: string | null;
  clientName: string | null;
  healthScore: number | null;
  summary: string | null;
  createdAt: string;
  faultCount: number;
  activeFaults: number;
  criticalFaults: number;
}

export interface DiagnosticFault {
  id: string;
  code: string;
  description: string;
  system: string;
  ecu: string | null;
  status: "active" | "pending" | "history" | "permanent" | "unknown";
  severity: "critical" | "high" | "medium" | "low" | "info";
  isRecurring: boolean;
}

export interface DiagnosticRootCause {
  title: string;
  confidence: "high" | "medium";
  explanation: string;
  explains: string[];
  repairSequence: string[];
}

export interface DiagnosticRecommendation {
  action: string;
  priority: "critical" | "high" | "medium" | "low";
  codes: string[];
  estCostMin: number; // paise
  estCostMax: number;
  laborHours: number;
}

export interface DiagnosticExtraction {
  vehicle: {
    vin?: string | null;
    plateNumber?: string | null;
    make?: string | null;
    model?: string | null;
    fuelType?: string | null;
    year?: number | null;
    odometerKm?: number | null;
  };
  reportDate?: string | null;
  workshopName?: string | null;
  technicianName?: string | null;
  sensors: { name: string; value: string; unit?: string | null }[];
  freezeFrames?: { code?: string | null; values: { name: string; value: string; unit?: string | null }[] }[];
  remarks?: string[];
  partsReplaced?: string[];
}

export interface DiagnosticComparison {
  previousReportId: string;
  previousDate: string;
  previousHealthScore: number | null;
  healthDelta: number | null;
  newCodes: string[];
  resolvedCodes: string[];
  recurringCodes: string[];
}

export interface DiagnosticReportDetail {
  report: {
    id: string;
    fileUrl: string;
    fileName: string;
    textFileUrl: string | null;
    reportType: string;
    status: "processed" | "needs_ai" | "failed";
    engine: "parser" | "ocr" | "parser+llm" | "ocr+llm" | null;
    reportDate: string | null;
    odometerKm: number | null;
    vin: string | null;
    plateNumber: string | null;
    workshopName: string | null;
    technicianName: string | null;
    extracted: DiagnosticExtraction | null;
    healthScore: number | null;
    systemScores: Record<string, number> | null;
    rootCauses: DiagnosticRootCause[] | null;
    recommendations: DiagnosticRecommendation[] | null;
    summary: string | null;
    aiAnalysis: Record<string, unknown> | null;
    createdAt: string;
    vehicleId: string | null;
  };
  faults: DiagnosticFault[];
  vehicle: { id: string; plateNumber: string; year: number | null; fuelType: string | null } | null;
  client: { id: string; name: string; phone: string } | null;
  comparison: DiagnosticComparison | null;
  statusDetail?: string | null;
}

export interface DiagnosticTimeline {
  vehicle: { id: string; plateNumber: string };
  reports: (DiagnosticReportDetail["report"] & { faults: DiagnosticFault[] })[];
  healthTrend: { date: string; score: number }[];
  recurringCodes: { code: string; occurrences: number; description: string }[];
}

export const api = {
  signup: (input: SignupInput) =>
    request<{ token: string }>("/auth/signup", { method: "POST", body: JSON.stringify(input) }),
  login: (phone: string, password: string) =>
    request<{ token: string }>("/auth/login", { method: "POST", body: JSON.stringify({ phone, password }) }),
  me: () => request<MeResponse>("/me"),
  dashboardMetrics: (branchId?: string) =>
    request<DashboardMetrics>(`/dashboard/metrics${branchId ? `?branchId=${branchId}` : ""}`),
  dashboardForecast: (granularity: "day" | "week" | "month", branchId?: string) => {
    const p = new URLSearchParams({ granularity });
    if (branchId) p.set("branchId", branchId);
    return request<ForecastResponse>(`/dashboard/forecast?${p.toString()}`);
  },
  listProducts: () => request<Product[]>("/products"),
  createProduct: (input: ProductInput) => request<Product>("/products", { method: "POST", body: JSON.stringify(input) }),
  updateProduct: (id: string, input: Partial<ProductInput>) =>
    request<Product>(`/products/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteProduct: (id: string) => request<{ success: true }>(`/products/${id}`, { method: "DELETE" }),
  listVendors: () => request<Vendor[]>("/vendors"),
  createVendor: (input: VendorInput) => request<Vendor>("/vendors", { method: "POST", body: JSON.stringify(input) }),
  updateVendor: (id: string, input: Partial<VendorInput>) =>
    request<Vendor>(`/vendors/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteVendor: (id: string) => request<{ success: true }>(`/vendors/${id}`, { method: "DELETE" }),
  getVendorLedger: (id: string, params?: { search?: string; period?: string; page?: number; limit?: number }) => {
    const p = new URLSearchParams();
    if (params?.search) p.set("search", params.search);
    if (params?.period) p.set("period", params.period);
    if (params?.page) p.set("page", String(params.page));
    if (params?.limit) p.set("limit", String(params.limit));
    const qs = p.toString();
    return request<VendorLedgerResponse>(`/vendors/${id}/ledger${qs ? `?${qs}` : ""}`);
  },
  payVendorVehicle: (id: string, vehicleId: string, amount: number, paymentMode?: string) =>
    request<{ success: true; remainingBalanceRupees: number }>(`/vendors/${id}/pay-vehicle`, {
      method: "POST",
      body: JSON.stringify({ vehicleId, amount, paymentMode }),
    }),
  listFeedback: (source?: string) => request<Feedback[]>(`/feedback${source && source !== "all" ? `?source=${source}` : ""}`),
  feedbackSummary: () => request<FeedbackSummary>("/feedback/summary"),
  createFeedback: (input: { source: string; reviewerName?: string; rating?: number; comment?: string; reviewDate?: string }) =>
    request<Feedback>("/feedback", { method: "POST", body: JSON.stringify(input) }),
  replyFeedback: (id: string, reply: string) =>
    request<Feedback>(`/feedback/${id}/reply`, { method: "PATCH", body: JSON.stringify({ reply }) }),
  listEnquiries: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<Enquiry[]>(`/enquiries${qs}`);
  },
  createEnquiry: (input: EnquiryInput) => request<Enquiry>("/enquiries", { method: "POST", body: JSON.stringify(input) }),
  updateEnquiry: (id: string, input: { leadStatus?: LeadStatus; response?: string; dateToFollow?: string; leadRepresentativeId?: string }) =>
    request<Enquiry>(`/enquiries/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  inventorySummary: (branchId?: string) => request<InventorySummary>(`/inventory/summary${branchId ? `?branchId=${branchId}` : ""}`),
  listInventory: (filter: "available" | "expired" | "all", branchId?: string) =>
    request<InventoryItem[]>(`/inventory/items?filter=${filter}${branchId ? `&branchId=${branchId}` : ""}`),
  recordPurchase: (input: PurchaseInput) => request<{ id: string; lotNo: string }>("/inventory/lots", { method: "POST", body: JSON.stringify(input) }),
  consumeInventoryItem: (id: string, qty: number, notes?: string) => request<{ id: string }>(`/inventory/items/${id}/consume`, { method: "POST", body: JSON.stringify({ quantity: qty, notes }) }),
  listInventoryConsumptions: () => request<InventoryConsumption[]>("/inventory/consumptions"),
  listBranches: () => request<Branch[]>("/branches"),
  createBranch: (input: BranchInput) =>
    request<Branch>("/branches", { method: "POST", body: JSON.stringify(input) }),
  updateBranch: (id: string, input: Partial<BranchInput>) =>
    request<Branch>(`/branches/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  listStaff: () => request<StaffListItem[]>("/staff"),
  createMechanic: (input: MechanicFormInput) =>
    request<{ user: { id: string; name: string; phone: string } }>("/staff/mechanics", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateMechanic: (userId: string, input: Partial<MechanicFormInput>) =>
    request<{ success: boolean }>(`/staff/mechanics/${userId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  createStaffMember: (input: StaffMemberFormInput) =>
    request<{ user: { id: string; name: string; phone: string } }>("/staff/members", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateStaffMember: (userId: string, input: Partial<StaffMemberFormInput>) =>
    request<{ success: boolean }>(`/staff/members/${userId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  uploadFile: async (file: File): Promise<{ url: string }> => {
    const token = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${BASE}/uploads`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || data.error || "upload failed");
    return data;
  },
  markAttendance: (input: MarkAttendanceInput) =>
    request<AttendanceRecord>("/attendance", { method: "POST", body: JSON.stringify(input) }),
  listAttendance: (userId: string, from: string, to: string) =>
    request<AttendanceRecord[]>(`/attendance?userId=${userId}&from=${from}&to=${to}`),
  attendanceSummary: (userId: string, year: string) =>
    request<AttendanceMonthSummary[]>(`/attendance/summary?userId=${userId}&year=${year}`),
  payrollPreview: (userId: string, month: string) =>
    request<PayrollBreakdown>(`/payroll/${userId}/${month}/preview`),
  finalizePayroll: (userId: string, month: string) =>
    request<PayrollRecord>(`/payroll/${userId}/${month}/finalize`, { method: "POST" }),
  payrollHistory: (userId: string) => request<PayrollRecord[]>(`/payroll/${userId}/history`),
  listVehicleMakes: () => request<VehicleMake[]>("/vehicle-makes"),
  createVehicleMake: (name: string) =>
    request<VehicleMake>("/vehicle-makes", { method: "POST", body: JSON.stringify({ name }) }),
  deleteVehicleMake: (id: string) => request<{ success: true }>(`/vehicle-makes/${id}`, { method: "DELETE" }),
  listVehicleModels: () => request<VehicleModel[]>("/vehicle-models"),
  createVehicleModel: (input: { name: string; makeId: string; segment: string }) =>
    request<VehicleModel>("/vehicle-models", { method: "POST", body: JSON.stringify(input) }),
  deleteVehicleModel: (id: string) => request<{ success: true }>(`/vehicle-models/${id}`, { method: "DELETE" }),
  searchClients: (q: string) => request<ClientRecord[]>(`/clients/search?q=${encodeURIComponent(q)}`),
  searchVehicles: (q: string) => request<VehicleSearchResult[]>(`/vehicles/search?q=${encodeURIComponent(q)}`),
  listClients: () => request<ClientListItem[]>("/clients"),
  createClient: (input: CreateClientInput) =>
    request<ClientRecord>("/clients", { method: "POST", body: JSON.stringify(input) }),
  getClientCredit: (id: string) => request<ClientCredit>(`/clients/${id}/credit`),
  getCalendar: (month: string, branchId?: string) =>
    request<CalendarResponse>(`/calendar?month=${month}${branchId ? `&branchId=${branchId}` : ""}`),
  listCameras: (branchId?: string) =>
    request<{ providers: CameraProvider[]; cameras: BranchCamera[] }>(`/cameras${branchId ? `?branchId=${branchId}` : ""}`),
  createCamera: (input: CameraInput) => request<BranchCamera>("/cameras", { method: "POST", body: JSON.stringify(input) }),
  updateCamera: (id: string, input: Partial<CameraInput>) =>
    request<BranchCamera>(`/cameras/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteCamera: (id: string) => request<{ success: true }>(`/cameras/${id}`, { method: "DELETE" }),
  getCalendarDay: (date: string, branchId?: string) =>
    request<CalendarDayDetail>(`/calendar/day?date=${date}${branchId ? `&branchId=${branchId}` : ""}`),
  getClientDetail: (id: string) => request<ClientDetail>(`/clients/${id}`),
  getClient360: (id: string) => request<Client360>(`/clients/${id}/360`),
  listServices: () => request<Service[]>("/services"),
  createJobCard: (input: CreateJobCardInput) =>
    request<{ jobCard: { id: string } }>("/job-cards", { method: "POST", body: JSON.stringify(input) }),
  listJobCards: (branchId?: string) => request<JobCardListItem[]>(`/job-cards${branchId ? `?branchId=${branchId}` : ""}`),
  getJobCardDetail: (id: string) => request<JobCardDetail>(`/job-cards/${id}`),
  completeJobCard: (id: string) =>
    request<{ jobCard: unknown; invoice: { id: string }; alreadyExisted: boolean }>(`/job-cards/${id}/complete`, { method: "POST" }),
  listInvoices: (branchId?: string) => request<InvoiceListItem[]>(`/invoices${branchId ? `?branchId=${branchId}` : ""}`),
  getInvoiceDetail: (id: string) => request<InvoiceDetail>(`/invoices/${id}`),
  recordPayment: (id: string, input: { mode: "cash" | "upi" | "card" | "wallet"; amount: number; txnRef?: string }) =>
    request<{ invoice: unknown; payment: Payment; earnedPoints: number }>(`/invoices/${id}/payments`, { method: "POST", body: JSON.stringify(input) }),
  redeemPoints: (id: string, points: number) =>
    request<{ invoice: unknown; payment: Payment; redeemedPoints: number; redeemedValue: number; pointsRemaining: number }>(
      `/invoices/${id}/redeem-points`,
      { method: "POST", body: JSON.stringify({ points }) }
    ),
  updateOrgSettings: (input: { walletEnabled: boolean }) =>
    request<{ walletEnabled: boolean }>("/org/settings", { method: "PATCH", body: JSON.stringify(input) }),
  refreshSalesActions: () => request<{ created: number }>("/sales-actions/refresh", { method: "POST" }),
  listSalesActions: (status?: string, branchId?: string) => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (branchId) p.set("branchId", branchId);
    const qs = p.toString();
    return request<SalesAction[]>(`/sales-actions${qs ? `?${qs}` : ""}`);
  },
  getSalesActionLogs: (id: string) => request<SalesActionLog[]>(`/sales-actions/${id}/logs`),
  recordSalesOutcome: (
    id: string,
    input: { outcome: SalesActionStatus; note: string; nextFollowUpDate?: string; appointmentDate?: string; appointmentTime?: string }
  ) => request<SalesAction>(`/sales-actions/${id}/outcome`, { method: "POST", body: JSON.stringify(input) }),
  listAppointments: () => request<AppointmentRecord[]>("/appointments"),
  updateAppointmentStatus: (id: string, status: AppointmentRecord["status"]) =>
    request<AppointmentRecord>(`/appointments/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
  listConnectors: () => request<Connector[]>("/connectors"),
  saveConnector: (provider: string, config: Record<string, string>) =>
    request<{ provider: string; connected: boolean }>(`/connectors/${provider}`, { method: "PUT", body: JSON.stringify({ config }) }),
  disconnectConnector: (provider: string) => request<{ success: true }>(`/connectors/${provider}`, { method: "DELETE" }),
  listOffers: () => request<Offer[]>("/offers"),
  createOffer: (input: {
    code: string;
    title: string;
    description: string;
    discountType: "flat" | "percentage";
    value: number;
    maxDiscount?: number;
    minBillingAmount?: number;
    targetType: string;
    restrictedDays?: string[];
    startTime?: string;
    endTime?: string;
  }) => request<Offer>("/offers", { method: "POST", body: JSON.stringify(input) }),
  updateOffer: (
    id: string,
    input: Partial<{
      title: string;
      description: string;
      value: number;
      maxDiscount: number;
      minBillingAmount: number;
      isActive: boolean;
      restrictedDays: string[];
      startTime: string | null;
      endTime: string | null;
    }>
  ) => request<Offer>(`/offers/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteOffer: (id: string) => request<{ success: true }>(`/offers/${id}`, { method: "DELETE" }),
  listNotifications: () => request<Notification[]>("/notifications"),
  markAllNotificationsRead: () => request<{ success: true }>("/notifications/read-all", { method: "POST" }),
  markNotificationRead: (id: string) => request<{ success: true }>(`/notifications/${id}/read`, { method: "POST" }),
  listExpenseCategories: () => request<ExpenseCategory[]>("/expense-categories"),
  createExpenseCategory: (input: ExpenseCategoryInput) =>
    request<ExpenseCategory>("/expense-categories", { method: "POST", body: JSON.stringify(input) }),
  updateExpenseCategory: (id: string, input: Partial<ExpenseCategoryInput>) =>
    request<ExpenseCategory>(`/expense-categories/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteExpenseCategory: (id: string) =>
    request<{ success: true }>(`/expense-categories/${id}`, { method: "DELETE" }),
  listExpenses: (branchId?: string) =>
    request<Expense[]>(`/expenses${branchId ? `?branchId=${branchId}` : ""}`),
  expenseSummary: (branchId?: string) =>
    request<ExpenseSummary>(`/expenses/summary${branchId ? `?branchId=${branchId}` : ""}`),
  createExpense: (input: ExpenseInput) =>
    request<Expense>("/expenses", { method: "POST", body: JSON.stringify(input) }),
  updateExpense: (id: string, input: Partial<ExpenseInput>) =>
    request<Expense>(`/expenses/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteExpense: (id: string) => request<{ success: true }>(`/expenses/${id}`, { method: "DELETE" }),
  diagnosticsSummary: (branchId?: string) =>
    request<DiagnosticSummary>(`/diagnostics/summary${branchId ? `?branchId=${branchId}` : ""}`),
  listDiagnosticReports: (params?: { branchId?: string; vehicleId?: string; clientId?: string; status?: string }) => {
    const p = new URLSearchParams();
    Object.entries(params ?? {}).forEach(([k, v]) => v && p.set(k, v));
    const qs = p.toString();
    return request<DiagnosticReportListItem[]>(`/diagnostics/reports${qs ? `?${qs}` : ""}`);
  },
  getDiagnosticReport: (id: string) => request<DiagnosticReportDetail>(`/diagnostics/reports/${id}`),
  // Fields are appended BEFORE the file so @fastify/multipart exposes them on file.fields.
  uploadDiagnosticReport: async (file: File, fields: { branchId?: string; vehicleId?: string; reportType?: string }): Promise<DiagnosticReportDetail> => {
    const token = localStorage.getItem("token");
    const formData = new FormData();
    Object.entries(fields).forEach(([k, v]) => v && formData.append(k, v));
    formData.append("file", file);
    const res = await fetch(`${BASE}/diagnostics/reports`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || data.error || "upload failed");
    return data;
  },
  reprocessDiagnosticReport: (id: string, useOcr?: boolean) =>
    request<DiagnosticReportDetail>(`/diagnostics/reports/${id}/reprocess`, {
      method: "POST",
      body: JSON.stringify({ useOcr: useOcr ?? false }),
    }),
  deleteDiagnosticReport: (id: string) => request<{ success: true }>(`/diagnostics/reports/${id}`, { method: "DELETE" }),
  vehicleDiagnosticTimeline: (vehicleId: string) => request<DiagnosticTimeline>(`/diagnostics/vehicles/${vehicleId}/timeline`),
  getReport: <T>(reportType: string, params: { branchId?: string; userId?: string; startDate?: string; endDate?: string }) => {
    const cleanParams: Record<string, string> = {};
    Object.entries(params).forEach(([k, v]) => {
      if (v) cleanParams[k] = v;
    });
    const qs = new URLSearchParams(cleanParams).toString();
    return request<T[]>(`/reports/${reportType}${qs ? `?${qs}` : ""}`);
  },
};

export interface DailyReportRow {
  date: string;
  jobCardsCount: number;
  invoicesCount: number;
  invoicedAmount: number;
  paymentsCollected: number;
  discountsGiven: number;
}

export interface DaySummaryRow {
  date: string;
  type: string;
  referenceId: string;
  clientName: string;
  detail: string;
  value: number;
}

export interface JobCardReportRow {
  id: string;
  jobDate: string;
  status: string;
  subtotal: number;
  discount: number;
  taxPercent: number;
  total: number;
  source: string;
  createdAt: string;
  completedAt: string | null;
  clientName: string;
  clientPhone: string;
  plateNumber: string;
  advisorName: string | null;
  mechanics: string;
}

export interface BillingReportRow {
  id: string;
  createdAt: string;
  clientName: string;
  clientPhone: string;
  plateNumber: string;
  subtotal: number;
  discount: number;
  total: number;
  status: string;
  finalizedAt: string | null;
}

export interface EnquiryReportRow {
  id: string;
  createdAt: string;
  clientName: string;
  contactNumber: string;
  email: string | null;
  address: string | null;
  enquiryFor: string;
  enquiryType: string;
  sourceOfEnquiry: string;
  leadStatus: string;
  channel: string;
  vehicleNumber: string | null;
  repName: string | null;
  followUpDate: string;
}

export interface MechanicReportRow {
  mechanicId: string;
  name: string;
  jobCardsCount: number;
  invoicesCount: number;
  attributedRevenue: number;
  commissionPct: number;
  estimatedCommission: number;
}

export interface PaymentsReportRow {
  id: string;
  invoiceId: string;
  mode: string;
  amount: number;
  txnRef: string | null;
  paidAt: string;
  clientName: string;
  clientPhone: string;
  plateNumber: string;
}

export interface BalanceReportRow {
  id: string;
  createdAt: string;
  clientName: string;
  clientPhone: string;
  plateNumber: string;
  total: number;
  status: string;
  paidSoFar: number;
  balanceDue: number;
}

export interface AttendanceReportRow {
  id: string;
  date: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  hoursWorked: string;
  notes: string | null;
  employeeName: string;
}

export interface SmsHistoryReportRow {
  id: string;
  createdAt: string;
  clientName: string;
  contactNumber: string;
  channel: string;
  enquiryFor: string;
  leadStatus: string;
  followUpDate: string;
}

