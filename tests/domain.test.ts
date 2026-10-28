import { describe, it, expect } from 'vitest';
import { deriveCard, makeQueue, learningDay } from '../src/scheduler';
import type { Point, Review } from '../src/model';
const point: Point = { id:'address:verb:meaning', word:'address', meaning:'处理', example:'Address the problem.', translation:'处理这个问题。', books:['cet6','postgraduate'], ability:'meaning', reviewed:true };
const now = '2026-10-28T02:00:00.000Z';
const event: Review = {id:'r1',pointId:point.id,rating:3,at:now,base:'new',day:'2026-10-28'};
describe('learning domain', () => {
 it('shares a sense across books without making duplicate cards', () => expect(makeQueue([point],[],now,15,[])).toHaveLength(1));
 it('deduplicates retries before scheduling', () => expect(deriveCard([event,event])).toEqual(deriveCard([event])));
 it('preserves the conservative outcome of concurrent reviews', () => {
  const conflict={...event,id:'r2',rating:1 as const};
  expect(deriveCard([event,conflict])).toEqual(deriveCard([conflict]));
 });
 it('keeps another sense independent', () => expect(makeQueue([point,{...point,id:'address:noun:meaning'}],[event],now,15,[]).map(x=>x.id)).toContain('address:noun:meaning'));
 it('resumes allocated but unanswered words after reload', () => expect(makeQueue([point],[],now,15,[point.id]).map(x=>x.id)).toEqual([point.id]));
 it('does not allocate more than six new words across reload',()=>expect(makeQueue([point],[],now,15,['a','b','c','d','e','f'])).toEqual([]));
 it('uses Shanghai date across UTC midnight',()=>expect(learningDay('2026-10-27T17:00:00Z')).toBe('2026-10-28'));
});

