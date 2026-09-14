export type AppRoute =
  | "/overview"
  | "/accounts"
  | "/transactions"
  | "/planning"
  | "/installments"
  | "/budgets"
  | "/statistics"
  | "/forecast"
  | "/settings"
  | "/purchase-check";

export interface NavigationItem {
  label: string;
  to: AppRoute;
  icon: "overview" | "accounts" | "transactions" | "planning" | "installments" | "budgets" | "statistics" | "forecast" | "settings" | "purchase";
}
