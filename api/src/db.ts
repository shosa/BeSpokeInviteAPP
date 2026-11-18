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
-- Richieste di BeSpoke AI ricaricate con un acquisto su Shopify: si sommano al limite della console.
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS assistant_bonus integer NOT NULL DEFAULT 0;
ALTER TABLE assistant_usage ADD COLUMN IF NOT EXISTS counted boolean NOT NULL DEFAULT true;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS draft jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_url text;
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
CREATE TABLE IF NOT EXISTS planner_tables (
  id uuid PRIMARY KEY,
  invitation_id uuid NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  name text NOT NULL,
  seats integer NOT NULL DEFAULT 8,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE planner_guests ADD COLUMN IF NOT EXISTS table_id uuid REFERENCES planner_tables(id) ON DELETE SET NULL;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'rsvp';
CREATE TABLE IF NOT EXISTS planner_budget_items (
  id uuid PRIMARY KEY,
  invitation_id uuid NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  category text NOT NULL,
  label text NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  due_date date,
  paid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS planner_tasks (
  id uuid PRIMARY KEY,
  invitation_id uuid NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  title text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  days_before integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS planner_vendors (
  id uuid PRIMARY KEY,
  invitation_id uuid NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL DEFAULT '',
  contact text NOT NULL DEFAULT '',
  contract_status text NOT NULL DEFAULT 'unsigned' CHECK (contract_status IN ('unsigned', 'signed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS planner_guests (
  id uuid PRIMARY KEY,
  invitation_id uuid NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  name text NOT NULL,
  group_name text NOT NULL DEFAULT '',
  party_size integer NOT NULL DEFAULT 1,
  response text NOT NULL DEFAULT 'pending' CHECK (response IN ('pending', 'yes', 'no')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Planner come servizio a sé (si compra a parte): un evento con i suoi dati, collegabile a un invito (facoltativo).
CREATE TABLE IF NOT EXISTS planners (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitation_id uuid UNIQUE REFERENCES invitations(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  event_date date,
  venue text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  data jsonb NOT NULL DEFAULT '{}',
  order_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS planners_user_idx ON planners(user_id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS planner_id uuid REFERENCES planners(id) ON DELETE SET NULL;
ALTER TABLE planner_tables ADD COLUMN IF NOT EXISTS planner_id uuid REFERENCES planners(id) ON DELETE CASCADE;
ALTER TABLE planner_budget_items ADD COLUMN IF NOT EXISTS planner_id uuid REFERENCES planners(id) ON DELETE CASCADE;
ALTER TABLE planner_tasks ADD COLUMN IF NOT EXISTS planner_id uuid REFERENCES planners(id) ON DELETE CASCADE;
ALTER TABLE planner_vendors ADD COLUMN IF NOT EXISTS planner_id uuid REFERENCES planners(id) ON DELETE CASCADE;
ALTER TABLE planner_guests ADD COLUMN IF NOT EXISTS planner_id uuid REFERENCES planners(id) ON DELETE CASCADE;
ALTER TABLE planner_tables ALTER COLUMN invitation_id DROP NOT NULL;
ALTER TABLE planner_budget_items ALTER COLUMN invitation_id DROP NOT NULL;
ALTER TABLE planner_tasks ALTER COLUMN invitation_id DROP NOT NULL;
ALTER TABLE planner_vendors ALTER COLUMN invitation_id DROP NOT NULL;
ALTER TABLE planner_guests ALTER COLUMN invitation_id DROP NOT NULL;

-- Migrazione una tantum (idempotente): ogni invito «premium» diventa un invito normale con un planner collegato,
-- che si porta dietro i dati del planner (note, cartella, budget, quota) e le righe di invitati, budget, attività, fornitori e tavoli.
INSERT INTO planners (id, user_id, invitation_id, title, event_date, venue, address, data, order_ref, created_at)
SELECT gen_random_uuid(), i.user_id, i.id,
       COALESCE(i.config->'event'->>'title', ''),
       CASE WHEN i.config->'event'->>'eventDate' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN (i.config->'event'->>'eventDate')::date END,
       COALESCE(i.config->'event'->>'venue', ''),
       COALESCE(i.config->'event'->>'address', ''),
       jsonb_build_object(
         'docs', COALESCE(i.planner->'docs', '{}'::jsonb),
         'notes', COALESCE(i.planner->>'notes', ''),
         'budgetCents', CASE WHEN i.planner->>'budgetCents' ~ '^[0-9]+$' THEN (i.planner->>'budgetCents')::bigint ELSE 0 END,
         'guestQuota', CASE WHEN i.planner->>'guestQuota' ~ '^[0-9]+$' THEN (i.planner->>'guestQuota')::int ELSE 0 END
       ),
       i.order_ref, i.created_at
FROM invitations i
WHERE i.tier = 'premium' AND NOT EXISTS (SELECT 1 FROM planners p WHERE p.invitation_id = i.id);
UPDATE planner_tables x SET planner_id = p.id FROM planners p WHERE x.planner_id IS NULL AND x.invitation_id = p.invitation_id;
UPDATE planner_budget_items x SET planner_id = p.id FROM planners p WHERE x.planner_id IS NULL AND x.invitation_id = p.invitation_id;
UPDATE planner_tasks x SET planner_id = p.id FROM planners p WHERE x.planner_id IS NULL AND x.invitation_id = p.invitation_id;
UPDATE planner_vendors x SET planner_id = p.id FROM planners p WHERE x.planner_id IS NULL AND x.invitation_id = p.invitation_id;
UPDATE planner_guests x SET planner_id = p.id FROM planners p WHERE x.planner_id IS NULL AND x.invitation_id = p.invitation_id;
UPDATE invitations SET tier = 'rsvp' WHERE tier = 'premium';
-- Tipo di evento del planner (matrimonio, compleanno…): quelli già creati lo prendono dall'invito collegato, altrimenti matrimonio.
ALTER TABLE planners ADD COLUMN IF NOT EXISTS event_type text;
UPDATE planners p SET event_type = COALESCE((SELECT i.config->>'eventType' FROM invitations i WHERE i.id = p.invitation_id), 'wedding') WHERE p.event_type IS NULL;
-- Acquisti «premium» non ancora attivati: restano un invito da attivare e ricevono anche un planner da attivare.
INSERT INTO orders (id, user_id, invitation_id, amount_cents, currency, source, status, kind, draft, status_url, created_at)
SELECT o.id || '-planner', o.user_id, NULL, 0, o.currency, o.source, 'paid', 'initial', '{"product":"planner"}'::jsonb, o.status_url, o.created_at
FROM orders o
WHERE o.draft->>'tier' = 'premium' AND o.invitation_id IS NULL AND o.status = 'paid' AND o.user_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;
UPDATE orders SET draft = jsonb_set(draft, '{tier}', '"rsvp"') WHERE draft->>'tier' = 'premium';
-- Budget del planner: preventivi per categoria (da confrontare e prenotare), con i dati del contratto
-- e della mancia. I pagamenti sono le righe di planner_budget_items collegate a un preventivo.
CREATE TABLE IF NOT EXISTS planner_quotes (
  id uuid PRIMARY KEY,
  planner_id uuid NOT NULL REFERENCES planners(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'altro',
  name text NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  rating integer NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  booked boolean NOT NULL DEFAULT false,
  signed boolean NOT NULL DEFAULT false,
  arrival text NOT NULL DEFAULT '',
  contact text NOT NULL DEFAULT '',
  tip_cents integer NOT NULL DEFAULT 0,
  envelope boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS planner_quotes_planner_idx ON planner_quotes(planner_id);
ALTER TABLE planner_budget_items ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES planner_quotes(id) ON DELETE CASCADE;
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
