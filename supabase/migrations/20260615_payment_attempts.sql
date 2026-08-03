-- Tabela para rate limiting da Edge Function create-preference
CREATE TABLE IF NOT EXISTS payment_attempts (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_attempts_user_created_idx
  ON payment_attempts (user_id, created_at DESC);

ALTER TABLE payment_attempts ENABLE ROW LEVEL SECURITY;
-- Sem políticas de acesso — só service_role acessa esta tabela
