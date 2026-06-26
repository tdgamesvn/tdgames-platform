-- Sổ tay nhân viên (Employee Handbook)
-- 2026-06-26

-- ── Categories ────────────────────────────────────────────────
CREATE TABLE handbook_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  icon        TEXT NOT NULL DEFAULT '📄',
  order_index INT  NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Articles ──────────────────────────────────────────────────
CREATE TABLE handbook_articles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id  UUID NOT NULL REFERENCES handbook_categories(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  content      TEXT NOT NULL DEFAULT '',
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  order_index  INT NOT NULL DEFAULT 0,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX handbook_articles_category_idx ON handbook_articles(category_id);
CREATE INDEX handbook_articles_published_idx ON handbook_articles(category_id, is_published);

-- updated_at trigger
CREATE OR REPLACE FUNCTION handbook_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_handbook_articles_updated_at
  BEFORE UPDATE ON handbook_articles
  FOR EACH ROW EXECUTE FUNCTION handbook_set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE handbook_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE handbook_articles   ENABLE ROW LEVEL SECURITY;

-- Admin / HR: full CRUD
CREATE POLICY "admin_hr_manage_categories" ON handbook_categories
  FOR ALL TO authenticated
  USING   ((auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'hr'))
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'hr'));

CREATE POLICY "admin_hr_manage_articles" ON handbook_articles
  FOR ALL TO authenticated
  USING   ((auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'hr'))
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'hr'));

-- All authenticated: read (categories always; articles only published)
CREATE POLICY "authenticated_read_categories" ON handbook_categories
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "authenticated_read_published_articles" ON handbook_articles
  FOR SELECT TO authenticated USING (is_published = TRUE);

-- ── Seed: default categories ──────────────────────────────────
INSERT INTO handbook_categories (title, icon, order_index) VALUES
  ('Nội quy & Quy định',  '📋', 0),
  ('Chính sách lương thưởng', '💰', 1),
  ('Phúc lợi',            '🎁', 2),
  ('Quy trình nhân sự',   '🧑‍💼', 3),
  ('Onboarding',          '🚀', 4);
