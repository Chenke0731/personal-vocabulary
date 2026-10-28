import {describe,it,expect} from 'vitest';
import {parseWordPack} from '../src/content';
describe('word pack import',()=>{
 it('rejects malformed points instead of partially importing',()=>expect(()=>parseWordPack({format:'cijian-wordpack',version:1,points:[{word:'address'}]})).toThrow());
 it('requires unique stable identities',()=>{const p={id:'x',word:'x',meaning:'示例',example:'An example.',translation:'一个例子。',books:['cet6'],ability:'meaning',reviewed:true};expect(()=>parseWordPack({format:'cijian-wordpack',version:1,points:[p,p]})).toThrow();});
 it('preserves different senses of the same word',()=>{const p={word:'address',meaning:'处理',example:'Address it.',translation:'处理它。',books:['cet6'],ability:'meaning',reviewed:true};expect(parseWordPack({format:'cijian-wordpack',version:1,points:[{...p,id:'a'},{...p,id:'b'}]})).toHaveLength(2);});
});
