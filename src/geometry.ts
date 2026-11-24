import auditoriumData from '../config/auditoriums.json';
export type Vec3 = { x:number; y:number; z:number };
export type Seat = { id:string; row:string; number:number; position:Vec3; yawDegrees:number };
export type Hall = typeof auditoriumData.halls.standard;
export const halls = auditoriumData.halls as Record<string, Hall>;
export const eyeOffset = auditoriumData.metadata.assumedSeatedEyeOffsetMeters;
export function getSeats(hall: Hall): Seat[] {
  return hall.rows.flatMap(row => row.xPositions.map((x,index) => ({id:`${row.label}${index+1}`,row:row.label,number:index+1,position:{x,y:row.y,z:row.z},yawDegrees:0})));
}
export function eyePoint(seat: Seat): Vec3 { return {x:seat.position.x,y:seat.position.y+eyeOffset,z:seat.position.z}; }
export function seatMeasurements(hall:Hall,seat:Seat) {
  const eye=eyePoint(seat), center=hall.screen.center;
  const dx=center.x-eye.x, dy=center.y-eye.y, dz=center.z-eye.z;
  const distance=Math.hypot(dx,dy,dz);
  const half=hall.screen.width/2;
  const leftX=center.x-half, rightX=center.x+half;
  const yaw=hall.screen.yawDegrees*Math.PI/180;
  const leftVec={x:(leftX-eye.x)*Math.cos(yaw),z:(leftX-eye.x)*Math.sin(yaw)-eye.z};
  const rightVec={x:(rightX-eye.x)*Math.cos(yaw),z:(rightX-eye.x)*Math.sin(yaw)-eye.z};
  const leftAngle=Math.atan2(leftVec.x,-leftVec.z), rightAngle=Math.atan2(rightVec.x,-rightVec.z);
  const screenAngle=Math.abs((rightAngle-leftAngle)*180/Math.PI);
  const centerBearing=Math.atan2(dx,-dz)*180/Math.PI;
  const turn=centerBearing-seat.yawDegrees;
  return {distance,screenAngle,verticalAngle:Math.atan2(dy,Math.hypot(dx,dz))*180/Math.PI,turnAngle:turn,eye};
}
