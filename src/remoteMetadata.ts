import type { MetadataChange, RemoteMetadata } from "./metadata";
import { cloud } from "./cloudClient";
// Uses the authenticated user's RLS-bound connection; no service-role key.
export const remoteMetadata: RemoteMetadata = {
  async push(changes, owner) {
    if (!cloud) throw Error("尚未配置云服务。");
    for (let offset = 0; offset < changes.length; offset += 200) {
      const rows = changes
        .slice(offset, offset + 200)
        .map(({ id, kind, key, value, at }) => ({
          user_id: owner,
          id,
          payload: { id, kind, key, value, at },
        }));
      const { error } = await cloud
        .from("private_metadata")
        .upsert(rows, { onConflict: "user_id,id", ignoreDuplicates: true });
      if (error)
        throw Error(
          "词包或设置上传失败。本机记录仍在，请检查网络及002数据库迁移。",
        );
    }
  },
  async pull(owner) {
    if (!cloud) throw Error("尚未配置云服务。");
    const result: MetadataChange[] = [];
    let cursor = 0;
    while (true) {
      const { data, error } = await cloud
        .from("private_metadata")
        .select("sequence,payload")
        .eq("user_id", owner)
        .gt("sequence", cursor)
        .order("sequence")
        .limit(500);
      if (error) throw Error("词包或设置读取失败，本机内容未被覆盖。");
      for (const row of data ?? []) {
        result.push({ ...row.payload, sequence: row.sequence, owner });
        cursor = row.sequence;
      }
      if (!data || data.length < 500) break;
    }
    return result;
  },
};
