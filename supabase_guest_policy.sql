-- 訪客雙向同步權限設定 (Supabase SQL)
-- 請在 Supabase Dashboard 的 SQL Editor 中執行此腳本

-- 1. 首先，請找出您的 User ID (UUID)。您可以執行下面這行來查看所有用戶，找到您的 email 對應的 ID。
-- SELECT id, email FROM auth.users;

-- 假設您的 UUID 是 '您的_UUID_填在這裡' (例如: 'a0eebc99-9c0b-...')
-- 請將下方的 UUID 替換為您的真實 UUID。

-- ==========================================
-- 設定 Tasks 表權限
-- ==========================================

-- 允許任何人讀取特定使用者的任務
CREATE POLICY "Allow Guest Read Tasks"
ON public.tasks
FOR SELECT
TO anon, authenticated
USING (true); 
-- 注意：為了方便，我們允許讀取所有公開任務。若要嚴格限制，可改為 USING (user_id = '您的UUID')

-- 允許任何人新增任務 (指定 user_id 為您的 UUID)
CREATE POLICY "Allow Guest Insert Tasks"
ON public.tasks
FOR INSERT
TO anon, authenticated
WITH CHECK (true);
-- 同樣，若要嚴格限制，可改為 WITH CHECK (user_id = '您的UUID')

-- 允許任何人更新特定使用者的任務
CREATE POLICY "Allow Guest Update Tasks"
ON public.tasks
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);
-- 限制版：USING (user_id = '您的UUID')

-- 允許任何人刪除特定使用者的任務 (軟刪除只需 Update，若用硬刪除需此權限)
CREATE POLICY "Allow Guest Delete Tasks"
ON public.tasks
FOR DELETE
TO anon, authenticated
USING (true);
-- 限制版：USING (user_id = '您的UUID')


-- ==========================================
-- 設定 Tags 表權限 (讓訪客能讀取/使用標籤)
-- ==========================================

CREATE POLICY "Allow Guest Read Tags"
ON public.tags
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Allow Guest Insert Tags"
ON public.tags
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Allow Guest Update Tags"
ON public.tags
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 啟用 RLS (如果尚未啟用)
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- 確保 anon 角色有權限使用 sequence (解決 id 生成問題)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- 確保 anon 角色有權限存取表
GRANT ALL ON TABLE public.tasks TO anon, authenticated;
GRANT ALL ON TABLE public.tags TO anon, authenticated;
