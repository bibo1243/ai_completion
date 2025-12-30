# Things Clone for macOS

完整複製網站功能的原生 macOS 應用程式

## 功能

### ✅ 已實現
- 🔐 登入/登出
- 📥 收件匣視圖
- ⭐ 今天視圖
- 📅 預定視圖
- 📦 稍後視圖
- 📁 專案視圖
- 📖 紀錄本視圖
- 🏷️ 標籤管理
- ✏️ 任務新增/編輯/刪除
- ✅ 任務完成切換
- 🔍 搜尋功能
- ⌨️ 快捷鍵 (N = 新增任務)

### 🚧 待開發
- 📝 完整的任務編輯器
- 📎 附件管理
- 🤖 AI 助手
- 📆 行事曆視圖
- 📓 日記功能
- 🎯 專注模式

## 開始使用

### 1. 用 Xcode 開啟

由於這是 Swift 程式碼，你需要在 Xcode 中建立專案：

1. 開啟 Xcode
2. 選擇 「Create a new Xcode project」
3. 選擇 macOS → App
4. 產品名稱: `ThingsMac`
5. Interface: SwiftUI
6. Language: Swift
7. 建立專案後，把以下檔案拖進專案:
   - `ThingsMacApp.swift`
   - `ContentView.swift`
   - `Models.swift`
   - `SupabaseService.swift`

### 2. 執行

按 `Cmd+R` 執行

### 3. 登入

使用你的帳號密碼登入

## 快捷鍵

| 快捷鍵 | 功能 |
|--------|------|
| `N` | 新增任務 |
| `⌘,` | 設定 |

## 技術細節

- SwiftUI
- macOS 13.0+
- Supabase REST API
