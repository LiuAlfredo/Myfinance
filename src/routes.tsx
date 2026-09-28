import { Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense, type ReactNode } from "react";
import { AppShell } from "@/layouts/app-shell";
import { AccountsPage } from "@/pages/accounts-page";
import { BudgetsPage } from "@/pages/budgets-page";
const DashboardPage = lazy(() =>
  import("@/pages/dashboard-page").then((m) => ({ default: m.DashboardPage })),
);
import { ForecastPage } from "@/pages/forecast-page";
import { InstallmentsPage } from "@/pages/installments-page";
const PlanningPage = lazy(() =>
  import("@/pages/planning-page").then((m) => ({ default: m.PlanningPage })),
);
const SettingsPage = lazy(() =>
  import("@/pages/settings-page").then((m) => ({ default: m.SettingsPage })),
);
const StatisticsPage = lazy(() =>
  import("@/pages/statistics-page").then((m) => ({
    default: m.StatisticsPage,
  })),
);
import { TransactionsPage } from "@/pages/transactions-page";
import { PurchaseCheckPage } from "@/pages/purchase-check-page";
import { LoginPage } from "@/pages/login-page";
import { ModulesPage } from "@/pages/modules-page";
import { PersonalSettingsPage } from "@/pages/personal-settings-page";
const PrivateCalendarPage = lazy(() =>
  import("@/features/private-calendar/private-calendar-page").then((m) => ({
    default: m.PrivateCalendarPage,
  })),
);
const JourneyPage = lazy(() =>
  import("@/features/journey/journey-page").then((m) => ({
    default: m.JourneyPage,
  })),
);
import { TodayPage } from "@/features/life/today-page";
const DailyPage = lazy(() =>
  import("@/features/life/daily-page").then((m) => ({ default: m.DailyPage })),
);
const KnowledgePage = lazy(() =>
  import("@/features/life/knowledge-page").then((m) => ({
    default: m.KnowledgePage,
  })),
);
import { WorkspaceSearch } from "@/features/life/workspace-search";
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
    <Suspense fallback={<p className="p-8 text-center">正在加载页面…</p>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/modules"
          element={
            <ProtectedRoute>
              <ModulesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/today"
          element={
            <ProtectedRoute>
              <TodayPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/search"
          element={
            <ProtectedRoute>
              <WorkspaceSearch />
            </ProtectedRoute>
          }
        />
        <Route
          path="/daily"
          element={
            <ProtectedRoute>
              <DailyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/knowledge"
          element={
            <ProtectedRoute>
              <KnowledgePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/personal-settings"
          element={
            <ProtectedRoute>
              <PersonalSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/private-calendar"
          element={
            <ProtectedRoute>
              <PrivateCalendarPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/journey"
          element={
            <ProtectedRoute>
              <JourneyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/finance/*"
          element={
            <ProtectedRoute>
              <FinanceRoutes />
            </ProtectedRoute>
          }
        />
        <Route
          path="*"
          element={
            <Navigate replace to={isAuthenticated ? "/today" : "/login"} />
          }
        />
      </Routes>
    </Suspense>
  );
}
