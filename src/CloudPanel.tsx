import { useEffect, useState } from "react";
import { cloud, synchronizeCloud } from "./cloud";
export default function CloudPanel({
  onSynced,
}: {
  onSynced: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!cloud) return;
    cloud.auth
      .getSession()
      .then(({ data }) => setUser(data.session?.user.email ?? ""));
    const { data } = cloud.auth.onAuthStateChange((_event, session) =>
      setUser(session?.user.email ?? ""),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (!cloud) return;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await cloud.auth.signInWithPassword({
        email,
        password,
      });
      setPassword("");
      if (error) throw new Error("登录失败，请检查账号、密码或网络。");
      await synchronizeCloud();
      await onSynced();
      setMessage("已登录并完成本次作答同步。");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "登录失败。");
    } finally {
      setBusy(false);
    }
  }
  async function sync() {
    setBusy(true);
    try {
      const count = await synchronizeCloud();
      await onSynced();
      setMessage(`同步完成，本次上传 ${count} 条作答。`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "同步失败，本机记录仍在。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="settings-section">
      <h2>账号与云端作答同步</h2>
      {!cloud ? (
        <>
          <p>尚未配置云服务，当前记录仅保存在本机。</p>
          <p className="muted">
            代码已提供接入入口；实际服务与双端同步尚未验证。配置步骤见项目README。
          </p>
        </>
      ) : user ? (
        <>
          <p>已登录：{user}</p>
          <div className="button-row">
            <button className="primary" disabled={busy} onClick={sync}>
              立即同步
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={async () => {
                await cloud!.auth.signOut();
                setMessage("已退出，本机记录保留并仍关联原账号。");
              }}
            >
              退出账号
            </button>
          </div>
          <p className="muted">
            当前同步作答记录。词包、收藏及学习设置请使用备份在设备间迁移。
          </p>
        </>
      ) : (
        <form onSubmit={login} className="cloud-form">
          <p>
            登录后将本机学习记录关联到此账号。请使用你在自有云服务中创建的账号。
          </p>
          <label>
            邮箱
            <input
              required
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            密码
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button disabled={busy} className="primary">
            登录并关联本机记录
          </button>
        </form>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
