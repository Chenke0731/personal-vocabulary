import { test, expect } from "@playwright/test";
test("phone study persists a review across reload and can restore a backup twice", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开始今日学习" }).click();
  await expect(
    page.getByRole("heading", { name: "address", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "收藏单词" }).click();
  await expect(page.getByRole("button", { name: "取消收藏" })).toHaveText("★");
  await page.getByRole("button", { name: "查看答案", exact: true }).click();
  await page.getByRole("button", { name: "记得 回忆正确" }).click();
  await expect(
    page.getByRole("heading", { name: "sustain", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("学习概览")).toContainText("1次");
  await page.getByRole("button", { name: "开始今日学习" }).click();
  await expect(
    page.getByRole("heading", { name: "sustain", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "手机导航" })
    .getByRole("button", { name: "我的", exact: true })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出备份" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw Error("No backup downloaded");
  await page.getByLabel("选择备份文件").setInputFiles(path);
  await expect(page.getByRole("status")).toContainText("备份已合并");
  await page.getByLabel("选择备份文件").setInputFiles(path);
  await expect(page.getByRole("status")).toContainText("备份已合并");
  await page
    .getByRole("navigation", { name: "手机导航" })
    .getByRole("button", { name: "今日", exact: true })
    .click();
  await expect(page.getByLabel("学习概览")).toContainText("1次");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("imports a word pack and keeps spelling separate from meaning", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "手机导航" })
    .getByRole("button", { name: "我的", exact: true })
    .click();
  await page
    .getByLabel("选择词包文件")
    .setInputFiles("public/example-wordpack.json");
  await expect(
    page.getByText("有效知识点 1 个", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "确认合并" }).click();
  await expect(page.getByRole("status")).toContainText("已合并");
  await page
    .getByRole("navigation", { name: "手机导航" })
    .getByRole("button", { name: "词库", exact: true })
    .click();
  await page.getByLabel("搜索单词或释义").fill("sustain");
  await page.getByLabel("练习方式 sustain").selectOption("spelling");
  await expect(
    page.getByRole("heading", { name: "拼写回忆", exact: true }),
  ).toBeVisible();
  await page.getByLabel("你的答案").fill("SUSTAIN");
  await page.getByRole("button", { name: "核对答案" }).click();
  await expect(page.getByRole("status")).toContainText("正确");
  await page.getByRole("button", { name: "记得 回忆正确" }).click();
  await expect(page.getByText("本次完成 1 项", { exact: false })).toBeVisible();
});
test("shows a supplied phonetic transcription on a meaning card", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "手机导航" }).getByRole("button", { name: "我的", exact: true }).click();
  await page.getByLabel("选择词包文件").setInputFiles({ name: "phonetic.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ format: "cijian-wordpack", version: 1, points: [{ id: "test:phonetic", word: "exampleword", phonetic: "/test/", meaning: "示例", example: "An example.", translation: "一个例子。", books: ["cet6"], ability: "meaning", reviewed: true }] })) });
  await page.getByRole("button", { name: "确认合并" }).click();
  await page.getByRole("navigation", { name: "手机导航" }).getByRole("button", { name: "词库", exact: true }).click();
  await page.getByLabel("搜索单词或释义").fill("exampleword");
  await page.getByLabel("练习方式 exampleword").selectOption("meaning");
  await expect(page.getByText("/test/", { exact: true })).toBeVisible();
});
test("works after a cached production shell goes offline", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "开始今日学习" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "开始今日学习" }).click();
  await page.getByRole("button", { name: "查看答案", exact: true }).click();
  await page.getByRole("button", { name: "忘记 需要重学" }).click();
  await expect(
    page.getByRole("heading", { name: "sustain", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("学习概览")).toContainText("1次");
});

test("assessment resumes independently and does not create review records", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "词汇起点抽查", exact: false })
    .click();
  await page.getByRole("button", { name: "核对抽查答案" }).click();
  await page.getByRole("button", { name: "正确想起", exact: true }).click();
  await expect(page.getByText("起点抽查 · 1 / 24")).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "词汇起点抽查", exact: false })
    .click();
  await expect(page.getByText("起点抽查 · 1 / 24")).toBeVisible();
  await page.getByRole("button", { name: "保存并返回" }).click();
  await expect(page.getByLabel("学习概览")).toContainText("0次");
});
test("respects a restored time budget and allows extending to 30 minutes", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "手机导航" })
    .getByRole("button", { name: "我的", exact: true })
    .click();
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  await page.getByLabel("选择备份文件").setInputFiles({
    name: "time.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        format: "vocabulary-backup",
        version: 1,
        reviews: [],
        settings: [{ key: "session:" + day, value: 900 }],
      }),
    ),
  });
  await page
    .getByRole("navigation", { name: "手机导航" })
    .getByRole("button", { name: "今日", exact: true })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "开始今日学习" }).click();
  await expect(page.getByRole("status")).toContainText("时间预算已完成");
  await page.getByRole("button", { name: "回到今日" }).click();
  await page.getByRole("button", { name: "30分钟", exact: true }).click();
  await page.getByRole("button", { name: "开始今日学习" }).click();
  await expect(
    page.getByRole("heading", { name: "address", exact: true }),
  ).toBeVisible();
});
test("unreviewed words require explicit checking before they can be practiced", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "手机导航" })
    .getByRole("button", { name: "我的", exact: true })
    .click();
  const point = {
    id: "candidate::one",
    word: "candidateword",
    meaning: "待校对",
    example: "",
    translation: "",
    books: ["cet6"],
    ability: "meaning",
    reviewed: false,
    source: "测试来源",
  };
  await page.getByLabel("选择词包文件").setInputFiles({
    name: "candidate.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        format: "cijian-wordpack",
        version: 1,
        points: [point],
      }),
    ),
  });
  await page.getByRole("button", { name: "确认合并" }).click();
  await page
    .getByRole("navigation", { name: "手机导航" })
    .getByRole("button", { name: "词库", exact: true })
    .click();
  await page.getByLabel("搜索单词或释义").fill("candidateword");
  await expect(page.getByLabel("练习方式 candidateword")).toBeDisabled();
  await page.getByRole("button", { name: "待校对", exact: true }).click();
  await page.getByLabel("核心义项").fill("候选示例词");
  await page.getByLabel("我已核对这一义项，允许进入学习任务").check();
  await page.getByRole("button", { name: "保存校对", exact: true }).click();
  await expect(page.getByLabel("练习方式 candidateword")).toBeEnabled();
  await page.getByLabel("练习方式 candidateword").selectOption("meaning");
  await page.getByRole("button", { name: "查看答案", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "候选示例词", exact: true }),
  ).toBeVisible();
});

test("large unreviewed packs stay searchable without rendering thousands of rows", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "手机导航" })
    .getByRole("button", { name: "我的", exact: true })
    .click();
  const points = Array.from({ length: 1000 }, (_, i) => ({
    id: "fixture:" + i,
    word: "fixtureword" + i,
    meaning: "待校对测试数据",
    example: "",
    translation: "",
    books: ["ielts"],
    ability: "meaning",
    reviewed: false,
  }));
  await page.getByLabel("选择词包文件").setInputFiles({
    name: "large.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ format: "cijian-wordpack", version: 1, points }),
    ),
  });
  await page.getByRole("button", { name: "确认合并" }).click();
  await expect(page.getByRole("status")).toContainText("共 1024 个");
  await page
    .getByRole("navigation", { name: "手机导航" })
    .getByRole("button", { name: "词库", exact: true })
    .click();
  await expect(page.locator(".word-list article")).toHaveCount(60);
  await page.getByLabel("搜索单词或释义").fill("fixtureword999");
  await expect(
    page.getByRole("heading", { name: "fixtureword999", exact: true }),
  ).toBeVisible();
});
test("backs up offline preference edits including a canceled favorite", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "30分钟", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "30分钟", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("navigation", { name: "手机导航" })
    .getByRole("button", { name: "词库", exact: true })
    .click();
  await page.getByLabel("搜索单词或释义").fill("address");
  const favorite = page.getByLabel("收藏 address", { exact: true });
  await favorite.click();
  await expect(favorite).toHaveText("★");
  await favorite.click();
  await expect(favorite).toHaveText("☆");
  await page
    .getByRole("navigation", { name: "手机导航" })
    .getByRole("button", { name: "我的", exact: true })
    .click();
  const next = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出备份" }).click();
  const file = await next;
  const stream = await file.createReadStream();
  if (!stream) throw Error("No backup");
  let text = "";
  for await (const chunk of stream) text += chunk.toString();
  const backup = JSON.parse(text);
  expect(
    backup.metadata.some(
      (c: { kind: string; value: unknown }) =>
        c.kind === "budget" && c.value === 30,
    ),
  ).toBe(true);
  expect(
    backup.metadata
      .filter((c: { kind: string }) => c.kind === "favorite")
      .map((c: { value: boolean }) => c.value),
  ).toEqual([true, false]);
});

test("downloads and imports the original academic practice pack without duplicates", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "手机导航" }).getByRole("button", { name: "我的", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("link", { name: "下载原创学术词汇练习包（6个知识点）" }).click();
  const download = await pending;
  const path = await download.path();
  if (!path) throw new Error("Word pack download failed");
  for (let i = 0; i < 2; i++) {
    await page.getByLabel("选择词包文件").setInputFiles(path);
    await expect(page.getByText("有效知识点 6 个", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "确认合并" }).click();
    await expect(page.getByRole("status")).toContainText("共 30 个");
  }
  await page.getByRole("navigation", { name: "手机导航" }).getByRole("button", { name: "词库", exact: true }).click();
  await page.getByLabel("搜索单词或释义").fill("evaluate");
  await page.getByLabel("练习方式 evaluate").selectOption("meaning");
  await page.getByRole("button", { name: "查看答案" }).click();
  await expect(page.getByRole("heading", { name: "评价；评估" })).toBeVisible();
});
