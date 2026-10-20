const {test}=require('node:test');
const assert=require('node:assert/strict');
const clock=require('../public/business-clock');
test('Friday-evening orders start Monday morning and are due Wednesday morning',()=>{
  const ordered='2026-10-23T22:00:00Z'; // 6 p.m. Eastern Friday.
  assert.equal(clock.startsAt(ordered).toISOString(),'2026-10-26T13:00:00.000Z');
  assert.equal(clock.dueAt(ordered).toISOString(),'2026-10-28T13:00:00.000Z');
});
test('weekday cutoff and two business days are stable across daylight saving',()=>{
  assert.equal(clock.dueAt('2026-10-30T20:00:00Z').toISOString(),'2026-11-03T21:00:00.000Z');
  assert.equal(clock.startsAt('2026-10-19T11:00:00Z').toISOString(),'2026-10-19T13:00:00.000Z');
  assert.equal(clock.startsAt('2026-10-19T21:00:00Z').toISOString(),'2026-10-20T13:00:00.000Z');
  assert.equal(clock.dueAt('2026-10-19T16:30:00Z').toISOString(),'2026-10-21T16:30:00.000Z');
});
test('funder cutoff conversion respects a separately selected timezone',()=>{
  assert.equal(clock.instant({year:2026,month:10,day:23,hour:17,minute:0},'America/Los_Angeles').toISOString(),'2026-10-24T00:00:00.000Z');
});
