import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { AppShell } from "@/layouts/app-shell";
import { AccountsPage } from "@/pages/accounts-page";
import { BudgetsPage } from "@/pages/budgets-page";
import { DashboardPage } from "@/pages/dashboard-page";
import { ForecastPage } from "@/pages/forecast-page";
import { InstallmentsPage } from "@/pages/installments-page";
import { PlanningPage } from "@/pages/planning-page";
import { SettingsPage } from "@/pages/settings-page";
import { StatisticsPage } from "@/pages/statistics-page";
import { TransactionsPage } from "@/pages/transactions-page";
import { PurchaseCheckPage } from "@/pages/purchase-check-page";
import { LoginPage } from "@/pages/login-page";
import { ModulesPage } from "@/pages/modules-page";
import { PersonalSettingsPage } from "@/pages/personal-settings-page";
import { PrivateCalendarPage } from "@/features/private-calendar/private-calendar-page";
import { JourneyPage } from "@/features/journey/journey-page";
import { TodayPage } from "@/features/life/today-page";
import { DailyPage } from "@/features/life/daily-page";
import { KnowledgePage } from "@/features/life/knowledge-page";
import { useAuthStore } from "@/stores/auth-store";

function ProtectedRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? children : <Navigate replace to="/login" />;
}

function FinanceRoutes() {
  return (
    <AppShell>
      <Routes>
        <Route path="overview" element={<DashboardPage />} />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="planning" element={<PlanningPage />} />
        <Route path="installments" element={<InstallmentsPage />} />
        <Route path="budgets" element={<BudgetsPage />} />
        <Route path="statistics" element={<StatisticsPage />} />
        <Route path="forecast" element={<ForecastPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="purchase-check" element={<PurchaseCheckPage />} />
        <Route path="*" element={<Navigate replace to="overview" />} />
      </Routes>
    </AppShell>
  );
}

export function AppRoutes() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/modules" element={<ProtectedRoute><ModulesPage /></ProtectedRoute>} />
      <Route path="/today" element={<ProtectedRoute><TodayPage /></ProtectedRoute>} />
      <Route path="/daily" element={<ProtectedRoute><DailyPage /></ProtectedRoute>} />
      <Route path="/knowledge" element={<ProtectedRoute><KnowledgePage /></ProtectedRoute>} />
      <Route path="/personal-settings" element={<ProtectedRoute><PersonalSettingsPage /></ProtectedRoute>} />
      <Route path="/private-calendar" element={<ProtectedRoute><PrivateCalendarPage /></ProtectedRoute>} />
      <Route path="/journey" element={<ProtectedRoute><JourneyPage /></ProtectedRoute>} />
      <Route path="/finance/*" element={<ProtectedRoute><FinanceRoutes /></ProtectedRoute>} />
      <Route path="*" element={<Navigate replace to={isAuthenticated ? "/today" : "/login"} />} />
    </Routes>
  );
}
