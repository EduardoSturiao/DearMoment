-- Audit log para ações críticas (LGPD Art. 48 — rastreabilidade de incidentes)
CREATE TABLE IF NOT EXISTS audit_log (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  action     text        NOT NULL,
  user_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  gift_id    uuid,
  metadata   jsonb,
  created_at timestamptz DEFAULT now()
);

-- Índices para consultas por usuário e por presente
CREATE INDEX IF NOT EXISTS audit_log_user_id_idx  ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS audit_log_gift_id_idx  ON audit_log (gift_id);
CREATE INDEX IF NOT EXISTS audit_log_created_idx  ON audit_log (created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Usuário lê apenas seus próprios registros
CREATE POLICY "users_read_own_audit" ON audit_log
  FOR SELECT USING (auth.uid() = user_id);

-- Usuário autenticado pode inserir apenas com seu próprio user_id
CREATE POLICY "users_insert_own_audit" ON audit_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Nenhuma UPDATE ou DELETE por usuários — tabela append-only para não-admins
