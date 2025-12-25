# 添加 Attachments 功能到數據庫

## 問題
上傳檔案後出現錯誤：`Could not find the 'attachments' column of 'tasks' in the schema cache`

## 解決方案
需要在 Supabase 數據庫中添加 `attachments` 列。

## 執行步驟

### 方法 1: 使用 Supabase Dashboard（推薦）

1. 打開 Supabase Dashboard: https://supabase.com/dashboard
2. 選擇您的項目
3. 點擊左側菜單的 **SQL Editor**
4. 創建新查詢並複製貼上以下 SQL：

```sql
-- Add attachments column to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- Add comment to describe the column
COMMENT ON COLUMN tasks.attachments IS 'Array of file attachments with metadata: [{ name, url, size, type }]';
```

5. 點擊 **Run** 執行 SQL
6. 刷新您的應用程序頁面

### 方法 2: 使用 Supabase CLI（如果已安裝）

```bash
# 確保在項目根目錄
cd /Users/leegary/ai_completion

# 推送遷移到數據庫
supabase db push

# 或者直接運行遷移文件
supabase db execute -f supabase/migrations/20250125_add_attachments.sql
```

## 驗證

執行 SQL 後，您可以在 **Table Editor** 中查看 `tasks` 表，應該能看到新的 `attachments` 列（類型為 JSONB）。

## 數據結構

`attachments` 列存儲的數據格式：
```json
[
  {
    "name": "document.pdf",
    "url": "https://...",
    "size": 1024000,
    "type": "application/pdf"
  }
]
```

## 注意事項

- 此列使用 JSONB 類型，可以高效存儲和查詢 JSON 數據
- 默認值為空數組 `[]`
- 現有的任務會自動獲得空數組作為默認值
