#property strict
#property script_show_inputs
string cfg="";
#include "EngineRules.mqh"
int failed=0,passed=0;
void Check(bool ok,string name){if(ok){passed++;Print("PASS ",name);}else{failed++;Print("FAIL ",name);}}
void OnStart(){
 double values[4]={1,2,3,2},sma[],ema[];MovingAverage(values,sma,2,false);MovingAverage(values,ema,2,true);
 Check(sma[0]==EMPTY_VALUE&&MathAbs(sma[1]-1.5)<1e-9&&MathAbs(sma[3]-2.5)<1e-9,"SMA golden vector");
 Check(ema[0]==EMPTY_VALUE&&MathAbs(ema[1]-1.5)<1e-9&&MathAbs(ema[3]-2.1666666666666665)<1e-9,"EMA golden vector");
 Check(Cross(1,3,2,2,true)&&!Cross(1,1,2,2,true),"Cross up");Check(Cross(3,1,2,2,false),"Cross down");
 double zk[4]={15,25,24,26},zd[4]={30,20,25,25};
 Check(!ZoneThenCross(zk,zd,3,true,20,80,3),"Buy cancelled after leaving zone");
 double bk[3]={15,18,25},bd[3]={30,25,20};Check(ZoneThenCross(bk,bd,2,true,20,80,3),"Buy zone then cross");
 double sk[3]={85,82,75},sd[3]={70,75,80};Check(ZoneThenCross(sk,sd,2,false,20,80,3),"Sell zone then cross");
 double ek[4]={15,20,20,20},ed[4]={30,30,30,19};Check(!ZoneThenCross(ek,ed,3,true,20,80,2)&&ZoneThenCross(ek,ed,3,true,20,80,3),"Zone wait expiry");
 MqlRates bars[4];for(int i=0;i<4;i++){bars[i].open=values[i];bars[i].close=values[i];bars[i].high=values[i]+.3;bars[i].low=values[i]-.3;}
 string common="\nm0.period=2\nm0.fast=2\nm0.slow=1\nm0.signal=1\nm0.low=20\nm0.high=80\nm0.average=SMA\nm0.target=moving_average\n";
 cfg="m0.kind=ema\nm0.rule=price_above"+common;Check(!Module(bars,3,0,true),"EMA price above false");
 cfg="m0.kind=ema\nm0.rule=price_below"+common;Check(Module(bars,3,0,true),"EMA price below true");
 cfg="m0.kind=rsi\nm0.rule=recover_for_direction"+common;Check(!Module(bars,3,0,true),"RSI recover 50 not from low");
 cfg="m0.kind=rsi\nm0.rule=above_level"+common;Check(Module(bars,3,0,true),"RSI Wilder 50 above 20");
 cfg="m0.kind=stochastic\nm0.rule=extreme_for_direction"+common;Check(Module(bars,3,0,true),"Stoch 18.75 below 20");
 cfg="m0.kind=price_cross\nm0.rule=cross_down\nm0.period=2\nm0.target=price_level\nm0.low=2.5\n";Check(Module(bars,3,0,false),"Price crosses below 2.5");
 Print("EASpaze rule conformance: ",passed," passed, ",failed," failed");
}
