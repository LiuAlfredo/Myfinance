import { Navigate, Route, Routes } from "react-router-dom";
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

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/overview" element={<DashboardPage />} />
      <Route path="/accounts" element={<AccountsPage />} />
      <Route path="/transactions" element={<TransactionsPage />} />
      <Route path="/planning" element={<PlanningPage />} />
      <Route path="/installments" element={<InstallmentsPage />} />
      <Route path="/budgets" element={<BudgetsPage />} />
      <Route path="/statistics" element={<StatisticsPage />} />
      <Route path="/forecast" element={<ForecastPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/purchase-check" element={<PurchaseCheckPage />} />
      <Route path="*" element={<Navigate replace to="/overview" />} />
    </Routes>
  );
}
