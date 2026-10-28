import 'fake-indexeddb/auto';
import { afterEach, expect, it } from 'vitest';
import { db, saveReview, restoreBackup } from '../src/store';
import type { Review } from '../src/model';
const review: Review={id:'once',pointId:'demo',rating:3,at:'2026-10-28T01:00:00Z',base:'new',day:'2026-10-28'};
afterEach(async()=>{await db.reviews.clear();await db.settings.clear();});
it('saves a review once including the pending synchronization state',async()=>{
 await saveReview(review);await saveReview(review);
 expect(await db.reviews.count()).toBe(1);
 expect((await db.reviews.get('once'))?.pending).toBe(true);
});
it('rejects a damaged backup without changing existing records',async()=>{
 await saveReview(review);
 await expect(restoreBackup({format:'vocabulary-backup',version:1,reviews:[{id:'bad'}]})).rejects.toThrow();
 expect(await db.reviews.count()).toBe(1);
});
it('restores twice without duplicates',async()=>{
 const backup={format:'vocabulary-backup',version:1,reviews:[review],settings:[]};
 await restoreBackup(backup);await restoreBackup(backup);
 expect(await db.reviews.count()).toBe(1);
});
