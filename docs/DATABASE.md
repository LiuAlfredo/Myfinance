# DATABASE.md

# MyFinance Database Design

## 1. Database

数据库：

```text
SQLite
```

ORM：

```text
Drizzle ORM
```

设计原则：

* Local First
* 数据安全
* 可迁移
* 可扩展
* 财务金额使用整数
* 所有重要操作保证事务一致性

---

# 2. Currency

金额使用最小货币单位保存。

例如：

```text
CNY ¥68.50
→ 6850

CNY ¥100
→ 10000

JPY ¥1000
→ 1000

USD $12.50
→ 1250
```

数据库字段：

```text
amount INTEGER
```

不要使用：

```text
FLOAT
DOUBLE
REAL
```

保存核心财务金额。

---

# 3. accounts

账户表。

```text
accounts
```

字段：

| 字段              | 类型      | 说明    |
| --------------- | ------- | ----- |
| id              | TEXT    | 主键    |
| name            | TEXT    | 账户名称  |
| institution     | TEXT    | 银行/平台 |
| type            | TEXT    | 账户类型  |
| currency        | TEXT    | 货币    |
| initial_balance | INTEGER | 初始余额  |
| is_active       | INTEGER | 是否启用  |
| created_at      | INTEGER | 创建时间  |
| updated_at      | INTEGER | 更新时间  |

账户类型：

```text
BANK
CASH
CREDIT_CARD
E_WALLET
INVESTMENT
OTHER
```

---

# 4. categories

交易分类。

```text
categories
```

字段：

| 字段         | 类型      |
| ---------- | ------- |
| id         | TEXT    |
| name       | TEXT    |
| type       | TEXT    |
| icon       | TEXT    |
| color      | TEXT    |
| sort_order | INTEGER |
| is_system  | INTEGER |
| created_at | INTEGER |
| updated_at | INTEGER |

类型：

```text
INCOME
EXPENSE
```

初始支出分类可以包括：

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

# 5. transactions

核心交易表。

```text
transactions
```

字段：

| 字段               | 类型      | 说明   |
| ---------------- | ------- | ---- |
| id               | TEXT    | 主键   |
| type             | TEXT    | 交易类型 |
| account_id       | TEXT    | 账户   |
| category_id      | TEXT    | 分类   |
| amount           | INTEGER | 金额   |
| currency         | TEXT    | 货币   |
| merchant         | TEXT    | 商户   |
| transaction_date | INTEGER | 交易时间 |
| note             | TEXT    | 备注   |
| created_at       | INTEGER | 创建时间 |
| updated_at       | INTEGER | 更新时间 |

交易类型：

```text
INCOME
EXPENSE
ADJUSTMENT
```

---

# 6. transfers

转账表。

```text
transfers
```

字段：

| 字段              | 类型      |
| --------------- | ------- |
| id              | TEXT    |
| from_account_id | TEXT    |
| to_account_id   | TEXT    |
| amount          | INTEGER |
| currency        | TEXT    |
| transfer_date   | INTEGER |
| note            | TEXT    |
| created_at      | INTEGER |
| updated_at      | INTEGER |

转账不属于收入或支出。

---

# 7. recurring_transactions

固定收支。

```text
recurring_transactions
```

字段：

| 字段            | 类型      |
| ------------- | ------- |
| id            | TEXT    |
| type          | TEXT    |
| account_id    | TEXT    |
| category_id   | TEXT    |
| amount        | INTEGER |
| currency      | TEXT    |
| title         | TEXT    |
| frequency     | TEXT    |
| start_date    | INTEGER |
| end_date      | INTEGER |
| next_run_date | INTEGER |
| is_active     | INTEGER |
| created_at    | INTEGER |
| updated_at    | INTEGER |

frequency：

```text
DAILY
WEEKLY
MONTHLY
YEARLY
CUSTOM
```

例如：

```text
工资
每月25日
¥25,000
```

---

# 8. planned_expenses

计划支出。

例如：

```text
MacBook
¥12,000
2026-11-15
```

字段：

| 字段           | 类型      |
| ------------ | ------- |
| id           | TEXT    |
| title        | TEXT    |
| amount       | INTEGER |
| currency     | TEXT    |
| planned_date | INTEGER |
| category_id  | TEXT    |
| account_id   | TEXT    |
| status       | TEXT    |
| note         | TEXT    |
| created_at   | INTEGER |
| updated_at   | INTEGER |

status：

```text
PLANNED
COMPLETED
CANCELLED
```

---

# 9. installments

分期计划。

字段：

| 字段                 | 类型      |
| ------------------ | ------- |
| id                 | TEXT    |
| title              | TEXT    |
| total_amount       | INTEGER |
| installment_count  | INTEGER |
| installment_amount | INTEGER |
| first_payment_date | INTEGER |
| paid_count         | INTEGER |
| remaining_count    | INTEGER |
| remaining_amount   | INTEGER |
| account_id         | TEXT    |
| status             | TEXT    |
| created_at         | INTEGER |
| updated_at         | INTEGER |

status：

```text
ACTIVE
COMPLETED
CANCELLED
```

---

# 10. budgets

预算表。

字段：

| 字段          | 类型      |
| ----------- | ------- |
| id          | TEXT    |
| category_id | TEXT    |
| amount      | INTEGER |
| currency    | TEXT    |
| year        | INTEGER |
| month       | INTEGER |
| created_at  | INTEGER |
| updated_at  | INTEGER |

例如：

```text
2026年9月
餐饮预算
¥3000
```

---

# 11. settings

用户设置。

字段：

| 字段         | 类型      |
| ---------- | ------- |
| key        | TEXT    |
| value      | TEXT    |
| updated_at | INTEGER |

例如：

```text
default_currency = CNY
theme = system
safety_balance = 10000
```

---

# 12. Relationships

核心关系：

```text
accounts
   │
   ├──────── transactions
   │
   ├──────── transfers
   │
   ├──────── recurring_transactions
   │
   ├──────── planned_expenses
   │
   └──────── installments

categories
   │
   ├──────── transactions
   ├──────── recurring_transactions
   ├──────── planned_expenses
   └──────── budgets
```

---

# 13. Balance Calculation

账户理论余额：

```text
initial_balance
+ income
- expense
+ transfer_in
- transfer_out
+ adjustment
```

最终得到：

```text
current_balance
```

系统不能因为 UI 页面不同而产生不同的余额结果。

---

# 14. Transfer Rules

转账：

```text
A - amount
B + amount
```

必须使用数据库事务。

转账不能增加：

```text
income
```

也不能增加：

```text
expense
```

---

# 15. Forecast Data

未来现金流预测不需要完全复制成大量交易数据。

可以根据：

```text
Current Balance
+
Recurring Income
-
Recurring Expense
-
Planned Expense
-
Installment
```

计算未来余额。

---

# 16. Database Migration

所有数据库结构变化必须使用 migration。

禁止：

```text
直接删除数据库
```

禁止为了开发方便：

```text
DROP TABLE
```

除非明确处于全新开发数据库初始化阶段。

生产数据必须受到保护。

---

# 17. Backup

未来支持：

```text
Export Database
Import Database
Backup
Restore
```

建议支持：

```text
SQLite database backup
JSON export
CSV export
```

---

# 18. Future Extension

未来可以增加：

```text
tasks
projects
notes
calendar_events
attachments
```

这些表不应该与 Finance 表强耦合。

Finance 是当前核心模块，但不是整个系统唯一模块。
