import {test,expect} from '@playwright/test';
test('phone study persists a review across reload and can restore a backup twice',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'开始今日学习'}).click();await expect(page.getByRole('heading',{name:'address',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'查看答案',exact:true}).click();await page.getByRole('button',{name:'记得 回忆正确'}).click();
 await expect(page.getByRole('heading',{name:'sustain',exact:true})).toBeVisible();await page.reload();
 await expect(page.getByLabel('学习概览')).toContainText('1次');
 await page.getByRole('button',{name:'开始今日学习'}).click();await expect(page.getByRole('heading',{name:'sustain',exact:true})).toBeVisible();
 await page.getByRole('navigation',{name:'手机导航'}).getByRole('button',{name:'我的',exact:true}).click();
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'导出备份'}).click();const download=await downloadPromise;const path=await download.path();if(!path)throw Error('No backup downloaded');
 await page.getByLabel('选择备份文件').setInputFiles(path);await expect(page.getByRole('status')).toContainText('备份已合并');
 await page.getByLabel('选择备份文件').setInputFiles(path);await expect(page.getByRole('status')).toContainText('备份已合并');
 await page.getByRole('navigation',{name:'手机导航'}).getByRole('button',{name:'今日',exact:true}).click();await expect(page.getByLabel('学习概览')).toContainText('1次');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('imports a word pack and keeps spelling separate from meaning',async({page})=>{
 await page.goto('/');await page.getByRole('navigation',{name:'手机导航'}).getByRole('button',{name:'我的',exact:true}).click();
 await page.getByLabel('选择词包文件').setInputFiles('public/example-wordpack.json');await expect(page.getByText('有效知识点 1 个', {exact:false})).toBeVisible();await page.getByRole('button',{name:'确认合并'}).click();await expect(page.getByRole('status')).toContainText('已合并');
 await page.getByRole('navigation',{name:'手机导航'}).getByRole('button',{name:'词库',exact:true}).click();await page.getByLabel('搜索单词或释义').fill('sustain');await page.getByLabel('练习方式 sustain').selectOption('spelling');
 await expect(page.getByRole('heading',{name:'拼写回忆',exact:true})).toBeVisible();await page.getByLabel('你的答案').fill('SUSTAIN');await page.getByRole('button',{name:'核对答案'}).click();await expect(page.getByRole('status')).toContainText('正确');await page.getByRole('button',{name:'记得 回忆正确'}).click();
 await expect(page.getByText('本次完成 1 项', {exact:false})).toBeVisible();
});
test('works after a cached production shell goes offline',async({page,context})=>{
 await page.goto('/');await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();await page.waitForLoadState('networkidle');
 await context.setOffline(true);await page.reload();await expect(page.getByRole('button',{name:'开始今日学习'})).toBeVisible();await page.getByRole('button',{name:'开始今日学习'}).click();await page.getByRole('button',{name:'查看答案',exact:true}).click();await page.getByRole('button',{name:'忘记 需要重学'}).click();
 await page.reload();await expect(page.getByLabel('学习概览')).toContainText('1次');
});
