-- ══════════════════════════════════════════════════════
-- System Health Checks — monitoring table
-- ══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS system_health_checks (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name text        NOT NULL,  -- e.g. 'app.tdgamestudio.com'
  service_type text        NOT NULL,  -- 'http' | 'supabase' | 'vps'
  status       text        NOT NULL,  -- 'up' | 'down' | 'degraded'
  latency_ms   int,
  status_code  int,
  error_msg    text,
  metadata     jsonb,
  checked_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_health_service_time
  ON system_health_checks (service_name, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_health_status
  ON system_health_checks (status, checked_at DESC);

ALTER TABLE system_health_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff can read health checks"
  ON system_health_checks FOR SELECT
  USING (is_staff());

CREATE POLICY "service role can insert health checks"
  ON system_health_checks FOR INSERT
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION cleanup_old_health_checks()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM system_health_checks
  WHERE checked_at < now() - INTERVAL '30 days';
END;
$$;
