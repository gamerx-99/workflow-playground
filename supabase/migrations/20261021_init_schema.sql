-- =========================================================
-- WORKFLOW AUTOMATION LAB — SUPABASE INITIAL SCHEMA & RLS
-- Phase 7 Migration: 20261021_init_schema.sql
-- =========================================================

-- Enable pgcrypto if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------
-- 1. Profiles Table (Linked with Supabase auth.users)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- ---------------------------------------------------------
-- 2. Progress Table (Level completion & scores)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.progress (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  level_id INTEGER NOT NULL,
  passed BOOLEAN NOT NULL DEFAULT FALSE,
  score INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  PRIMARY KEY (user_id, level_id)
);

-- ---------------------------------------------------------
-- 3. Flows Table (Student workspace flow state per level)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.flows (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  level_id INTEGER NOT NULL,
  flow_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  PRIMARY KEY (user_id, level_id)
);

-- ---------------------------------------------------------
-- 4. Projects Table (Studio projects)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  flow_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- ---------------------------------------------------------
-- 5. Custom Levels Table (User-created levels)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.custom_levels (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  level_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- ---------------------------------------------------------
-- 6. Shares Table (Shared flows/projects via shortcode)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shares (
  code TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  data_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- ---------------------------------------------------------
-- 7. Level Solutions Table (Hidden solutions - Server only)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.level_solutions (
  level_id INTEGER PRIMARY KEY,
  template_json JSONB NOT NULL,
  checks_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- ---------------------------------------------------------
-- Indexes for Performance
-- ---------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_progress_user_id ON public.progress(user_id);
CREATE INDEX IF NOT EXISTS idx_flows_user_id ON public.flows(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_levels_user_id ON public.custom_levels(user_id);
CREATE INDEX IF NOT EXISTS idx_shares_code ON public.shares(code);

-- ---------------------------------------------------------
-- Auth Trigger: Automatically create Profile on SignUp
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ---------------------------------------------------------

-- 1. Profiles RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by self and teachers" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher')
  );

CREATE POLICY "Users can update own display_name" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()) -- Prevents self-elevation of role
  );

-- 2. Progress RLS
ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own progress; teachers can read all" ON public.progress
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher')
  );

CREATE POLICY "Users can insert/update own progress" ON public.progress
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Flows RLS
ALTER TABLE public.flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own flows" ON public.flows
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Projects RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own projects" ON public.projects
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Custom Levels RLS
ALTER TABLE public.custom_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view custom levels" ON public.custom_levels
  FOR SELECT USING (TRUE);

CREATE POLICY "Users can manage own custom levels, teachers can manage all" ON public.custom_levels
  FOR ALL USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher')
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher')
  );

-- 6. Shares RLS
ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read shared flow by code" ON public.shares
  FOR SELECT USING (TRUE);

CREATE POLICY "Authenticated users can create shares" ON public.shares
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 7. Level Solutions RLS (Server-only / Service Role)
ALTER TABLE public.level_solutions ENABLE ROW LEVEL SECURITY;
-- No client policies created for level_solutions: clients (anon/auth) cannot read this table directly.
