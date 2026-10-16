/*
 * The homepage share card. Next renders this once at build and serves a static,
 * content-hashed asset — so a crawler never waits on a cold render, and editing
 * the poster changes its URL. That last part is the only invalidation an
 * unfurler respects: X keeps its own copy and retired the validator that could
 * force a re-crawl.
 */
export { alt, contentType, default, size } from "@/lib/seo/share-image";
