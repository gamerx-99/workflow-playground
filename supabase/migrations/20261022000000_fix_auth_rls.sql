-- =========================================================
-- WORKFLOW AUTOMATION LAB — แก้ไขความปลอดภัยของ Auth / RLS (ต่อจาก 20261021_init_schema.sql)
--
-- ปัญหาที่พบในไฟล์เดิม (ยืนยันด้วยการทดสอบบน Postgres จริง ดู supabase/tests/):
--  1. สมัครสมาชิกพร้อม role=teacher ใน metadata ได้สิทธิ์ผู้สอนทันที (trigger เชื่อค่าจากผู้ใช้) — ใครก็ยิง Auth API ตรงด้วย public key ได้
--  2. policy ของ profiles/progress/custom_levels อ้างตาราง profiles ซ้อนใน policy เอง → "infinite recursion" (HTTP 500 ทุกครั้งที่อ่าน)
--  3. ใครก็อ่านรายการ shares ทั้งหมดได้ (SELECT USING true) และรหัสแชร์สร้างฝั่ง client ด้วย Math.random
--  4. ด่านสร้างเองทุกคนอ่านได้ รวมถึงเฉลย (template)
--  5. ผู้ใช้ anonymous เขียน shares/custom_levels ได้เหมือนผู้ใช้จริง
--
-- วิธีใช้: รันไฟล์นี้ 1 ครั้งหลังไฟล์ init (SQL Editor หรือ `supabase db push`) แล้วตั้งรหัสสมัครผู้สอนด้วยคำสั่งที่ท้ายไฟล์
-- ไฟล์นี้รันซ้ำได้ (idempotent)
--
-- ที่ยังไม่แก้ในไฟล์นี้ (ต้องมี Edge Function ตรวจคำตอบฝั่งเซิร์ฟเวอร์ก่อน — ดู docs/ROADMAP.md Phase 7):
--  • ตาราง progress ยังให้ client เขียนแถวของตัวเองได้ → ปลอมว่าผ่านด่านได้ (ไม่รั่วข้อมูลคนอื่น แต่คะแนนไม่น่าเชื่อถือ 100%)
-- =========================================================

-- ---------------------------------------------------------
-- 0. ตัวช่วย (SECURITY DEFINER ข้าม RLS ของ profiles จึงไม่เกิด recursion)
-- ---------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('teacher', 'admin')
  );
$$;

-- ล็อกอินจริง (ไม่ใช่ผู้ใช้ anonymous)
CREATE OR REPLACE FUNCTION public.is_registered()
RETURNS BOOLEAN
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
     AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, FALSE) = FALSE;
$$;

-- ต้องให้ anon เรียกได้ด้วย: policy ถูกประเมินด้วยสิทธิ์ของผู้ที่ query (anon ก็โดน) ถ้าไม่ให้จะได้ "permission denied for function"
-- (สำหรับ anon ฟังก์ชันคืน false เสมอเพราะ auth.uid() เป็น null)
REVOKE ALL ON FUNCTION public.is_teacher() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_registered() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_teacher() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_registered() TO anon, authenticated;

-- ผู้เข้าชมที่ไม่ล็อกอิน (anon) ไม่ต้องแตะตารางข้อมูลผู้ใช้เลย — ปิดสิทธิ์ระดับตารางซ้ำอีกชั้นนอกจาก RLS
REVOKE ALL ON public.profiles, public.progress, public.flows, public.projects, public.custom_levels, public.shares FROM anon;

-- ---------------------------------------------------------
-- 1. สร้างโปรไฟล์ตอนสมัคร: ทุกคนเป็น 'student' เสมอ (ไม่เชื่อ role จาก metadata)
--    ผู้สอนต้องเรียก claim_teacher(รหัส) หลังล็อกอิน
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  base_name TEXT;
  candidate TEXT;
  shown_name TEXT;
  tries INT := 0;
BEGIN
  IF COALESCE(NEW.is_anonymous, FALSE) THEN
    base_name := 'guest_' || substr(NEW.id::text, 1, 8);
  ELSE
    base_name := lower(regexp_replace(
      COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'username', ''), split_part(COALESCE(NEW.email, ''), '@', 1)),
      '[^a-zA-Z0-9_.-]', '', 'g'));
    base_name := left(NULLIF(base_name, ''), 32);
    IF base_name IS NULL THEN base_name := 'user_' || substr(NEW.id::text, 1, 8); END IF;
  END IF;

  candidate := base_name;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) AND tries < 10 LOOP
    tries := tries + 1;
    candidate := left(base_name, 26) || '_' || substr(md5(random()::text || clock_timestamp()::text), 1, 5);
  END LOOP;

  shown_name := left(btrim(COALESCE(NEW.raw_user_meta_data ->> 'display_name', '')), 60);
  IF shown_name = '' THEN shown_name := candidate; END IF;

  INSERT INTO public.profiles (id, username, display_name, role)
  VALUES (NEW.id, candidate, shown_name, 'student');
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------
-- 2. profiles: ไม่ recursion + แก้ได้เฉพาะ display_name (role/username แก้เองไม่ได้)
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "Profiles viewable by self and teachers" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own display_name" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_self_or_teacher" ON public.profiles; -- ชื่อใหม่ก็ DROP ไว้ด้วย เพื่อให้รันซ้ำได้
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;

CREATE POLICY "profiles_select_self_or_teacher" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_teacher());

CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- policy คุมระดับแถว ส่วนสิทธิ์ระดับคอลัมน์คุมว่าแก้ช่องไหนได้: ผู้ใช้แก้ได้เฉพาะ display_name
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (display_name) ON public.profiles TO authenticated;

-- ---------------------------------------------------------
-- 3. progress
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own progress; teachers can read all" ON public.progress;
DROP POLICY IF EXISTS "Users can insert/update own progress" ON public.progress;
DROP POLICY IF EXISTS "progress_select_self_or_teacher" ON public.progress;
DROP POLICY IF EXISTS "progress_insert_self" ON public.progress;
DROP POLICY IF EXISTS "progress_update_self" ON public.progress;

CREATE POLICY "progress_select_self_or_teacher" ON public.progress
  FOR SELECT USING (auth.uid() = user_id OR public.is_teacher());

-- ชั่วคราว: client เขียนแถวของตัวเองได้ (จนกว่าจะมี Edge Function ตรวจคำตอบ) แต่ค่าต้องสมเหตุสมผล
CREATE POLICY "progress_insert_self" ON public.progress
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND public.is_registered()
    AND score >= 0 AND total >= 0 AND score <= total AND total <= 200 AND attempts >= 0 AND attempts <= 100000
  );

CREATE POLICY "progress_update_self" ON public.progress
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND score >= 0 AND total >= 0 AND score <= total AND total <= 200 AND attempts >= 0 AND attempts <= 100000
  );

-- ---------------------------------------------------------
-- 4. custom_levels: เจ้าของและผู้สอนเท่านั้นที่อ่าน/แก้ได้ (ด่านมีเฉลย) — แบ่งปันให้คนอื่นผ่านระบบแชร์
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view custom levels" ON public.custom_levels;
DROP POLICY IF EXISTS "Users can manage own custom levels, teachers can manage all" ON public.custom_levels;
DROP POLICY IF EXISTS "custom_levels_select_owner_or_teacher" ON public.custom_levels;
DROP POLICY IF EXISTS "custom_levels_insert_owner" ON public.custom_levels;
DROP POLICY IF EXISTS "custom_levels_update_owner_or_teacher" ON public.custom_levels;
DROP POLICY IF EXISTS "custom_levels_delete_owner_or_teacher" ON public.custom_levels;

CREATE POLICY "custom_levels_select_owner_or_teacher" ON public.custom_levels
  FOR SELECT USING (auth.uid() = user_id OR public.is_teacher());

CREATE POLICY "custom_levels_insert_owner" ON public.custom_levels
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_registered());

CREATE POLICY "custom_levels_update_owner_or_teacher" ON public.custom_levels
  FOR UPDATE USING (auth.uid() = user_id OR public.is_teacher())
  WITH CHECK (auth.uid() = user_id OR public.is_teacher());

CREATE POLICY "custom_levels_delete_owner_or_teacher" ON public.custom_levels
  FOR DELETE USING (auth.uid() = user_id OR public.is_teacher());

-- ---------------------------------------------------------
-- 5. shares: ไม่เปิดให้ list; อ่านทีละรหัสผ่าน get_share(); รหัสสร้างโดยฐานข้อมูล (สุ่มแบบ CSPRNG)
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can read shared flow by code" ON public.shares;
DROP POLICY IF EXISTS "Authenticated users can create shares" ON public.shares;
DROP POLICY IF EXISTS "shares_select_own" ON public.shares;
DROP POLICY IF EXISTS "shares_insert_registered" ON public.shares;
DROP POLICY IF EXISTS "shares_delete_own" ON public.shares;

CREATE POLICY "shares_select_own" ON public.shares
  FOR SELECT USING (auth.uid() = user_id OR public.is_teacher());

CREATE POLICY "shares_insert_registered" ON public.shares
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_registered());

CREATE POLICY "shares_delete_own" ON public.shares
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.shares_set_code()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  -- ไม่ใช้รหัสที่ client ส่งมา (เดาง่าย/จองรหัสล่วงหน้าได้) — ออกรหัส 10 ตัวอักษรเอง
  NEW.code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shares_before_insert ON public.shares;
CREATE TRIGGER shares_before_insert
  BEFORE INSERT ON public.shares
  FOR EACH ROW EXECUTE FUNCTION public.shares_set_code();

CREATE OR REPLACE FUNCTION public.get_share(p_code TEXT)
RETURNS TABLE (code TEXT, type TEXT, title TEXT, data_json JSONB, created_at TIMESTAMPTZ, author TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT s.code, s.type, s.title, s.data_json, s.created_at, p.display_name
  FROM public.shares s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  WHERE s.code = upper(btrim(p_code))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_share(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_share(TEXT) TO anon, authenticated;

-- ---------------------------------------------------------
-- 6. สมัครเป็นผู้สอน: ตรวจรหัสที่ฝั่งฐานข้อมูล (รหัสเก็บใน private.app_config ไม่อยู่ในโค้ด/ไฟล์นี้)
--    กันเดารหัส: ผิดเกิน 5 ครั้งใน 15 นาที จะถูกปฏิเสธ
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS private.app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS private.teacher_claim_attempts (
  user_id UUID NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.claim_teacher(code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  expected TEXT;
  recent INT;
BEGIN
  IF NOT public.is_registered() THEN
    RAISE EXCEPTION 'ต้องเข้าสู่ระบบด้วยบัญชีจริงก่อน' USING ERRCODE = '42501';
  END IF;

  DELETE FROM private.teacher_claim_attempts WHERE at < now() - interval '1 day';
  SELECT count(*) INTO recent FROM private.teacher_claim_attempts
    WHERE user_id = auth.uid() AND at > now() - interval '15 minutes';
  IF recent >= 5 THEN
    RAISE EXCEPTION 'ลองรหัสผิดหลายครั้งเกินไป กรุณารอ 15 นาที' USING ERRCODE = '42501';
  END IF;

  SELECT value INTO expected FROM private.app_config WHERE key = 'teacher_signup_code';

  IF expected IS NULL OR expected = '' OR code IS NULL
     OR encode(sha256(convert_to(code, 'UTF8')), 'hex') <> encode(sha256(convert_to(expected, 'UTF8')), 'hex') THEN
    INSERT INTO private.teacher_claim_attempts (user_id) VALUES (auth.uid()); -- ตอบ false (ไม่ raise) เพื่อให้บันทึกความพยายามไว้ได้
    RETURN FALSE;
  END IF;

  UPDATE public.profiles SET role = 'teacher', updated_at = now() WHERE id = auth.uid();
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_teacher(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_teacher(TEXT) TO authenticated;

-- ---------------------------------------------------------
-- 7. ตารางเฉลย: client เข้าถึงไม่ได้เลย (มี RLS เปิดอยู่แล้ว ไม่มี policy — ปิดสิทธิ์ระดับตารางซ้ำอีกชั้น)
-- ---------------------------------------------------------
REVOKE ALL ON public.level_solutions FROM anon, authenticated;

-- ---------------------------------------------------------
-- 8. กันข้อมูลใหญ่เกินและ id แปลกๆ (NOT VALID = ตรวจเฉพาะข้อมูลใหม่ ไม่ทำให้ migration ล้มเพราะข้อมูลเก่า)
-- ---------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'flows_size_chk') THEN
    ALTER TABLE public.flows ADD CONSTRAINT flows_size_chk CHECK (octet_length(flow_json::text) <= 1000000) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_size_chk') THEN
    ALTER TABLE public.projects ADD CONSTRAINT projects_size_chk CHECK (octet_length(flow_json::text) <= 1000000 AND char_length(name) <= 120) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'custom_levels_chk') THEN
    ALTER TABLE public.custom_levels ADD CONSTRAINT custom_levels_chk CHECK (octet_length(level_json::text) <= 500000 AND id ~ '^custom_[0-9]+$' AND char_length(title) <= 200) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shares_chk') THEN
    ALTER TABLE public.shares ADD CONSTRAINT shares_chk CHECK (octet_length(data_json::text) <= 1000000 AND char_length(title) <= 200 AND type IN ('project', 'level')) NOT VALID;
  END IF;
END
$$;

-- =========================================================
-- หลังรันไฟล์นี้: ตั้งรหัสสมัครผู้สอน (รันเองใน SQL Editor — ห้ามใส่รหัสจริงลงไฟล์นี้หรือ git)
--
--   INSERT INTO private.app_config (key, value) VALUES ('teacher_signup_code', 'ตั้งรหัสของคุณที่นี่')
--   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
--
-- ถ้าไม่ตั้ง = ไม่มีใครสมัครเป็นผู้สอนผ่านระบบได้ (ปลอดภัยไว้ก่อน); เปลี่ยนบัญชีเป็นผู้สอนด้วยมือได้:
--   UPDATE public.profiles SET role = 'teacher' WHERE username = 'ชื่อผู้ใช้';
-- =========================================================
