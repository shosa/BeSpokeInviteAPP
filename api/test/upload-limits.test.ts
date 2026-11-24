import { test, after } from "node:test";
import assert from "node:assert/strict";
import { setHandler, sessionCookie, sessionUser } from "./helpers/fakeDb";
import { buildApp } from "../src/app";
import { args } from "../src/media";
import { errorToEnglish } from "../src/errorsEn";

// Hardening upload: limite per tipo già in arrivo, ffmpeg solo su file locali.
const OWNER = "5a5a5a5a-5a5a-4a5a-8a5a-5a5a5a5a5a5a";
const INV = "5b5b5b5b-5b5b-4b5b-8b5b-5b5b5b5b5b5b";
const app = await buildApp();
after(() => app.close());

test("una foto oltre 30 MB → 413 con il messaggio italiano", async () => {
  setHandler((sql, p) => {
    const s = sessionUser(sql, p, { [OWNER]: { email: "sposi@example.test" } });
    if (s) return s;
    if (/^SELECT \* FROM invitations i WHERE i.id = \$1/.test(sql)) return { rows: [{ id: INV, user_id: OWNER, status: "paid", edit_count: 0, config: {} }] };
    return undefined;
  });
  const boundary = "----limite";
  const big = Buffer.alloc(31 * 1024 * 1024, 1);
  const payload = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
    big,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const res = await app.inject({ method: "POST", url: `/api/invitations/${INV}/media?kind=photo`, headers: { cookie: sessionCookie(OWNER), "content-type": `multipart/form-data; boundary=${boundary}` }, payload });
  assert.equal(res.statusCode, 413);
  assert.equal(res.json().error, "File troppo grande (massimo 30 MB)");
  assert.equal(errorToEnglish(res.json().error), "File too large (up to 30 MB)");
});

test("ffmpeg legge solo file locali", () => {
  for (const kind of ["photo", "video", "audio"] as const) {
    const a = args(kind, "/tmp/x.bin", "/tmp/y.out");
    const i = a.indexOf("-protocol_whitelist");
    assert.ok(i >= 0 && a[i + 1] === "file,pipe" && i < a.indexOf("-i"), kind);
  }
});
