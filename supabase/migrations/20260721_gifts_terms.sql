-- Colunas de aceite dos Termos de Uso no step final do wizard (feature UX-1)
-- Preenchidas em pagamento.html no momento do upsert do presente.
ALTER TABLE gifts ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
ALTER TABLE gifts ADD COLUMN IF NOT EXISTS terms_version     text;
