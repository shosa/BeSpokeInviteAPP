import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { setHandler, queries } from "./helpers/fakeDb";
import { buildApp } from "../src/app";
import { MEDIA_DIR } from "../src/media";

// SEC-08: un file usato solo dalla pagina pubblicata (published_config) non è orfano e non si cancella.
const NAME = "0e0e0e0e-0e0e-4e0e-8e0e-0e0e0e0e0e0e.jpg";
const INV = "0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f";
const app = await buildApp();
after(() => app.close());

function seedFile() {
  const full = path.join(MEDIA_DIR, NAME);
  fs.writeFileSync(full, "x");
  const old = new Date(Date.now() - 3 * 86_400_000);
  fs.utimesSync(full, old, old);
  return full;
}
function install() {
  setHandler((sql) => {
    if (/^SELECT id, slug, config, published_config, planner FROM invitations$/.test(sql)) return { rows: [{ id: INV, slug: "anna-luca", config: { blocks: [] }, published_config: { blocks: [{ props: { photo: `/api/media/${NAME}` } }] }, planner: {} }] };
    return undefined;
  });
}

test("SEC-08: file solo in published_config → orphan:false", async () => {
  seedFile();
  install();
  const res = await app.inject({ method: "GET", url: "/api/admin/media" });
  assert.equal(res.statusCode, 200);
  const row = res.json().files.find((f: { name: string }) => f.name === NAME);
  assert.equal(row.orphan, false);
});

test("SEC-08: il cleanup non lo rimuove, il delete singolo risponde 409", async () => {
  const full = seedFile();
  install();
  await app.inject({ method: "POST", url: "/api/admin/media/cleanup" });
  assert.ok(fs.existsSync(full));
  const del = await app.inject({ method: "DELETE", url: `/api/admin/media/${NAME}` });
  assert.equal(del.statusCode, 409);
  assert.ok(fs.existsSync(full));
});

test("SEC-08: eliminando un invito, un file usato dalla pagina online di un altro invito resta", async () => {
  const full = seedFile();
  setHandler((sql) => {
    if (/^SELECT slug, config, published_config, planner FROM invitations WHERE id = \$1/.test(sql)) return { rows: [{ slug: "da-eliminare", config: { blocks: [] }, published_config: { blocks: [{ props: { photo: `/api/media/${NAME}` } }] }, planner: {} }] };
    if (/published_config::text, ''\) LIKE \$2/.test(sql)) return { rows: [{ "?column?": 1 }] };
    return undefined;
  });
  const res = await app.inject({ method: "DELETE", url: `/api/admin/invitations/${INV}?confirm=da-eliminare` });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().removedFiles, 0);
  assert.ok(fs.existsSync(full));
  assert.ok(queries.some((q) => /UNION ALL SELECT 1 FROM planners WHERE data::text LIKE/.test(q.sql)));
});
