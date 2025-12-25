#!/bin/bash

# AI Completion 快速啟動腳本
# 此腳本將協助您快速設置並啟動專案

echo "🚀 AI Completion 快速啟動腳本"
echo "================================"
echo ""

# 檢查 Node.js 是否已安裝
if ! command -v node &> /dev/null; then
    echo "❌ 錯誤: 未找到 Node.js"
    echo "請先安裝 Node.js: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js 版本: $(node -v)"
echo "✅ npm 版本: $(npm -v)"
echo ""

# 檢查是否在正確的目錄
if [ ! -f "package.json" ]; then
    echo "❌ 錯誤: 請在專案根目錄執行此腳本"
    exit 1
fi

# 檢查 .env 檔案
if [ ! -f ".env" ]; then
    echo "⚠️  警告: 未找到 .env 檔案"
    echo "正在從 .env.example 創建 .env..."
    cp .env.example .env
    echo "✅ 已創建 .env 檔案"
    echo ""
    echo "⚠️  重要: 請編輯 .env 檔案並填入您的 Supabase 資訊："
    echo "   - VITE_SUPABASE_URL"
    echo "   - VITE_SUPABASE_ANON_KEY"
    echo ""
    read -p "按 Enter 繼續，或按 Ctrl+C 取消並先設定環境變數..."
fi

# 檢查依賴是否已安裝
if [ ! -d "node_modules" ]; then
    echo "📦 正在安裝依賴..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 依賴安裝失敗"
        exit 1
    fi
    echo "✅ 依賴安裝完成"
    echo ""
fi

# 詢問用戶要執行的操作
echo "請選擇要執行的操作："
echo "1) 啟動開發伺服器 (localhost)"
echo "2) 建置生產版本"
echo "3) 預覽生產版本"
echo "4) 執行測試"
echo "5) 查看部署指南"
echo ""
read -p "請輸入選項 (1-5): " choice

case $choice in
    1)
        echo ""
        echo "🚀 正在啟動開發伺服器..."
        echo "專案將在 http://localhost:5173 啟動"
        echo "按 Ctrl+C 停止伺服器"
        echo ""
        npm run dev
        ;;
    2)
        echo ""
        echo "🔨 正在建置生產版本..."
        npm run build
        if [ $? -eq 0 ]; then
            echo "✅ 建置完成！輸出目錄: dist/"
            echo ""
            echo "您現在可以："
            echo "- 執行 'npm run preview' 預覽生產版本"
            echo "- 將 dist/ 目錄部署到任何靜態網站託管服務"
        else
            echo "❌ 建置失敗"
            exit 1
        fi
        ;;
    3)
        echo ""
        if [ ! -d "dist" ]; then
            echo "⚠️  未找到 dist/ 目錄，正在建置..."
            npm run build
            if [ $? -ne 0 ]; then
                echo "❌ 建置失敗"
                exit 1
            fi
        fi
        echo "🚀 正在啟動預覽伺服器..."
        echo "專案將在 http://localhost:4173 啟動"
        echo "按 Ctrl+C 停止伺服器"
        echo ""
        npm run preview
        ;;
    4)
        echo ""
        echo "🧪 正在執行測試..."
        npm run test
        ;;
    5)
        echo ""
        if [ -f "DEPLOYMENT_GUIDE.md" ]; then
            echo "📖 正在開啟部署指南..."
            open DEPLOYMENT_GUIDE.md 2>/dev/null || cat DEPLOYMENT_GUIDE.md
        else
            echo "❌ 未找到 DEPLOYMENT_GUIDE.md"
        fi
        ;;
    *)
        echo "❌ 無效的選項"
        exit 1
        ;;
esac

echo ""
echo "✨ 完成！"
