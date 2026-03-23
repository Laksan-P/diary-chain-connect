/**
 * API Service Layer — Connected to Express Backend
 * =================================================
 * All calls go to the Express backend via Vite proxy (/api → http://localhost:4000/api)
 */

import type {
  AuthResponse, User, Farmer, FarmerRegistration, ChillingCenter,
  MilkCollection, QualityTest, Dispatch, PricingRule, Payment,
  Notification, CenterPerformance,
} from '@/types';

const API_BASE_URL = ''; // Proxied via vite.config.ts

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

/** POST /api/auth/login */
export const login = async (email: string, password: string): Promise<AuthResponse> => {
  const data = await apiFetch<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  setStoredUser(data.user);
  return data;
};

/** POST /api/auth/register-farmer */
export const registerFarmer = async (data: FarmerRegistration): Promise<AuthResponse> => {
  const res = await apiFetch<AuthResponse>('/api/auth/register-farmer', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  setToken(res.token);
  setStoredUser(res.user);
  return res;
};

/** POST /api/auth/register-user */
export const registerUser = async (data: { name: string; email: string; password: string; role: 'nestle' | 'chilling_center' }): Promise<AuthResponse> => {
  const res = await apiFetch<AuthResponse>('/api/auth/register-user', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  setToken(res.token);
  setStoredUser(res.user);
  return res;
};

/** POST /api/auth/register-farmer-by-center */
export const registerFarmerByCenter = async (data: FarmerRegistration): Promise<Farmer> => {
  return apiFetch<Farmer>('/api/auth/register-farmer-by-center', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

/** GET /api/auth/me */
export const getMe = async (): Promise<User> => {
  return apiFetch<User>('/api/auth/me');
};

/** GET /api/auth/nestle-officers */
export const getNestleOfficers = async (): Promise<any[]> => {
  return apiFetch<any[]>('/api/auth/nestle-officers');
};

// ============ CHILLING CENTERS ============

/** GET /api/chilling-centers */
export const getChillingCenters = async (): Promise<ChillingCenter[]> => {
  return apiFetch<ChillingCenter[]>('/api/chilling-centers');
};

// ============ FARMERS ============

/** GET /api/farmers */
export const getFarmers = async (): Promise<Farmer[]> => {
  return apiFetch<Farmer[]>('/api/farmers');
};

/** GET /api/farmers/:id */
export const getFarmer = async (id: number): Promise<Farmer> => {
  return apiFetch<Farmer>(`/api/farmers/${id}`);
};

// ============ COLLECTIONS ============

/** GET /api/collections */
export const getCollections = async (centerId?: number, farmerId?: number): Promise<MilkCollection[]> => {
  let url = '/api/collections';
  if (centerId) url += `?centerId=${centerId}`;
  else if (farmerId) url += `?farmerId=${farmerId}`;
  return apiFetch<MilkCollection[]>(url);
};

/** POST /api/collections */
export const createCollection = async (data: Partial<MilkCollection>): Promise<MilkCollection> => {
  return apiFetch<MilkCollection>('/api/collections', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

// ============ QUALITY TESTS ============

/** POST /api/quality-tests */
export const submitQualityTest = async (data: { collectionId: number; snf: number; fat: number; water: number }): Promise<QualityTest> => {
  return apiFetch<QualityTest>('/api/quality-tests', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

// ============ DISPATCHES ============

/** GET /api/dispatches */
export const getDispatches = async (centerId?: number): Promise<Dispatch[]> => {
  let url = '/api/dispatches';
  if (centerId) url += `?centerId=${centerId}`;
  return apiFetch<Dispatch[]>(url);
};

/** POST /api/dispatches */
export const createDispatch = async (data: Partial<Dispatch>): Promise<Dispatch> => {
  return apiFetch<Dispatch>('/api/dispatches', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

/** PATCH /api/dispatches/:id/status */
export const updateDispatchStatus = async (id: number, status: 'Approved' | 'Rejected', reason?: string): Promise<void> => {
  await apiFetch<{ success: boolean }>(`/api/dispatches/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reason }),
  });
};

// ============ PRICING RULES ============

/** GET /api/pricing-rules */
export const getPricingRules = async (): Promise<PricingRule[]> => {
  return apiFetch<PricingRule[]>('/api/pricing-rules');
};

/** POST /api/pricing-rules */
export const createPricingRule = async (data: Partial<PricingRule>): Promise<PricingRule> => {
  return apiFetch<PricingRule>('/api/pricing-rules', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

// ============ PAYMENTS ============

/** GET /api/payments */
export const getPayments = async (farmerId?: number): Promise<Payment[]> => {
  let url = '/api/payments';
  if (farmerId) url += `?farmerId=${farmerId}`;
  return apiFetch<Payment[]>(url);
};

/** POST /api/payments/generate */
export const generatePayment = async (collectionId: number): Promise<Payment> => {
  return apiFetch<Payment>('/api/payments/generate', {
    method: 'POST',
    body: JSON.stringify({ collectionId }),
  });
};

/** PATCH /api/payments/:id/status */
export const updatePaymentStatus = async (id: number, status: 'Paid'): Promise<void> => {
  await apiFetch<{ success: boolean }>(`/api/payments/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
};

// ============ ANALYTICS ============

/** GET /api/chilling-centers/performance */
export const getCenterPerformance = async (): Promise<CenterPerformance[]> => {
  return apiFetch<CenterPerformance[]>('/api/chilling-centers/performance');
};

// ============ NOTIFICATIONS ============

/** GET /api/notifications */
export const getNotifications = async (): Promise<Notification[]> => {
  return apiFetch<Notification[]>('/api/notifications');
};

// ============ LOGOUT ============
export const logout = () => {
  clearToken();
};
