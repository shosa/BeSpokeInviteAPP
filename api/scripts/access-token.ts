// Crea o rinnova il link di accesso di un cliente e lo stampa. Il link si vede una sola volta: poi nel database resta solo l'hash.
// Uso: npm run access-token -w @inviteme/api -- <email> <nome>
import { randomUUID } from "crypto";
import { pool, migrate } from "../src/db";
import { createAccessToken, roleForEmail } from "../src/auth";
import { appUrl } from "../src/mail";

const [email, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(" ").trim();
if (!email || !name) {
  console.error("Uso: npm run access-token -w @inviteme/api -- <email> <nome>");
  process.exit(1);
}

async function main() {
  await migrate();
  const normalized = email.trim().toLowerCase();
  const { rows } = await pool.query("SELECT id FROM users WHERE email = $1", [normalized]);
  const userId: string = rows[0]?.id ?? randomUUID();
  if (!rows[0]) await pool.query("INSERT INTO users (id, email, name, role) VALUES ($1, $2, $3, $4)", [userId, normalized, name, roleForEmail(normalized)]);
  const token = await createAccessToken(userId);
  console.log(`${appUrl()}/accesso/${token}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
