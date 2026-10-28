import "fake-indexeddb/auto";
import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { VocabularyDB } from "../src/store";
import {
  putSetting,
  exchangeMetadata,
  type MetadataChange,
  type RemoteMetadata,
} from "../src/metadata";
it("converges private metadata from two device stores through migrated PostgreSQL", async () => {
  const pg = new PGlite();
  const a = new VocabularyDB("sql-a-" + crypto.randomUUID()),
    b = new VocabularyDB("sql-b-" + crypto.randomUUID());
  const owner = "11111111-1111-4111-8111-111111111111";
  try {
    await pg.exec(
      `create schema auth;create role anon;create role authenticated;create table auth.users(id uuid primary key);insert into auth.users values('${owner}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;`,
    );
    await pg.exec(
      await readFile("supabase/migrations/002_private_metadata.sql", "utf8"),
    );
    await pg.exec("set role authenticated;");
    await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [
      owner,
    ]);
    const remote: RemoteMetadata = {
      push: async (changes) => {
        for (const { id, kind, key, value, at } of changes)
          await pg.query(
            "insert into private_metadata(user_id,id,payload) values($1,$2,$3) on conflict(user_id,id) do nothing",
            [owner, id, JSON.stringify({ id, kind, key, value, at })],
          );
      },
      pull: async () => {
        const result = await pg.query<{
          sequence: number;
          payload: MetadataChange;
        }>(
          "select sequence::int,payload from private_metadata order by sequence",
        );
        return result.rows.map((row) => ({
          ...row.payload,
          sequence: row.sequence,
          owner,
        }));
      },
    };
    const point = (id: string) => ({
      id,
      word: id,
      meaning: "示例",
      example: "An example.",
      translation: "示例。",
      books: ["cet6"],
      ability: "meaning",
      reviewed: true,
    });
    await putSetting(a, { key: "points", value: [point("a")] });
    await putSetting(b, { key: "points", value: [point("b")] });
    await putSetting(a, { key: "favorites", value: ["a"] });
    await exchangeMetadata(a, owner, remote);
    await exchangeMetadata(b, owner, remote);
    await putSetting(b, { key: "favorites", value: [] });
    await putSetting(b, { key: "budget", value: 30 });
    await exchangeMetadata(b, owner, remote);
    await exchangeMetadata(a, owner, remote);
    expect((await a.settings.get("points"))?.value).toEqual(
      (await b.settings.get("points"))?.value,
    );
    expect((await a.settings.get("points"))?.value as unknown[]).toHaveLength(
      2,
    );
    expect((await a.settings.get("favorites"))?.value).toEqual([]);
    expect((await a.settings.get("budget"))?.value).toBe(30);
  } finally {
    await a.delete();
    await b.delete();
    await pg.close();
  }
}, 30000);
