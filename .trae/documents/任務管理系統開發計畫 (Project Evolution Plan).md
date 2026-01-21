# 任務管理系統開發計畫

根據您的需求，我們將基於現有的 `things4-clone` 專案進行重構與擴展。目前的專案是一個單體 React 元件，具備基礎的任務管理與 Supabase 同步功能。我們將分階段將其升級為符合您要求的企業級系統。

## 階段一：架構重構與基礎建設 (Architecture & Infrastructure)
目前的 `App.tsx` 過於龐大（>1600行），需先進行模組化以利後續擴充。
1.  **代碼拆分**：
    *   將 `App.tsx` 拆分為 `components/` (TaskItem, Sidebar, TaskInput), `contexts/` (AppProvider), `hooks/` (useTaskOperations).
    *   建立標準的路由結構 (React Router)，支援 `/tasks`, `/calendar`, `/journal`, `/login` 等路徑。
2.  **DevOps 設置**：
    *   建立 `Dockerfile` 與 `docker-compose.yml` 支援容器化部署。
    *   建立 GitHub Actions 流程 (`.github/workflows/ci.yml`) 實現自動化測試與構建。

## 階段二：核心功能擴充 (Core Features)
1.  **使用者認證系統 (Authentication)**：
    *   實作 `Login` 頁面。
    *   整合 Supabase Auth，支援 Email/Password 登入。
    *   配置 OAuth Provider (Google)。(WeChat 需額外申請 API Key，將預留接口)。
    *   實作 `Profile` 頁面，管理個人資料與偏好。
2.  **任務管理增強 (Task Management)**：
    *   確認並優化「大項目 (Area) → 專案 (Project) → 任務 (Task)」的三層結構邏輯。
    *   優化拖曳排序體驗，確保多層級移動的穩定性。
3.  **行事曆整合 (Calendar)**：
    *   新增 `CalendarView` 元件。
    *   實作 月/週 視圖，支援將任務拖入特定日期。
4.  **日記功能 (Journal)**：
    *   新增 `Journal` 模組。
    *   整合 Markdown 編輯器 (如 `react-markdown` 或輕量化編輯器)，支援純文本寫作與預覽。
    *   新增 `journals` 資料表至 Supabase Schema。

## 階段三：品質保證與優化 (QA & Optimization)
1.  **測試覆蓋**：
    *   引入 `Vitest` 與 `React Testing Library` 進行單元測試。
    *   引入 `Playwright` 進行端對端 (E2E) 測試，確保核心流程（登入、新增任務、同步）正常。
2.  **無障礙與性能**：
    *   審查並修正 ARIA 標籤，確保符合 WCAG 2.1。
    *   使用 Lighthouse 進行效能檢測與優化。

## 技術堆疊確認
*   **前端**: React, TypeScript, Tailwind CSS, Framer Motion (維持現狀)
*   **後端/數據庫**: Supabase (PostgreSQL + Realtime + Auth) (維持現狀，符合即時同步與數據庫要求)
*   **測試**: Vitest, Playwright

請問您是否同意此執行計畫？如果確認，我將從「架構重構」開始執行。