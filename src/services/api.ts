/**
 * API Service Layer — Connected to Vercel Serverless Backend
 * ==========================================================
 * All calls go to the Vercel serverless API functions via /api/...?action=...
 */

import type {
  AuthResponse, User, Farmer, FarmerRegistration, ChillingCenter,
  MilkCollection, QualityTest, Dispatch, PricingRule, Payment,
  Notification, CenterPerformance,
} from '@/types';

const API_BASE_URL = ''; // Same origin on Vercel

// ============ AUTH TOKEN MANAGEMENT ============
let authToken: string | null = localStorage.getItem('auth_token');

export const setToken = (token: string) => {
  authToken = token;
  localStorage.setItem('auth_token', token);
};

export const clearToken = () => {
  authToken = null;
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
};

export const getStoredUser = (): User | null => {
  const u = localStorage.getItem('auth_user');
  return u ? JSON.parse(u) : null;
};

export const setStoredUser = (user: User) => {
  localStorage.setItem('auth_user', JSON.stringify(user));
};

// ============ FETCH HELPER ============
async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

// ============ AUTH ============

/** POST /api/auth?action=login */
export const login = async (email: string, password: string): Promise<AuthResponse> => {
  const data = await apiFetch<AuthResponse>('/api/auth?action=login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  setStoredUser(data.user);
  return data;
};

/** POST /api/auth?action=register-farmer */
export const registerFarmer = async (data: FarmerRegistration): Promise<AuthResponse> => {
  const res = await apiFetch<AuthResponse>('/api/auth?action=register-farmer', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  setToken(res.token);
  setStoredUser(res.user);
  return res;
};

/** POST /api/auth?action=register-user */
export const registerUser = async (data: { 
  name: string; 
  email: string; 
  password: string; 
  role: 'nestle' | 'chilling_center';
  location?: string;
  bankName?: string;
  accountNumber?: string;
  branch?: string;
}): Promise<AuthResponse> => {
  const res = await apiFetch<AuthResponse>('/api/auth?action=register-user', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  setToken(res.token);
  setStoredUser(res.user);
  return res;
};

/** Admin action to register a CC without switching context */
export const registerChillingCenterByAdmin = async (data: any): Promise<any> => {
  return apiFetch<any>('/api/auth?action=register-user', {
    method: 'POST',
    body: JSON.stringify({ ...data, role: 'chilling_center' }),
  });
};

/** POST /api/auth?action=register-farmer-by-center */
export const registerFarmerByCenter = async (data: FarmerRegistration): Promise<Farmer> => {
  return apiFetch<Farmer>('/api/auth?action=register-farmer-by-center', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

/** GET /api/auth?action=me */
export const getMe = async (): Promise<User> => {
  return apiFetch<User>('/api/auth?action=me');
};

/** GET /api/auth?action=nestle-officers */
export const getNestleOfficers = async (): Promise<any[]> => {
  return apiFetch<any[]>('/api/auth?action=nestle-officers');
};

// ============ CHILLING CENTERS ============

/** GET /api/chilling-centers?action=list */
export const getChillingCenters = async (): Promise<ChillingCenter[]> => {
  return apiFetch<ChillingCenter[]>('/api/chilling-centers?action=list');
};

/** POST /api/chilling-centers?action=create */
export const createChillingCenter = async (data: { name: string; location: string }): Promise<ChillingCenter> => {
  return apiFetch<ChillingCenter>('/api/chilling-centers?action=create', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

// ============ FARMERS ============

/** GET /api/farmers?action=list */
export const getFarmers = async (centerId?: number): Promise<Farmer[]> => {
  let url = '/api/farmers?action=list';
  if (centerId) url += `&centerId=${centerId}`;
  return apiFetch<Farmer[]>(url);
};

/** GET /api/farmers?action=get&id=X */
export const getFarmer = async (id: number): Promise<Farmer> => {
  return apiFetch<Farmer>(`/api/farmers?action=get&id=${id}`);
};

// ============ COLLECTIONS ============

/** GET /api/collections?action=list */
export const getCollections = async (centerId?: number, farmerId?: number): Promise<MilkCollection[]> => {
  let url = '/api/collections?action=list';
  if (centerId) url += `&centerId=${centerId}`;
  else if (farmerId) url += `&farmerId=${farmerId}`;
  return apiFetch<MilkCollection[]>(url);
};

/** POST /api/collections?action=create */
export const createCollection = async (data: Partial<MilkCollection>): Promise<MilkCollection> => {
  return apiFetch<MilkCollection>('/api/collections?action=create', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

// ============ QUALITY TESTS ============

/** POST /api/operations?action=quality-test */
export const submitQualityTest = async (data: { collectionId: number; snf: number; fat: number; water: number }): Promise<QualityTest> => {
  return apiFetch<QualityTest>('/api/operations?action=quality-test', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

// ============ DISPATCHES ============

/** GET /api/operations?action=dispatches */
export const getDispatches = async (centerId?: number): Promise<Dispatch[]> => {
  let url = '/api/operations?action=dispatches';
  if (centerId) url += `&centerId=${centerId}`;
  return apiFetch<Dispatch[]>(url);
};

/** POST /api/operations?action=create-dispatch */
export const createDispatch = async (data: Partial<Dispatch>): Promise<Dispatch> => {
  return apiFetch<Dispatch>('/api/operations?action=create-dispatch', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

/** PATCH /api/operations?action=dispatch-status&id=X */
export const updateDispatchStatus = async (id: number, status: 'Approved' | 'Rejected', reason?: string): Promise<void> => {
  await apiFetch<{ success: boolean }>(`/api/operations?action=dispatch-status&id=${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reason }),
  });
};

// ============ PRICING RULES ============

/** GET /api/operations?action=pricing-rules */
export const getPricingRules = async (): Promise<PricingRule[]> => {
  return apiFetch<PricingRule[]>('/api/operations?action=pricing-rules');
};

/** POST /api/operations?action=create-pricing-rule */
export const createPricingRule = async (data: Partial<PricingRule>): Promise<PricingRule> => {
  return apiFetch<PricingRule>('/api/operations?action=create-pricing-rule', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};
/** PATCH /api/operations?action=update-pricing-rule&id=X */
export const updatePricingRule = async (id: number, isActive: boolean): Promise<void> => {
  await apiFetch<{ success: boolean }>(`/api/operations?action=update-pricing-rule&id=${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
};

/** DELETE /api/operations?action=delete-pricing-rule&id=X */
export const deletePricingRule = async (id: number): Promise<void> => {
  await apiFetch<{ success: boolean }>(`/api/operations?action=delete-pricing-rule&id=${id}`, {
    method: 'DELETE',
  });
};

// ============ PAYMENTS ============

/** GET /api/payments?action=list */
export const getPayments = async (farmerId?: number): Promise<Payment[]> => {
  let url = '/api/payments?action=list';
  if (farmerId) url += `&farmerId=${farmerId}`;
  return apiFetch<Payment[]>(url);
};

/** POST /api/payments?action=generate */
export const generatePayment = async (collectionId: number): Promise<Payment> => {
  return apiFetch<Payment>('/api/payments?action=generate', {
    method: 'POST',
    body: JSON.stringify({ collectionId }),
  });
};

/** GET /api/payments?action=cycle-summary */
export const getPaymentCycleSummary = async (skipCycle = false): Promise<any> => {
  return apiFetch<any>(`/api/payments?action=cycle-summary${skipCycle ? '&skipCycle=true' : ''}`);
};

/** POST /api/payments?action=process-batch */
export const processPaymentBatch = async (summaryItems: any[]): Promise<any> => {
  return apiFetch<any>('/api/payments?action=process-batch', {
    method: 'POST',
    body: JSON.stringify({ summaryItems }),
  });
};

/** PATCH /api/payments?action=update-status&id=X */
export const updatePaymentStatus = async (id: number, status: 'Paid'): Promise<void> => {
  await apiFetch<{ success: boolean }>(`/api/payments?action=update-status&id=${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
};

// ============ ANALYTICS ============

/** GET /api/chilling-centers?action=performance */
export const getCenterPerformance = async (): Promise<CenterPerformance[]> => {
  return apiFetch<CenterPerformance[]>('/api/chilling-centers?action=performance');
};

// ============ NOTIFICATIONS ============

/** GET /api/notifications?action=list */
export const getNotifications = async (): Promise<Notification[]> => {
  return apiFetch<Notification[]>('/api/notifications?action=list');
};

/** PATCH /api/notifications?action=mark-read&id=X */
export const markNotificationRead = async (id: string | number): Promise<void> => {
  await apiFetch<void>(`/api/notifications?action=mark-read&id=${id}`, {
    method: 'PATCH'
  });
};

// ============ LOGOUT ============
export const logout = () => {
  clearToken();
};
