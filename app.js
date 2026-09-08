
const $ = id => document.getElementById(id);

function showView(id){
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  $(id).classList.add("active");
  window.scrollTo({top:0,behavior:"instant"});
}
document.querySelectorAll("[data-view]").forEach(btn=>btn.addEventListener("click",()=>showView(btn.dataset.view)));

// ===== レンジ変換 =====
let rangeDirection="sigToPv";
const favKey="ctool_v1_range_favorites";
const histKey="ctool_v1_range_history";

function signalBounds(){
  return $("signalType").value==="4-20mA"
    ? {low:4,high:20,unit:"mA"}
    : {low:1,high:5,unit:"V"};
}
function getRangeConfig(){
  return {
    signalType:$("signalType").value,
    low:parseFloat($("rangeLow").value),
    high:parseFloat($("rangeHigh").value),
    unit:$("rangeUnit").value.trim(),
    decimals:parseInt($("rangeDecimals").value,10)
  };
}
function validRange(c){return Number.isFinite(c.low)&&Number.isFinite(c.high)&&c.low!==c.high}
function calcRange(saveHistory=false){
  const c=getRangeConfig(), x=parseFloat($("rangeInput").value), sig=signalBounds();
  $("rangeInputLabel").textContent=rangeDirection==="sigToPv"?"入力信号":"実値";
  $("rangeInputUnit").textContent=rangeDirection==="sigToPv"?sig.unit:(c.unit||"PV");

  if(!validRange(c)||!Number.isFinite(x)){
    $("rangeResult").textContent="—";
    $("rangeWarning").textContent="入力値を確認してください";
    return;
  }

  let y, warning="";
  if(rangeDirection==="sigToPv"){
    y=c.low+((x-sig.low)/(sig.high-sig.low))*(c.high-c.low);
    if(x<sig.low) warning=`⚠ アンダーレンジ（${sig.low}${sig.unit}未満）`;
    else if(x>sig.high) warning=`⚠ オーバーレンジ（${sig.high}${sig.unit}超）`;
    $("rangeResult").textContent=`${y.toFixed(c.decimals)} ${c.unit}`.trim();
  }else{
    y=sig.low+((x-c.low)/(c.high-c.low))*(sig.high-sig.low);
    const min=Math.min(c.low,c.high), max=Math.max(c.low,c.high);
    if(x<min) warning="⚠ レンジ下限外";
    else if(x>max) warning="⚠ レンジ上限外";
    $("rangeResult").textContent=`${y.toFixed(c.decimals)} ${sig.unit}`;
  }
  $("rangeWarning").textContent=warning;
  if(saveHistory) pushHistory(c);
}
function setRangeDirection(dir){
  rangeDirection=dir;
  $("sigToPvBtn").classList.toggle("active",dir==="sigToPv");
  $("pvToSigBtn").classList.toggle("active",dir==="pvToSig");
  calcRange(false);
}
$("sigToPvBtn").onclick=()=>setRangeDirection("sigToPv");
$("pvToSigBtn").onclick=()=>setRangeDirection("pvToSig");

["signalType","rangeLow","rangeHigh","rangeUnit","rangeInput","rangeDecimals"].forEach(id=>{
  $(id).addEventListener("input",()=>calcRange(false));
  $(id).addEventListener("change",()=>calcRange(true));
});

function loadJson(key){try{return JSON.parse(localStorage.getItem(key)||"[]")}catch{return []}}
function saveJson(key,data){localStorage.setItem(key,JSON.stringify(data))}
function rangeId(c){return [c.signalType,c.low,c.high,c.unit,c.decimals].join("|")}
function pushHistory(c){
  if(!validRange(c))return;
  let arr=loadJson(histKey).filter(x=>rangeId(x)!==rangeId(c));
  arr.unshift({...c,ts:Date.now()});
  saveJson(histKey,arr.slice(0,5));
  renderHistory();
}
function applyRangeConfig(c){
  $("signalType").value=c.signalType;
  $("rangeLow").value=c.low;
  $("rangeHigh").value=c.high;
  $("rangeUnit").value=c.unit;
  $("rangeDecimals").value=String(c.decimals??1);
  calcRange(true);
}
function renderList(containerId,arr,isFavorite){
  const box=$(containerId);box.innerHTML="";
  if(!arr.length){
    box.className="list empty";
    box.textContent=isFavorite?"まだ登録されていません":"履歴はありません";
    return;
  }
  box.className="list";
  arr.forEach((c,i)=>{
    const item=document.createElement("div");item.className="item";
    const main=document.createElement("div");main.className="item-main";
    const title=document.createElement("div");title.className="item-title";
    title.textContent=c.name||`${c.low}～${c.high}${c.unit}`;
    const sub=document.createElement("div");sub.className="item-sub";
    sub.textContent=`${c.signalType} / ${c.low} ～ ${c.high} ${c.unit}`;
    main.append(title,sub);
    const actions=document.createElement("div");actions.className="item-actions";
    const use=document.createElement("button");use.textContent="呼出";use.onclick=()=>applyRangeConfig(c);actions.append(use);
    if(isFavorite){
      const del=document.createElement("button");del.textContent="削除";
      del.onclick=()=>{const a=loadJson(favKey);a.splice(i,1);saveJson(favKey,a);renderFavorites();};
      actions.append(del);
    }
    item.append(main,actions);box.append(item);
  });
}
function renderFavorites(){renderList("favoritesList",loadJson(favKey),true)}
function renderHistory(){renderList("historyList",loadJson(histKey),false)}

$("favoriteBtn").onclick=()=>{
  const c=getRangeConfig();
  if(!validRange(c))return alert("レンジ設定を確認してください");
  const suggested=`${c.low}～${c.high}${c.unit}`;
  const name=prompt("お気に入り名",suggested);
  if(name===null)return;
  const arr=loadJson(favKey);
  arr.push({...c,name:(name.trim()||suggested)});
  saveJson(favKey,arr);
  renderFavorites();
};
$("clearHistoryBtn").onclick=()=>{
  if(confirm("最近使ったレンジの履歴を削除しますか？")){
    saveJson(histKey,[]);
    renderHistory();
  }
};

// ===== 進数変換 =====
function invalidNum(){
  $("outDec").textContent="—";
  $("outHex").textContent="—";
  $("outBin").textContent="—";
  $("out16").textContent="—";
  $("signedInfo").textContent="入力形式を確認してください";
}
function calcNum(){
  const base=parseInt($("numBase").value,10);
  const raw=$("numInput").value.trim().replace(/\s+/g,"");
  let n;

  if(base===10){
    if(!/^-?\d+$/.test(raw)){invalidNum();return;}
    n=Number(raw);
  }else if(base===16){
    if(!/^[0-9a-fA-F]+$/.test(raw)){invalidNum();return;}
    n=parseInt(raw,16);
  }else{
    if(!/^[01]+$/.test(raw)){invalidNum();return;}
    n=parseInt(raw,2);
  }

  if(!Number.isSafeInteger(n)){invalidNum();return;}

  const u16=((n%65536)+65536)%65536;
  const s16=u16>=32768?u16-65536:u16;

  $("outDec").textContent=String(n);
  $("outHex").textContent=(n<0?u16:n).toString(16).toUpperCase();
  $("outBin").textContent=(n<0?u16:n).toString(2);
  $("out16").textContent=u16.toString(2).padStart(16,"0").match(/.{1,4}/g).join(" ");
  $("signedInfo").textContent=`Unsigned: ${u16}　Signed: ${s16}`;
}
["numBase","numInput"].forEach(id=>{
  $(id).addEventListener("input",calcNum);
  $(id).addEventListener("change",calcNum);
});

// ===== 熱量演算 =====
function flowToM3h(v,u){
  if(u==="m3h")return v;
  if(u==="Lmin")return v*0.06;
  if(u==="Ls")return v*3.6;
}
function calcHeat(){
  const flow=parseFloat($("heatFlow").value);
  const t1=parseFloat($("heatT1").value);
  const t2=parseFloat($("heatT2").value);
  if(![flow,t1,t2].every(Number.isFinite)){
    $("heatResult").textContent="—";
    $("heatSub").textContent="入力値を確認してください";
    return;
  }

  const m3h=flowToM3h(flow,$("heatFlowUnit").value);
  let dt=t2-t1;
  if($("heatDeltaMode").value==="abs")dt=Math.abs(dt);

  // ρ=1000 kg/m3, Cp=4.186 kJ/kgK => kW = 4.186*1000/3600 = 1.162777...
  const kw=(4.186*1000/3600)*m3h*dt;
  const out=$("heatOutput").value;
  let val=kw, unit="kW";
  if(out==="MJh"){val=kw*3.6;unit="MJ/h";}
  else if(out==="GJh"){val=kw*0.0036;unit="GJ/h";}
  else if(out==="kcalh"){val=kw*859.845;unit="kcal/h";}

  const digits=Math.abs(val)>=1000?0:Math.abs(val)>=100?1:2;
  $("heatResult").textContent=`${val.toFixed(digits)} ${unit}`;
  $("heatSub").textContent=`ΔT = ${dt.toFixed(1)} ℃`;
  $("heatFlowConverted").textContent=`${m3h.toFixed(3)} m³/h`;
  $("heatFormula").textContent="1.1628 × 流量 × ΔT";
}
["heatFlow","heatFlowUnit","heatT1","heatT2","heatDeltaMode","heatOutput"].forEach(id=>{
  $(id).addEventListener("input",calcHeat);
  $(id).addEventListener("change",calcHeat);
});

// ===== 単位変換 =====
const unitDefs={
  pressure:{
    units:["Pa","kPa","MPa","bar","kgf/cm²","psi"],
    toBase:{
      "Pa":v=>v,"kPa":v=>v*1e3,"MPa":v=>v*1e6,"bar":v=>v*1e5,
      "kgf/cm²":v=>v*98066.5,"psi":v=>v*6894.757293168
    },
    fromBase:{
      "Pa":v=>v,"kPa":v=>v/1e3,"MPa":v=>v/1e6,"bar":v=>v/1e5,
      "kgf/cm²":v=>v/98066.5,"psi":v=>v/6894.757293168
    }
  },
  temperature:{units:["℃","℉","K"]},
  flow:{
    units:["m³/h","m³/min","L/min","L/s"],
    toBase:{
      "m³/h":v=>v,"m³/min":v=>v*60,"L/min":v=>v*0.06,"L/s":v=>v*3.6
    },
    fromBase:{
      "m³/h":v=>v,"m³/min":v=>v/60,"L/min":v=>v/0.06,"L/s":v=>v/3.6
    }
  }
};
function tempToC(v,u){
  if(u==="℃")return v;
  if(u==="℉")return (v-32)*5/9;
  return v-273.15;
}
function cToTemp(v,u){
  if(u==="℃")return v;
  if(u==="℉")return v*9/5+32;
  return v+273.15;
}
function populateUnits(){
  const def=unitDefs[$("unitCategory").value];
  $("unitFrom").innerHTML="";
  $("unitTo").innerHTML="";
  def.units.forEach(u=>{
    const a=document.createElement("option");a.value=u;a.textContent=u;$("unitFrom").append(a);
    const b=document.createElement("option");b.value=u;b.textContent=u;$("unitTo").append(b);
  });
  if($("unitCategory").value==="pressure"){
    $("unitFrom").value="MPa";$("unitTo").value="kPa";
  }else if($("unitCategory").value==="temperature"){
    $("unitFrom").value="℃";$("unitTo").value="℉";
  }else{
    $("unitFrom").value="m³/h";$("unitTo").value="L/min";
  }
  calcUnit();
}
function calcUnit(){
  const cat=$("unitCategory").value;
  const from=$("unitFrom").value,to=$("unitTo").value;
  const v=parseFloat($("unitValue").value);
  if(!Number.isFinite(v)){
    $("unitResult").textContent="—";
    $("unitFormula").textContent="入力値を確認してください";
    return;
  }
  let out;
  if(cat==="temperature"){
    out=cToTemp(tempToC(v,from),to);
  }else{
    out=unitDefs[cat].fromBase[to](unitDefs[cat].toBase[from](v));
  }
  const abs=Math.abs(out);
  const digits=abs>=1000?3:abs>=1?6:8;
  let display=Number(out.toFixed(digits)).toString();
  $("unitResult").textContent=`${display} ${to}`;
  $("unitFormula").textContent=`${v} ${from} → ${to}`;
}
$("unitCategory").addEventListener("change",populateUnits);
["unitFrom","unitTo","unitValue"].forEach(id=>{
  $(id).addEventListener("input",calcUnit);
  $(id).addEventListener("change",calcUnit);
});
$("swapUnitBtn").onclick=()=>{
  const a=$("unitFrom").value;
  $("unitFrom").value=$("unitTo").value;
  $("unitTo").value=a;
  calcUnit();
};

renderFavorites();
renderHistory();
calcRange(false);
calcNum();
calcHeat();
populateUnits();

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("service-worker.js"));
}
