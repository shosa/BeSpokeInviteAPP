import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_RSVP, attendanceOf, partySizeOf, type RsvpQuestion } from "../src/invitation";

// Domande personalizzate come quelle create dal builder: id generati (q1, q2…), non "attending".
const custom: RsvpQuestion[] = [
  { id: "q1", label: "Nome e cognome", type: "text", required: true },
  { id: "q2", label: "Parteciperai?", type: "yes-no", required: true },
  { id: "q4", label: "Serve un alloggio", type: "yes-no" },
  { id: "q7", label: "Quanti siete?", type: "number" },
];

test("presenza dalle domande personalizzate: la prima sì/no", () => {
  assert.equal(attendanceOf(custom, { q1: "Anna", q2: true, q4: false }), true);
  assert.equal(attendanceOf(custom, { q1: "Anna", q2: false, q4: true }), false);
});

test("presenza dalle domande di partenza: id attending", () => {
  assert.equal(attendanceOf(DEFAULT_RSVP, { attending: true }), true);
  assert.equal(attendanceOf(DEFAULT_RSVP, { attending: false }), false);
});

test("senza domanda sì/no la presenza è sconosciuta", () => {
  assert.equal(attendanceOf([{ id: "q1", label: "Nome", type: "text" }], { q1: "Anna" }), null);
});

test("persone: numero dichiarato, altrimenti 1", () => {
  assert.equal(partySizeOf(custom, { q7: 3 }), 3);
  assert.equal(partySizeOf(custom, {}), 1);
  assert.equal(partySizeOf(DEFAULT_RSVP, { guests: 2 }), 2);
  assert.equal(partySizeOf(DEFAULT_RSVP, { guests: 0 }), 1);
});
