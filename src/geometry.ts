import auditoriumData from '../config/auditoriums.json' with { type: 'json' };
export type Vec3 = { x:number; y:number; z:number };
export type Seat = { id:string; row:string; number:number; position:Vec3; yawDegrees:number };
type HallBase = typeof auditoriumData.halls.standard;
export type Hall = Omit<HallBase,'rows'> & {rows:Array<{label:string;z:number;y:number;xPositions:number[]}>;seats?:Seat[]};
export const halls = auditoriumData.halls as Record<string, Hall>;
export const eyeOffset = auditoriumData.metadata.assumedSeatedEyeOffsetMeters;
export function getSeats(hall: Hall): Seat[] {
  if(hall.seats?.length)return hall.seats;
  return hall.rows.flatMap(row => row.xPositions.map((x,index) => ({id:`${row.label}${index+1}`,row:row.label,number:index+1,position:{x,y:row.y,z:row.z},yawDegrees:0})));
}
export function eyePoint(seat: Seat): Vec3 { return {x:seat.position.x,y:seat.position.y+eyeOffset,z:seat.position.z}; }
export function seatMeasurements(hall:Hall,seat:Seat) {
  const eye=eyePoint(seat), center=hall.screen.center;
  const dx=center.x-eye.x, dy=center.y-eye.y, dz=center.z-eye.z;
  const distance=Math.hypot(dx,dy,dz);
  const half=hall.screen.width/2, yaw=hall.screen.yawDegrees*Math.PI/180;
  const left={x:center.x-half*Math.cos(yaw),z:center.z+half*Math.sin(yaw)};
  const right={x:center.x+half*Math.cos(yaw),z:center.z-half*Math.sin(yaw)};
  const bearing=(point:{x:number;z:number})=>Math.atan2(point.x-eye.x,eye.z-point.z);
  const screenAngle=Math.abs((bearing(right)-bearing(left))*180/Math.PI);
  const centerBearing=Math.atan2(dx,-dz)*180/Math.PI;
  const turn=centerBearing-seat.yawDegrees;
  return {distance,screenAngle,verticalAngle:Math.atan2(dy,Math.hypot(dx,dz))*180/Math.PI,turnAngle:turn,eye};
}
