export type AccountKind = "银行卡" | "电子钱包" | "现金" | "信用卡" | "投资" | "其他";
export type TransactionKind = "income" | "expense" | "adjustment";

export interface AccountPreview {
  id: string;
  name: string;
  institution: string;
  type: AccountKind;
  balance: number;
  color: string;
  symbol: string;
  currency?: string;
}

export interface TransactionPreview {
  id: string;
  title: string;
  account: string;
  category: string;
  amount: number;
  type: TransactionKind;
  timestamp: string;
  icon: string;
  currency?: string;
}

export interface AccountRecord extends AccountPreview { currency: string; initialBalance: number; isActive: boolean; }
export interface TransactionRecord extends TransactionPreview { accountId: string; categoryId?: string; currency: string; merchant: string; note: string; transactionDate: number; }
export interface CategoryRecord { id: string; name: string; type: "INCOME" | "EXPENSE"; icon: string; color: string; isActive?: boolean; }
export interface DashboardData { totalBalance: number; monthlyIncome: number; monthlyExpenses: number; monthlySavings: number; accountCount: number; accounts: AccountRecord[]; transactions: TransactionRecord[]; balancesByCurrency: Array<{currency: string; amount: number}>; balanceTrend: TrendPoint[]; }

export interface TrendPoint {
  label: string;
  balance: number;
}
