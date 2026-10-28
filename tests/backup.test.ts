import {expect,it} from 'vitest';
import 'fake-indexeddb/auto';
import {db,exportBackup,restoreBackup} from '../src/store';
it('exports only portable preferences, excluding cloud binding',async()=>{
 await db.settings.put({key:'cloud-owner',value:'private-account'});
 const backup=await exportBackup();expect(backup.settings.some(s=>s.key==='cloud-owner')).toBe(false);
 await expect(restoreBackup(backup)).resolves.toBeUndefined();await db.settings.clear();
});
