export type UserRole = 'farmer' | 'chilling_center' | 'nestle_officer';

export interface User {
  id: number;
  email: string;
  role: UserRole;
  name: string;
  chillingCenterId?: number;
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
  totalQuantity?: number;
  avgQuantity?: number;
  qualityRate?: number;
  revenue?: number;
}

export interface MilkCollection {
  id: number;
  farmerId: number;
  farmerName?: string;
  farmerCode?: string;
  chillingCenterId: number;
  date: string;
  time: string;
  temperature: number;
  quantity: number;
  milkType?: 'Buffalo' | 'Cow' | 'Goat';
  qualityResult?: 'Pass' | 'Fail';
  failureReason?: string;
  dispatchStatus?: 'Pending' | 'Dispatched' | 'Approved' | 'Rejected';
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
  id: number;
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
  createdAt: string;
}

export interface DispatchItem {
  id: number;
  dispatchId: number;
  collectionId: number;
  farmerName?: string;
  quantity?: number;
  qualityResult?: string;
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
  type: 'quality_result' | 'payment' | 'dispatch' | 'general';
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
