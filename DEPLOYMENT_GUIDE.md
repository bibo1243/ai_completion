# AI Completion 專案部署指南

本指南將協助您在本地（localhost）和線上平台部署此專案。

## 📋 目錄
1. [本地部署 (Localhost)](#本地部署-localhost)
2. [線上部署選項](#線上部署選項)
   - [Vercel 部署](#vercel-部署-推薦)
   - [Netlify 部署](#netlify-部署)
   - [Docker 部署](#docker-部署)
   - [Cloudflare Pages 部署](#cloudflare-pages-部署)

---

## 🏠 本地部署 (Localhost)

### 前置需求
- Node.js (v16 或更高版本)
- npm 或 yarn
- Supabase 帳號（用於資料庫）

### 步驟 1: 環境變數設定

1. 複製環境變數範例檔案：
```bash
cp .env.example .env
```

2. 編輯 `.env` 檔案，填入您的 Supabase 資訊：
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> **如何取得 Supabase 資訊：**
> 1. 前往 [Supabase Dashboard](https://app.supabase.com)
> 2. 選擇您的專案
> 3. 點擊左側選單的 "Settings" > "API"
> 4. 複製 "Project URL" 和 "anon public" key

### 步驟 2: 安裝依賴（如果尚未安裝）

```bash
npm install
```

### 步驟 3: 啟動開發伺服器

```bash
npm run dev
```

專案將在 `http://localhost:5173` 啟動（Vite 預設端口）

### 步驟 4: 建置生產版本（可選）

```bash
npm run build
```

建置完成後，可以預覽生產版本：

```bash
npm run preview
```

---

## 🌐 線上部署選項

### Vercel 部署 (推薦)

Vercel 是最簡單的部署方式，專為 React/Vite 專案優化。

#### 方法 1: 使用 Vercel CLI

1. 安裝 Vercel CLI：
```bash
npm install -g vercel
```

2. 登入 Vercel：
```bash
vercel login
```

3. 部署專案：
```bash
cd /Users/leegary/ai_completion
vercel
```

4. 設定環境變數：
```bash
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
```

5. 重新部署以套用環境變數：
```bash
vercel --prod
```

#### 方法 2: 使用 Vercel Dashboard

1. 前往 [Vercel Dashboard](https://vercel.com/dashboard)
2. 點擊 "Add New Project"
3. 連接您的 Git 儲存庫（需先將專案推送到 GitHub/GitLab/Bitbucket）
4. 在 "Environment Variables" 區域添加：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. 點擊 "Deploy"

**優點：**
- ✅ 自動 HTTPS
- ✅ 全球 CDN
- ✅ 自動部署（Git push 後）
- ✅ 免費方案充足

---

### Netlify 部署

#### 使用 Netlify CLI

1. 安裝 Netlify CLI：
```bash
npm install -g netlify-cli
```

2. 登入 Netlify：
```bash
netlify login
```

3. 初始化並部署：
```bash
cd /Users/leegary/ai_completion
netlify init
```

4. 建置並部署：
```bash
npm run build
netlify deploy --prod --dir=dist
```

5. 在 Netlify Dashboard 設定環境變數：
   - 前往 Site settings > Environment variables
   - 添加 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`

#### 使用 Netlify Dashboard

1. 前往 [Netlify Dashboard](https://app.netlify.com)
2. 拖放 `dist` 資料夾（需先執行 `npm run build`）
3. 或連接 Git 儲存庫進行自動部署

**建置設定：**
- Build command: `npm run build`
- Publish directory: `dist`

---

### Docker 部署

專案已包含 `Dockerfile` 和 `docker-compose.yml`。

#### 使用 Docker Compose

1. 確保已安裝 Docker 和 Docker Compose

2. 建立 `.env` 檔案（參考上方本地部署步驟）

3. 啟動容器：
```bash
cd /Users/leegary/ai_completion
docker-compose up -d
```

4. 訪問應用程式：
```
http://localhost:80
```

5. 停止容器：
```bash
docker-compose down
```

#### 使用 Docker 單獨部署

1. 建置映像：
```bash
docker build -t ai-completion .
```

2. 執行容器：
```bash
docker run -p 80:80 \
  -e VITE_SUPABASE_URL=your_url \
  -e VITE_SUPABASE_ANON_KEY=your_key \
  ai-completion
```

**適用場景：**
- 自有伺服器部署
- AWS EC2, Google Cloud, Azure VM
- 任何支援 Docker 的平台

---

### Cloudflare Pages 部署

#### 使用 Wrangler CLI

1. 安裝 Wrangler：
```bash
npm install -g wrangler
```

2. 登入 Cloudflare：
```bash
wrangler login
```

3. 建置專案：
```bash
npm run build
```

4. 部署到 Cloudflare Pages：
```bash
wrangler pages deploy dist --project-name=ai-completion
```

5. 設定環境變數：
   - 前往 Cloudflare Dashboard
   - 選擇您的 Pages 專案
   - Settings > Environment variables
   - 添加 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`

#### 使用 Cloudflare Dashboard

1. 前往 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 選擇 "Pages" > "Create a project"
3. 連接 Git 儲存庫
4. 設定建置：
   - Build command: `npm run build`
   - Build output directory: `dist`
5. 添加環境變數

**優點：**
- ✅ 全球 CDN
- ✅ 無限頻寬
- ✅ 免費 SSL

---

## 🔧 部署後檢查清單

無論使用哪種部署方式，請確認：

- [ ] 環境變數已正確設定
- [ ] Supabase 資料庫已設定並可連接
- [ ] 應用程式可以正常載入
- [ ] 登入功能正常運作
- [ ] 資料可以正確儲存和讀取
- [ ] 所有功能（任務管理、日誌等）正常運作

---

## 🐛 常見問題排解

### 問題 1: 環境變數未生效
**解決方案：** 確保環境變數名稱以 `VITE_` 開頭（Vite 要求）

### 問題 2: Supabase 連接失敗
**解決方案：** 
- 檢查 Supabase URL 和 Key 是否正確
- 確認 Supabase 專案狀態正常
- 檢查 RLS (Row Level Security) 政策設定

### 問題 3: 建置失敗
**解決方案：**
```bash
# 清除快取並重新安裝
rm -rf node_modules package-lock.json
npm install
npm run build
```

### 問題 4: 部署後頁面空白
**解決方案：** 檢查瀏覽器控制台的錯誤訊息，通常是環境變數或 API 連接問題

---

## 📚 相關資源

- [Vite 文檔](https://vitejs.dev/)
- [Vercel 文檔](https://vercel.com/docs)
- [Netlify 文檔](https://docs.netlify.com/)
- [Supabase 文檔](https://supabase.com/docs)
- [Docker 文檔](https://docs.docker.com/)
- [Cloudflare Pages 文檔](https://developers.cloudflare.com/pages/)

---

## 💡 建議的部署流程

1. **開發階段：** 使用本地開發伺服器 (`npm run dev`)
2. **測試階段：** 建置並預覽 (`npm run build && npm run preview`)
3. **生產部署：** 使用 Vercel 或 Netlify（最簡單）
4. **企業部署：** 使用 Docker + 自有伺服器

---

## 🎉 完成！

選擇最適合您的部署方式，按照步驟操作即可。如有問題，請參考常見問題排解或相關資源文檔。
