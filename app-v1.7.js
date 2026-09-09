
const $ = (id) => document.getElementById(id);

const APP_VERSION = "1.7";
const APP_BUILD = "plc-word-bit-hex-source-dest";
let updateReloadPending = false;

function setUpdateUi(message, state="idle"){
  const status=$("updateStatus"), btn=$("checkUpdateBtn");
  if(status) status.textContent=message;
  if(!btn) return;

  btn.classList.toggle("is-current", state==="current");
  btn.classList.toggle("is-updating", state==="updating");
  btn.disabled=state==="updating";

  const icon=btn.querySelector(".update-icon");
  if(icon) icon.textContent="↻";

  const label=btn.querySelector(".update-label");
  if(label) label.textContent="更新";

  const aria =
    state==="updating" ? "更新中" :
    state==="current" ? "最新版です" :
    "最新版を確認";
  btn.setAttribute("aria-label",aria);
  btn.title=aria;
}

async function fetchRemoteVersion(){
  const res=await fetch(`version.json?t=${Date.now()}`,{
    cache:"no-store",
    headers:{"Cache-Control":"no-cache"}
  });
  if(!res.ok) throw new Error(`version.json HTTP ${res.status}`);
  return await res.json();
}

async function unregisterAllServiceWorkers(){
  if(!("serviceWorker" in navigator)) return;
  const regs=await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map(reg=>reg.unregister()));
}

// USER DATA SAFETY:
 // App updates may delete only Cache Storage / Service Worker registrations.
 // Never clear localStorage here: range favorites and future user settings live there.
async function clearAllAppCaches(){
  if(!("caches" in window)) return;
  const keys=await caches.keys();
  await Promise.all(keys.map(key=>caches.delete(key)));
}

async function hardReloadFromNetwork(remoteVersion){
  // iOSホーム画面PWA対策:
  // 古いService WorkerとCache Storageを一旦捨てて、
  // キャッシュバスター付きURLでネットワークからindex.htmlを取り直す。
  sessionStorage.setItem("ctoolUpdateDone",remoteVersion || "latest");

  await unregisterAllServiceWorkers();
  await clearAllAppCaches();

  const url=new URL(window.location.href);
  url.searchParams.set("update",remoteVersion || "latest");
  url.searchParams.set("t",Date.now().toString());

  // replace にして戻る履歴へ古いURLを残さない
  window.location.replace(url.toString());
}

async function checkForAppUpdate(){
  if(location.protocol==="file:"){
    setUpdateUi("単体HTMLでは更新確認を使用しません");
    return;
  }

  if(!navigator.onLine){
    setUpdateUi("オフラインのため更新確認できません");
    return;
  }

  setUpdateUi("最新版を確認しています…","updating");

  try{
    const remote=await fetchRemoteVersion();
    const remoteVersion=String(remote.version || "");

    if(!remoteVersion){
      throw new Error("version missing");
    }

    if(remoteVersion===APP_VERSION && remote.build===APP_BUILD){
      setUpdateUi(`v${APP_VERSION} が最新版です`,"current");
      setTimeout(()=>setUpdateUi(""),2200);
      return;
    }

    setUpdateUi(`v${remoteVersion} へ更新しています…`,"updating");
    await hardReloadFromNetwork(remoteVersion);

  }catch(err){
    console.error("C-TOOL update failed",err);
    setUpdateUi("更新に失敗しました。通信を確認して再度押してください");
  }
}

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
  if(out==="MJh"){val=kw*1.0;unit="MJ/h";}
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
// General P calculation:
// MV[%] = Bias[%] + direction * Kp * error[%]
// Kp = 100 / PB
// Final MV is limited to 0..100%.
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
  const pTerm=sign*kp*errorPct;
  const raw=bias+pTerm;
  const clamped=Math.max(0,Math.min(100,raw));
  return {errorPct,pTerm,raw,clamped};
}

function mapPctToRange(pct, low, high){
  return low + (pct/100)*(high-low);
}

function calcPAction(){
  const sp=parseFloat($("pidSp").value);
  const pv=parseFloat($("pidPv").value);
  const inLow=parseFloat($("pidInLow").value);
  const inHigh=parseFloat($("pidInHigh").value);
  const bias=parseFloat($("pidBias").value);
  const outLow=parseFloat($("pidOutLow").value);
  const outHigh=parseFloat($("pidOutHigh").value);
  const unit=$("pidOutUnit").value.trim();
  const direction=$("pidDirection").value;
  const {kp,pb}=getPidKp();

  const valid=[sp,pv,inLow,inHigh,bias,outLow,outHigh,kp].every(Number.isFinite)
    && inHigh>inLow
    && outHigh!==outLow
    && kp>0;

  if(!valid){
    $("pidOutputPct").textContent="—";
    $("pidOutputMapped").textContent="入力値を確認してください";
    $("pidDetail").textContent="入力レンジは上限＞下限、P設定は0より大きい値にしてください。";
    $("pidPConverted").textContent="—";
    $("pidTableBody").innerHTML="";
    return;
  }

  $("pidPConverted").textContent=$("pidPMode").value==="kp"
    ? `PB = ${pb.toFixed(2)} %`
    : `Kp = ${kp.toFixed(3)}`;

  const now=pOutputForPv(pv,sp,inLow,inHigh,kp,direction,bias);
  const mapped=mapPctToRange(now.clamped,outLow,outHigh);
  const suffix=unit?` ${unit}`:"";
  const errEng=sp-pv;
  const sat=now.raw<0
    ? " / 0%で下限制限"
    : now.raw>100
      ? " / 100%で上限制限"
      : "";

  $("pidOutputPct").textContent=`${now.clamped.toFixed(1)} %`;
  $("pidOutputMapped").textContent=`出力レンジ換算：${mapped.toFixed(3)}${suffix}`;
  $("pidDetail").textContent=
    `偏差 ${errEng>=0?"+":""}${errEng.toFixed(3)}`
    + `（${now.errorPct>=0?"+":""}${now.errorPct.toFixed(2)}%）`
    + ` / P項 ${now.pTerm>=0?"+":""}${now.pTerm.toFixed(1)}%`
    + ` / バイアス ${bias.toFixed(1)}%`
    + ` / 演算前 ${now.raw.toFixed(1)}%${sat}`;

  const rows=[0,25,50,75,100].map(pos=>{
    const rowPv=inLow+(pos/100)*(inHigh-inLow);
    const r=pOutputForPv(rowPv,sp,inLow,inHigh,kp,direction,bias);
    const rowMapped=mapPctToRange(r.clamped,outLow,outHigh);
    const satMark=(r.raw<0||r.raw>100)?" *":"";
    return `<tr><td>${pos}%</td><td>${rowPv.toFixed(3)}</td>`
      + `<td>${r.clamped.toFixed(1)}%${satMark}</td>`
      + `<td>${rowMapped.toFixed(3)}${suffix}</td></tr>`;
  }).join("");
  $("pidTableBody").innerHTML=rows;
}

["pidSp","pidPv","pidInLow","pidInHigh","pidPValue","pidBias","pidOutLow","pidOutHigh","pidOutUnit"]
  .forEach(id=>$(id).addEventListener("input",calcPAction));
["pidPMode","pidDirection"]
  .forEach(id=>$(id).addEventListener("change",calcPAction));

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
      "m³/h": v=>v, "L/min": v=>v*0.06, "L/s": v=>v*1.0, "m³/min": v=>v*60
    },
    fromBase: {
      "m³/h": v=>v, "L/min": v=>v/0.06, "L/s": v=>v/1.0, "m³/min": v=>v/60
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

// ===== PLC tools v1.7 =====
const PLC_DEVICE_BASES={X:16,Y:16,W:16,B:16,M:10,D:10,ZR:10};

// Devices whose address itself represents bits.
const PLC_BIT_DEVICES=new Set(["X","Y","M","B"]);
// Devices that can naturally be treated as 16-bit word + .bit.
const PLC_WORD_DEVICES=new Set(["D","ZR","W"]);

function plcDeviceBase(device){
  return PLC_DEVICE_BASES[device] || 10;
}

function plcDeviceAddress(device,raw,allowBit=true){
  const base=plcDeviceBase(device);
  const text=String(raw||"").trim().toUpperCase().replace(/\s+/g,"");

  // Optional .bit is accepted for all listed devices.
  // Address portion follows the device radix, while .bit is always HEX 0..F.
  const m=text.match(/^([0-9A-F]+)(?:\.([0-9A-F]))?$/);
  if(!m) return null;

  const digits=m[1];
  const bitText=m[2];

  if(base===16){
    if(!/^[0-9A-F]+$/.test(digits)) return null;
  }else{
    if(!/^[0-9]+$/.test(digits)) return null;
  }

  const value=parseInt(digits,base);
  const bit=bitText===undefined ? null : parseInt(bitText,16);

  if(!Number.isSafeInteger(value)) return null;
  if(bit!==null && (bit<0 || bit>15)) return null;
  if(!allowBit && bit!==null) return null;

  return {device,base,value,bit};
}

function plcFormat(device,value){
  if(!Number.isSafeInteger(value) || value<0) return null;
  return device + value.toString(plcDeviceBase(device)).toUpperCase();
}

function plcFormatWithOptionalBit(device,value,bit){
  const a=plcFormat(device,value);
  if(a===null) return null;
  return bit===null ? a : a+"."+bit.toString(16).toUpperCase();
}

// Convert a device address to an absolute "point index".
// - Bit device without .bit: one address step = one point.
// - Any device with .bit: one address step = 16 points and .bit = 0..F.
// - Word device without .bit: treated as word boundary (bit 0) when used in bit mapping.
function plcPointIndex(addr, forceWordBit=false){
  const usesWordBit = forceWordBit || addr.bit!==null || PLC_WORD_DEVICES.has(addr.device);
  if(usesWordBit){
    return addr.value*16 + (addr.bit ?? 0);
  }
  return addr.value;
}

function formatFromPointIndex(device,pointIndex,preferBit){
  if(pointIndex<0 || !Number.isSafeInteger(pointIndex)) return null;

  const shouldUseBit = preferBit || PLC_WORD_DEVICES.has(device);
  if(shouldUseBit){
    const word=Math.floor(pointIndex/16);
    const bit=pointIndex%16;
    return plcFormatWithOptionalBit(device,word,bit);
  }
  return plcFormat(device,pointIndex);
}

function calcPlcAddress(){
  const mode=$("plcMapMode").value;

  const fromDev=$("plcBaseFromDevice").value;
  const toDev=$("plcBaseToDevice").value;
  const targetDev=$("plcTargetFromDevice").value;

  const baseFrom=plcDeviceAddress(fromDev,$("plcBaseFromNo").value,true);
  const targetFrom=plcDeviceAddress(targetDev,$("plcTargetFromNo").value,true);

  if(!baseFrom || !targetFrom){
    $("plcAddressResult").textContent="—";
    $("plcAddressDetail").textContent="変換元アドレスを確認してください。";
    return;
  }

  if(mode==="bitToWord"){
    const baseTo=plcDeviceAddress(toDev,$("plcBaseToNo").value,true);
    if(!baseTo){
      $("plcAddressResult").textContent="—";
      $("plcAddressDetail").textContent="変換先アドレスを確認してください。";
      return;
    }

    // Source offset is calculated in bit-points.
    // If source uses .bit (e.g. D100.A), its word address advances by 16 points.
    const sourceUsesBit = baseFrom.bit!==null || targetFrom.bit!==null || PLC_WORD_DEVICES.has(fromDev);
    const baseFromPoint=plcPointIndex(baseFrom,sourceUsesBit);
    const targetFromPoint=plcPointIndex(targetFrom,sourceUsesBit);
    const offset=targetFromPoint-baseFromPoint;

    // Destination is always evaluated as a word.bit coordinate in this mode.
    const baseToPoint=plcPointIndex(baseTo,true);
    const resultPoint=baseToPoint+offset;
    const result=formatFromPointIndex(toDev,resultPoint,true);

    $("plcAddressResult").textContent=result || "—";
    $("plcAddressDetail").textContent=result
      ? `${plcFormatWithOptionalBit(fromDev,baseFrom.value,baseFrom.bit)} → ${plcFormatWithOptionalBit(toDev,baseTo.value,baseTo.bit ?? 0)} / ${plcFormatWithOptionalBit(targetDev,targetFrom.value,targetFrom.bit)} は ${offset>=0?"+":""}${offset}点 → ${result}`
      : "変換結果が負アドレスです。";
    return;
  }

  // Linear mode:
  // If either side of the source uses .bit, calculate offset in bit-points.
  // Otherwise calculate normal address offset.
  const sourceUsesBit = baseFrom.bit!==null || targetFrom.bit!==null;
  let offset;
  if(sourceUsesBit){
    offset=plcPointIndex(targetFrom,true)-plcPointIndex(baseFrom,true);
  }else{
    offset=targetFrom.value-baseFrom.value;
  }

  const baseTo=plcDeviceAddress(toDev,$("plcBaseToNo").value,true);
  if(!baseTo){
    $("plcAddressResult").textContent="—";
    $("plcAddressDetail").textContent="変換先アドレスを確認してください。";
    return;
  }

  let result;
  if(sourceUsesBit || baseTo.bit!==null){
    const resultPoint=plcPointIndex(baseTo,true)+offset;
    result=formatFromPointIndex(toDev,resultPoint,true);
  }else{
    result=plcFormat(toDev,baseTo.value+offset);
  }

  $("plcAddressResult").textContent=result || "—";
  $("plcAddressDetail").textContent=result
    ? `${plcFormatWithOptionalBit(fromDev,baseFrom.value,baseFrom.bit)} → ${plcFormatWithOptionalBit(toDev,baseTo.value,baseTo.bit)} / ${plcFormatWithOptionalBit(targetDev,targetFrom.value,targetFrom.bit)} は ${offset>=0?"+":""}${offset}点 → ${result}`
    : "変換結果が負アドレスです。";
}

const PLC_DATA_TYPES={
  i16:{label:"16bit 符号あり整数（INT）",bits:16,words:1,kind:"signed"},
  u16:{label:"16bit 符号なし整数（UINT）",bits:16,words:1,kind:"unsigned"},
  i32:{label:"32bit 符号あり整数（DINT）",bits:32,words:2,kind:"signed"},
  u32:{label:"32bit 符号なし整数（UDINT）",bits:32,words:2,kind:"unsigned"},
  f32:{label:"単精度浮動小数点（REAL / FLOAT）",bits:32,words:2,kind:"float32"},
  i64:{label:"64bit 符号あり整数（LINT）",bits:64,words:4,kind:"signed"},
  u64:{label:"64bit 符号なし整数（ULINT）",bits:64,words:4,kind:"unsigned"},
  f64:{label:"倍精度浮動小数点（LREAL / DOUBLE）",bits:64,words:4,kind:"float64"}
};

function parseBigIntValue(text){
  const s=String(text||"").trim();
  if(!/^[+-]?(?:\d+|0[xX][0-9A-Fa-f]+)$/.test(s)) return null;
  try{return BigInt(s);}catch{return null;}
}
function packedValue(type,text){
  const def=PLC_DATA_TYPES[type];
  if(!def) return null;

  if(def.kind==="float32" || def.kind==="float64"){
    const n=Number(String(text||"").trim());
    if(!Number.isFinite(n)) return null;

    if(def.kind==="float32"){
      const buf=new ArrayBuffer(4);
      const dv=new DataView(buf);
      dv.setFloat32(0,n,false);
      return BigInt(dv.getUint32(0,false));
    }

    const buf=new ArrayBuffer(8);
    const dv=new DataView(buf);
    dv.setFloat64(0,n,false);
    return (BigInt(dv.getUint32(0,false))<<32n) | BigInt(dv.getUint32(4,false));
  }

  const n=parseBigIntValue(text);
  if(n===null) return null;

  const bits=BigInt(def.bits);
  const mod=1n<<bits;

  if(def.kind==="signed"){
    const min=-(1n<<(bits-1n));
    const max=(1n<<(bits-1n))-1n;
    if(n<min || n>max) return null;
    return n<0 ? mod+n : n;
  }

  if(n<0n || n>=mod) return null;
  return n;
}

function parseStorageAddress(raw){
  const text=String(raw||"").trim().toUpperCase().replace(/\s+/g,"");
  const m=text.match(/^([A-Z]+)([0-9A-F]+)$/);
  if(!m) return null;
  const device=m[1];
  const base=PLC_DEVICE_BASES[device] || 10;
  const digits=m[2];
  if(base===16 ? !/^[0-9A-F]+$/.test(digits) : !/^[0-9]+$/.test(digits)) return null;
  const value=parseInt(digits,base);
  return Number.isSafeInteger(value) ? {device,value} : null;
}

function calcDataAddressUsage(){
  const start=parseStorageAddress($("dataStartAddress").value);
  const type=$("dataTypeSize").value;
  const def=PLC_DATA_TYPES[type];

  if(!start || !def){
    $("dataAddressUsage").textContent="—";
    $("dataAddressDetail").textContent="開始アドレスまたはデータ型を確認してください。";
    $("dataPackedHex").textContent="—";
    $("dataPackedInfo").textContent="";
    $("dataWordRows").innerHTML="";
    $("dataOnBits").textContent="—";
    return;
  }

  const addresses=Array.from({length:def.words},(_,i)=>plcFormat(start.device,start.value+i));
  const next=plcFormat(start.device,start.value+def.words);

  $("dataAddressUsage").textContent=def.words===1
    ? addresses[0]
    : `${addresses[0]} ～ ${addresses[def.words-1]}`;
  $("dataAddressDetail").textContent=`${def.label} / ${def.words}ワード使用 / 次の空き ${next}`;

  const packed=packedValue(type,$("dataValue").value);
  if(packed===null){
    $("dataPackedHex").textContent="—";
    $("dataPackedInfo").textContent="値の形式または範囲を確認してください。";
    $("dataWordRows").innerHTML="";
    $("dataOnBits").textContent="—";
    return;
  }

  $("dataPackedHex").textContent="0x"+packed.toString(16).toUpperCase().padStart(def.bits/4,"0");
  $("dataPackedInfo").textContent=`${def.bits}bit / ${def.label}`;

  const lowFirstWords=Array.from(
    {length:def.words},
    (_,i)=>Number((packed>>BigInt(i*16))&0xFFFFn)
  );
  const words=$("dataWordOrder").value==="lowFirst"
    ? lowFirstWords
    : [...lowFirstWords].reverse();

  const allOn=[];
  $("dataWordRows").innerHTML=words.map((word,i)=>{
    const hex=word.toString(16).toUpperCase().padStart(4,"0");
    const bin=word.toString(2).padStart(16,"0").match(/.{4}/g).join(" ");
    const bits=[];
    for(let b=0;b<16;b++){
      if((word&(1<<b))!==0){
        bits.push(`${addresses[i]}.${b.toString(16).toUpperCase()}`);
      }
    }
    allOn.push(...bits);
    return `<tr><td>${addresses[i]}</td><td>${hex}</td><td class="mono-cell">${bin}</td><td>${bits.length?bits.join(", "):"—"}</td></tr>`;
  }).join("");

  $("dataOnBits").textContent=allOn.length?allOn.join(", "):"ONビットなし";
  $("dataBitNote").textContent=
    ($("dataWordOrder").value==="lowFirst"?"先頭アドレスに下位ワード":"先頭アドレスに上位ワード")
    +" / ビット番号 .0 ～ .F";
}

// iPhone/Safari: update on typing and on control changes.
["plcBaseFromNo","plcBaseToNo","plcTargetFromNo"].forEach(id=>{
  $(id).addEventListener("input",calcPlcAddress);
  $(id).addEventListener("change",calcPlcAddress);
});
["plcBaseFromDevice","plcBaseToDevice","plcTargetFromDevice","plcMapMode"].forEach(id=>{
  $(id).addEventListener("change",calcPlcAddress);
});
["dataStartAddress","dataValue"].forEach(id=>{
  $(id).addEventListener("input",calcDataAddressUsage);
  $(id).addEventListener("change",calcDataAddressUsage);
});
["dataTypeSize","dataWordOrder"].forEach(id=>{
  $(id).addEventListener("change",calcDataAddressUsage);
});

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

// ===== Time conversion =====
const TIME_TO_SEC={ms:0.001,s:1,min:60,h:3600,day:86400};
function smartNum(v, max=6){
  if(!Number.isFinite(v)) return "—";
  const a=Math.abs(v);
  if(a!==0 && (a>=1e9 || a<1e-6)) return v.toExponential(6).replace(/\.?0+e/,"e");
  return v.toLocaleString("ja-JP",{maximumFractionDigits:max});
}
function humanDuration(sec){
  if(!Number.isFinite(sec)) return "—";
  const sign=sec<0?"-":"";
  let ms=Math.round(Math.abs(sec)*1000);
  const day=Math.floor(ms/86400000); ms%=86400000;
  const h=Math.floor(ms/3600000); ms%=3600000;
  const min=Math.floor(ms/60000); ms%=60000;
  const s=Math.floor(ms/1000); ms%=1000;
  const parts=[];
  if(day) parts.push(`${day}日`);
  if(h) parts.push(`${h}時間`);
  if(min) parts.push(`${min}分`);
  if(s || (!day&&!h&&!min&&ms===0)) parts.push(`${s}秒`);
  if(ms) parts.push(`${ms}ms`);
  return sign+parts.join(" ");
}
function calcTime(){
  const value=parseFloat($("timeValue").value), unit=$("timeUnit").value;
  if(!Number.isFinite(value)){
    ["timeMainResult","timeHumanResult","timeMs","timeSec","timeMin","timeHour","timeDay"].forEach(id=>$(id).textContent="—");
    return;
  }
  const sec=value*TIME_TO_SEC[unit];
  $("timeMainResult").textContent=`${smartNum(sec,6)} 秒`;
  $("timeHumanResult").textContent=humanDuration(sec);
  $("timeMs").textContent=`${smartNum(sec*1000,6)} ms`;
  $("timeSec").textContent=`${smartNum(sec,6)} s`;
  $("timeMin").textContent=`${smartNum(sec/60,9)} min`;
  $("timeHour").textContent=`${smartNum(sec/3600,9)} h`;
  $("timeDay").textContent=`${smartNum(sec/86400,12)} day`;
}
["timeValue","timeUnit"].forEach(id=>{
  $(id).addEventListener("input",calcTime);
  $(id).addEventListener("change",calcTime);
});

// ===== Clock: device time always works, online correction is optional =====
let clockOffsetMs=0;
let clockMode="device";
let clockTimer=null;
let clockSyncBusy=false;

function formatClockDate(d){
  try{
    return new Intl.DateTimeFormat("ja-JP",{
      year:"numeric",month:"2-digit",day:"2-digit",weekday:"short"
    }).format(d);
  }catch{
    return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}`;
  }
}

function renderOnlineClock(){
  const clockEl=$("onlineClock");
  const dateEl=$("onlineDate");
  if(!clockEl || !dateEl) return;

  const d=new Date(Date.now()+clockOffsetMs);
  const hh=String(d.getHours()).padStart(2,"0");
  const mm=String(d.getMinutes()).padStart(2,"0");
  const ss=String(d.getSeconds()).padStart(2,"0");
  const ms=String(d.getMilliseconds()).padStart(3,"0");

  clockEl.textContent=`${hh}:${mm}:${ss}.${ms}`;
  dateEl.textContent=
    clockMode==="server"
      ? `${formatClockDate(d)}　オンライン補正中`
      : `${formatClockDate(d)}　端末時計`;
}

function startClockRenderer(){
  renderOnlineClock();
  if(clockTimer) clearInterval(clockTimer);
  clockTimer=setInterval(renderOnlineClock,50);
}

function sleep(ms){ return new Promise(resolve=>setTimeout(resolve,ms)); }

async function getServerClockSample(){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),1800);
  const t0=Date.now();
  const p0=performance.now();

  try{
    // GET is used instead of HEAD because iOS standalone PWAs can behave
    // inconsistently with HEAD requests. version.json is tiny and same-origin.
    const response=await fetch(`version.json?clock=${Date.now()}_${Math.random()}`,{
      method:"GET",
      cache:"no-store",
      headers:{"Cache-Control":"no-cache"},
      signal:controller.signal
    });

    const p1=performance.now();
    const t1=Date.now();

    if(!response.ok) throw new Error(`HTTP ${response.status}`);

    const dateHeader=response.headers.get("Date");
    if(!dateHeader) throw new Error("Date header unavailable");

    const parsed=Date.parse(dateHeader);
    if(!Number.isFinite(parsed)) throw new Error("Invalid Date header");

    const rtt=p1-p0;

    // HTTP Date is normally one-second resolution. Use the center of the
    // represented second and the midpoint of the request round trip.
    const serverCenter=parsed+500;
    const clientMid=(t0+t1)/2;

    return {
      offset:serverCenter-clientMid,
      rtt
    };
  }finally{
    clearTimeout(timeout);
  }
}

async function syncOnlineClock(){
  const btn=$("syncClockBtn");
  const state=$("clockSyncState");
  if(clockSyncBusy) return;

  if(!navigator.onLine){
    clockMode="device";
    clockOffsetMs=0;
    if(state) state.textContent="端末時刻（オフライン）";
    renderOnlineClock();
    return;
  }

  clockSyncBusy=true;
  if(btn) btn.disabled=true;
  if(state) state.textContent="同期中…";

  try{
    const samples=[];

    // Three short samples are enough for a field-reference correction and
    // keep the UI responsive on iPhone home-screen PWAs.
    for(let i=0;i<3;i++){
      try{
        samples.push(await getServerClockSample());
      }catch(err){
        console.warn("Clock sample failed:",err);
      }
      if(i<2) await sleep(100);
    }

    if(!samples.length) throw new Error("No usable clock samples");

    samples.sort((a,b)=>a.rtt-b.rtt);
    const chosen=samples[0];

    clockOffsetMs=chosen.offset;
    clockMode="server";
    if(state) state.textContent=`オンライン補正済み（RTT ${Math.round(chosen.rtt)}ms）`;
    renderOnlineClock();

  }catch(err){
    console.warn("Clock sync failed; using device clock:",err);
    // Crucially: synchronization failure never stops the clock.
    clockOffsetMs=0;
    clockMode="device";
    if(state) state.textContent="端末時刻（同期失敗）";
    renderOnlineClock();
  }finally{
    clockSyncBusy=false;
    if(btn) btn.disabled=false;
  }
}

const syncClockBtn=$("syncClockBtn");
if(syncClockBtn) syncClockBtn.addEventListener("click",syncOnlineClock);

window.addEventListener("online",()=>{
  const state=$("clockSyncState");
  if(clockMode==="device" && state) state.textContent="端末時刻";
});
window.addEventListener("offline",()=>{
  clockMode="device";
  clockOffsetMs=0;
  const state=$("clockSyncState");
  if(state) state.textContent="端末時刻（オフライン）";
  renderOnlineClock();
});

// The clock starts immediately and does not depend on network access.
startClockRenderer();

// ===== Stopwatch =====
let swRunning=false, swStartPerf=0, swAccumulated=0, swRaf=0, lapNo=0;
function formatStopwatch(ms){
  ms=Math.max(0,ms);
  const h=Math.floor(ms/3600000);
  const m=Math.floor((ms%3600000)/60000);
  const s=Math.floor((ms%60000)/1000);
  const milli=Math.floor(ms%1000);
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}.${String(milli).padStart(3,"0")}`;
}
function swElapsed(){
  return swAccumulated+(swRunning?(performance.now()-swStartPerf):0);
}
function renderStopwatch(){
  $("stopwatchDisplay").textContent=formatStopwatch(swElapsed());
  if(swRunning) swRaf=requestAnimationFrame(renderStopwatch);
}
$("stopwatchStartBtn").addEventListener("click",()=>{
  if(swRunning){
    swAccumulated+=performance.now()-swStartPerf;
    swRunning=false;
    cancelAnimationFrame(swRaf);
    $("stopwatchStartBtn").textContent="再開";
    $("stopwatchLapBtn").disabled=true;
    renderStopwatch();
  }else{
    swStartPerf=performance.now();
    swRunning=true;
    $("stopwatchStartBtn").textContent="ストップ";
    $("stopwatchLapBtn").disabled=false;
    renderStopwatch();
  }
});
$("stopwatchResetBtn").addEventListener("click",()=>{
  swRunning=false;
  cancelAnimationFrame(swRaf);
  swAccumulated=0; lapNo=0;
  $("stopwatchStartBtn").textContent="スタート";
  $("stopwatchLapBtn").disabled=true;
  $("lapList").innerHTML="";
  renderStopwatch();
});
$("stopwatchLapBtn").addEventListener("click",()=>{
  if(!swRunning) return;
  lapNo++;
  const row=document.createElement("div");
  row.className="lap-row";
  row.innerHTML=`<span>Lap ${lapNo}</span><strong>${formatStopwatch(swElapsed())}</strong>`;
  $("lapList").prepend(row);
});

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

calcTime();
calcFreq();

if($("checkUpdateBtn")) $("checkUpdateBtn").addEventListener("click",checkForAppUpdate);

if("serviceWorker" in navigator && location.protocol!=="file:"){
  

  window.addEventListener("load",async()=>{
    try{
      const hadController=Boolean(navigator.serviceWorker.controller);
      const reg=await navigator.serviceWorker.register("service-worker-v1.7.js",{updateViaCache:"none"});
      await reg.update();
      if(!hadController) { setUpdateUi("オフライン利用の準備完了","current"); setTimeout(()=>setUpdateUi(""),2200); }
    }catch(err){
      console.error("Service Worker registration failed",err);
      setUpdateUi(`現在 v${APP_VERSION} ・ オフライン準備を確認できませんでした`);
    }
  });
}

window.addEventListener("online",()=>setUpdateUi(""));
window.addEventListener("offline",()=>setUpdateUi("オフライン"));

// Do not auto-sync on launch. Device clock starts immediately; online sync is user-triggered.

window.addEventListener("DOMContentLoaded",()=>{
  const done=sessionStorage.getItem("ctoolUpdateDone");
  if(done){
    sessionStorage.removeItem("ctoolUpdateDone");
    setTimeout(()=>setUpdateUi(`v${APP_VERSION} に更新しました`,"current"),250);
    setTimeout(()=>setUpdateUi(""),2600);
  }
});

window.addEventListener("unhandledrejection",(event)=>{
  console.error("C-TOOL async error:",event.reason);
});
