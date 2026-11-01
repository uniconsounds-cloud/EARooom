// Rule contract 1.0.0. Same seed/smoothing/cross definitions as web/lib/strategy/evaluator.ts.
string Value(string key){string search="\n"+key+"=";int p=StringFind("\n"+cfg,search);if(p<0)return "";p+=StringLen(search);string src="\n"+cfg;int end=StringFind(src,"\n",p);if(end<0)end=StringLen(src);return StringSubstr(src,p,end-p);}
double Number(string key){return StringToDouble(Value(key));}
void MovingAverage(const double &samples[],double &output[],int n,bool exponential){
 int len=ArraySize(samples);ArrayResize(output,len);ArrayInitialize(output,EMPTY_VALUE);double sum=0,current=EMPTY_VALUE;int valid=0;
 for(int i=0;i<len;i++){
  if(samples[i]!=EMPTY_VALUE){sum+=samples[i];valid++;}
  if(!exponential){if(i>=n&&samples[i-n]!=EMPTY_VALUE){sum-=samples[i-n];valid--;}if(i>=n-1&&valid==n)output[i]=sum/n;}
  else if(i>=n-1){current=current==EMPTY_VALUE?sum/n:samples[i]*2/(n+1)+current*(1-2.0/(n+1));output[i]=current;}
 }
}
bool Cross(double a0,double a1,double b0,double b1,bool buy){if(a0==EMPTY_VALUE||a1==EMPTY_VALUE||b0==EMPTY_VALUE||b1==EMPTY_VALUE)return false;return buy?(a0<=b0&&a1>b1):(a0>=b0&&a1<b1);}
bool ZoneThenCross(const double &a[],const double &b[],int i,bool buy,double low,double high,int wait){
 if(i<1||!Cross(a[i-1],a[i],b[i-1],b[i],buy))return false;
 for(int j=i-1;j>=MathMax(0,i-wait);j--){double k=a[j];if(k==EMPTY_VALUE||(buy?k>low:k<high))return false;if(buy?k<low:k>high)return true;}
 return false;
}
bool Module(const MqlRates &bars[],int i,int module,bool buy){
 string prefix="m"+IntegerToString(module)+".",kind=Value(prefix+"kind"),rule=Value(prefix+"rule");int n=(int)Number(prefix+"period"),size=ArraySize(bars);
 double close[];ArrayResize(close,size);for(int j=0;j<size;j++)close[j]=bars[j].close;
 double a[],b[];ArrayResize(a,size);ArrayResize(b,size);ArrayInitialize(a,EMPTY_VALUE);ArrayInitialize(b,EMPTY_VALUE);
 if(kind=="ema")MovingAverage(close,a,n,true);
 else if(kind=="ma_cross"){MovingAverage(close,a,(int)Number(prefix+"fast"),Value(prefix+"average")=="EMA");MovingAverage(close,b,(int)Number(prefix+"slow"),Value(prefix+"average")=="EMA");}
 else if(kind=="price_cross"){if(Value(prefix+"target")=="price_level")ArrayInitialize(a,Number(prefix+"low"));else MovingAverage(close,a,n,Value(prefix+"average")=="EMA");}
 else if(kind=="rsi"){
  double gain=0,loss=0;
  for(int j=1;j<size;j++){double delta=close[j]-close[j-1],g=MathMax(0,delta),l=MathMax(0,-delta);if(j<=n){gain+=g;loss+=l;if(j<n)continue;gain/=n;loss/=n;}else{gain=(gain*(n-1)+g)/n;loss=(loss*(n-1)+l)/n;}a[j]=loss==0?(gain==0?50:100):100-100/(1+gain/loss);}
 }else if(kind=="stochastic"){
  double raw[],slow[];ArrayResize(raw,size);ArrayInitialize(raw,EMPTY_VALUE);
  for(int j=n-1;j<size;j++){double low=bars[j].low,high=bars[j].high;for(int k=j-n+1;k<j;k++){low=MathMin(low,bars[k].low);high=MathMax(high,bars[k].high);}raw[j]=high==low?50:100*(close[j]-low)/(high-low);}
  MovingAverage(raw,slow,(int)Number(prefix+"slow"),false);ArrayCopy(a,slow);MovingAverage(a,b,(int)Number(prefix+"signal"),false);
 }
 if(i<1||a[i]==EMPTY_VALUE)return false;double v=a[i],previous=a[i-1],low=Number(prefix+"low"),high=Number(prefix+"high");
 if(kind=="ema"){if(rule=="price_above")return close[i]>v;if(rule=="price_below")return close[i]<v;if(rule=="slope_with_direction")return previous!=EMPTY_VALUE&&(buy?v>previous:v<previous);return buy?close[i]>v:close[i]<v;}
 bool direction=rule=="cross_up"?true:rule=="cross_down"?false:buy;
 if(kind=="ma_cross")return Cross(previous,v,b[i-1],b[i],direction);
 if(kind=="price_cross")return Cross(close[i-1],close[i],previous,v,direction);
 if(kind=="stochastic"){if(rule=="zone_then_cross")return ZoneThenCross(a,b,i,buy,low,high,(int)Number(prefix+"zoneWait"));if(rule=="k_above_d")return b[i]!=EMPTY_VALUE&&v>b[i];if(rule=="k_below_d")return b[i]!=EMPTY_VALUE&&v<b[i];if(rule=="extreme_for_direction")return buy?v<=low:v>=high;return Cross(previous,v,b[i-1],b[i],buy);}
 if(rule=="above_level")return v>low;if(rule=="below_level")return v<high;if(rule=="cross_above_level")return Cross(previous,v,low,low,true);if(rule=="cross_below_level")return Cross(previous,v,high,high,false);return buy?Cross(previous,v,low,low,true):Cross(previous,v,high,high,false);
}
bool Setup(const MqlRates &bars[],int index,bool buy,int &count){count=0;int n=(int)Number("count");for(int i=0;i<n;i++)if(Module(bars,index,i,buy))count++;return Value("logic")=="all"?count==n:count>0;}
