# ROADMAP.md

# MyFinance Development Roadmap

## Project Goal

打造一个现代化 Windows 个人财务管理软件。

第一阶段重点：

> 稳定、可靠、漂亮的个人财务管理。

未来逐步扩展成为：

> Personal Management Center

---

# Phase 0 — Project Foundation

状态：

```text
DONE
```

目标：

建立项目基础架构。

内容：

* Tauri 2
* React
* TypeScript
* Vite
* Tailwind CSS
* shadcn/ui
* Lucide
* Motion
* Zustand
* SQLite
* Drizzle

完成：

* 项目能够启动
* Windows 桌面窗口正常运行
* Light / Dark Mode
* Sidebar
* 基础 Layout
* Dashboard 骨架
* 基础页面路由

暂不实现真正财务数据。

---

# Phase 1 — Account Management

状态：

```text
DONE
```

目标：

实现账户管理。

功能：

* 新增账户
* 编辑账户
* 删除账户
* 启用 / 禁用账户
* 银行 / 平台
* 账户类型
* 货币
* 初始余额
* 当前余额

支持：

```text
招商银行
工商银行
支付宝
微信
现金
信用卡
```

完成标准：

* 数据保存到 SQLite
* 重启软件数据仍存在
* UI 现代化
* 账户余额正确

---

# Phase 2 — Transaction System

状态：

```text
IN PROGRESS
```

目标：

实现核心交易系统。

支持：

```text
收入
支出
转账
余额调整
```

功能：

* 新增
* 编辑
* 删除
* 查询
* 分类
* 日期
* 商户
* 账户
* 备注

要求：

每一笔支出必须明确：

```text
从哪个账户支付
```

---

# Phase 3 — Categories

状态：

```text
DONE
```

实现：

* 收入分类
* 支出分类
* 新增分类
* 编辑分类
* 删除分类
* 分类图标
* 分类排序

默认分类：

```text
餐饮
交通
购物
住房
娱乐
医疗
学习
通讯
旅行
生活
其他
```

---

# Phase 4 — Recurring Income / Expense

状态：

```text
DONE
```

实现固定收支。

例如：

```text
工资
每月25日
¥25,000
```

以及：

```text
房租
每月1日
¥5,000
```

支持：

```text
每日
每周
每月
每年
自定义
```

---

# Phase 5 — Planned Expenses

状态：

```text
DONE
```

例如：

```text
MacBook
¥12,000
2026-11-15
```

支持：

```text
PLANNED
COMPLETED
CANCELLED
```

计划支出必须进入未来现金流预测。

---

# Phase 6 — Installments

状态：

```text
DONE
```

支持：

```text
总金额
分期期数
每期金额
首期日期
支付账户
```

自动计算：

```text
已支付
剩余期数
剩余金额
下一期日期
```

---

# Phase 7 — Budget

状态：

```text
DONE
```

支持：

```text
月度预算
分类预算
预算使用率
超预算提醒
```

例如：

```text
餐饮
预算 ¥3000
已使用 ¥2150
剩余 ¥850
```

---

# Phase 8 — Dashboard

状态：

```text
DONE
```

Dashboard 显示：

```text
Total Balance

Monthly Income
Monthly Expense
Monthly Savings

Account Overview

Recent Transactions

Expense Categories

Balance Trend
```

---

# Phase 9 — Statistics

状态：

```text
DONE
```

实现：

* 月度收入
* 月度支出
* 月度结余
* 储蓄率
* 分类支出
* 账户余额变化
* 收入趋势
* 支出趋势

时间范围：

```text
本月
上月
最近3个月
最近6个月
最近12个月
自定义
```

---

# Phase 10 — Cash Flow Forecast

状态：

```text
DONE
```

这是 MyFinance 的核心特色功能之一。

根据：

```text
当前余额
+
固定收入
-
固定支出
-
计划支出
-
分期付款
```

预测未来余额。

支持：

```text
30天
3个月
6个月
12个月
自定义
```

---

# Phase 11 — Financial Safety Warning

状态：

```text
DONE
```

用户设置：

```text
最低安全余额
```

例如：

```text
¥10,000
```

如果未来预测：

```text
¥8,500
```

则提醒：

```text
预计余额将低于你的安全余额
```

---

# Phase 12 — Can I Buy This?

状态：

```text
DONE
```

用户输入：

```text
商品：MacBook
价格：¥12,000
```

系统模拟购买后的未来现金流。

输出：

```text
可以购买
```

或：

```text
暂不建议
```

并显示：

```text
购买前余额
购买后余额
未来最低余额
安全余额
```

---

# Phase 13 — Backup / Restore

状态：

```text
DONE
```

支持：

```text
SQLite Backup
SQLite Restore
JSON Export
CSV Export
```

要求：

* 防止误覆盖
* 导入前确认
* 数据校验
* 错误提示

---

# Phase 14 — Global Search

状态：

```text
DONE
```

未来支持：

```text
Ctrl + K
```

搜索：

```text
交易
账户
分类
计划
预算
分期
```

---

# Phase 15 — Personal Management Expansion

状态：

```text
FUTURE
```

未来增加：

```text
Tasks
Projects
Notes
Calendar
```

---

# Phase 16 — AI Assistant

状态：

```text
FUTURE
```

未来可能支持：

```text
分析消费
总结本月财务
发现异常支出
预测现金流
生成财务报告
自然语言查询
```

例如：

```text
“我这个月为什么花了这么多钱？”
```

或者：

```text
“按照现在的收入和支出，三个月后我有多少钱？”
```

---

# Development Rules

## 每次只完成一个 Phase

Codex 不允许自动连续完成多个 Phase。

完成一个 Phase 后：

1. 检查代码
2. TypeScript Check
3. Lint
4. Build
5. 测试
6. 修复错误
7. 总结
8. 等待下一阶段指令

---

# Phase Completion Criteria

一个 Phase 只有在以下条件满足后才能标记：

```text
DONE
```

必须：

* 功能实现
* 数据正确
* UI 完整
* 错误处理完成
* Loading 状态完成
* Empty 状态完成
* TypeScript 无明显错误
* Build 成功
* 不破坏已有功能

---

# Current Priority

当前开发顺序：

```text
Phase 0
 ↓
Phase 1
 ↓
Phase 2
 ↓
Phase 3
 ↓
Phase 4
 ↓
Phase 5
 ↓
Phase 6
 ↓
Phase 7
 ↓
Phase 8
 ↓
Phase 9
 ↓
Phase 10
 ↓
Phase 11
 ↓
Phase 12
 ↓
Phase 13
 ↓
Phase 14
```

暂时不要开发：

```text
Tasks
Projects
Notes
Calendar
AI
Cloud Sync
```

先把 Finance 做完整。
