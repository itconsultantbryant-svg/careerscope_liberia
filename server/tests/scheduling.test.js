import test from 'node:test';
import assert from 'node:assert/strict';
import { wallTimeToDate,scheduleOccurrence,nextOccurrence } from '../../shared/scheduling.js';
test('wall-clock time respects timezone and rejects nonexistent dates',()=>{
  assert.equal(wallTimeToDate('2027-01-15','10:30','Africa/Monrovia').toISOString(),'2027-01-15T10:30:00.000Z');
  assert.equal(wallTimeToDate('2027-01-15','10:30','America/New_York').toISOString(),'2027-01-15T15:30:00.000Z');
  assert.throws(()=>wallTimeToDate('2027-02-30','10:30'));
  assert.throws(()=>wallTimeToDate('2027-01-15','25:30'));
  assert.throws(()=>wallTimeToDate('2027-01-15','10:30','Invalid/Zone'));
});
test('quarterly recurrences stay inside the accepted date window',()=>{
  const schedule={day_of_week:'Monday',start_time:'14:00',end_time:'15:00',valid_from:'2027-01-01',valid_until:'2027-03-31',timezone:'Africa/Monrovia'};
  assert.equal(scheduleOccurrence(schedule,'2027-01-04').start.toISOString(),'2027-01-04T14:00:00.000Z');
  assert.throws(()=>scheduleOccurrence(schedule,'2027-04-05'));
  assert.throws(()=>scheduleOccurrence(schedule,'2027-01-05'));
  assert.equal(nextOccurrence(schedule,new Date('2027-01-04T15:01:00Z')).date,'2027-01-11');
  assert.equal(nextOccurrence(schedule,new Date('2027-04-05T12:00:00Z')),null);
});
