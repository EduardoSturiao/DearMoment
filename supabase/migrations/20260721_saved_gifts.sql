-- Tabela de presentes salvos por destinatários (FEAT: "Salvar este presente")
-- Schema inferido do uso em assets/js/meus-presentes.js e presente.html — conferir
-- contra a definição real da tabela no projeto B (staging) antes de aplicar em produção.
CREATE TABLE IF NOT EXISTS saved_gifts (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gift_id    uuid        NOT NULL REFERENCES gifts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saved_gifts_user_id_idx ON saved_gifts (user_id);
CREATE INDEX IF NOT EXISTS saved_gifts_gift_id_idx ON saved_gifts (gift_id);

ALTER TABLE saved_gifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_saved_gifts" ON saved_gifts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_saved_gifts" ON saved_gifts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_saved_gifts" ON saved_gifts
  FOR DELETE USING (auth.uid() = user_id);

-- Sem política de UPDATE — nenhum fluxo do app atualiza uma linha existente.
