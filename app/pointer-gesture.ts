/** A drag stays a drag even if the finger returns to its starting position. */
export class PointerGesture {
 private active=new Map<number,{x:number;y:number}>();
 private moved=false;
 private multiple=false;
 down(id:number,x:number,y:number){
  if(this.active.size===0){this.moved=false;this.multiple=false;}
  this.active.set(id,{x,y});
  if(this.active.size>1)this.multiple=true;
 }
 move(id:number,x:number,y:number){
  const start=this.active.get(id);
  if(start&&Math.hypot(x-start.x,y-start.y)>9)this.moved=true;
 }
 up(id:number,x:number,y:number){
  if(!this.active.has(id))return false;
  this.move(id,x,y);
  const tap=this.active.size===1&&!this.multiple&&!this.moved;
  this.active.delete(id);return tap;
 }
 cancel(){this.active.clear();this.moved=true;this.multiple=true;}
}
