
class Compute{
  constructor(get){
    this.listeners = [];
    this._get = get;
  }
  get(index){
     return this._get(index);
  }
  dirty(index){    this.listeners.forEach(e=>e.dirty(index));
  }
  attach(compute){
    this.listeners.push(compute);
  }
}

class Summer extends Compute{
    get(i,prev){
       if(prev === undefined)prev = i===0?0:this.get(i-1);
       return this._get(i,prev);
    }
}
class CacheCompute extends Summer{
   constructor(){
      super(...arguments);
      this._cache = [];
   }
    get(i, prev){
      if(this._cache[i]!==undefined)
         return this._cache[i];
      return (this._cache[i] = super.get(i,prev));  
   }
   dirty(i){
      if(this._cache.length>i)this._cache.length = i;
super.dirty(i)
   }
}
class TreeCompute extends CacheCompute{
    constructor(){
       super(...arguments);
       this.left = null;
       this.right = null;
       this.size = 0;
       this.start = 0;
    }
    findBlock(i){
        if(this.size<50)return null;
if(i>this.size>>1)return this.right||(this.right = new TreeCompute(this._get));
else return this.left||(this.left = new TreeCompute(this._get));     
    }
    get(i){
       if(i>this.size)this.setSize(i);
       let block = this.findBlock(i);
       return block?block.get(i-block.start):super.get(i);
    }
setSize(i){
   let m = this.size>>1;
let half= m>>1;
   if(half5>m){
//move stuff from right to left;
let removed = this.right.setStart(
}
}//TODO
}
let m = new Compute(m=>m);
let fib = new  CacheCompute((i,prev)=>i+prev);
let fibOfFib = new TreeCompute((i,prev)=>fib.get(i)+prev);
fibOfFib.get(100)
fib.attach(fibOfFib);
fib.get(90)
fib.dirty(10)
console.log(fib,fibOfFib)
fib.get(45)

