
const $ = (id) => document.getElementById(id);

function showView(id){
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  $(id).classList.add("active");
}
document.querySelectorAll("[data-view]").forEach(btn=>btn.addEventListener("click",()=>showView(btn.dataset.view)));

// ===== Range =====
let direction = "sigToPv";
const favKey = "ctoolFavoritesV1";
const histKey = "ctoolHistoryV1";

function signalBounds(){
  return $("signalType").value === "4-20mA" ? {low:4, high:20, unit:"mA"} : {low:1, high:5, unit:"V"};
}
function getConfig(){
  return {signalType:$("signalType").value,low:parseFloat($("rangeLow").value),high:parseFloat($("rangeHigh").value),unit:$("unit").value.trim(),decimals:parseInt($("decimals").value,10)};
}
function validConfig(c){ return Number.isFinite(c.low)&&Number.isFinite(c.high)&&c.low!==c.high; }
function calculateRange(saveHistory=true){
  const c=getConfig(), x=parseFloat($("inputValue").value), r=signalBounds();
  $("inputUnit").textContent=direction==="sigToPv"?r.unit:(c.unit||"PV");
  $("inputValueLabel").textContent=direction==="sigToPv"?"入力信号":"実値";
  if(!validConfig(c)||!Number.isFinite(x)){ $("result").textContent="—"; $("warning").textContent="入力値を確認してください"; return; }
  let result, warning="";
  if(direction==="sigToPv"){
    result=c.low+((x-r.low)/(r.high-r.low))*(c.high-c.low);
    if(x<r.low) warning=`⚠ ${r.low}${r.unit} 未満（アンダーレンジ）`;
    if(x>r.high) warning=`⚠ ${r.high}${r.unit} 超（オーバーレンジ）`;
    $("result").textContent=`${result.toFixed(c.decimals)} ${c.unit}`.trim();
  }else{
    result=r.low+((x-c.low)/(c.high-c.low))*(r.high-r.low);
    if((c.high>c.low&&x<c.low)||(c.high<c.low&&x>c.low)) warning="⚠ レンジ下限外";
    if((c.high>c.low&&x>c.high)||(c.high<c.low&&x<c.high)) warning="⚠ レンジ上限外";
    $("result").textContent=`${result.toFixed(c.decimals)} ${r.unit}`;
  }
  $("warning").textContent=warning;
  if(saveHistory) pushHistory(c);
}
function setDirection(dir){
  direction=dir;$("sigToPvBtn").classList.toggle("active",dir==="sigToPv");$("pvToSigBtn").classList.toggle("active",dir==="pvToSig");calculateRange(false);
}
$("sigToPvBtn").onclick=()=>setDirection("sigToPv"); $("pvToSigBtn").onclick=()=>setDirection("pvToSig");
["signalType","rangeLow","rangeHigh","unit","inputValue","decimals"].forEach(id=>{
  $(id).addEventListener("input",()=>calculateRange(false)); $(id).addEventListener("change",()=>calculateRange(true));
});
function load(key){ try{return JSON.parse(localStorage.getItem(key)||"[]")}catch{return []} }
function save(key,data){ localStorage.setItem(key,JSON.stringify(data)) }
function configId(c){ return [c.signalType,c.low,c.high,c.unit,c.decimals].join("|") }
function pushHistory(c){
  if(!validConfig(c)) return;
  let arr=load(histKey).filter(x=>configId(x)!==configId(c)); arr.unshift({...c,ts:Date.now()}); arr=arr.slice(0,5); save(histKey,arr); renderHistory();
}
function applyConfig(c){
  $("signalType").value=c.signalType;$("rangeLow").value=c.low;$("rangeHigh").value=c.high;$("unit").value=c.unit;$("decimals").value=String(c.decimals??1);calculateRange(true);
}
function renderList(containerId,arr,favorite=false){
  const box=$(containerId); box.innerHTML="";
  if(!arr.length){ box.className="list empty"; box.textContent=favorite?"まだ登録されていません":"履歴はありません"; return; }
  box.className="list";
  arr.forEach((c,i)=>{
    const item=document.createElement("div");item.className="item";
    const main=document.createElement("div");main.className="item-main";
    const title=document.createElement("div");title.className="item-title";title.textContent=c.name||`${c.low} ～ ${c.high} ${c.unit}`;
    const sub=document.createElement("div");sub.className="item-sub";sub.textContent=`${c.signalType} / ${c.low} ～ ${c.high} ${c.unit}`;
    main.append(title,sub);
    const actions=document.createElement("div");actions.className="item-actions";
    const use=document.createElement("button");use.textContent="呼出";use.onclick=()=>applyConfig(c);actions.append(use);
    if(favorite){const del=document.createElement("button");del.textContent="削除";del.onclick=()=>{const a=load(favKey);a.splice(i,1);save(favKey,a);renderFavorites();};actions.append(del);}
    item.append(main,actions);box.append(item);
  });
}
function renderFavorites(){renderList("favoritesList",load(favKey),true)}
function renderHistory(){renderList("historyList",load(histKey),false)}
$("favoriteBtn").onclick=()=>{
  const c=getConfig(); if(!validConfig(c)) return alert("レンジ設定を確認してください");
  const suggested=`${c.low}～${c.high}${c.unit}`; const name=prompt("お気に入り名を入力してください",suggested); if(name===null)return;
  const arr=load(favKey);arr.push({...c,name:name.trim()||suggested});save(favKey,arr);renderFavorites();
};
$("clearHistoryBtn").onclick=()=>{if(confirm("最近使ったレンジの履歴を削除しますか？")){save(histKey,[]);renderHistory();}};

// ===== Heat =====
function calculateHeat(){
  const flow=parseFloat($("heatFlow").value), t1=parseFloat($("heatT1").value), t2=parseFloat($("heatT2").value);
  if(![flow,t1,t2].every(Number.isFinite)){ $("heatResult").textContent="—"; $("heatSub").textContent="入力値を確認してください"; return; }
  let dt=t2-t1; if($("heatMode").value==="abs") dt=Math.abs(dt);
  const kw=1.163*flow*dt;
  const out=$("heatOutput").value;
  let val=kw, unit="kW";
  if(out==="MJh"){val=kw*3.6;unit="MJ/h";}
  else if(out==="GJh"){val=kw*0.0036;unit="GJ/h";}
  else if(out==="kcalh"){val=kw*860;unit="kcal/h";}
  const digits=Math.abs(val)>=1000?0:Math.abs(val)>=100?1:2;
  $("heatResult").textContent=`${val.toFixed(digits)} ${unit}`;
  $("heatSub").textContent=`ΔT = ${dt.toFixed(1)} ℃`;
}
["heatFlow","heatT1","heatT2","heatMode","heatOutput"].forEach(id=>{$(id).addEventListener("input",calculateHeat);$(id).addEventListener("change",calculateHeat);});

// ===== Dew point =====
function calculateDew(){
  const T=parseFloat($("dewTemp").value), RH=parseFloat($("dewRh").value), surface=parseFloat($("surfaceTemp").value);
  if(!Number.isFinite(T)||!Number.isFinite(RH)||RH<=0||RH>100){$("dewResult").textContent="—";$("dewWarning").textContent="湿度は0超～100%で入力してください";return;}
  const a=17.62,b=243.12;
  const gamma=Math.log(RH/100)+(a*T)/(b+T);
  const td=(b*gamma)/(a-gamma);
  $("dewResult").textContent=`${td.toFixed(1)} ℃`;
  if(Number.isFinite(surface)){
    const margin=surface-td;
    $("dewWarning").textContent=margin<=0?`⚠ 結露リスクあり（露点より ${Math.abs(margin).toFixed(1)}℃ 低い）`:`露点マージン +${margin.toFixed(1)}℃`;
  }else $("dewWarning").textContent="";
}
["dewTemp","dewRh","surfaceTemp"].forEach(id=>$(id).addEventListener("input",calculateDew));

// ===== P action check =====
let pidBias = 50;

function setPidBias(value){
  pidBias = value;
  $("pidBias0").classList.toggle("active", value===0);
  $("pidBias50").classList.toggle("active", value===50);
  calcPAction();
}
$("pidBias0").onclick=()=>setPidBias(0);
$("pidBias50").onclick=()=>setPidBias(50);

function getPidKp(){
  const mode=$("pidPMode").value;
  const p=parseFloat($("pidPValue").value);
  if(!Number.isFinite(p) || p<=0) return {kp:NaN,pb:NaN};
  return mode==="kp" ? {kp:p,pb:100/p} : {kp:100/p,pb:p};
}

function pOutputForPv(pv, sp, low, high, kp, direction, bias){
  const span=high-low;
  const errorPct=(sp-pv)/span*100;
  const sign=direction==="heat" ? 1 : -1;
  const raw=bias + sign*kp*errorPct;
  const clamped=Math.max(0,Math.min(100,raw));
  return {errorPct,raw,clamped};
}

function mapPctToRange(pct, low, high){
  return low + (pct/100)*(high-low);
}

function calcPAction(){
  const sp=parseFloat($("pidSp").value);
  const pv=parseFloat($("pidPv").value);
  const inLow=parseFloat($("pidInLow").value);
  const inHigh=parseFloat($("pidInHigh").value);
  const outLow=parseFloat($("pidOutLow").value);
  const outHigh=parseFloat($("pidOutHigh").value);
  const unit=$("pidOutUnit").value.trim();
  const direction=$("pidDirection").value;
  const {kp,pb}=getPidKp();

  const valid=[sp,pv,inLow,inHigh,outLow,outHigh,kp].every(Number.isFinite) && inHigh!==inLow && outHigh!==outLow && kp>0;
  if(!valid){
    $("pidOutputPct").textContent="—";
    $("pidOutputMapped").textContent="入力値を確認してください";
    $("pidDetail").textContent="入力レンジは上下限を異なる値にし、P設定は0より大きくしてください。";
    $("pidPConverted").textContent="—";
    $("pidTableBody").innerHTML="";
    return;
  }

  $("pidPConverted").textContent=$("pidPMode").value==="kp" ? `PB = ${pb.toFixed(2)} %` : `Kp = ${kp.toFixed(3)}`;

  const now=pOutputForPv(pv,sp,inLow,inHigh,kp,direction,pidBias);
  const mapped=mapPctToRange(now.clamped,outLow,outHigh);
  const suffix=unit?` ${unit}`:"";
  const errEng=sp-pv;
  const sat=now.raw<0?" / 0%で下限制限":now.raw>100?" / 100%で上限制限":"";
  $("pidOutputPct").textContent=`${now.clamped.toFixed(1)} %`;
  $("pidOutputMapped").textContent=`出力レンジ換算：${mapped.toFixed(3)}${suffix}`;
  $("pidDetail").textContent=`偏差 ${errEng>=0?"+":""}${errEng.toFixed(3)}（${now.errorPct>=0?"+":""}${now.errorPct.toFixed(2)}%） / 演算前 ${now.raw.toFixed(1)}%${sat}`;

  const rows=[0,25,50,75,100].map(pos=>{
    const rowPv=inLow+(pos/100)*(inHigh-inLow);
    const r=pOutputForPv(rowPv,sp,inLow,inHigh,kp,direction,pidBias);
    const rowMapped=mapPctToRange(r.clamped,outLow,outHigh);
    const satMark=(r.raw<0||r.raw>100)?" *":"";
    return `<tr><td>${pos}%</td><td>${rowPv.toFixed(3)}</td><td>${r.clamped.toFixed(1)}%${satMark}</td><td>${rowMapped.toFixed(3)}${suffix}</td></tr>`;
  }).join("");
  $("pidTableBody").innerHTML=rows;
}

["pidSp","pidPv","pidInLow","pidInHigh","pidPValue","pidOutLow","pidOutHigh","pidOutUnit"].forEach(id=>$(id).addEventListener("input",calcPAction));
["pidPMode","pidDirection"].forEach(id=>$(id).addEventListener("change",calcPAction));

// ===== Unit conversion =====
const unitDefs = {
  pressure: {
    units: ["kPa","MPa","Pa","bar","kgf/cm²","psi"],
    toBase: {
      "Pa": v=>v, "kPa": v=>v*1000, "MPa": v=>v*1e6, "bar": v=>v*100000,
      "kgf/cm²": v=>v*98066.5, "psi": v=>v*6894.757293
    },
    fromBase: {
      "Pa": v=>v, "kPa": v=>v/1000, "MPa": v=>v/1e6, "bar": v=>v/100000,
      "kgf/cm²": v=>v/98066.5, "psi": v=>v/6894.757293
    }
  },
  temperature: {
    units: ["℃","℉","K"]
  },
  flow: {
    units: ["m³/h","L/min","L/s","m³/min"],
    toBase: {
      "m³/h": v=>v, "L/min": v=>v*0.06, "L/s": v=>v*3.6, "m³/min": v=>v*60
    },
    fromBase: {
      "m³/h": v=>v, "L/min": v=>v/0.06, "L/s": v=>v/3.6, "m³/min": v=>v/60
    }
  }
};
function populateUnitSelects(){
  const cat=$("unitCategory").value, def=unitDefs[cat], from=$("unitFrom"), to=$("unitTo");
  const prevFrom=from.value, prevTo=to.value;
  from.innerHTML="";to.innerHTML="";
  def.units.forEach(u=>{ const o=document.createElement("option");o.value=u;o.textContent=u;from.append(o); });
  def.units.forEach(u=>{ const o=document.createElement("option");o.value=u;o.textContent=u;to.append(o); });
  if(def.units.includes(prevFrom)) from.value=prevFrom;
  if(def.units.includes(prevTo)) to.value=prevTo;
  if(from.value===to.value && def.units.length>1) to.value=def.units[1];
  calcUnit();
}
function tempToC(v,u){ if(u==="℃")return v;if(u==="℉")return (v-32)*5/9;return v-273.15; }
function cToTemp(v,u){ if(u==="℃")return v;if(u==="℉")return v*9/5+32;return v+273.15; }
function calcUnit(){
  const cat=$("unitCategory").value, from=$("unitFrom").value, to=$("unitTo").value, v=parseFloat($("unitValue").value);
  if(!Number.isFinite(v)){ $("unitResult").textContent="—"; $("unitFormula").textContent="入力値を確認してください"; return; }
  let out;
  if(cat==="temperature") out=cToTemp(tempToC(v,from),to);
  else out=unitDefs[cat].fromBase[to](unitDefs[cat].toBase[from](v));
  const digits=Math.abs(out)>=1000?2:Math.abs(out)>=1?4:6;
  $("unitResult").textContent=`${Number(out.toFixed(digits))} ${to}`;
  $("unitFormula").textContent=`${v} ${from} → ${to}`;
}
$("unitCategory").addEventListener("change",populateUnitSelects);
["unitFrom","unitTo","unitValue"].forEach(id=>{$(id).addEventListener("input",calcUnit);$(id).addEventListener("change",calcUnit);});

// ===== Signal quick reference =====
function calcSignalQuick(){
  const p=parseFloat($("signalPercent").value);
  if(!Number.isFinite(p)){ $("quickMa").textContent="—"; $("quickV").textContent="—"; return; }
  const ma=4+16*(p/100), v=1+4*(p/100);
  $("quickMa").textContent=`${ma.toFixed(2)} mA`;
  $("quickV").textContent=`${v.toFixed(2)} V`;
}
$("signalPercent").addEventListener("input",calcSignalQuick);

// ===== Number conversion =====
function calcNum(){
  const base=parseInt($("numBase").value,10);
  const raw=$("numInput").value.trim().replace(/\s+/g,"");
  let n;
  if(base===10){
    if(!/^-?\d+$/.test(raw)){ invalidNum(); return; }
    n=parseInt(raw,10);
  } else if(base===16){
    if(!/^[0-9a-fA-F]+$/.test(raw)){ invalidNum(); return; }
    n=parseInt(raw,16);
  } else {
    if(!/^[01]+$/.test(raw)){ invalidNum(); return; }
    n=parseInt(raw,2);
  }
  if(!Number.isSafeInteger(n)){ invalidNum(); return; }
  $("outDec").textContent=String(n);
  $("outHex").textContent=(n<0 ? (n>>>0).toString(16) : n.toString(16)).toUpperCase();
  $("outBin").textContent=(n<0 ? (n>>>0).toString(2) : n.toString(2));
  const u16=((n%65536)+65536)%65536;
  $("out16").textContent=u16.toString(2).padStart(16,"0").match(/.{1,4}/g).join(" ");
  const signed16=u16>=32768?u16-65536:u16;
  $("signedInfo").textContent=`Unsigned: ${u16}　Signed: ${signed16}`;
}
function invalidNum(){
  $("outDec").textContent="—";$("outHex").textContent="—";$("outBin").textContent="—";$("out16").textContent="—";$("signedInfo").textContent="入力形式を確認してください";
}
["numBase","numInput"].forEach(id=>{$(id).addEventListener("input",calcNum);$(id).addEventListener("change",calcNum);});


// ===== Pt100 =====
let ptMode="tempToR";
const A=3.9083e-3, B=-5.775e-7, C=-4.183e-12;
function ptResistance(t){
  if(t>=0) return 100*(1+A*t+B*t*t);
  return 100*(1+A*t+B*t*t+C*(t-100)*t*t*t);
}
function ptTempFromR(r){
  let lo=-200, hi=850;
  for(let i=0;i<80;i++){ const mid=(lo+hi)/2; if(ptResistance(mid)<r) lo=mid; else hi=mid; }
  return (lo+hi)/2;
}
function calcPt(){
  const x=parseFloat($("ptInput").value);
  if(!Number.isFinite(x)){ $("ptResult").textContent="—"; $("ptNote").textContent="入力値を確認してください"; return; }
  if(ptMode==="tempToR"){
    const r=ptResistance(x);
    $("ptResult").textContent=`${r.toFixed(3)} Ω`;
    $("ptNote").textContent=(x<-200||x>850)?"⚠ 規格範囲外":"";
  } else {
    const t=ptTempFromR(x);
    $("ptResult").textContent=`${t.toFixed(2)} ℃`;
    $("ptNote").textContent=(x<18.52||x>390.48)?"⚠ Pt100標準範囲外の抵抗値":"";
  }
}
function setPtMode(mode){
  ptMode=mode;
  $("ptTempToRBtn").classList.toggle("active",mode==="tempToR");
  $("ptRToTempBtn").classList.toggle("active",mode==="rToTemp");
  $("ptInputLabel").textContent=mode==="tempToR"?"温度":"抵抗値";
  $("ptInputUnit").textContent=mode==="tempToR"?"℃":"Ω";
  $("ptInput").value=mode==="tempToR"?"0":"100";
  calcPt();
}
$("ptTempToRBtn").onclick=()=>setPtMode("tempToR");
$("ptRToTempBtn").onclick=()=>setPtMode("rToTemp");
$("ptInput").addEventListener("input",calcPt);

// ===== Modbus =====
function modbusBase(){
  const t=$("modbusType").value;
  return t==="4"?40001:t==="3"?30001:t==="1"?10001:1;
}
function calcModbus(){
  const base=modbusBase(), ref=parseInt($("modbusRef").value,10), off=parseInt($("modbusOffsetInput").value,10);
  if(Number.isInteger(ref)){
    const offset=ref-base;
    $("modbusOffset").textContent=String(offset);
    $("modbusHex").textContent=offset>=0?`HEX: ${offset.toString(16).toUpperCase().padStart(4,"0")}`:"範囲を確認";
  } else { $("modbusOffset").textContent="—"; $("modbusHex").textContent=""; }
  if(Number.isInteger(off)&&off>=0){
    $("modbusRefBack").textContent=String(base+off);
    $("modbusOffsetHex").textContent=off.toString(16).toUpperCase().padStart(4,"0");
  } else { $("modbusRefBack").textContent="—"; $("modbusOffsetHex").textContent="—"; }
}
["modbusType","modbusRef","modbusOffsetInput"].forEach(id=>{$(id).addEventListener("input",calcModbus);$(id).addEventListener("change",calcModbus);});

// ===== PLC Timer =====
function humanTime(sec){
  const sign=sec<0?"-":"";
  sec=Math.abs(sec);
  const min=Math.floor(sec/60), s=sec-min*60;
  return `${sign}${min}分 ${s.toFixed(3)}秒`;
}
function calcTimer(){
  const base=parseFloat($("timerBase").value), count=parseFloat($("timerCount").value), sec=parseFloat($("timerSeconds").value);
  if(Number.isFinite(count)){
    const total=count*base;
    $("timerTime").textContent=`${total.toFixed(3)} s`;
    $("timerHuman").textContent=humanTime(total);
  }
  if(Number.isFinite(sec)){
    const raw=sec/base, rounded=Math.round(raw), actual=rounded*base;
    $("timerCountBack").textContent=String(rounded);
    $("timerError").textContent=`${(actual-sec).toFixed(3)} s`;
  }
}
["timerBase","timerCount","timerSeconds"].forEach(id=>{$(id).addEventListener("input",calcTimer);$(id).addEventListener("change",calcTimer);});

// ===== Frequency / RPM =====
function calcFreq(){
  const hz=parseFloat($("freqHz").value), poles=parseFloat($("freqPoles").value), actual=parseFloat($("actualRpm").value);
  if(!Number.isFinite(hz)||!Number.isFinite(poles)||poles<=0){$("syncRpm").textContent="—";return;}
  const sync=120*hz/poles;
  $("syncRpm").textContent=`${sync.toFixed(sync%1?1:0)} rpm`;
  if(Number.isFinite(actual)){
    const slipR=sync-actual, slipP=sync===0?0:(slipR/sync)*100;
    $("slipPercent").textContent=`${slipP.toFixed(2)} %`;
    $("slipRpm").textContent=`${slipR.toFixed(1)} rpm`;
  } else {
    $("slipPercent").textContent="—"; $("slipRpm").textContent="—";
  }
}
["freqHz","freqPoles","actualRpm"].forEach(id=>{$(id).addEventListener("input",calcFreq);$(id).addEventListener("change",calcFreq);});

// ===== Initial render =====
renderFavorites();
renderHistory();
calculateRange(false);
calculateHeat();
calculateDew();
calcPAction();
populateUnitSelects();
calcSignalQuick();
calcNum();
calcPt();
calcModbus();
calcTimer();
calcFreq();

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("service-worker.js"));
}
