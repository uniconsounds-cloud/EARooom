import type { Strategy } from "./model";
import { evaluateGroup, historyLength, linesFor, type Bar } from "./evaluator";

// Guided, deterministic OHLC scenarios; selection is based on the actual evaluator.
// Impossible combinations are reported as partial matches, never forced to pass.
export function generateScenario(strategy:Strategy, variation=0) {
  const group=strategy.entry.signalGroup??{logic:"all" as const,conditions:[]};
  const count=historyLength(strategy),level=group.conditions.find(m=>m.kind==="price_cross"&&m.target==="price_level")?.level;
  const base=level&&level>0?level:2368,scale=Math.max(.02,base*.00032);
  let best: {bars:Bar[];score:number;focus:number;label:string}|undefined;
  const shapes=["trend","pullback","range","breakout"];
  for(let attempt=0;attempt<8;attempt++){
    let seed=(12345+variation*101+attempt*171+strategy.timeframe.split("").reduce((v,c)=>v+c.charCodeAt(0),0))>>>0;
    const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    const sign=strategy.direction==="sell"?-1:strategy.direction==="buy"?1:attempt%2===0?1:-1;
    const shape=shapes[attempt%4];let close=base-sign*scale*8;
    const bars:Bar[]=Array.from({length:count},(_,i)=>{
      const j=i-(count-64);let drift=sign*.07;
      if(j>=0)drift=shape==="trend"?sign*.28:shape==="pullback"?(j<32?sign*.36:j<48?-sign*.5:sign*.55):shape==="breakout"?(j<40?Math.sin(j*.6)*.3:sign*.6):Math.cos(j*.35)*.7;
      const open=close;
      // Mix small pauses and occasional large impulses; retain deterministic OHLC.
      const burst=random(),size=burst<.2?.22:burst>.9?2.4:.7+random()*.8;
      close=Math.max(scale,open+scale*(drift*.48+(random()-.5)*2*size));
      const upper=scale*(.05+random()*random()*1.4),lower=scale*(.05+random()*random()*1.4);
      return {open,close,high:Math.max(open,close)+upper,low:Math.min(open,close)-lower};
    });
    // Anchor the end of the warmup near a requested absolute price level.
    if(level){const offset=level-bars[count-64].close;bars.forEach(b=>{b.open+=offset;b.close+=offset;b.high+=offset;b.low+=offset;});}
    const lines=linesFor(group,bars);let score=-1,focus=count-20;
    for(let i=count-60;i<count-4;i++)for(const side of (["buy","sell"] as const)){
      if(strategy.direction!=="both"&&strategy.direction!==side)continue;
      const match=evaluateGroup(group,lines,i,bars,side),value=match.count+(match.passed?10:0);
      if(value>score){score=value;focus=i;}
    }
    if(!best||score>best.score)best={bars,score,focus,label:shape};
    if(score>=group.conditions.length+10)break;
  }
  return best!;
}
