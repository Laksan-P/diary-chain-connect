import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ChillingCenterLayout from "./layouts/ChillingCenterLayout";
import CCDashboard from "./pages/chilling-center/CCDashboard";
import RegisterFarmer from "./pages/chilling-center/RegisterFarmer";
import MilkCollectionPage from "./pages/chilling-center/MilkCollection";
import QualityTestingPage from "./pages/chilling-center/QualityTesting";
import CollectionHistory from "./pages/chilling-center/CollectionHistory";
import DispatchPage from "./pages/chilling-center/DispatchPage";
import CCSupport from "./pages/chilling-center/CCSupport";
import NestleLayout from "./layouts/NestleLayout";
import NestleDashboard from "./pages/nestle/NestleDashboard";
import FarmersView from "./pages/nestle/FarmersView";
import DispatchMonitoring from "./pages/nestle/DispatchMonitoring";
import PricingRules from "./pages/nestle/PricingRules";
import PaymentsPage from "./pages/nestle/PaymentsPage";

import NestleMilkHistory from "./pages/nestle/NestleMilkHistory";
import ChillingCentersView from "./pages/nestle/ChillingCentersView";
import SupportManagement from "@/pages/nestle/SupportManagement";
import PerformanceDashboard from "./pages/nestle/PerformanceDashboard";
import SupplyPredictions from "./pages/nestle/SupplyPredictions";
import RecommendationManager from "./pages/nestle/RecommendationManager";
import NotFound from "./pages/NotFound";

import ErrorBoundary from "@/components/ErrorBoundary";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Navigate to="/login" replace />} />

              {/* Chilling Center */}
              <Route path="/chilling-center" element={<ProtectedRoute allowedRoles={['chilling_center']}><ChillingCenterLayout /></ProtectedRoute>}>
                <Route index element={<CCDashboard />} />
                <Route path="register-farmer" element={<RegisterFarmer />} />
                <Route path="collection" element={<MilkCollectionPage />} />
                <Route path="quality" element={<QualityTestingPage />} />
                <Route path="history" element={<CollectionHistory />} />
                <Route path="dispatch" element={<DispatchPage />} />
                <Route path="support" element={<CCSupport />} />
              </Route>

              {/* Nestlé */}
              <Route path="/nestle" element={<ProtectedRoute allowedRoles={['nestle_officer']}><NestleLayout /></ProtectedRoute>}>
                <Route index element={<NestleDashboard />} />
                <Route path="history" element={<NestleMilkHistory />} />
                <Route path="centers" element={<ChillingCentersView />} />
                <Route path="farmers" element={<FarmersView />} />
                <Route path="dispatches" element={<DispatchMonitoring />} />
                <Route path="pricing" element={<PricingRules />} />
                <Route path="payments" element={<PaymentsPage />} />

                <Route path="performance" element={<PerformanceDashboard />} />
                <Route path="predictions" element={<SupplyPredictions />} />
                <Route path="recommendations" element={<RecommendationManager />} />
                <Route path="support" element={<SupportManagement />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
