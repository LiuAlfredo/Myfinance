# ARCHITECTURE.md

# MyFinance Architecture

## 1. Architecture Goal

MyFinance 使用模块化、分层和可扩展架构。

当前重点：

```text
Finance / Journey / Tasks / Notes / Calendar / Security
```

未来可以扩展：

```text
Finance
Tasks
Projects
Notes
Calendar
AI
```

当前实现不能阻碍未来模块扩展。

---

# 2. Overall Architecture

整体结构：

```text
┌──────────────────────────────────────┐
│              React UI                │
│              src/                   │
├──────────────────────────────────────┤
│       Frontend State / Services      │
│       Zustand / API Layer            │
├──────────────────────────────────────┤
│          Tauri Commands              │
├──────────────────────────────────────┤
│          Rust Backend                │
│          src-tauri/                  │
├──────────────────────────────────────┤
│          Database Layer              │
│       SQLite + Rust rusqlite         │
└──────────────────────────────────────┘
```

---

# 3. Frontend Architecture

实际持久化由 Rust `rusqlite` 管理，React 通过 Tauri 命令访问数据库。启动与恢复时按版本执行事务迁移。
任务、日程、笔记、首页、重复规则与订阅后端位于 `src-tauri/src/life/`。
普通笔记草稿与附件保存在同一数据库；附件使用 BLOB 与 SHA256，完整 SQLite 快照同时包含正文、草稿、历史和附件。
普通财务与资料未加密；私密日历和密码库保持各自的加密与解锁边界。全局搜索仅查询普通任务、项目和笔记。

推荐结构：

```text
src/
├── components/
├── pages/
├── layouts/
├── features/
├── stores/
├── services/
├── hooks/
├── types/
├── utils/
├── lib/
├── assets/
├── App.tsx
└── main.tsx
```

---

# 4. Pages

页面负责：

* 页面布局
* 页面级数据组织
* 页面级交互

例如：

```text
pages/
├── Dashboard/
├── Accounts/
├── Transactions/
├── Planning/
├── Installments/
├── Budgets/
├── Statistics/
├── Forecast/
└── Settings/
```

页面不要直接执行复杂数据库操作。

---

# 5. Components

组件负责可复用 UI。

例如：

```text
components/
├── Sidebar
├── Header
├── AccountCard
├── BalanceCard
├── TransactionItem
├── TransactionForm
├── DatePicker
├── AmountInput
├── EmptyState
├── LoadingState
└── ConfirmDialog
```

---

# 6. Features

复杂业务功能建议按照 Feature 进行组织。

例如：

```text
features/
├── finance/
│   ├── accounts/
│   ├── transactions/
│   ├── budgets/
│   ├── planning/
│   └── forecast/
│
├── tasks/
├── projects/
├── notes/
└── calendar/
```

当前只实现 Finance。

---

# 7. State Management

使用 Zustand 管理前端状态。

适合：

* 当前账户
* UI 状态
* 筛选条件
* Dashboard 状态
* 用户设置

不应该把所有数据库数据永久塞进 Zustand。

数据库才是持久化数据的最终来源。

---

# 8. Service Layer

前端 Service 负责调用 Tauri。

例如：

```text
src/services/
├── accountService.ts
├── transactionService.ts
├── budgetService.ts
├── forecastService.ts
└── settingsService.ts
```

React 页面不直接调用底层 Tauri command。

推荐：

```text
Page
 ↓
Service
 ↓
Tauri Command
 ↓
Rust
 ↓
Database
```

---

# 9. Tauri / Rust Architecture

推荐：

```text
src-tauri/src/
├── commands/
│   ├── account.rs
│   ├── transaction.rs
│   ├── budget.rs
│   └── forecast.rs
│
├── database/
│   ├── connection.rs
│   ├── schema.rs
│   └── repository/
│
├── services/
│   ├── account_service.rs
│   ├── transaction_service.rs
│   ├── forecast_service.rs
│   └── backup_service.rs
│
├── models/
├── utils/
└── lib.rs
```

---

# 10. Command Layer

Command 是 React 与 Rust 之间的接口。

例如：

```text
create_account
get_accounts
update_account
delete_account

create_transaction
get_transactions
update_transaction
delete_transaction

create_transfer
create_adjustment

get_forecast
get_statistics
```

Command 层不应该承载大量业务逻辑。

业务逻辑应该进入 Service。

---

# 11. Service Layer

Service 负责：

* 业务规则
* 数据验证
* 事务处理
* 财务计算

例如：

```text
TransactionService
        ↓
验证账户
        ↓
验证金额
        ↓
创建交易
        ↓
更新账户余额
        ↓
数据库事务
```

---

# 12. Database Layer

数据库使用：

```text
SQLite
```

数据库访问必须集中管理。

不要在多个地方直接执行 SQL。

推荐：

```text
Command
 ↓
Service
 ↓
Repository
 ↓
SQLite
```

---

# 13. Financial Calculation

核心计算必须统一。

例如：

```text
Current Balance
+
Future Income
-
Future Expense
-
Installments
-
Planned Expense
=
Forecast Balance
```

预测算法应该集中在：

```text
forecast service
```

而不是散落在 React 页面中。

---

# 14. Account Balance

账户余额是重要数据。

原则：

```text
初始余额
+
收入
-
支出
+
转入
-
转出
+
余额调整
=
当前余额
```

余额不能由多个前端页面分别计算。

应该由统一业务逻辑计算。

---

# 15. Transfer Architecture

转账必须保证原子性：

```text
BEGIN TRANSACTION

A account - amount
B account + amount
create transfer record

COMMIT
```

任何一步失败：

```text
ROLLBACK
```

---

# 16. Future Modules

未来可以扩展：

```text
features/
├── finance/
├── tasks/
├── projects/
├── notes/
├── calendar/
└── ai/
```

每个模块尽量保持：

```text
UI
Service
State
Types
```

相对独立。

---

# 17. Security

财务数据默认：

> Local First

第一阶段：

* 不要求账号登录
* 不要求云端服务器
* 不要求联网
* 数据保存在本地

未来如果加入云同步，必须重新设计：

* 加密
* 身份认证
* 冲突解决
* 数据同步

---

# 18. Architecture Principle

核心原则：

```text
UI ≠ Business Logic
Business Logic ≠ Database
Database ≠ UI
```

即：

```text
React
 ↓
Service
 ↓
Tauri Command
 ↓
Rust Service
 ↓
Repository
 ↓
SQLite
```

保持清晰的职责边界。
