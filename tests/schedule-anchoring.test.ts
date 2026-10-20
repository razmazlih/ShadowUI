import test from 'node:test';
import assert from 'node:assert/strict';
import {createSchedule,applyScheduleOperation,scheduleView,evaluateSchedule} from '../lib/schedule';

test('explicit staff week starts on supplied date and spans seven days across month boundary',()=>{
 const schedule=createSchedule('dated','Create shifts for six employees starting 2026-11-28');
 const dates=[...new Set(schedule.shifts.map(shift=>shift.date))].sort();
 assert.deepEqual(dates,['2026-11-28','2026-11-29','2026-11-30','2026-12-01','2026-12-02','2026-12-03','2026-12-04']);
 assert.equal(evaluateSchedule(schedule).valid,true);
 assert.match(scheduleView(schedule).assumptions!.join(' '),/2026-11-28 through 2026-12-04/);
});
test('requested weekend coverage follows actual weekdays after rebasing',()=>{
 const schedule=createSchedule('weekend','Staff are Daniel, Maya, Noa. Start 2026-11-01. Friday only morning. Saturday only evening.');
 const friday=schedule.shifts.filter(shift=>shift.date==='2026-11-06'),saturday=schedule.shifts.filter(shift=>shift.date==='2026-11-07');
 assert.ok(friday.length);assert.ok(friday.every(shift=>shift.start==='09:00'));
 assert.ok(saturday.length);assert.ok(saturday.every(shift=>shift.start==='13:00'));
 assert.equal(new Set(schedule.shifts.map(shift=>shift.date)).size,7);
});
test('dated availability creates actual conflict and a recommended replacement removes it',()=>{
 let schedule=createSchedule('replace','Create shifts for six employees from 2026-12-01');
 const affected=schedule.shifts[0];assert.ok(affected.employeeId);
 schedule=applyScheduleOperation(schedule,{type:'set_availability',employeeId:affected.employeeId!,date:affected.date,unavailable:true});
 const view=scheduleView(schedule);assert.ok(view.evaluation.conflicts.some(conflict=>conflict.code==='UNAVAILABLE'&&conflict.shiftId===affected.id));
 const alternative=view.alternatives[affected.id][0];assert.ok(alternative);assert.notEqual(alternative.employeeId,affected.employeeId);
 const fixed=applyScheduleOperation(schedule,{type:'assign',shiftId:affected.id,employeeId:alternative.employeeId});
 assert.equal(evaluateSchedule(fixed).valid,true);assert.equal(schedule.shifts[0].employeeId,affected.employeeId);
});
test('invalid explicit dates fail clearly and absent dates preserve fixture anchors',()=>{
 assert.throws(()=>createSchedule('invalid','Six employees starting 2026-02-30'),/date is invalid/);
 assert.equal(createSchedule('fixture','Shifts for six staff').shifts[0].date,'2026-10-19');
});
