import { useEffect, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHero } from "@/components/page-hero";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { getTransactions } from "@/services/finance-service";
import type { TransactionRecord } from "@/types/finance";

export function StatisticsPage(){
  const [transactions,setTransactions]=useState<TransactionRecord[]>([]),[currency,setCurrency]=useState("CNY"),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const load=()=>{setLoading(true);void getTransactions().then((rows)=>{setTransactions(rows);setError("");}).catch((reason:unknown)=>setError(reason instanceof Error?reason.message:"加载统计失败")).finally(()=>setLoading(false));};
  useEffect(()=>{load();window.addEventListener("finance-data-changed",load);return()=>window.removeEventListener("finance-data-changed",load);},[]);
  const currencies=[...new Set(transactions.map((row)=>row.currency))],rows=transactions.filter((row)=>row.currency===currency),income=rows.filter((row)=>row.type==="income").reduce((sum,row)=>sum+row.amount,0),expense=rows.filter((row)=>row.type==="expense").reduce((sum,row)=>sum+row.amount,0);
  const grouped=useMemo(()=>{const values=new Map<string,number>();rows.filter((row)=>row.type==="expense").forEach((row)=>values.set(row.category,(values.get(row.category)??0)+row.amount));return [...values.entries()].sort((left,right)=>right[1]-left[1]);},[rows]);
  return <div className="page-container"><PageHero title="统计" description="每个币种独立统计，避免无汇率相加造成误导。" action={currencies.length?<select className="form-control w-auto" value={currency} onChange={(event)=>setCurrency(event.target.value)}>{currencies.map((value)=><option key={value}>{value}</option>)}</select>:undefined}/>{loading?<div className="content-card p-8">正在加载统计…</div>:error?<div className="content-card p-8 text-[var(--danger)]">{error}<Button variant="secondary" onClick={load}>重试</Button></div>:!rows.length?<EmptyState icon={BarChart3} title="还没有可分析的交易" description="记录几笔收入或支出后，这里会自动生成统计。"/>:<div className="grid gap-4 md:grid-cols-3"><section className="content-card"><p className="text-sm text-[var(--text-secondary)]">累计收入</p><p className="mt-3 text-3xl font-semibold text-[var(--success)]">{formatCurrency(income,currency)}</p></section><section className="content-card"><p className="text-sm text-[var(--text-secondary)]">累计支出</p><p className="mt-3 text-3xl font-semibold text-[var(--danger)]">{formatCurrency(expense,currency)}</p></section><section className="content-card"><p className="text-sm text-[var(--text-secondary)]">结余</p><p className="mt-3 text-3xl font-semibold">{formatCurrency(income-expense,currency)}</p></section><section className="content-card md:col-span-3"><h3 className="font-semibold">分类支出</h3><div className="mt-4 space-y-3">{grouped.map(([name,amount])=><div key={name}><div className="flex justify-between text-sm"><span>{name}</span><span>{formatCurrency(amount,currency)}</span></div><div className="mt-1 h-2 rounded-full bg-[var(--surface-muted)]"><div className="h-2 rounded-full bg-[var(--accent)]" style={{width:`${expense?Math.min(100,amount/expense*100):0}%`}}/></div></div>)}</div></section></div>}</div>;
}
