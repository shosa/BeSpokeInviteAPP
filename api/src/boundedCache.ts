// Cache in memoria con scadenza e numero massimo di voci: oltre il massimo si tolgono prima le voci scadute, poi
// le più vecchie (le Map tengono l'ordine di inserimento). Così una serie di ricerche diverse non fa crescere la
// memoria senza limite.
export class BoundedCache<V> {
  private map = new Map<string, { at: number; value: V }>();
  constructor(private ttlMs: number, private max = 2000) {}

  get(key: string): V | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (Date.now() - hit.at >= this.ttlMs) {
      this.map.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: V) {
    this.map.delete(key);
    if (this.map.size >= this.max) {
      const now = Date.now();
      for (const [k, v] of this.map) if (now - v.at >= this.ttlMs) this.map.delete(k);
      while (this.map.size >= this.max) this.map.delete(this.map.keys().next().value as string);
    }
    this.map.set(key, { at: Date.now(), value });
  }

  get size() {
    return this.map.size;
  }
}
