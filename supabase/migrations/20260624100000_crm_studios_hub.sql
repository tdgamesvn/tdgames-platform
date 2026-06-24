-- ============================================================
-- CRM Studios Hub (2026-06-24)
-- Merge crm_hiring_studios + crm_discovered_studios → crm_studios
-- Add studio_id FK to crm_outreach_leads + backfill
-- ============================================================

-- 1. Create crm_studios
CREATE TABLE crm_studios (
  id            bigserial PRIMARY KEY,
  studio_name   text NOT NULL,
  apollo_id     text,
  country       text,
  domain        text,
  careers_link  text,
  source        text NOT NULL DEFAULT 'discovered',
  -- 'hiring' | 'discovered' | 'both'
  bd_status     text NOT NULL DEFAULT 'uncontacted',
  -- 'uncontacted' | 'outreached' | 'responding' | 'proposal' | 'client'
  contacts_found int NOT NULL DEFAULT 0,
  processed_at  timestamptz,
  discovered_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX crm_studios_apollo_id_idx
  ON crm_studios (apollo_id) WHERE apollo_id IS NOT NULL;
CREATE INDEX crm_studios_name_lower_idx
  ON crm_studios (LOWER(TRIM(studio_name)));
CREATE INDEX crm_studios_bd_status_idx ON crm_studios (bd_status);
CREATE INDEX crm_studios_country_idx   ON crm_studios (country);
CREATE INDEX crm_studios_source_idx    ON crm_studios (source);

-- 2. Migrate from crm_hiring_studios (insert all)
INSERT INTO crm_studios
  (studio_name, country, domain, careers_link, source, contacts_found, processed_at, created_at)
SELECT
  studio_name,
  NULLIF(TRIM(location), ''),
  NULLIF(TRIM(domain), ''),
  NULLIF(TRIM(careers_link), ''),
  'hiring',
  COALESCE(contacts_found, 0),
  processed_at,
  COALESCE(created_at, now())
FROM crm_hiring_studios;

-- 3. Insert discovered studios that don't already exist by name
INSERT INTO crm_studios
  (studio_name, apollo_id, country, source, contacts_found, discovered_at)
SELECT
  d.studio_name,
  d.apollo_id,
  d.country,
  'discovered',
  COALESCE(d.contacts_found, 0),
  d.discovered_at
FROM crm_discovered_studios d
WHERE NOT EXISTS (
  SELECT 1 FROM crm_studios s
  WHERE LOWER(TRIM(s.studio_name)) = LOWER(TRIM(d.studio_name))
);

-- 4. Merge discovered data into existing hiring rows → source='both'
UPDATE crm_studios s
SET
  apollo_id      = d.apollo_id,
  source         = 'both',
  contacts_found = GREATEST(s.contacts_found, COALESCE(d.contacts_found, 0)),
  discovered_at  = d.discovered_at,
  updated_at     = now()
FROM crm_discovered_studios d
WHERE LOWER(TRIM(s.studio_name)) = LOWER(TRIM(d.studio_name))
  AND d.apollo_id IS NOT NULL;

-- 5. Add studio_id FK to crm_outreach_leads
ALTER TABLE crm_outreach_leads
  ADD COLUMN studio_id bigint REFERENCES crm_studios(id) ON DELETE SET NULL;
CREATE INDEX crm_outreach_leads_studio_id_idx ON crm_outreach_leads (studio_id);

-- 6. Backfill studio_id for existing leads
UPDATE crm_outreach_leads l
SET studio_id = s.id
FROM crm_studios s
WHERE LOWER(TRIM(l.studio_name)) = LOWER(TRIM(s.studio_name))
  AND l.studio_id IS NULL
  AND TRIM(l.studio_name) != '';

-- 7. Derive initial bd_status from existing outreach history
UPDATE crm_studios s
SET bd_status = CASE
  WHEN EXISTS (
    SELECT 1 FROM crm_outreach_leads l
    WHERE l.studio_id = s.id AND l.replied_at IS NOT NULL
  ) THEN 'responding'
  WHEN EXISTS (
    SELECT 1 FROM crm_outreach_leads l
    WHERE l.studio_id = s.id AND l.initial_sent_at IS NOT NULL
  ) THEN 'outreached'
  ELSE 'uncontacted'
END
WHERE EXISTS (SELECT 1 FROM crm_outreach_leads l WHERE l.studio_id = s.id);

-- 8. RLS
ALTER TABLE crm_studios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_studios_select" ON crm_studios FOR SELECT TO authenticated USING (true);
CREATE POLICY "crm_studios_insert" ON crm_studios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "crm_studios_update" ON crm_studios FOR UPDATE TO authenticated USING (true);
CREATE POLICY "crm_studios_delete" ON crm_studios FOR DELETE TO authenticated USING (true);
