// Gli id di inviti, planner e clienti sono UUID: un parametro di percorso diverso (es. «..%2F») non arriva mai all'API.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);
