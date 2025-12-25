# 🚀 快速部署指南

這是一個 Things4 克隆專案，使用 React + Vite + TypeScript + Supabase 構建。

## ⚡ 快速開始

### 方法 1: 使用快速啟動腳本（推薦）

```bash
cd /Users/leegary/ai_completion
./quick-start.sh
```

腳本會引導您完成所有設置步驟。

### 方法 2: 手動啟動

1. **設定環境變數**
```bash
cp .env.example .env
# 編輯 .env 並填入您的 Supabase 資訊
```

2. **安裝依賴**（如果尚未安裝）
```bash
npm install
```

3. **啟動開發伺服器**
```bash
npm run dev
```

專案將在 `http://localhost:5173` 啟動

## 📦 可用命令

| 命令 | 說明 |
|------|------|
| `npm run dev` | 啟動開發伺服器 (localhost:5173) |
| `npm run build` | 建置生產版本到 dist/ |
| `npm run preview` | 預覽生產版本 (localhost:4173) |
| `npm run test` | 執行單元測試 |
| `npm run test:e2e` | 執行端對端測試 |

## 🌐 線上部署

### 最簡單的方式：Vercel

```bash
# 安裝 Vercel CLI
npm install -g vercel

# 登入並部署
vercel login
vercel
```

### 其他部署選項

- **Netlify**: `netlify deploy --prod --dir=dist`
- **Docker**: `docker-compose up -d`
- **Cloudflare Pages**: `wrangler pages deploy dist`

詳細部署說明請參考 [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

## 🔧 環境變數設定

在 `.env` 檔案中設定以下變數：

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 如何取得 Supabase 資訊

1. 前往 [Supabase Dashboard](https://app.supabase.com)
2. 選擇您的專案
3. 點擊 Settings > API
4. 複製 "Project URL" 和 "anon public" key

## 📁 專案結構

```
ai_completion/
├── src/                    # 源代碼
│   ├── components/        # React 組件
│   ├── hooks/            # 自定義 Hooks
│   ├── services/         # API 服務
│   ├── types/            # TypeScript 類型
│   └── utils/            # 工具函數
├── public/               # 靜態資源
├── supabase/            # Supabase 遷移腳本
├── e2e/                 # 端對端測試
├── DEPLOYMENT_GUIDE.md  # 完整部署指南
└── quick-start.sh       # 快速啟動腳本
```

## 🐛 常見問題

### 問題：環境變數未生效
**解決：** 確保變數名稱以 `VITE_` 開頭

### 問題：無法連接 Supabase
**解決：** 檢查 URL 和 Key 是否正確，確認專案狀態正常

### 問題：端口被佔用
**解決：** 
```bash
# 修改 vite.config.ts 中的端口
# 或關閉佔用端口的程序
lsof -ti:5173 | xargs kill -9
```

## 📚 更多資源

- [完整部署指南](./DEPLOYMENT_GUIDE.md) - 詳細的部署步驟和選項
- [Vite 文檔](https://vitejs.dev/)
- [React 文檔](https://react.dev/)
- [Supabase 文檔](https://supabase.com/docs)

## 💡 提示

- 開發時使用 `npm run dev`
- 部署前先執行 `npm run build` 測試建置
- 使用 Vercel 或 Netlify 可獲得最佳體驗
- Docker 適合自有伺服器部署

---

**需要幫助？** 查看 [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) 獲取詳細說明。
