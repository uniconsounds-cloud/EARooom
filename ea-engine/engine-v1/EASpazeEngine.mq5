#property strict
#property version "1.000"
#property description "EASpaze Simple engine 0.1.0. Monitor by default; orders limited to demo/tester."
#include <Trade/Trade.mqh>
input string InpConfigFile="easpaze.cfg"; // Common Files; reload every poll
input string InpConfigUrl="";           // Optional exact public strategy HTTPS URL
input int InpPollSeconds=15;
input bool InpEnableDemoOrders=false;
input ulong InpMagic=730031;
input double InpPipSize=0;              // 0 = XAU 0.1; FX 3/5 digits = 10 points
const string ENGINE="0.1.0",CONTRACT="1.0.0";
string cfg="",revision="",syncText="NO CONFIG",stateText="WAIT CONFIG",queued="";
bool synced=false,armed=false,sideBuy=true,prevBuy=false,prevSell=false,manualRequested=false;
datetime lastSync=0,lastBar=0,armedAt=0;
double reference=0,signalHigh=0,signalLow=0,signalSwing=0;
int matched=0,moduleTotal=0;
CTrade trade;

#include "EngineRules.mqh"
bool Member(string value,string list){return StringFind("|"+list+"|","|"+value+"|")>=0;}
bool Numeric(string key,double low,double high,bool integral=false){string raw=Value(key);if(raw=="")return false;for(int j=0;j<StringLen(raw);j++)if(StringFind("0123456789.eE+-",StringSubstr(raw,j,1))<0)return false;double n=StringToDouble(raw);return MathIsValidNumber(n)&&n>=low&&n<=high&&(!integral||n==MathFloor(n));}
bool KnownKey(string key){if(Member(key,"format|contract|engine|revision|symbol|timeframe|direction|logic|history|lot|maxSpread|trigger|delay|move|moveDirection|buffer|triggerEma|wait|stopMode|sl|tp|lookback|swingBuffer|rr|count"))return true;int dot=StringFind(key,".");if(dot<2||StringSubstr(key,0,1)!="m")return false;string idx=StringSubstr(key,1,dot-1);int n=(int)StringToInteger(idx);if(IntegerToString(n)!=idx||n<0||n>=12)return false;return Member(StringSubstr(key,dot+1),"kind|rule|period|fast|slow|signal|low|high|average|target");}
ENUM_TIMEFRAMES Timeframe(string tf){if(tf=="M1")return PERIOD_M1;if(tf=="M5")return PERIOD_M5;if(tf=="M15")return PERIOD_M15;if(tf=="H1")return PERIOD_H1;if(tf=="H4")return PERIOD_H4;if(tf=="D1")return PERIOD_D1;return PERIOD_CURRENT;}
bool Validate(){
 if(Value("format")!="easpaze-runtime"||Value("contract")!=CONTRACT||Value("engine")!=ENGINE)return false;
 if(StringLen(Value("revision"))!=8||Value("symbol")!=_Symbol||Timeframe(Value("timeframe"))!=_Period)return false;
 if(!Member(Value("direction"),"buy|sell|both")||!Member(Value("logic"),"all|any")||!Member(Value("stopMode"),"swing|fixed_pips"))return false;
 if(!Member(Value("trigger"),"immediate|next_bar_open|delay_seconds|price_move|break_signal_candle|pullback_to_ema|manual")||!Member(Value("moveDirection"),"favorable|adverse"))return false;
 if(!Numeric("count",1,12,true)||!Numeric("history",250,6200,true)||!Numeric("lot",.001,1000)||!Numeric("maxSpread",.01,1e7)||!Numeric("delay",1,86400,true)||!Numeric("move",.01,1e7)||!Numeric("buffer",0,1e7)||!Numeric("triggerEma",1,2000,true)||!Numeric("wait",1,1000,true)||!Numeric("sl",.01,1e7)||!Numeric("tp",.01,1e7)||!Numeric("lookback",1,2000,true)||!Numeric("swingBuffer",0,1e7)||!Numeric("rr",.01,100))return false;
 string rows[];int length=StringSplit(cfg,'\n',rows);string seen="|";
 for(int j=0;j<length;j++){if(rows[j]=="")continue;int eq=StringFind(rows[j],"=");if(eq<1)return false;string key=StringSubstr(rows[j],0,eq);if(!KnownKey(key)||StringFind(seen,"|"+key+"|")>=0)return false;seen+=key+"|";}
 for(int i=0;i<(int)Number("count");i++){
  string p="m"+IntegerToString(i)+".",kind=Value(p+"kind"),rule=Value(p+"rule");
  if(!Member(Value(p+"average"),"SMA|EMA")||!Member(Value(p+"target"),"moving_average|price_level"))return false;
  if(!Numeric(p+"period",1,2000,true)||!Numeric(p+"fast",1,2000,true)||!Numeric(p+"slow",1,2000,true)||!Numeric(p+"signal",1,2000,true)||!Numeric(p+"low",0,1e9)||!Numeric(p+"high",0,1e9))return false;
  if(kind=="ema"){if(!Member(rule,"with_direction|price_above|price_below|slope_with_direction"))return false;}
  else if(kind=="rsi"){if(!Member(rule,"recover_for_direction|cross_above_level|cross_below_level|above_level|below_level"))return false;}
  else if(kind=="stochastic"){if(!Member(rule,"cross_for_direction|extreme_for_direction|k_above_d|k_below_d"))return false;}
  else if(kind=="ma_cross"||kind=="price_cross"){if(!Member(rule,"cross_for_direction|cross_up|cross_down"))return false;if(kind=="ma_cross"&&Number(p+"fast")>=Number(p+"slow"))return false;}
  else return false;
  if((kind=="rsi"||kind=="stochastic")&&(Number(p+"low")>=Number(p+"high")||Number(p+"high")>100))return false;
 }
 return true;
}
bool AnyPosition(){for(int i=PositionsTotal()-1;i>=0;i--){ulong ticket=PositionGetTicket(i);if(ticket>0&&PositionGetString(POSITION_SYMBOL)==_Symbol)return true;}return false;}
void AcceptConfig(string text){
 StringReplace(text,"\r","");if(text==""||StringLen(text)>16000){synced=false;syncText="CONFIG EMPTY / TOO LARGE";return;}
 string old=cfg;cfg=text;
 if(!Validate()){cfg=old;synced=false;armed=false;syncText="CONFIG / VERSION / CHART MISMATCH";return;}
 string next=Value("revision");
 if(next!=revision&&AnyPosition()){queued=text;cfg=old;synced=false;armed=false;syncText="UPDATE WAITING · POSITION OPEN";return;}
 if(next!=revision){revision=next;armed=false;prevBuy=false;prevSell=false;lastBar=iTime(_Symbol,_Period,0);Print("EASpaze config accepted: ",revision," contract ",CONTRACT);}
 synced=true;syncText="SYNC OK · "+revision;lastSync=TimeLocal();
}
void Poll(){
 if(InpConfigUrl!=""&&!MQLInfoInteger(MQL_TESTER)){
  if(StringFind(InpConfigUrl,"https://")!=0){synced=false;syncText="HTTPS URL REQUIRED";return;}
  char data[],response[];string headers;ResetLastError();int code=WebRequest("GET",InpConfigUrl,"Accept: text/plain\r\n",5000,data,response,headers);
  if(code!=200){synced=false;armed=false;syncText="SYNC ERROR · HTTP "+IntegerToString(code);return;}
  AcceptConfig(CharArrayToString(response,0,WHOLE_ARRAY,CP_UTF8));
 }else{
  int file=FileOpen(InpConfigFile,FILE_READ|FILE_TXT|FILE_ANSI|FILE_COMMON,0,CP_UTF8);
  if(file==INVALID_HANDLE){synced=false;armed=false;syncText="CONFIG FILE NOT FOUND";return;}
  string text="";while(!FileIsEnding(file)){text+=FileReadString(file)+"\n";if(StringLen(text)>16000)break;}FileClose(file);AcceptConfig(text);
 }
 if(queued!=""&&!AnyPosition()){string text=queued;queued="";AcceptConfig(text);}
}
void Status(string text,color tint){
 string names[4]={"easpaze_title","easpaze_sync","easpaze_state","easpaze_mode"};
 string texts[4]={"EASpaze · EA "+ENGINE,syncText,text,InpEnableDemoOrders?"DEMO / TESTER ORDERS ENABLED":"MONITOR · ORDERS OFF"};
 for(int i=0;i<4;i++){if(ObjectFind(0,names[i])<0)ObjectCreate(0,names[i],OBJ_LABEL,0,0,0);ObjectSetInteger(0,names[i],OBJPROP_CORNER,CORNER_LEFT_UPPER);ObjectSetInteger(0,names[i],OBJPROP_XDISTANCE,14);ObjectSetInteger(0,names[i],OBJPROP_YDISTANCE,20+i*22);ObjectSetInteger(0,names[i],OBJPROP_FONTSIZE,i==0?11:9);ObjectSetInteger(0,names[i],OBJPROP_COLOR,i==1?(synced?clrMediumAquamarine:clrOrange):i==2?tint:clrSilver);ObjectSetString(0,names[i],OBJPROP_TEXT,texts[i]);}
 string button="easpaze_confirm";if(armed&&Value("trigger")=="manual"){if(ObjectFind(0,button)<0)ObjectCreate(0,button,OBJ_BUTTON,0,0,0);ObjectSetInteger(0,button,OBJPROP_XDISTANCE,14);ObjectSetInteger(0,button,OBJPROP_YDISTANCE,116);ObjectSetInteger(0,button,OBJPROP_XSIZE,130);ObjectSetInteger(0,button,OBJPROP_YSIZE,24);ObjectSetString(0,button,OBJPROP_TEXT,"Confirm Demo Entry");}else ObjectDelete(0,button);
}
void Enter(const MqlRates &bars[]){
 MqlTick tick;if(!SymbolInfoTick(_Symbol,tick))return;double point=SymbolInfoDouble(_Symbol,SYMBOL_POINT),entry=sideBuy?tick.ask:tick.bid,sign=sideBuy?1:-1;
 if((tick.ask-tick.bid)/point>Number("maxSpread")){stateText="WAIT · SPREAD LIMIT";return;}
 if(AnyPosition()){armed=false;stateText="POSITION EXISTS · WAIT";return;}
 double pip=InpPipSize>0?InpPipSize:(StringFind(_Symbol,"XAU")==0?.1:(_Digits==3||_Digits==5?10*point:point));
 double sl=entry-sign*Number("sl")*pip,tp=entry+sign*Number("tp")*pip;
 if(Value("stopMode")=="swing"){
  sl=signalSwing;tp=entry+sign*MathAbs(entry-sl)*Number("rr");
 }
 sl=NormalizeDouble(sl,_Digits);tp=NormalizeDouble(tp,_Digits);
 double minimum=SymbolInfoInteger(_Symbol,SYMBOL_TRADE_STOPS_LEVEL)*point;
 if(sign*(entry-sl)<=minimum||sign*(tp-entry)<=minimum){armed=false;stateText="REJECTED · SL / TP DISTANCE";return;}
 double lot=Number("lot"),step=SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_STEP);
 if(lot<SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MIN)||lot>SymbolInfoDouble(_Symbol,SYMBOL_VOLUME_MAX)||step<=0||MathAbs(lot/step-MathRound(lot/step))>1e-7){armed=false;stateText="REJECTED · BROKER LOT SIZE";return;}
 if(!InpEnableDemoOrders){armed=false;stateText="TRIGGER READY · MONITOR ONLY";Print("EASpaze simulated entry ",sideBuy?"BUY":"SELL"," config ",revision);return;}
 if(!MQLInfoInteger(MQL_TESTER)&&AccountInfoInteger(ACCOUNT_TRADE_MODE)!=ACCOUNT_TRADE_MODE_DEMO){armed=false;stateText="LIVE ORDERS DISABLED IN V0.1";return;}
 bool ok=sideBuy?trade.Buy(lot,_Symbol,0,sl,tp,"EASpaze "+revision):trade.Sell(lot,_Symbol,0,sl,tp,"EASpaze "+revision);
 uint ret=trade.ResultRetcode();armed=false;stateText=ok&&(ret==TRADE_RETCODE_DONE||ret==TRADE_RETCODE_PLACED||ret==TRADE_RETCODE_DONE_PARTIAL)?"POSITION ACTIVE":"ORDER REJECTED · "+IntegerToString((int)ret);
 if(!ok)Print("EASpaze order rejected: ",trade.ResultRetcodeDescription());
}
void OnTick(){
 if(!synced){Status("WAIT · SYNC REQUIRED",clrOrange);return;}
 if(!MQLInfoInteger(MQL_TESTER)&&TimeLocal()-lastSync>MathMax(45,InpPollSeconds*3)){armed=false;synced=false;syncText="SYNC STALE";Status("WAIT · SYNC REQUIRED",clrOrange);return;}
 if(AnyPosition()){Status("POSITION EXISTS · NO NEW ENTRY",clrDeepSkyBlue);return;}
 MqlRates bars[];ArraySetAsSeries(bars,false);int count=(int)Number("history");if(CopyRates(_Symbol,_Period,0,count,bars)!=count){Status("WAIT · PRICE HISTORY",clrOrange);return;}
 int closed=count-2;datetime current=bars[count-1].time;bool fresh=current!=lastBar;
 if(fresh){
  lastBar=current;int buys=0,sells=0;bool buy=Setup(bars,closed,true,buys)&&Value("direction")!="sell",sell=Setup(bars,closed,false,sells)&&Value("direction")!="buy";matched=MathMax(buys,sells);moduleTotal=(int)Number("count");
  if(armed&&!(sideBuy?buy:sell)){armed=false;stateText="SETUP INVALID · WAIT";}
  if(!armed&&((buy&&!prevBuy)||(sell&&!prevSell))){sideBuy=buy&&!prevBuy;armed=true;manualRequested=false;armedAt=current;reference=bars[closed].close;signalHigh=bars[closed].high;signalLow=bars[closed].low;signalSwing=sideBuy?signalLow:signalHigh;int begin=(int)MathMax(0,closed-(int)Number("lookback")+1);for(int j=begin;j<closed;j++)signalSwing=sideBuy?MathMin(signalSwing,bars[j].low):MathMax(signalSwing,bars[j].high);signalSwing-=(sideBuy?1:-1)*Number("swingBuffer")*SymbolInfoDouble(_Symbol,SYMBOL_POINT);stateText="SETUP READY · WAIT TRIGGER";}
  prevBuy=buy;prevSell=sell;
 }
 if(!armed){if(StringFind(stateText,"WAIT CONFIG")>=0||stateText=="SETUP INVALID · WAIT")stateText="WAIT SETUP";Status(stateText+" · "+IntegerToString(matched)+"/"+IntegerToString(moduleTotal),clrSilver);return;}
 if(TimeCurrent()-armedAt>=(int)Number("wait")*PeriodSeconds(_Period)){armed=false;Status("SIGNAL EXPIRED · WAIT",clrOrange);return;}
 string trigger=Value("trigger");MqlTick tick;if(!SymbolInfoTick(_Symbol,tick))return;double price=sideBuy?tick.ask:tick.bid,sign=sideBuy?1:-1,point=SymbolInfoDouble(_Symbol,SYMBOL_POINT);bool fire=false;
 if(trigger=="immediate"||trigger=="next_bar_open")fire=true;
 else if(trigger=="delay_seconds")fire=TimeCurrent()-armedAt>=Number("delay");
 else if(trigger=="price_move"){double target=reference+sign*(Value("moveDirection")=="adverse"?-1:1)*Number("move")*point;bool up=sideBuy!=(Value("moveDirection")=="adverse");fire=up?price>=target:price<=target;}
 else if(trigger=="break_signal_candle")fire=sideBuy?price>=signalHigh+Number("buffer")*point:price<=signalLow-Number("buffer")*point;
 else if(trigger=="pullback_to_ema"){double close[],out[];ArrayResize(close,count);for(int i=0;i<count;i++)close[i]=bars[i].close;MovingAverage(close,out,(int)Number("triggerEma"),true);double target=out[closed];fire=target!=EMPTY_VALUE&&MathAbs(price-target)<=MathMax(point,Number("buffer")*point);}
 else if(trigger=="manual")fire=manualRequested;
 if(fire)Enter(bars);Status(armed?"SETUP READY · WAIT TRIGGER":stateText,armed?clrKhaki:clrMediumAquamarine);
}
int OnInit(){if(InpPollSeconds<5||InpMagic==0||InpPipSize<0)return INIT_PARAMETERS_INCORRECT;trade.SetExpertMagicNumber(InpMagic);trade.SetDeviationInPoints(10);trade.SetTypeFillingBySymbol(_Symbol);Poll();if(!EventSetTimer(InpPollSeconds))return INIT_FAILED;Status("WAIT SETUP",clrSilver);return INIT_SUCCEEDED;}
void OnTimer(){Poll();Status(stateText,synced?clrMediumAquamarine:clrOrange);}
void OnChartEvent(const int id,const long &lparam,const double &dparam,const string &sparam){if(id==CHARTEVENT_OBJECT_CLICK&&sparam=="easpaze_confirm"&&armed){manualRequested=true;ObjectSetInteger(0,sparam,OBJPROP_STATE,false);}}
void OnDeinit(const int reason){EventKillTimer();ObjectsDeleteAll(0,"easpaze_");}
