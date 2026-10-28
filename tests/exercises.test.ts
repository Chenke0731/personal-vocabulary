import {it,expect} from 'vitest';
import {checkSpelling,cloze} from '../src/exercises';
it('accepts spaces and case but not a different word',()=>{expect(checkSpelling(' Address ','address')).toBe(true);expect(checkSpelling('addresses','address')).toBe(false);});
it('blanks a whole matching word without hiding substrings',()=>expect(cloze('The address is known; addressable is another word.','address')).toBe('The _____ is known; addressable is another word.'));
it('treats punctuation in a phrase as literal input',()=>expect(cloze('Use C++ carefully.','C++')).toBe('Use _____ carefully.'));
import {makeExercise} from '../src/exercises';
it('keeps different words and abilities on independent card IDs',()=>{
 const p={id:'address',word:'address',meaning:'处理',example:'Address it.',translation:'处理它。',books:['cet6'] as const,ability:'meaning' as const,reviewed:true};
 const a=makeExercise({...p,books:['cet6']},'spelling');const b=makeExercise({...p,id:'retain',books:['cet6']},'spelling');expect(a.id).not.toBe(b.id);expect(a.id).not.toBe(p.id);
});
