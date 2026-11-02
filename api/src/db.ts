import pg from "pg";

// Pool di connessione a PostgreSQL. La stringa arriva da DATABASE_URL (vedi docker-compose.yml).
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? "postgres://inviteme:inviteme@localhost:5432/inviteme",
  max: 10,
  idleTimeoutMillis: 30_000,
});

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'paid')),
  config jsonb NOT NULL,
  guests jsonb NOT NULL DEFAULT '[]'::jsonb,
  order_ref text,
  views integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invitations_user_idx ON invitations(user_id);
CREATE TABLE IF NOT EXISTS rsvps (
  id uuid PRIMARY KEY,
  invitation_id uuid NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  answers jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rsvps_invitation_idx ON rsvps(invitation_id);
CREATE TABLE IF NOT EXISTS orders (
  id text PRIMARY KEY,
  invitation_id uuid REFERENCES invitations(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL,
  currency text NOT NULL,
  source text NOT NULL CHECK (source IN ('shopify', 'local')),
  status text NOT NULL CHECK (status IN ('pending', 'paid')),
  checkout_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS events (
  id bigserial PRIMARY KEY,
  type text NOT NULL,
  invitation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS outbox (
  id bigserial PRIMARY KEY,
  to_address text NOT NULL,
  subject text NOT NULL,
  html text NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
-- Pannello di gestione dell'invito: note organizzative e nota del conto alla rovescia (non fanno parte della pagina).
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS planner jsonb NOT NULL DEFAULT '{}'::jsonb;
-- Dopo l'acquisto l'invito si modifica una sola volta: la prima modifica salvata lo consuma e apre una sessione.
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS edit_count integer NOT NULL DEFAULT 0;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS edit_session text;
-- Cosa è stato pagato (le funzioni restano acquistate anche se tolte e riaggiunte) e la versione pubblicata agli ospiti.
-- La bozza è la colonna config: le modifiche dopo l'acquisto non arrivano agli ospiti finché non si conferma.
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS purchased_addons jsonb;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS published_config jsonb;
UPDATE invitations SET purchased_addons = config->'addons', published_config = config WHERE status = 'paid' AND purchased_addons IS NULL;
-- Ordini: acquisto iniziale oppure «upgrade» (funzioni nuove aggiunte dopo l'acquisto), con le funzioni pagate.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'initial';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS addons jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub text;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_idx ON users (google_sub) WHERE google_sub IS NOT NULL;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS assistant_calls integer NOT NULL DEFAULT 0;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS assistant_asked boolean NOT NULL DEFAULT false;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS assistant_free_run integer NOT NULL DEFAULT 0;
ALTER TABLE assistant_usage ADD COLUMN IF NOT EXISTS counted boolean NOT NULL DEFAULT true;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS draft jsonb;
CREATE TABLE IF NOT EXISTS assistant_usage (
  id bigserial PRIMARY KEY,
  invitation_id uuid NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  model text NOT NULL,
  input_tokens integer NOT NULL,
  output_tokens integer NOT NULL,
  cache_read_tokens integer NOT NULL,
  cache_write_tokens integer NOT NULL,
  actions integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin'));
CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS music_tracks (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  artist text NOT NULL DEFAULT '',
  url text NOT NULL,
  license text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS stock_imports (
  pixabay_id integer PRIMARY KEY,
  url text NOT NULL,
  bytes integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS access_tokens (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
DROP TABLE IF EXISTS password_resets;
`;

// Crea lo schema all'avvio. Il lock evita che due istanze lo eseguano insieme.
export async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(424242)");
    await client.query(SCHEMA);
  } finally {
    await client.query("SELECT pg_advisory_unlock(424242)").catch(() => undefined);
    client.release();
  }
}

export async function track(type: string, invitationId?: string) {
  await pool.query("INSERT INTO events (type, invitation_id) VALUES ($1, $2)", [type, invitationId ?? null]);
}
