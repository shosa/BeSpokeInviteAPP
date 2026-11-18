// Fotografia statica della demo del planner: avvia per un momento il sito già costruito (next start),
// salva /planner/demo come pagina HTML con i suoi file in out/ (nella cartella del progetto) e richiude il server.
// Serve per pubblicare la demo su un hosting statico o per confrontarla con altre pagine.
// Uso: npm run build && npm run snapshot:planner -w @inviteme/web   (lingua: PLANNER_LANG=it|en, di base en)
import { spawn } from "node:child_process";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.resolve(web, "..", "out");
const port = 3999 + Math.floor(Math.random() * 500);
const lang = process.env.PLANNER_LANG === "it" ? "it" : "en";

if (!existsSync(path.join(web, ".next", "BUILD_ID"))) {
  console.error("Manca la build: esegui prima npm run build.");
  process.exit(1);
}

const next = path.join(web, "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");
const bin = existsSync(next) ? next : path.resolve(web, "..", "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");
const server = spawn(bin, ["start", "-p", String(port)], { cwd: web, stdio: "ignore", shell: process.platform === "win32" });

function stop() {
  if (process.platform === "win32") spawn("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  else server.kill("SIGTERM");
}

try {
  let html = null;
  for (let i = 0; i < 60 && !html; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      const res = await fetch(`http://127.0.0.1:${port}/planner/demo?lang=${lang}`);
      if (res.ok) html = await res.text();
    } catch {
      /* il server sta ancora partendo */
    }
  }
  if (!html) throw new Error("Il server non ha risposto entro un minuto.");
  await rm(out, { recursive: true, force: true });
  await mkdir(path.join(out, "_next"), { recursive: true });
  await cp(path.join(web, ".next", "static"), path.join(out, "_next", "static"), { recursive: true });
  await cp(path.join(web, "public", "planner"), path.join(out, "planner"), { recursive: true });
  await writeFile(path.join(out, "index.html"), html);
  // L'icona del sito è una rotta di Next (app/icon.png): va salvata a parte.
  const icon = await fetch(`http://127.0.0.1:${port}/icon.png`).catch(() => null);
  if (icon?.ok) await writeFile(path.join(out, "icon.png"), Buffer.from(await icon.arrayBuffer()));
  console.log(`Demo del planner salvata in ${out}`);
} finally {
  stop();
}
