import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeVariant, validateShopifyIds } from "../src/shopifySettings";

test("un ID di variante numerico diventa un gid Shopify completo", () => {
  assert.equal(normalizeVariant("44123456789"), "gid://shopify/ProductVariant/44123456789");
  assert.equal(normalizeVariant("gid://shopify/ProductVariant/44123456789"), "gid://shopify/ProductVariant/44123456789");
  assert.equal(normalizeVariant("non-un-id"), null);
  assert.equal(normalizeVariant("gid://shopify/Product/1"), null);
});

test("il dominio del negozio deve essere un dominio myshopify.com", () => {
  const ok = validateShopifyIds({ storeDomain: " Bespoke-Shop.myshopify.com ", variantId: "1", variantPremiumId: "" });
  assert.ok(ok.ok);
  assert.equal(ok.ok && ok.value.storeDomain, "bespoke-shop.myshopify.com");
  assert.equal(validateShopifyIds({ storeDomain: "https://evil.example.com" }).ok, false);
  assert.equal(validateShopifyIds({ storeDomain: "shop.myshopify.com.evil.io" }).ok, false);
});

test("le varianti vuote restano vuote, quelle sbagliate vengono rifiutate", () => {
  const empty = validateShopifyIds({});
  assert.ok(empty.ok);
  assert.equal(empty.ok && empty.value.variantId, "");
  assert.equal(validateShopifyIds({ variantId: "abc" }).ok, false);
  assert.equal(validateShopifyIds({ variantPremiumId: "12 34" }).ok, false);
});
