import { beforeEach, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { getAccounts, getDashboard, localDateInput } from "./finance-service";

vi.mock("@tauri-apps/api/core",()=>({invoke:vi.fn()}));
beforeEach(()=>{
  vi.clearAllMocks();
  Object.defineProperty(window,"__TAURI_INTERNALS__",{configurable:true,value:{}});
});

it("converts account and dashboard money from minor units exactly once",async()=>{
  vi.mocked(invoke).mockImplementation(async(command)=>command==="get_accounts"?[{id:"a",name:"账户",institution:"",type:"银行卡",currency:"CNY",initialBalance:100000,balance:123456,isActive:true}]:{totalBalance:123456,monthlyIncome:10000,monthlyExpenses:2000,monthlySavings:8000,accountCount:1,accounts:[],transactions:[],balancesByCurrency:[{currency:"CNY",amount:123456}],balanceTrend:[{label:"今天",balance:123456}]});
  expect((await getAccounts())[0]).toMatchObject({initialBalance:1000,balance:1234.56});
  expect(await getDashboard()).toMatchObject({totalBalance:1234.56,monthlyIncome:100,balanceTrend:[{label:"今天",balance:1234.56}]});
});

it("formats date inputs in local time",()=>{
  expect(localDateInput(new Date(2026,8,29,0,30))).toBe("2026-09-29");
});
