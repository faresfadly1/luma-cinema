import test from 'node:test';
import assert from 'node:assert/strict';
import {seatMeasurements,type Hall,type Seat} from './geometry';
const h={screen:{width:4,height:2,center:{x:0,y:1,z:0},yawDegrees:0},rows:[]} as unknown as Hall;
const seat=(x:number,z:number):Seat=>({id:'X',row:'X',number:1,position:{x,y:-.15,z},yawDegrees:0});
test('distance uses 3D geometry and known 3-4-5 distance',()=>{const m=seatMeasurements(h,seat(3,4));assert.equal(m.distance,5);});
test('mirrored seats have equal distance and opposite turn angles',()=>{const left=seatMeasurements(h,seat(-2,8)),right=seatMeasurements(h,seat(2,8));assert.equal(left.distance,right.distance);assert.equal(left.turnAngle,-right.turnAngle);});
test('off-center screen angle is measured from both edges',()=>{const m=seatMeasurements(h,seat(1,8));assert.ok(m.screenAngle>0&&m.screenAngle<40);});
test('seat measurements use the seated eye point and screen-center distance',()=>{const m=seatMeasurements(h,seat(0,8));assert.ok(Math.abs(m.eye.y-1)<1e-9);assert.equal(m.distance,8);});
test('lateral offset is measured along the rotated screen horizontal axis',()=>{const rotated={...h,screen:{...h.screen,yawDegrees:90}} as Hall;const m=seatMeasurements(rotated,seat(0,2));assert.equal(m.lateralOffset,-2);});
test('horizontal screen angle is derived from both projected screen edges',()=>{const m=seatMeasurements(h,seat(0,8));assert.ok(Math.abs(m.screenAngle-(2*Math.atan2(2,8)*180/Math.PI))<1e-9);});

test('rotated screen hall uses the screen orientation for centered seats',()=>{const hall={...h,screen:{...h.screen,yawDegrees:30}} as Hall;const centerSeat:Seat={id:'C',row:'C',number:1,position:{x:5,y:-.15,z:Math.sqrt(75)},yawDegrees:-30};const m=seatMeasurements(hall,centerSeat);assert.ok(Math.abs(m.turnAngle)<1e-9);assert.ok(m.screenAngle>0);});
