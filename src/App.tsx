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
import NestleLayout from "./layouts/NestleLayout";
import NestleDashboard from "./pages/nestle/NestleDashboard";
import FarmersView from "./pages/nestle/FarmersView";
import DispatchMonitoring from "./pages/nestle/DispatchMonitoring";
import PricingRules from "./pages/nestle/PricingRules";
import PaymentsPage from "./pages/nestle/PaymentsPage";
import AnalyticsPage from "./pages/nestle/AnalyticsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
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
            </Route>

            {/* Nestlé */}
            <Route path="/nestle" element={<ProtectedRoute allowedRoles={['nestle_officer']}><NestleLayout /></ProtectedRoute>}>
              <Route index element={<NestleDashboard />} />
              <Route path="farmers" element={<FarmersView />} />
              <Route path="dispatches" element={<DispatchMonitoring />} />
              <Route path="pricing" element={<PricingRules />} />
              <Route path="payments" element={<PaymentsPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
