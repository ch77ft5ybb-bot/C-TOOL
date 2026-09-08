
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

// ===== 解説 / 項目ヘルプ =====
const helpContent = {
  range: {
    title: "レンジ変換とは？",
    html: `<p>センサや変換器が出す標準信号と、実際の温度・圧力・流量などを相互に換算します。</p>
      <h4>4–20mAの考え方</h4><p>4mAをレンジ下限、20mAをレンジ上限として直線的に換算します。4mAを0mAにしないのは、断線などの異常と「0%の正常信号」を区別しやすくするためです。</p>
      <div class="example">例：0〜100℃の温度計で12mA → 50℃</div>
      <h4>計算式</h4><p><code>PV = L + (入力−信号下限) ÷ 信号幅 × (H−L)</code></p><p>L=レンジ下限、H=レンジ上限です。</p>`
  },
  num: {
    title: "進数変換とは？",
    html: `<p>PLCや通信データでよく使う2進数・10進数・16進数を相互変換します。</p>
      <h4>DEC / HEX / BIN</h4><ul><li>DEC：普段使う10進数</li><li>HEX：0〜9とA〜Fを使う16進数</li><li>BIN：0と1だけで表す2進数</li></ul>
      <div class="example">例：DEC 255 = HEX FF = BIN 11111111</div>
      <p>16bit表示では、同じビット列を符号なし（Unsigned）と符号付き（Signed）の両方で確認できます。</p>`
  },
  heat: {
    title: "熱量演算とは？",
    html: `<p>水が運んでいる熱量を、流量と往還温度差から求めます。空調・冷温水系統の能力確認で使います。</p>
      <h4>基本式</h4><p><code>熱量[kW] ≒ 1.1628 × 流量[m³/h] × ΔT[℃]</code></p>
      <div class="example">例：100 m³/h、温度差5℃ → 約581.4 kW</div>
      <p>このツールでは水の密度1000kg/m³、比熱4.186kJ/(kg·K)として計算しています。</p>`
  },
  unit: {
    title: "単位変換とは？",
    html: `<p>現場で混在しやすい圧力・温度・流量の単位を変換します。</p>
      <div class="example">例：1 MPa = 1000 kPa / 1 m³/h = 16.6667 L/min</div>
      <p>値を入力し、「変換元」と「変換先」を選ぶだけで換算できます。⇄ボタンで方向を入れ替えられます。</p>`
  },
  pid: {
    title: "PIDとは？",
    html: `<p>PID制御は、設定値SPと現在値PVの偏差を小さくするために、P（比例）・I（積分）・D（微分）の3つを組み合わせて操作量を決める制御です。</p>
      <ul><li><b>P：</b>今の偏差に反応</li><li><b>I：</b>偏差が残り続けることに反応</li><li><b>D：</b>偏差の変化速度に反応</li></ul>
      <div class="example">この画面は各項が出力にどれだけ効くかを見るための簡易シミュレータです。</div>
      <p>実機のPLC・調節計では、比例帯方式、速度形、微分先行、フィルタ、出力制限、アンチワインドアップなど仕様が異なります。最終設定は機器仕様を確認してください。</p>`
  },
  pt100: {
    title: "Pt100とは？",
    html: `<p>Pt100は白金測温抵抗体です。0℃で100Ωになり、温度によって抵抗値が変化します。</p>
      <div class="example">代表値：0℃ ≈ 100Ω / 100℃ ≈ 138.5Ω</div>
      <p>このツールではIEC 60751のCallendar–Van Dusen式（α=0.00385）で、−200〜850℃を計算します。</p>
      <p>実際の測定では2線/3線/4線式の配線抵抗、センサ階級、自己発熱などの誤差要因があります。</p>`
  },
  freq: {
    title: "周波数変換とは？",
    html: `<p>パルス周波数Hz、回転数RPM、1周期の時間を相互に換算します。</p>
      <h4>パルスと回転数</h4><p><code>RPM = Hz × 60 ÷ PPR</code></p><p>PPRは1回転あたりのパルス数です。</p>
      <div class="example">PPR=1なら 50Hz → 3000RPM、周期は20ms</div>
      <h4>モータ同期速度</h4><p><code>Ns = 120 × 周波数 ÷ 極数</code></p><p>誘導電動機の実回転数は「すべり」により同期速度より少し低くなります。</p>`
  },
  time: {
    title: "時間変換とは？",
    html: `<p>ms・秒・分・時間・日を相互変換します。PLCタイマ設定値の確認にも使えます。</p>
      <div class="example">例：5秒を100ms時限のタイマで設定 → 設定値50</div>
      <p>PLCタイマは機種や命令によって1ms、10ms、100ms、1sなど時限が異なります。ツールの設定値と実機仕様を必ず合わせてください。</p>`
  }
};

const infoContent = {
  "range-direction":["変換方向","信号→実値は、計測したmA/Vから温度などを求めます。実値→信号は、目的の温度などが何mA/Vに相当するか求めます。"],
  "signal-type":["信号種類","4–20mAと1–5Vは計装でよく使われる標準アナログ信号です。接続している機器の仕様と同じものを選びます。"],
  "range-limits":["レンジ下限・上限","変換器の測定レンジです。例：−20〜80℃なら下限−20、上限80を入力します。"],
  "range-input":["入力値","変換方向に応じて、実際に測った信号値または換算したい実値を入力します。"],
  "num-base":["入力形式","DEC=10進、HEX=16進、BIN=2進です。PLCのデバイス値や通信データの確認で使います。"],
  "signed16":["Signed / Unsigned","同じ16bitでも、Unsignedは0〜65535、Signedは−32768〜32767として解釈します。たとえばFFFFはUnsigned=65535、Signed=−1です。"],
  "heat-flow":["流量","配管を流れる水量です。入力単位はm³/h、L/min、L/sから選べます。内部ではm³/hへ換算して熱量を計算します。"],
  "delta-t":["温度差 ΔT","往きと還りなど2点の温度差です。絶対値モードは方向を無視して熱量の大きさを求め、符号付きモードはT2−T1の方向も残します。"],
  "pid-sp-pv":["SP / PV","SPは目標値（Set Point）、PVは現在値（Process Value）です。偏差e=SP−PVをPID演算に使います。"],
  "pid-kp":["Kp（比例ゲイン）","偏差に対するP項の強さです。大きいほど反応が強くなりますが、大きすぎると振動しやすくなります。"],
  "pid-ti":["Ti（積分時間）","積分作用の時間定数です。この簡易式ではTiが小さいほどI作用が強くなります。0を入力するとI項を無効化します。"],
  "pid-td":["Td（微分時間）","偏差の変化に対するD作用の強さです。0ならD項は無効です。ノイズの影響を受けやすい項です。"],
  "pid-integral":["積分蓄積値","過去から蓄積している偏差積分の初期値です。0から始めれば、今回1周期分の積分効果を確認できます。"],
  "pt100-basics":["Pt100","0℃で100Ωの白金測温抵抗体です。温度→抵抗、抵抗→温度を変換できます。"],
  "freq-ppr":["PPR","Pulse Per Revolution。センサやエンコーダが1回転で出すパルス数です。PPRが2なら、2Hzで1回転/秒=60RPMです。"],
  "motor-poles":["モータ極数","2極・4極・6極など、交流モータの極数です。極数が多いほど同じ周波数で同期速度は低くなります。"],
  "plc-timer":["PLCタイマ設定値","目標時間÷タイマ時限で設定値を求めます。例：5秒÷0.1秒=50。端数が出る場合は最も近い整数へ丸めています。"]
};

function openHelp(title, html){
  $("helpTitle").textContent=title;
  $("helpBody").innerHTML=html;
  $("helpModal").classList.add("open");
  $("helpModal").setAttribute("aria-hidden","false");
  document.body.style.overflow="hidden";
}
function closeHelp(){
  $("helpModal").classList.remove("open");
  $("helpModal").setAttribute("aria-hidden","true");
  document.body.style.overflow="";
}
document.querySelectorAll("[data-help]").forEach(btn=>btn.addEventListener("click",e=>{
  e.stopPropagation(); const c=helpContent[btn.dataset.help]; if(c) openHelp(c.title,c.html);
}));
document.querySelectorAll("[data-info]").forEach(btn=>btn.addEventListener("click",e=>{
  e.preventDefault(); e.stopPropagation(); const c=infoContent[btn.dataset.info]; if(c) openHelp(c[0],`<p>${c[1]}</p>`);
}));
$("helpClose").onclick=closeHelp;
document.querySelectorAll("[data-close-modal]").forEach(x=>x.onclick=closeHelp);
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeHelp();});

// ===== PID簡易演算 =====
function calcPid(){
  const vals=["pidSp","pidPv","pidKp","pidTi","pidTd","pidDt","pidPrevError","pidIntegral"].map(id=>parseFloat($(id).value));
  if(!vals.every(Number.isFinite)){["pidError","pidP","pidI","pidD","pidOutput"].forEach(id=>$(id).textContent="—");$("pidClamped").textContent="入力値を確認してください";return;}
  const [sp,pv,kp,ti,td,dt,prevErr,integral0]=vals;
  if(dt<=0 || ti<0 || td<0){$("pidOutput").textContent="—";$("pidClamped").textContent="Ti/Tdは0以上、Δtは0より大きくしてください";return;}
  const e=sp-pv;
  const p=kp*e;
  const integral=integral0 + e*dt;
  const i=ti===0?0:kp*integral/ti;
  const d=td===0?0:kp*td*(e-prevErr)/dt;
  const out=p+i+d;
  const clamped=Math.min(100,Math.max(0,out));
  $("pidError").textContent=e.toFixed(3);$("pidP").textContent=p.toFixed(3);$("pidI").textContent=i.toFixed(3);$("pidD").textContent=d.toFixed(3);$("pidOutput").textContent=out.toFixed(3);$("pidClamped").textContent=`0〜100%制限後: ${clamped.toFixed(3)}%`;
}
["pidSp","pidPv","pidKp","pidTi","pidTd","pidDt","pidPrevError","pidIntegral"].forEach(id=>$(id).addEventListener("input",calcPid));

// ===== Pt100 IEC 60751 =====
let ptDirection="tToR";
const PT_R0=100, PT_A=3.9083e-3, PT_B=-5.775e-7, PT_C=-4.183e-12;
function ptResistance(t){return t>=0?PT_R0*(1+PT_A*t+PT_B*t*t):PT_R0*(1+PT_A*t+PT_B*t*t+PT_C*(t-100)*t*t*t);}
function ptTemperature(r){
  if(r<ptResistance(-200)||r>ptResistance(850)) return NaN;
  let lo=-200, hi=850;
  for(let i=0;i<80;i++){const mid=(lo+hi)/2;if(ptResistance(mid)<r)lo=mid;else hi=mid;}
  return (lo+hi)/2;
}
function calcPt100(){
  const x=parseFloat($("ptInput").value);$("ptWarning").textContent="";
  if(!Number.isFinite(x)){$("ptResult").textContent="—";return;}
  if(ptDirection==="tToR"){
    if(x < -200 || x > 850){$("ptResult").textContent="—";$("ptWarning").textContent="計算範囲は −200〜850℃";return;}
    $("ptResult").textContent=`${ptResistance(x).toFixed(3)} Ω`;
  }else{
    const t=ptTemperature(x);if(!Number.isFinite(t)){$("ptResult").textContent="—";$("ptWarning").textContent=`有効抵抗範囲は約 ${ptResistance(-200).toFixed(3)}〜${ptResistance(850).toFixed(3)}Ω`;return;}
    $("ptResult").textContent=`${t.toFixed(3)} ℃`;
  }
}
function setPtDirection(dir){ptDirection=dir;$("ptTtoRBtn").classList.toggle("active",dir==="tToR");$("ptRtoTBtn").classList.toggle("active",dir==="rToT");$("ptInputLabel").textContent=dir==="tToR"?"温度":"抵抗値";$("ptInputUnit").textContent=dir==="tToR"?"℃":"Ω";$("ptResultLabel").textContent=dir==="tToR"?"抵抗値":"温度";$("ptInput").value=dir==="tToR"?"0":"100";calcPt100();}
$("ptTtoRBtn").onclick=()=>setPtDirection("tToR");$("ptRtoTBtn").onclick=()=>setPtDirection("rToT");$("ptInput").addEventListener("input",calcPt100);

// ===== 周波数 / RPM / 周期 =====
function calcFreq(){
  const mode=$("freqMode").value,x=parseFloat($("freqInput").value),ppr=parseFloat($("freqPpr").value);
  if(!Number.isFinite(x)||!Number.isFinite(ppr)||x<0||ppr<=0){$("freqHz").textContent=$("freqRpm").textContent=$("freqPeriod").textContent="—";return;}
  let hz;
  if(mode==="hz") hz=x;
  else if(mode==="rpm") hz=x*ppr/60;
  else hz=x===0?Infinity:1000/x;
  const rpm=Number.isFinite(hz)?hz*60/ppr:0;
  const period=hz===0?Infinity:1000/hz;
  $("freqHz").textContent=Number.isFinite(hz)?`${hz.toFixed(3)} Hz`:"∞ Hz";
  $("freqRpm").textContent=Number.isFinite(rpm)?`${rpm.toFixed(3)} RPM`:"—";
  $("freqPeriod").textContent=Number.isFinite(period)?`${period.toFixed(3)} ms`:"∞ ms";
}
function calcMotor(){const f=parseFloat($("motorHz").value),p=parseInt($("motorPoles").value,10);$("motorRpm").textContent=Number.isFinite(f)&&f>=0&&p>0?`${(120*f/p).toFixed(1).replace(/\.0$/,'')} RPM`:"—";}
["freqMode","freqInput","freqPpr"].forEach(id=>{$(id).addEventListener("input",calcFreq);$(id).addEventListener("change",calcFreq)});["motorHz","motorPoles"].forEach(id=>{$(id).addEventListener("input",calcMotor);$(id).addEventListener("change",calcMotor)});

// ===== 時間変換 / PLCタイマ =====
const timeToMs={ms:1,s:1000,min:60000,h:3600000,day:86400000};
function calcTime(){const v=parseFloat($("timeValue").value),from=$("timeFrom").value,to=$("timeTo").value;if(!Number.isFinite(v)){$("timeResult").textContent="—";return;}const out=v*timeToMs[from]/timeToMs[to];$("timeResult").textContent=`${Number(out.toPrecision(12)).toString()} ${to}`;$("timeFormula").textContent=`${v} ${from} → ${to}`;}
["timeValue","timeFrom","timeTo"].forEach(id=>{$(id).addEventListener("input",calcTime);$(id).addEventListener("change",calcTime)});
$("swapTimeBtn").onclick=()=>{const a=$("timeFrom").value;$("timeFrom").value=$("timeTo").value;$("timeTo").value=a;calcTime();};
function calcPlcTimer(){const sec=parseFloat($("plcTimeSec").value),base=parseFloat($("plcTimeBase").value);if(!Number.isFinite(sec)||sec<0||!Number.isFinite(base)||base<=0){$("plcTimerPreset").textContent="—";$("plcTimerActual").textContent="入力値を確認してください";return;}const preset=Math.round(sec/base);const actual=preset*base;$("plcTimerPreset").textContent=String(preset);$("plcTimerActual").textContent=`実時間: ${actual.toFixed(3)} s${Math.abs(actual-sec)>1e-9?`（誤差 ${(actual-sec).toFixed(3)} s）`:""}`;}
["plcTimeSec","plcTimeBase"].forEach(id=>{$(id).addEventListener("input",calcPlcTimer);$(id).addEventListener("change",calcPlcTimer)});

calcPid();calcPt100();calcFreq();calcMotor();calcTime();calcPlcTimer();
