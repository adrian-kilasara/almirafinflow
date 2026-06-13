import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { SettingsProvider } from "@/hooks/useSettings";
import { useThemeEffect } from "@/hooks/useTheme";
import { useIdleLogout } from "@/hooks/useIdleLogout";
import { useAuth } from "@/hooks/useAuth";

// Eagerly load Dashboard (main landing page)
import Dashboard from "./pages/Dashboard";

// Lazy load secondary pages
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Settings = lazy(() => import("./pages/Settings"));
const Install = lazy(() => import("./pages/Install"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

function IdleGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  useIdleLogout(!!user);
  return <>{children}</>;
}

function ThemeApplicator({ children }: { children: React.ReactNode }) {
  useThemeEffect();
  return <>{children}</>;
}

const PageFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <SettingsProvider>
        <ThemeApplicator>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <IdleGuard>
                <Suspense fallback={<PageFallback />}>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/install" element={<Install />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </IdleGuard>
            </BrowserRouter>
          </TooltipProvider>
        </ThemeApplicator>
      </SettingsProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
