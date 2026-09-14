# AGENTS.md

## 1. Project Overview

项目名称：MyFinance

MyFinance 是一个面向 Windows 桌面的现代化个人财务管理软件。

当前第一阶段重点是实现完整、可靠、易用的个人财务管理功能，包括：

* 账户管理
* 收入管理
* 支出管理
* 账户之间转账
* 余额调整
* 固定收入
* 固定支出
* 计划支出
* 分期付款
* 月度预算
* 财务统计
* 未来现金流预测
* 财务安全余额提醒
* 数据备份与恢复

未来项目可能继续扩展：

* 个人任务管理
* 项目管理
* 笔记 / Memo
* 日历
* 全局搜索
* AI 助手

因此当前代码和数据库设计必须保持模块化和可扩展性。

---

# 2. Development Philosophy

开发时遵循以下原则：

1. 正确性优先于开发速度。
2. 数据安全优先于视觉效果。
3. 架构清晰优先于快速堆积代码。
4. 优先实现稳定的核心功能，再增加高级功能。
5. 不为了一个小功能破坏已有架构。
6. 不随意修改数据库结构。
7. 不随意删除已有数据。
8. 不重复实现已经存在的功能。
9. 不使用无法解释的临时方案。
10. 不允许 TypeScript 中大量使用 `any`。
11. 不允许把所有逻辑堆积到单个组件或单个文件中。

---

# 3. Technology Stack

当前技术栈：

* Tauri 2
* React
* TypeScript
* Vite
* Tailwind CSS
* shadcn/ui
* Lucide Icons
* Motion
* Zustand
* SQLite
* Drizzle ORM
* ECharts 或 Recharts
* pnpm

Windows 为主要运行平台。

---

# 4. Frontend / Backend Responsibility

## 4.1 src/

`src/` 负责：

* React 页面
* UI 组件
* 用户交互
* 页面状态
* 前端 Store
* 前端表单验证
* 图表
* UI 动画
* 调用 Tauri Command
* 前端业务展示逻辑

禁止直接在 React
