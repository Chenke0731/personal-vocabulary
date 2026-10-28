import { test, expect } from "@playwright/test";

const fakeCloud = `
const listeners = new Set();
window.fakeAuth = { requests: [], failReset: false, failUpdate: false, failSignOut: false, emit(event) { for (const callback of listeners) callback(event, event === "SIGNED_OUT" ? null : { user: { email: "learner@example.test" } }); } };
export const cloud = { auth: {
  getSession: async () => ({ data: { session: null } }),
  onAuthStateChange(callback) { listeners.add(callback); return { data: { subscription: { unsubscribe() { listeners.delete(callback); } } } }; },
  resetPasswordForEmail: async (email, options) => { window.fakeAuth.requests.push({ method: "reset", email, redirect: options.redirectTo }); return { error: window.fakeAuth.failReset ? new Error("offline") : null }; },
  signOut: async () => { if (window.fakeAuth.failSignOut) return { error: new Error("offline") }; window.fakeAuth.emit("SIGNED_OUT"); return { error: null }; },
  updateUser: async () => { window.fakeAuth.requests.push({ method: "update" }); return { error: window.fakeAuth.failUpdate ? new Error("expired") : null }; }
}};
export const synchronizeCloud = async () => 0;
`;

test.beforeEach(async ({ page }) => {
  await page.route("**/src/cloud.ts", route => route.fulfill({ contentType: "application/javascript", body: fakeCloud }));
  await page.goto("http://localhost:5189/");
});

test("password reset uses a clean redirect and reports success or failure", async ({ page }) => {
  await page.getByRole("navigation", { name: "手机导航" }).getByRole("button", { name: "我的", exact: true }).click();
  await page.getByLabel("邮箱").fill("learner@example.test");
  await page.getByRole("button", { name: "忘记密码" }).click();
  await expect(page.getByRole("status")).toContainText("如果邮箱已注册");
  const request = await page.evaluate(() => (window as any).fakeAuth.requests[0]);
  expect(request).toEqual({ method: "reset", email: "learner@example.test", redirect: "http://localhost:5189/" });
  await page.evaluate(() => { (window as any).fakeAuth.failReset = true; });
  await page.getByRole("button", { name: "忘记密码" }).click();
  await expect(page.getByRole("status")).toContainText("重置请求未能发送");
});

test("recovery event opens password form and retains it after an update failure", async ({ page }) => {
  await page.evaluate(() => (window as any).fakeAuth.emit("PASSWORD_RECOVERY"));
  await expect(page.getByLabel("新密码")).toBeVisible();
  await page.getByLabel("新密码").fill("example-password");
  await page.evaluate(() => { (window as any).fakeAuth.failUpdate = true; });
  await page.getByRole("button", { name: "更新密码" }).click();
  await expect(page.getByRole("status")).toContainText("密码更新失败");
  await expect(page.getByLabel("新密码")).toBeVisible();
  await page.evaluate(() => { (window as any).fakeAuth.failUpdate = false; });
  await page.getByRole("button", { name: "更新密码" }).click();
  await expect(page.getByRole("status")).toContainText("密码已更新");
  expect(await page.evaluate(() => sessionStorage.getItem("password-recovery"))).toBeNull();
});

test("sign out reports an error without claiming success and allows retry", async ({ page }) => {
  await page.getByRole("navigation", { name: "手机导航" }).getByRole("button", { name: "我的", exact: true }).click();
  await page.evaluate(() => (window as any).fakeAuth.emit("SIGNED_IN"));
  await expect(page.getByText("已登录：learner@example.test")).toBeVisible();
  await page.evaluate(() => { (window as any).fakeAuth.failSignOut = true; });
  await page.getByRole("button", { name: "退出账号" }).click();
  await expect(page.getByRole("status")).toContainText("退出失败");
  await expect(page.getByText("已登录：learner@example.test")).toBeVisible();
  await page.evaluate(() => { (window as any).fakeAuth.failSignOut = false; });
  await page.getByRole("button", { name: "退出账号" }).click();
  await expect(page.getByRole("status")).toContainText("已退出");
  await expect(page.getByLabel("邮箱")).toBeVisible();
});

test("rejects an invalid recovery email before contacting auth", async ({ page }) => {
  await page.getByRole("navigation", { name: "手机导航" }).getByRole("button", { name: "我的", exact: true }).click();
  await page.getByLabel("邮箱").fill("not-an-email");
  await page.getByRole("button", { name: "忘记密码" }).click();
  await expect(page.getByRole("status")).toContainText("请输入有效的邮箱地址");
  expect(await page.evaluate(() => (window as any).fakeAuth.requests.length)).toBe(0);
});
