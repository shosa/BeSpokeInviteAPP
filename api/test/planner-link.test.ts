import { test, after } from "node:test";
import assert from "node:assert/strict";
import { setHandler, sessionCookie, sessionUser, queries } from "./helpers/fakeDb";
import { buildApp } from "../src/app";

// NV-01: la coppia di un cliente Pro non collega al suo planner gli inviti di altri clienti dello stesso studio.
const STUDIO = "1a1a1a1a-1a1a-4a1a-8a1a-1a1a1a1a1a1a";
const COUPLE = "2b2b2b2b-2b2b-4b2b-8b2b-2b2b2b2b2b2b";
const PLANNER = "3c3c3c3c-3c3c-4c3c-8c3c-3c3c3c3c3c3c";
const CLIENT_A = "4d4d4d4d-4d4d-4d4d-8d4d-4d4d4d4d4d4d";
const CLIENT_B = "5e5e5e5e-5e5e-4e5e-8e5e-5e5e5e5e5e5e";
const INV_B = "6f6f6f6f-6f6f-4f6f-8f6f-6f6f6f6f6f6f";
const app = await buildApp();
after(() => app.close());

test("NV-01: invito di un altro cliente dello studio → 404, planner non collegato", async () => {
  const invitations = [{ id: INV_B, user_id: STUDIO, pro_client_id: CLIENT_B }];
  setHandler((sql, p) => {
    const s = sessionUser(sql, p, { [COUPLE]: { email: "coppia-a@example.test" } });
    if (s) return s;
    if (/FROM planners p\s+WHERE p.id = \$1/.test(sql) || /FROM planners p WHERE p.id = \$1/.test(sql)) return { rows: [{ id: PLANNER, user_id: STUDIO, invitation_id: null, pro_client_id: CLIENT_A, data: {} }] };
    if (/^SELECT id FROM invitations WHERE id = \$1 AND user_id = \$2/.test(sql)) {
      // Il filtro per cliente arriva come terzo parametro.
      return { rows: invitations.filter((i) => i.id === p[0] && i.user_id === p[1] && (p[2] == null || i.pro_client_id === p[2])) };
    }
    return undefined;
  });
  const res = await app.inject({ method: "POST", url: `/api/planners/${PLANNER}/link`, headers: { cookie: sessionCookie(COUPLE) }, payload: { invitationId: INV_B } });
  assert.equal(res.statusCode, 404);
  assert.ok(!queries.some((q) => /^UPDATE planners SET invitation_id = \$2/.test(q.sql)));
});
