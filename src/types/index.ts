export type UserRole = 'farmer' | 'chilling_center' | 'nestle_officer';

export interface User {
  id: number;
  email: string;
  role: UserRole;
  name: string;
  chillingCenterId?: number;
  chillingCenterName?: string;
  farmerId?: number;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Farmer {
  id: number;
  farmerId: string;
  userId: number;
  name: string;
  address: string;
  phone: string;
  nic: string;
  chillingCenterId: number;
  chillingCenterName?: string;
  totalQuantity?: number;
  createdAt: string;
  performance_status?: 'Good' | 'Needs Improvement' | 'Improving';
  performance_recommendation?: string | null;
}

export interface BankAccount {
  id: number;
  farmerId: number;
  bankName: string;
  accountNumber: string;
  branch: string;
}

export interface ChillingCenter {
  id: number;
  name: string;
  location: string;
  phone_number?: string;
  email?: string;
  totalQuantity?: number;
  avgQuantity?: number;
  qualityRate?: number;
  revenue?: number;
  performance_status?: 'Good' | 'Needs Improvement';
  performance_recommendation?: string | null;
  quality_pass_rate?: number;
  show_alert?: boolean;
}

export interface MilkCollection {
  id: number | string;
  farmerId: number;
  farmerName?: string;
  farmerCode?: string;
  chillingCenterId: number;
  chillingCenterName?: string;
  date: string;
  time: string;
  temperature: number;
  quantity: number;
  milkType?: 'Buffalo' | 'Cow' | 'Goat';
  qualityResult?: 'Pass' | 'Fail';
  displayId?: string;
  failureReason?: string;
  dispatchStatus?: 'Pending' | 'Dispatched' | 'Approved' | 'Rejected';
  isOffline?: boolean;
  createdAt: string;
}

export interface QualityTest {
  id: number;
  collectionId: number;
  snf: number;
  fat: number;
  water: number;
  result: 'Pass' | 'Fail';
  reason?: string;
  testedAt: string;
}

export interface Dispatch {
  id: number | string;
  chillingCenterId: number;
  chillingCenterName?: string;
  transporterName: string;
  vehicleNumber: string;
  driverContact: string;
  dispatchDate: string;
  status: 'Dispatched' | 'Approved' | 'Rejected';
  rejectionReason?: string;
  items: DispatchItem[];
  totalQuantity?: number;
  offline_id?: string;
  isOffline?: boolean;
  realOfflineId?: string;
  createdAt: string;
}

export interface DispatchItem {
  id: number;
  dispatchId: number;
  collectionId: number;
  offlineCollectionId?: string;
  farmerName?: string;
  quantity?: number;
  qualityResult?: string;
  dispatchStatus?: string;
  failureReason?: string;
}

export interface PricingRule {
  id: number;
  basePricePerLiter: number;
  fatBonus: number;
  snfBonus: number;
  effectiveFrom: string;
  isActive: boolean;
}

export interface Payment {
  id: number;
  farmerId: number;
  farmerName?: string;
  farmerCode?: string;
  collectionId: number;
  quantity?: number;
  amount: number;
  basePay: number;
  fatBonus: number;
  snfBonus: number;
  status: 'Pending' | 'Paid';
  paidAt?: string;
  createdAt: string;
}

export interface Notification {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: 'quality_result' | 'payment' | 'dispatch' | 'general' | 'system';
  isRead: boolean;
  createdAt: string;
}

export interface CenterPerformance {
  centerId: number;
  centerName: string;
  totalQuantity: number;
  avgQuantity: number;
  totalRevenue: number;
  qualityRate: number;
  rank: number;
}

export interface FarmerRegistration {
  name: string;
  address: string;
  phone: string;
  nic: string;
  chillingCenterId: number;
  bankName: string;
  accountNumber: string;
  branch: string;
  email: string;
  password: string;
}

export interface PredictionData {
  actualData: { week: string; value: number }[];
  forecastData: { week: string; value: number }[];
  centerPredictions: {
    centerId: string;
    name: string;
    predictions: { week: string; value: number }[];
  }[];
  alerts: {
    level: 'Critical' | 'Warning';
    type: 'Red' | 'Amber';
    message: string;
  }[];
}
export interface PerformanceRecommendation {
  id: number;
  issue_type: string;
  title_en: string;
  title_si?: string;
  title_ta?: string;
  description_en?: string;
  description_si?: string;
  description_ta?: string;
  guidance_en?: string[];
  guidance_si?: string[];
  guidance_ta?: string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  created_at: string;
  updated_at: string;
}
