# UI_DESIGN.md

# MyFinance UI Design System

## 1. Design Goal

MyFinance 的 UI 目标：

> Modern Windows Personal Productivity Application

整体感觉应该：

* 简洁
* 高级
* 舒适
* 现代
* 轻量
* 有层次
* 易于长期使用

不是传统财务软件。

也不是传统企业后台管理系统。

---

# 2. Design Inspiration

设计方向参考：

* Windows 11 Fluent Design
* Linear
* Notion
* Raycast
* Apple 风格的信息层级

仅作为设计方向参考。

禁止直接复制其他软件界面。

---

# 3. Layout

整体：

```text
┌─────────────────────────────────────────────┐
│ Sidebar │ Header                            │
│         ├───────────────────────────────────┤
│         │                                   │
│         │        Main Content               │
│         │                                   │
│         │                                   │
│         │                                   │
└─────────────────────────────────────────────┘
```

推荐：

```text
Sidebar: 240px
Main Content: flexible
```

---

# 4. Sidebar

菜单：

```text
Overview

Finance
  Accounts
  Transactions
  Planning
  Installments
  Budgets
  Statistics
  Forecast

Settings
```

未来：

```text
Tasks
Projects
Notes
Calendar
```

---

# 5. Dashboard

首页应该突出：

```text
Total Balance
Monthly Income
Monthly Expenses
Monthly Savings
```

例如：

```text
¥128,520
```

作为视觉重点。

其次：

```text
收入
支出
储蓄率
账户数量
```

---

# 6. Account Cards

账户使用卡片设计。

例如：

```text
┌─────────────────────────┐
│ 🏦 招商银行              │
│                         │
│ ¥32,680.00              │
│                         │
│ 储蓄卡                   │
└─────────────────────────┘
```

卡片应：

* 圆角
* 留白
* 清晰层级
* Hover feedback

---

# 7. Transaction UI

交易列表避免传统 Excel 风格。

推荐：

```text
今天

🍜 午餐
招商银行
今天 12:30

-¥35.00
```

不同信息具有不同视觉层级。

---

# 8. New Transaction

新增交易应该使用现代 Modal / Sheet。

字段：

```text
金额
交易类型
分类
账户
商户
日期
备注
```

金额输入应该是最明显的输入项。

---

# 9. Colors

不要大量使用高饱和颜色。

主要使用：

```text
Neutral
Primary
Success
Warning
Danger
```

财务场景：

```text
收入 → Success
支出 → Danger / Neutral
余额 → Primary
警告 → Warning
```

颜色只用于表达信息，不应该到处使用。

---

# 10. Border Radius

推荐：

```text
Small: 8px
Medium: 12px
Large: 16px
XL: 20px
```

核心卡片：

```text
16px - 20px
```

---

# 11. Shadows

使用非常轻微的阴影。

避免：

```text
厚重阴影
```

推荐：

```text
soft shadow
```

界面应该看起来轻盈。

---

# 12. Typography

Windows 优先使用：

```text
Segoe UI
```

中文使用系统中文字体作为 fallback。

重要金额：

```text
32px
40px
48px
```

普通正文：

```text
14px
16px
```

页面标题：

```text
24px
28px
32px
```

---

# 13. Spacing

推荐使用统一 spacing system：

```text
4
8
12
16
20
24
32
40
48
```

避免随机使用大量不同间距。

---

# 14. Animation

使用 Motion 实现轻量动画。

可以使用：

* Fade
* Slide
* Scale
* Hover
* Layout animation

动画应该：

```text
快速
自然
克制
```

禁止：

* 大幅旋转
* 复杂弹跳
* 过长动画
* 为了动画而动画

---

# 15. Theme

支持：

```text
Light
Dark
System
```

默认：

```text
System
```

---

# 16. Empty State

没有数据时不能显示空白页面。

例如：

```text
还没有账户

添加你的第一个账户
开始管理你的财务
```

提供明确操作按钮。

---

# 17. Loading State

数据加载时使用：

```text
Skeleton
```

而不是整个页面出现：

```text
Loading...
```

---

# 18. Error State

错误页面应该：

```text
发生了一点问题

请稍后重试
```

提供：

```text
Retry
```

按钮。

不要直接显示技术错误。

---

# 19. Responsive

必须测试：

```text
1280 × 720
1440 × 900
1920 × 1080
```

窗口缩小时：

* Sidebar 可以折叠
* Card 自动调整
* 内容不能溢出
* 按钮不能被截断

---

# 20. Interaction

推荐快捷键：

```text
Ctrl + N
```

新建交易。

```text
Ctrl + K
```

全局搜索。

```text
Esc
```

关闭 Modal / Sheet。

---

# 21. Forms

表单应该：

* 清晰
* 简洁
* 少字段优先
* 自动校验
* 错误信息靠近字段

金额输入必须支持：

```text
¥
,
.
```

并正确转换为最小货币单位。

---

# 22. Charts

统计图表：

* 简洁
* 信息优先
* 不使用过多颜色
* Tooltip 清晰
* 支持时间范围切换

主要图表：

```text
余额趋势
收入 / 支出
分类支出
未来现金流
预算使用率
```

---

# 23. Accessibility

需要考虑：

* 键盘操作
* Focus 状态
* 合理对比度
* Tooltip
* aria-label
* 可读文字

---

# 24. UI Principle

核心原则：

> Less UI, More Information.

不要为了看起来复杂而增加大量组件。

用户应该能够快速回答：

```text
我现在有多少钱？

这个月花了多少钱？

钱花在哪里？

下个月会不会缺钱？

这个账户还有多少钱？

这笔钱从哪个账户扣的？
```

---

# 25. Visual Quality Standard

每一个页面完成后，都应该检查：

* 是否有足够留白？
* 信息层级是否明显？
* 是否存在多余边框？
* 圆角是否统一？
* 字体大小是否合理？
* 颜色是否克制？
* Hover 是否自然？
* Dark Mode 是否正常？
* 空数据是否美观？
* Loading 是否自然？
* 错误状态是否友好？

目标：

> 看起来像一个成熟的商业桌面应用，而不是一个课程作业或后台管理系统。
