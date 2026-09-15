export type AppRoute =
  | "/finance/overview"
  | "/finance/accounts"
  | "/finance/transactions"
  | "/finance/planning"
  | "/finance/installments"
  | "/finance/budgets"
  | "/finance/statistics"
  | "/finance/forecast"
  | "/finance/settings"
  | "/finance/purchase-check";

export interface NavigationItem {
  label: string;
  to: AppRoute;
  icon: "overview" | "accounts" | "transactions" | "planning" | "installments" | "budgets" | "statistics" | "forecast" | "settings" | "purchase";
}
