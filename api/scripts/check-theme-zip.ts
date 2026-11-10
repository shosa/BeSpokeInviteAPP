// Controlla uno ZIP di tema con lo stesso codice della console (api/src/themeUpload.ts), senza toccare themes/:
// lo installa in una cartella temporanea e riporta errori e avvisi. Esce con 1 se lo ZIP verrebbe rifiutato.
//   npm run check-theme-zip -w @inviteme/api -- percorso/<id>.zip
import fs from "fs";
import os from "os";
import path from "path";

// npm -w esegue lo script dentro api/: il percorso si risolve dalla cartella da cui è stato lanciato il comando.
const arg = process.argv[2];
const file = arg ? path.resolve(process.env.INIT_CWD ?? process.cwd(), arg) : "";
if (!file || !fs.existsSync(file)) {
  console.error("Uso: npm run check-theme-zip -w @inviteme/api -- percorso/<id>.zip");
  process.exit(2);
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "theme-zip-"));
process.env.THEMES_DIR = tmp; // prima di caricare il motore, che legge THEMES_DIR all'avvio
const { installThemeZip, ThemeUploadError } = await import("../src/themeUpload");
try {
  const r = installThemeZip(fs.readFileSync(file), { replace: false });
  const files = fs.readdirSync(path.join(tmp, r.id), { recursive: true }).map(String).sort();
  console.log(`OK: lo ZIP è valido. Tema "${r.name}" (id ${r.id}).`);
  console.log(`File installati (${files.length}):\n  ${files.join("\n  ")}`);
  if (r.warnings.length) console.log(`Avvisi (non bloccano):\n  - ${r.warnings.join("\n  - ")}`);
} catch (e) {
  if (e instanceof ThemeUploadError) {
    console.error(`RIFIUTATO: ${e.message}`);
    for (const d of e.details) console.error(`  - ${d}`);
    process.exitCode = 1;
  } else throw e;
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
