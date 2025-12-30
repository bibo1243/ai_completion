# QuickTask for macOS

快速新增任務到你的 Things GTD 系統

## 功能

- 🚀 選單欄常駐 App
- ⌨️ 全局快捷鍵 `Cmd+Shift+I` 快速開啟
- 📝 任務標題、備註、顏色、日期
- ☁️ 直接寫入 Supabase 資料庫

## 安裝步驟

### 1. 用 Xcode 開啟專案

```bash
open /Users/leegary/ai_completion/QuickTaskMac/QuickTask.xcodeproj
```

### 2. 設定 Supabase 憑證

編輯 `SupabaseService.swift`，填入你的 Supabase 資訊：

```swift
private let supabaseUrl = "YOUR_SUPABASE_URL"  // 例如: https://xxx.supabase.co
private let supabaseKey = "YOUR_SUPABASE_ANON_KEY"  // 你的 anon key
```

或在 App 執行後，從設定頁面填入。

### 3. 建置並執行

- 在 Xcode 中按 `Cmd+R` 執行
- App 會出現在選單列
- 首次使用需要登入你的帳號

### 4. 授予輔助使用權限

全局快捷鍵需要「輔助使用」權限：
1. 開啟「系統偏好設定」→「隱私權與安全性」→「輔助使用」
2. 點擊鎖頭解鎖
3. 加入 QuickTask.app 並啟用

## 快捷鍵

| 快捷鍵 | 功能 |
|--------|------|
| `⌘⇧I` | 開啟快速輸入視窗 |
| `⌘↵` | 新增任務 |
| `ESC` | 關閉視窗 |

## 輸入欄位

- **任務標題** - 必填
- **備註** - 選填，支援多行
- **顏色標籤** - 8 種顏色可選
- **開始日期** - 選填
- **截止日期** - 選填

## 故障排除

### 快捷鍵沒反應
- 確認已授予「輔助使用」權限
- 確認 App 正在執行（選單列有圖示）

### 無法新增任務
- 確認已在設定中登入
- 確認 Supabase URL 和 Key 正確
- 檢查網路連線

## 技術細節

- SwiftUI + AppKit
- macOS 13.0+
- Supabase REST API
