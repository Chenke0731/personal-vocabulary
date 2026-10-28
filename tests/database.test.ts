import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
let pg: PGlite;
const A = "11111111-1111-4111-8111-111111111111",
  B = "22222222-2222-4222-8222-222222222222";
async function asUser(id: string) {
  await pg.exec("reset role;set role authenticated;");
  await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
}
const payload = (id: string) => ({
  id,
  kind: "budget",
  key: "budget",
  value: 30,
  at: "2026-10-28T00:00:00Z",
});
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(
    `create schema auth;create role anon;create role authenticated;create table auth.users(id uuid primary key);insert into auth.users values('${A}'),('${B}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;`,
  );
  await pg.exec(await readFile("supabase/migrations/001_events.sql", "utf8"));
  await pg.exec(
    await readFile("supabase/migrations/002_private_metadata.sql", "utf8"),
  );
}, 30000);
beforeEach(async () => asUser(A));
afterAll(async () => {
  if (pg) await pg.close();
});
it("runs both migrations and retries immutable metadata IDs once", async () => {
  const row = payload("once");
  for (let i = 0; i < 2; i++)
    await pg.query(
      "insert into private_metadata(user_id,id,payload) values($1,$2,$3) on conflict(user_id,id) do nothing",
      [A, row.id, JSON.stringify(row)],
    );
  const result = await pg.query<{ count: number }>(
    "select count(*)::int as count from private_metadata where id='once'",
  );
  expect(result.rows[0].count).toBe(1);
});
it("isolates users and blocks ownership spoofing under RLS", async () => {
  const row = payload("private");
  await pg.query(
    "insert into private_metadata(user_id,id,payload) values($1,$2,$3)",
    [A, row.id, JSON.stringify(row)],
  );
  await asUser(B);
  expect(
    (await pg.query("select * from private_metadata where id='private'")).rows,
  ).toHaveLength(0);
  await expect(
    pg.query(
      "insert into private_metadata(user_id,id,payload) values($1,$2,$3)",
      [A, "spoof", JSON.stringify(payload("spoof"))],
    ),
  ).rejects.toThrow();
});
it("rejects malformed metadata and direct mutation of existing rows", async () => {
  const bad = {
    ...payload("bad"),
    kind: "point",
    key: "p",
    value: { word: "missing-id" },
  };
  await expect(
    pg.query(
      "insert into private_metadata(user_id,id,payload) values($1,$2,$3)",
      [A, "bad", JSON.stringify(bad)],
    ),
  ).rejects.toThrow();
  await expect(
    pg.exec("update private_metadata set payload='{}' where id='once'"),
  ).rejects.toThrow();
  await expect(
    pg.exec("delete from private_metadata where id='once'"),
  ).rejects.toThrow();
});
it("denies anonymous reads of private data", async () => {
  await pg.exec("reset role;set role anon;");
  await expect(pg.query("select * from private_metadata")).rejects.toThrow();
});
it("rejects review payloads with a null ID", async () => {
  const review = { id: null, pointId: "point", base: "new", at: "2026-10-28T00:00:00Z", day: "2026-10-28", rating: 3 };
  await expect(pg.query("insert into review_events(user_id,id,payload) values($1,$2,$3)", [A, "event", JSON.stringify(review)])).rejects.toThrow();
});
