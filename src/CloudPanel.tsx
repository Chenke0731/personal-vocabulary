import { useEffect, useRef, useState } from "react";
import { cloud, synchronizeCloud } from "./cloud";
export default function CloudPanel({
  onSynced,
  recovering,
  onRecoveryDone,
}: {
  onSynced: () => Promise<void>;
  recovering: boolean;
  onRecoveryDone: () => void;
}) {
  const [email, setEmail] = useState("");
  const emailInput = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");
  const [user, setUser] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [newPassword, setNewPassword] = useState("");
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
      setMessage("已登录，作答、私有词包及学习设置已同步。");
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
      setMessage(`同步完成，词包与设置已更新，本次上传 ${count} 条作答。`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "同步失败，本机记录仍在。");
    } finally {
      setBusy(false);
    }
  }
  async function requestReset() {
    if (!cloud) return;
    if (!email.trim() || !emailInput.current?.validity.valid) {
      setMessage("请输入有效的邮箱地址。");
      return;
    }
    setBusy(true);
    try {
      const { error } = await cloud.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + window.location.pathname });
      if (error) throw error;
      setMessage("请求已提交。如果邮箱已注册且邮件服务正常，请检查收件箱。");
    } catch {
      setMessage("重置请求未能发送，请检查网络或稍后重试。 ");
    } finally { setBusy(false); }
  }
  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!cloud) return;
    setBusy(true);
    try {
      const { error } = await cloud.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      onRecoveryDone();
      setMessage("密码已更新。 ");
    } catch {
      setMessage("密码更新失败，请检查密码要求或重新请求重置邮件。 ");
    } finally { setBusy(false); }
  }
  return (
    <section className="settings-section">
      <h2>账号与云端同步</h2>
      {!cloud ? (
        <>
          <p>尚未配置云服务，当前记录仅保存在本机。</p>
          <p className="muted">
            代码已提供接入入口；实际服务与双端同步尚未验证。配置步骤见项目README。
          </p>
        </>
      ) : recovering ? (
        <form onSubmit={updatePassword} className="cloud-form">
          <p>请设置新密码。</p>
          <label>新密码<input required minLength={6} type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></label>
          <button className="primary" disabled={busy}>更新密码</button>
          <button type="button" className="secondary" disabled={busy} onClick={() => { setNewPassword(""); onRecoveryDone(); }}>取消</button>
        </form>
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
                setBusy(true);
                setMessage("");
                try {
                  const { error } = await cloud!.auth.signOut();
                  if (error) throw error;
                  setMessage("已退出，本机记录保留并仍关联原账号。");
                } catch {
                  setMessage("退出失败，请检查网络后重试。");
                } finally {
                  setBusy(false);
                }
              }}
            >
              退出账号
            </button>
          </div>
          <p className="muted">
            同步作答、私有词包、收藏、学习预算和每日新词分配；计时与起点抽查仍保存在本机。
          </p>
        </>
      ) : (
        <form onSubmit={login} className="cloud-form">
          <p>
            登录后将本机作答、私有词包与设置关联到此账号。请使用你在自有云服务中创建的账号。
          </p>
          <label>
            邮箱
            <input
              required
              type="email"
              ref={emailInput}
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
          <button type="button" disabled={busy} className="secondary" onClick={requestReset}>忘记密码</button>
        </form>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
