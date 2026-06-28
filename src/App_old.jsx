import { useState, useEffect, useCallback, useRef } from "react";

// ── 상수 ──────────────────────────────────────────────
const MONTH_NAMES    = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
const CARD_COMPANIES = ["현대카드","신한카드","국민카드","삼성카드","롯데카드","하나카드","우리카드","NH카드","기타"];
const FIXED_TYPES    = ["대출","보험","구독","관리비","기타"];
const INCOME_TYPES   = ["월급","부수입","임대수입","이자","기타수입"];

// ── 팔레트 ────────────────────────────────────────────
const C = {
  bg:"#F5F0E8", card:"#FDFAF4", border:"#E8DFD0",
  primary:"#8B6F47", primaryBg:"#EDE5D8",
  accent:"#C4956A", accentBg:"#F7EFE3",
  jw:"#7A8E6A",   jwBg:"#EBF0E6",   // 변지원 — sage green
  sh:"#7A6E9E",   shBg:"#EDE9F5",   // 정수현 — dusty purple
  green:"#6A9E7A", greenBg:"#EAF3EC",
  red:"#C46A6A",   redBg:"#F7ECEC",
  yellow:"#C4A647",yellowBg:"#F7F3E3",
  blue:"#5B8BB0",  blueBg:"#E8F0F7",
  text:"#3D2E1E", sub:"#9E8B78", muted:"#BDB09E",
};

const MEMBERS = {
  jiwon:  { label:"변지원", initial:"지원", color:C.jw,  bg:C.jwBg  },
  suhyun: { label:"정수현", initial:"수현", color:C.sh,  bg:C.shBg  },
};

// ── 스토리지 키 ───────────────────────────────────────
const gk  = (y,m) => `cb_entries_${y}_${m}`;
const bk  = (y,m) => `cb_budget_${y}_${m}`;
const sk  = (y,m) => `cb_settle_${y}_${m}`;
const FK  = "cb_fixed_exp_v1";
const IK  = "cb_installments_v1";
const FIK = "cb_fixed_income_v1";
const PK  = "cb_profiles_v1";

// ── 유틸 ─────────────────────────────────────────────
const fmt    = n => n==null?"0":Number(n).toLocaleString("ko-KR");
const fmtAbs = n => fmt(Math.abs(n));
const pn     = s => Number((s||"").toString().replace(/,/g,""))||0;

function getInstSt(item,y,m){
  const diff=(y-item.sy)*12+(m-item.sm);
  if(diff<0||diff>=item.months)return null;
  return{cur:diff+1,total:item.months,isLast:diff+1===item.months};
}
function dday(ds){
  if(!ds)return null;
  const d=Math.ceil((new Date(ds)-new Date(new Date().toISOString().slice(0,10)))/86400000);
  return{label:d<0?`만기 ${Math.abs(d)}일 지남`:d===0?"D-Day":`D-${d}`,
         color:d<0?C.muted:d<=30?C.red:d<=90?C.yellow:C.green,
         bg:   d<0?"#f3ede5":d<=30?C.redBg:d<=90?C.yellowBg:C.greenBg};
}

// ── 스타일 헬퍼 ──────────────────────────────────────
const inp = { width:"100%",border:`1.5px solid ${C.border}`,borderRadius:10,padding:"11px 14px",fontSize:14,outline:"none",fontFamily:"inherit",boxSizing:"border-box",background:C.card,color:C.text };
const chip = (on,ac,ab)=>({padding:"6px 12px",borderRadius:99,cursor:"pointer",fontSize:12,border:`1.5px solid ${on?ac:C.border}`,background:on?ab:C.card,color:on?ac:C.muted,fontWeight:on?700:400});
const bigBtn = (fg,bg)=>({width:"100%",padding:"14px 0",border:"none",borderRadius:12,fontSize:15,fontWeight:700,cursor:"pointer",background:bg,color:fg});

// ── 공통 컴포넌트 ────────────────────────────────────
const Label = ({children})=><div style={{fontSize:12,color:C.sub,marginBottom:6,fontWeight:600}}>{children}</div>;

function Sheet({onClose,title,children}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(61,46,30,.4)",zIndex:200,display:"flex",alignItems:"flex-end"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:C.card,borderRadius:"22px 22px 0 0",padding:"24px 20px 44px",width:"100%",maxWidth:480,margin:"0 auto",maxHeight:"92vh",overflowY:"auto"}}>
        <div style={{fontSize:16,fontWeight:800,color:C.text,marginBottom:20}}>{title}</div>
        {children}
      </div>
    </div>
  );
}

function DelModal({msg,onCancel,onConfirm}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(61,46,30,.4)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:C.card,borderRadius:18,padding:24,width:284,textAlign:"center"}}>
        <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:6}}>삭제할까요?</div>
        <div style={{fontSize:12,color:C.sub,marginBottom:20}}>{msg||"삭제한 내역은 복구할 수 없어요"}</div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onCancel}  style={{flex:1,padding:"10px 0",border:`1.5px solid ${C.border}`,borderRadius:10,background:C.card,color:C.sub,fontWeight:600,cursor:"pointer"}}>취소</button>
          <button onClick={onConfirm} style={{flex:1,padding:"10px 0",border:"none",borderRadius:10,background:C.red,color:"#fff",fontWeight:700,cursor:"pointer"}}>삭제</button>
        </div>
      </div>
    </div>
  );
}

// ── 아바타 ───────────────────────────────────────────
function Avatar({src,initial,color,size=40}){
  return(
    <div style={{width:size,height:size,borderRadius:"50%",overflow:"hidden",background:color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.38,fontWeight:700,color:"#fff",flexShrink:0}}>
      {src?<img src={src} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:initial}
    </div>
  );
}

// ── 프로필 설정 탭 ───────────────────────────────────
function ProfileTab({profiles,saveProfiles}){
  const fileRefs={jiwon:useRef(),suhyun:useRef()};
  const [local,setLocal]=useState(profiles);
  useEffect(()=>setLocal(profiles),[profiles]);

  const pickFile=(who)=>{
    const f=fileRefs[who].current;
    if(f)f.click();
  };
  const onFile=(who,e)=>{
    const file=e.target.files[0]; if(!file)return;
    const r=new FileReader();
    r.onload=ev=>{ const next={...local,[who]:{...local[who],photo:ev.target.result}}; setLocal(next); saveProfiles(next); };
    r.readAsDataURL(file);
  };

  return(
    <div style={{paddingBottom:20}}>
      {Object.entries(MEMBERS).map(([k,m])=>(
        <div key={k} style={{background:C.card,borderRadius:16,padding:20,marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:18}}>
            <Avatar src={local[k]?.photo} initial={m.initial} color={m.color} size={56}/>
            <div>
              <div style={{fontSize:16,fontWeight:800,color:m.color}}>{m.label}</div>
              <button onClick={()=>pickFile(k)} style={{marginTop:4,fontSize:11,color:C.sub,background:"none",border:`1px solid ${C.border}`,borderRadius:6,padding:"3px 8px",cursor:"pointer"}}>
                사진 변경
              </button>
            </div>
            <input ref={fileRefs[k]} type="file" accept="image/*" style={{display:"none"}} onChange={e=>onFile(k,e)}/>
          </div>
          <Label>한마디 (선택)</Label>
          <input value={local[k]?.bio||""} onChange={e=>{const n={...local,[k]:{...local[k],bio:e.target.value}};setLocal(n);}} onBlur={()=>saveProfiles(local)} placeholder="예: 절약왕 💪" style={inp}/>
        </div>
      ))}
      <div style={{background:C.primaryBg,borderRadius:12,padding:"12px 16px",fontSize:12,color:C.primary,lineHeight:1.7}}>
        💡 사진은 이 기기에만 저장돼요. 두 분이 각자 기기에서 업로드해주세요.
      </div>
    </div>
  );
}

// ── 정산 탭 ──────────────────────────────────────────
function SettleTab({year,month,fixedIncome,fixedExp,instTotal,installments,fixedItems}){
  const KEY=sk(year,month);
  const blank={cashJw:"",cashSh:"",cardJw:"",cardSh:"",savingGoal:""};
  const [data,setData]=useState(blank);
  const [done,setDone]=useState(false);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      try{const r=await window.storage.get(KEY,true);if(r){setData(JSON.parse(r.value));setDone(true);}else{setData(blank);setDone(false);}}catch{setData(blank);setDone(false);}
      setLoading(false);
    })();
  },[year,month]);

  const save=async d=>{await window.storage.set(KEY,JSON.stringify(d),true);setData(d);setDone(true);};

  if(loading)return<div style={{textAlign:"center",padding:60,color:C.muted}}>불러오는 중...</div>;

  // ── 계산 핵심 ──
  // 잔액 풀 = 지원현금 + 수현현금 + 고정수입(월급 등)
  const cashJw    = pn(data.cashJw);
  const cashSh    = pn(data.cashSh);
  const cardJw    = pn(data.cardJw);
  const cardSh    = pn(data.cardSh);
  const totalCash = cashJw + cashSh;
  const totalCard = cardJw + cardSh;
  const savingGoal= pn(data.savingGoal);

  // 잔액 풀 = 현금 + 고정수입 (월급이 들어오면 자동 반영)
  const pool = totalCash + fixedIncome;

  // 차감: 카드 + 고정지출 + 할부
  const deduct = totalCard + fixedExp + instTotal;

  // 순 가용금액
  const avail           = pool - deduct;
  const availAfterSaving= avail - savingGoal;

  // 다음달
  const ny=month===11?year+1:year, nm=month===11?0:month+1;
  const nextInst=installments.reduce((s,i)=>{const st=getInstSt(i,ny,nm);return st?s+i.amount:s;},0);
  const nextDeduct=fixedExp+nextInst; // 카드는 변동이라 제외

  const Row=({label,value,color,sub,noBorder})=>(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",paddingBottom:noBorder?0:9,borderBottom:noBorder?"none":`1px solid ${C.border}`,marginBottom:noBorder?0:9}}>
      <div><span style={{fontSize:13,color:C.sub}}>{label}</span>{sub&&<div style={{fontSize:11,color:C.muted,marginTop:2}}>{sub}</div>}</div>
      <span style={{fontSize:14,fontWeight:700,color:color||C.text}}>{value}</span>
    </div>
  );

  return(
    <div>
      {/* 두 사람 현금 입력 */}
      <div style={{background:C.card,borderRadius:16,padding:18,marginBottom:12}}>
        <div style={{fontSize:14,fontWeight:800,color:C.text,marginBottom:14}}>💰 현재 보유 현금</div>
        {[["변지원","cashJw",C.jw],["정수현","cashSh",C.sh]].map(([name,key,color])=>(
          <div key={key} style={{marginBottom:10}}>
            <Label><span style={{color}}>{name}</span></Label>
            <input value={data[key]} onChange={e=>setData(d=>({...d,[key]:e.target.value}))} placeholder="0" type="number" style={{...inp,fontSize:16,fontWeight:700}}/>
          </div>
        ))}
        {/* 고정수입 자동반영 안내 */}
        {fixedIncome>0&&(
          <div style={{marginTop:12,background:C.greenBg,borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:12,color:C.green,fontWeight:700}}>📥 고정수입 자동 반영</div>
              <div style={{fontSize:11,color:C.sub,marginTop:2}}>월급 등 고정수입이 잔액 풀에 합산돼요</div>
            </div>
            <div style={{fontSize:15,fontWeight:800,color:C.green}}>+{fmt(fixedIncome)}원</div>
          </div>
        )}
      </div>

      {/* 카드 결제 예정 */}
      <div style={{background:C.card,borderRadius:16,padding:18,marginBottom:12}}>
        <div style={{fontSize:14,fontWeight:800,color:C.text,marginBottom:14}}>💳 이번달 카드 결제 예정</div>
        {[["변지원","cardJw",C.jw],["정수현","cardSh",C.sh]].map(([name,key,color])=>(
          <div key={key} style={{marginBottom:10}}>
            <Label><span style={{color}}>{name}</span></Label>
            <input value={data[key]} onChange={e=>setData(d=>({...d,[key]:e.target.value}))} placeholder="0" type="number" style={{...inp,fontSize:16,fontWeight:700}}/>
          </div>
        ))}
      </div>

      {/* 저축 목표 */}
      <div style={{background:C.card,borderRadius:16,padding:18,marginBottom:16}}>
        <div style={{fontSize:14,fontWeight:800,color:C.text,marginBottom:12}}>🎯 이번달 저축 목표</div>
        <input value={data.savingGoal} onChange={e=>setData(d=>({...d,savingGoal:e.target.value}))} placeholder="0" type="number" style={{...inp,fontSize:16,fontWeight:700}}/>
      </div>

      <button onClick={()=>save(data)} style={bigBtn("#fff",`linear-gradient(135deg,#7A5C38,${C.accent})`)}>계산하기</button>

      {/* 결과 */}
      {done&&(
        <div style={{marginTop:20}}>
          <div style={{fontSize:12,color:C.sub,fontWeight:700,marginBottom:10,paddingLeft:2}}>📊 정산 결과</div>

          {/* 잔액 풀 계산 */}
          <div style={{background:C.card,borderRadius:16,padding:18,marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>잔액 풀 구성</div>
            <Row label="보유 현금 합계" value={`${fmt(totalCash)}원`} color={C.green}/>
            {fixedIncome>0&&<Row label="고정수입 (월급 등)" value={`+${fmt(fixedIncome)}원`} color={C.green} sub={fixedItems.income?.map(i=>`${i.name} ${fmt(i.amount)}원`).join(" · ")}/>}
            <Row label="→ 잔액 풀" value={`${fmt(pool)}원`} color={C.primary} noBorder/>
          </div>

          {/* 차감 내역 */}
          <div style={{background:C.card,borderRadius:16,padding:18,marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>차감 내역</div>
            <Row label="카드 결제 예정" value={`-${fmt(totalCard)}원`} color={C.red} sub={`지원 ${fmt(cardJw)}원 · 수현 ${fmt(cardSh)}원`}/>
            {fixedExp>0&&<Row label="고정지출" value={`-${fmt(fixedExp)}원`} color={C.red} sub={fixedItems.expense?.map(i=>`${i.name} ${fmt(i.amount)}원`).join(" · ")||"없음"}/>}
            {instTotal>0&&<Row label="이번달 할부" value={`-${fmt(instTotal)}원`} color={C.red} sub={installments.filter(i=>getInstSt(i,year,month)).map(i=>`${i.name} ${fmt(i.amount)}원`).join(" · ")||"없음"}/>}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:6}}>
              <span style={{fontSize:14,fontWeight:700,color:C.text}}>순 가용금액</span>
              <span style={{fontSize:22,fontWeight:800,color:avail>=0?C.primary:C.red}}>{avail>=0?"":"-"}{fmtAbs(avail)}원</span>
            </div>
            {avail<0&&<div style={{marginTop:8,background:C.redBg,borderRadius:8,padding:"8px 12px",fontSize:12,color:C.red,fontWeight:600}}>⚠️ 지출이 수입을 초과해요</div>}
          </div>

          {/* 저축 후 */}
          {savingGoal>0&&(
            <div style={{background:C.card,borderRadius:16,padding:18,marginBottom:12}}>
              <Row label="저축 목표" value={`-${fmt(savingGoal)}원`} color={C.blue}/>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:14,fontWeight:700,color:C.text}}>저축 후 가용금액</span>
                <span style={{fontSize:22,fontWeight:800,color:availAfterSaving>=0?C.green:C.red}}>{availAfterSaving>=0?"":"-"}{fmtAbs(availAfterSaving)}원</span>
              </div>
              {availAfterSaving<0&&<div style={{marginTop:8,background:C.redBg,borderRadius:8,padding:"8px 12px",fontSize:12,color:C.red,fontWeight:600}}>⚠️ 저축 목표를 줄이거나 지출을 줄여야 해요</div>}
              {availAfterSaving>=0&&availAfterSaving<savingGoal*0.3&&<div style={{marginTop:8,background:C.yellowBg,borderRadius:8,padding:"8px 12px",fontSize:12,color:C.yellow,fontWeight:600}}>💛 여유가 빠듯해요</div>}
            </div>
          )}

          {/* 1인당 */}
          {availAfterSaving>0&&(
            <div style={{background:C.greenBg,borderRadius:14,padding:"16px",marginBottom:12,border:`1px solid ${C.green}22`}}>
              <div style={{fontSize:12,color:C.green,fontWeight:700,marginBottom:10}}>💚 각자 쓸 수 있는 금액</div>
              <div style={{display:"flex",gap:10}}>
                {Object.entries(MEMBERS).map(([k,m])=>(
                  <div key={k} style={{flex:1,background:"rgba(255,255,255,.7)",borderRadius:10,padding:"12px"}}>
                    <div style={{fontSize:11,color:m.color,fontWeight:700,marginBottom:4}}>{m.label}</div>
                    <div style={{fontSize:18,fontWeight:800,color:C.text}}>{fmt(Math.floor(availAfterSaving/2))}원</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 다음달 예고 */}
          <div style={{background:C.card,borderRadius:16,padding:18,marginBottom:4}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>📅 다음달 고정 예정 ({MONTH_NAMES[nm]})</div>
            <Row label="고정지출" value={`-${fmt(fixedExp)}원`} color={C.sub}/>
            <Row label="할부" value={`-${fmt(nextInst)}원`} color={C.sub}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:13,fontWeight:700,color:C.text}}>예상 고정 지출</span>
              <span style={{fontSize:17,fontWeight:800,color:C.primary}}>{fmt(nextDeduct)}원</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 메인 ─────────────────────────────────────────────
export default function App(){
  const today=new Date();
  const todayStr=today.toISOString().slice(0,10);
  const [year,setYear]=useState(today.getFullYear());
  const [month,setMonth]=useState(today.getMonth());
  const [tab,setTab]=useState("settle");
  const [loading,setLoading]=useState(true);

  const [entries,setEntries]=useState([]);
  const [budgetLimit,setBudgetLimit]=useState(null);
  const [budgetInput,setBudgetInput]=useState("");
  const [editBudget,setEditBudget]=useState(false);
  const [fixedExps,setFixedExps]=useState([]);
  const [installs,setInstalls]=useState([]);
  const [fixedIncomes,setFixedIncomes]=useState([]);
  const [profiles,setProfiles]=useState({jiwon:{},suhyun:{}});
  const [fixedSub,setFixedSub]=useState("income");

  // 폼/삭제
  const [showEF,setShowEF]=useState(false);
  const [showFE,setShowFE]=useState(false);
  const [showFI,setShowFI]=useState(false);
  const [showIN,setShowIN]=useState(false);
  const [delE,setDelE]=useState(null);
  const [delFE,setDelFE]=useState(null);
  const [delFI,setDelFI]=useState(null);
  const [delIN,setDelIN]=useState(null);

  const [ef,setEf]=useState({type:"expense",who:"jiwon",cat:"식비",amount:"",memo:"",date:todayStr});
  const [feForm,setFeForm]=useState({name:"",who:"jiwon",fixedType:"대출",amount:"",memo:"",expiryDate:""});
  const [fiForm,setFiForm]=useState({name:"",who:"jiwon",incomeType:"월급",amount:"",memo:""});
  const [inForm,setInForm]=useState({name:"",who:"jiwon",card:"현대카드",amount:"",memo:"",sy:today.getFullYear(),sm:today.getMonth(),mode:"months",months:"",endDate:""});

  const loadAll=useCallback(async()=>{
    setLoading(true);
    const ld=async(k,sh,fb)=>{try{const r=await window.storage.get(k,sh);return r?JSON.parse(r.value):fb;}catch{return fb;}};
    const ln=async(k,sh)=>{try{const r=await window.storage.get(k,sh);return r?Number(r.value):null;}catch{return null;}};
    setEntries(await ld(gk(year,month),true,[]));
    setBudgetLimit(await ln(bk(year,month),true));
    setFixedExps(await ld(FK,true,[]));
    setInstalls(await ld(IK,true,[]));
    setFixedIncomes(await ld(FIK,true,[]));
    setProfiles(await ld(PK,true,{jiwon:{},suhyun:{}}));
    setLoading(false);
  },[year,month]);
  useEffect(()=>{loadAll();},[loadAll]);

  const sv=(k,v,sh)=>window.storage.set(k,typeof v==="string"?v:JSON.stringify(v),sh);
  const saveEntries  =async nx=>{await sv(gk(year,month),nx,true);setEntries(nx);};
  const saveFixedExps=async nx=>{await sv(FK,nx,true);setFixedExps(nx);};
  const saveInstalls =async nx=>{await sv(IK,nx,true);setInstalls(nx);};
  const saveFixedInc =async nx=>{await sv(FIK,nx,true);setFixedIncomes(nx);};
  const saveProfiles =async nx=>{await sv(PK,nx,true);setProfiles(nx);};

  const addEntry=async()=>{
    const a=pn(ef.amount); if(!a)return;
    const e={id:Date.now()+Math.random(),...ef,amount:a,createdAt:new Date().toISOString()};
    await saveEntries([e,...entries].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)));
    setShowEF(false); setEf({type:"expense",who:"jiwon",cat:"식비",amount:"",memo:"",date:todayStr});
  };
  const addFixedExp=async()=>{
    if(!feForm.name||!feForm.amount)return;
    await saveFixedExps([...fixedExps,{id:Date.now()+Math.random(),...feForm,amount:pn(feForm.amount)}]);
    setShowFE(false); setFeForm({name:"",who:"jiwon",fixedType:"대출",amount:"",memo:"",expiryDate:""});
  };
  const addFixedInc=async()=>{
    if(!fiForm.name||!fiForm.amount)return;
    await saveFixedInc([...fixedIncomes,{id:Date.now()+Math.random(),...fiForm,amount:pn(fiForm.amount)}]);
    setShowFI(false); setFiForm({name:"",who:"jiwon",incomeType:"월급",amount:"",memo:""});
  };
  const addInstall=async()=>{
    if(!inForm.name||!inForm.amount)return;
    let months=Number(inForm.months);
    if(inForm.mode==="endDate"&&inForm.endDate){const[ey,em]=inForm.endDate.split("-").map(Number);months=(ey-inForm.sy)*12+(em-1-inForm.sm)+1;}
    if(!months||months<=0)return;
    await saveInstalls([...installs,{id:Date.now()+Math.random(),name:inForm.name,who:inForm.who,card:inForm.card,amount:pn(inForm.amount),months,sy:inForm.sy,sm:inForm.sm,memo:inForm.memo}]);
    setShowIN(false); setInForm({name:"",who:"jiwon",card:"현대카드",amount:"",memo:"",sy:today.getFullYear(),sm:today.getMonth(),mode:"months",months:"",endDate:""});
  };
  const saveBudget=async()=>{
    const v=pn(budgetInput); if(!v)return;
    await sv(bk(year,month),String(v),true); setBudgetLimit(v); setEditBudget(false);
  };

  // 집계
  const activeInst=installs.map(i=>({...i,st:getInstSt(i,year,month)})).filter(i=>i.st);
  const fixedExpTotal=fixedExps.reduce((s,i)=>s+i.amount,0);
  const instTotal   =activeInst.reduce((s,i)=>s+i.amount,0);
  const fixedIncTotal=fixedIncomes.reduce((s,i)=>s+i.amount,0);
  const autoExp=fixedExpTotal+instTotal;
  const totalInc=entries.filter(e=>e.type==="income").reduce((s,e)=>s+e.amount,0)+fixedIncTotal;
  const totalExp=entries.filter(e=>e.type==="expense").reduce((s,e)=>s+e.amount,0)+autoExp;
  const balance=totalInc-totalExp;
  const budgetUsed=budgetLimit?Math.min(totalExp/budgetLimit,1):0;

  const catStats={};
  entries.filter(e=>e.type==="expense").forEach(e=>{catStats[e.cat]=(catStats[e.cat]||0)+e.amount;});
  if(fixedExpTotal)catStats["고정지출"]=(catStats["고정지출"]||0)+fixedExpTotal;
  if(instTotal)catStats["할부"]=(catStats["할부"]||0)+instTotal;
  const catList=Object.entries(catStats).sort((a,b)=>b[1]-a[1]);
  const maxCat=catList[0]?.[1]||1;

  const grouped={};
  entries.forEach(e=>{(grouped[e.date]=grouped[e.date]||[]).push(e);});
  const dates=Object.keys(grouped).sort((a,b)=>b.localeCompare(a));

  const prev=()=>month===0?(setYear(y=>y-1),setMonth(11)):setMonth(m=>m-1);
  const next=()=>month===11?(setYear(y=>y+1),setMonth(0)):setMonth(m=>m+1);

  const ny=month===11?year+1:year, nm=month===11?0:month+1;
  const instPreview=()=>{
    if(inForm.mode==="months")return Number(inForm.months)||0;
    if(inForm.endDate){const[ey,em]=inForm.endDate.split("-").map(Number);return(ey-inForm.sy)*12+(em-1-inForm.sm)+1;}
    return 0;
  };
  const instEndLabel=m=>{if(!m||m<=0)return null;const e=new Date(inForm.sy,inForm.sm+m-1,1);return`${e.getFullYear()}년 ${MONTH_NAMES[e.getMonth()]}`;};

  const CATS_EXP=["식비","교통","쇼핑","의료","구독","외식","문화","기타"];
  const CATS_INC=["월급","부수입","용돈","기타수입"];

  const MemberToggle=({value,onChange})=>(
    <div style={{display:"flex",gap:8}}>
      {Object.entries(MEMBERS).map(([k,m])=>(
        <button key={k} onClick={()=>onChange(k)} style={{flex:1,padding:"9px 0",border:`2px solid ${value===k?m.color:C.border}`,borderRadius:10,background:value===k?m.bg:C.card,color:value===k?m.color:C.muted,fontWeight:700,fontSize:13,cursor:"pointer"}}>{m.label}</button>
      ))}
    </div>
  );

  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Pretendard','Apple SD Gothic Neo',sans-serif",maxWidth:480,margin:"0 auto",paddingBottom:88}}>

      {/* 헤더 */}
      <div style={{background:`linear-gradient(140deg,#6B5236,${C.accent})`,padding:"22px 20px 16px",color:"#fff"}}>
        {/* 프로필 행 */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <Avatar src={profiles.jiwon?.photo} initial="지원" color={C.jw} size={38}/>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.9)"}}>변지원</div>
              {profiles.jiwon?.bio&&<div style={{fontSize:10,color:"rgba(255,255,255,.65)"}}>{profiles.jiwon.bio}</div>}
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <button onClick={prev} style={{background:"rgba(255,255,255,.18)",border:"none",color:"#fff",borderRadius:8,width:30,height:30,fontSize:15,cursor:"pointer"}}>‹</button>
            <span style={{fontSize:16,fontWeight:700,minWidth:80,textAlign:"center"}}>{year}년 {MONTH_NAMES[month]}</span>
            <button onClick={next} style={{background:"rgba(255,255,255,.18)",border:"none",color:"#fff",borderRadius:8,width:30,height:30,fontSize:15,cursor:"pointer"}}>›</button>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.9)"}}>정수현</div>
              {profiles.suhyun?.bio&&<div style={{fontSize:10,color:"rgba(255,255,255,.65)"}}>{profiles.suhyun.bio}</div>}
            </div>
            <Avatar src={profiles.suhyun?.photo} initial="수현" color={C.sh} size={38}/>
          </div>
        </div>
        {/* 요약 */}
        <div style={{display:"flex",gap:8}}>
          {[["수입",`+${fmt(totalInc)}`,"#c8f0d8"],["지출",`-${fmt(totalExp)}`,"#ffd4d4"],["잔액",`${balance>=0?"+":""}${fmt(balance)}`,balance>=0?"#c8f0d8":"#ffd4d4"]].map(([l,v,c])=>(
            <div key={l} style={{flex:1,background:"rgba(255,255,255,.14)",borderRadius:12,padding:"10px 8px"}}>
              <div style={{fontSize:10,opacity:.8,marginBottom:2}}>{l}</div>
              <div style={{fontSize:13,fontWeight:700,color:c}}>{v}원</div>
            </div>
          ))}
        </div>
        {autoExp>0&&<div style={{marginTop:8,background:"rgba(255,255,255,.12)",borderRadius:9,padding:"7px 12px",fontSize:11,color:"rgba(255,255,255,.85)"}}>📌 고정 {fmt(fixedExpTotal)}원 + 할부 {fmt(instTotal)}원 자동 포함</div>}
        {budgetLimit&&(
          <div style={{marginTop:8,background:"rgba(255,255,255,.12)",borderRadius:9,padding:"9px 12px"}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,opacity:.85,marginBottom:5}}><span>예산</span><span>{fmt(totalExp)} / {fmt(budgetLimit)}원</span></div>
            <div style={{background:"rgba(255,255,255,.2)",borderRadius:99,height:5}}>
              <div style={{width:`${budgetUsed*100}%`,height:"100%",background:budgetUsed>.9?"#fca5a5":budgetUsed>.7?"#fde68a":"#a5f3d0",borderRadius:99,transition:"width .5s"}}/>
            </div>
          </div>
        )}
      </div>

      {/* 탭바 */}
      <div style={{display:"flex",background:C.card,borderBottom:`1px solid ${C.border}`,overflowX:"auto"}}>
        {[["settle","정산"],["feed","내역"],["fixed","고정/할부"],["stats","통계"],["budget","예산"],["profile","프로필"]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{flex:"0 0 auto",padding:"11px 12px",border:"none",background:"none",fontWeight:tab===k?700:400,color:tab===k?C.primary:C.muted,fontSize:12,borderBottom:tab===k?`2.5px solid ${C.primary}`:"2.5px solid transparent",cursor:"pointer",whiteSpace:"nowrap"}}>{l}</button>
        ))}
      </div>

      {/* 콘텐츠 */}
      <div style={{padding:"16px 16px 0"}}>
        {loading?<div style={{textAlign:"center",padding:60,color:C.muted}}>불러오는 중...</div>

        :tab==="settle"?(
          <SettleTab year={year} month={month} fixedIncome={fixedIncTotal} fixedExp={fixedExpTotal} instTotal={instTotal} installments={installs}
            fixedItems={{income:fixedIncomes,expense:fixedExps}}/>

        ):tab==="feed"?(<>
          {(fixedExps.length>0||activeInst.length>0)&&(
            <div style={{background:C.card,borderRadius:14,padding:"12px 14px",marginBottom:14,borderLeft:`4px solid ${C.accent}`}}>
              <div style={{fontSize:12,fontWeight:700,color:C.accent,marginBottom:8}}>📌 이번달 자동 지출</div>
              {fixedExps.map(i=>(
                <div key={i.id} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.sub,marginBottom:4}}>
                  <span style={{color:MEMBERS[i.who]?.color,fontWeight:600}}>[{MEMBERS[i.who]?.initial}]</span>
                  <span style={{flex:1,marginLeft:6}}>{i.name}</span>
                  <span style={{fontWeight:700,color:C.primary}}>-{fmt(i.amount)}원</span>
                </div>
              ))}
              {activeInst.map(i=>(
                <div key={i.id} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.sub,marginBottom:4}}>
                  <span style={{color:MEMBERS[i.who]?.color,fontWeight:600}}>[{MEMBERS[i.who]?.initial}]</span>
                  <span style={{flex:1,marginLeft:6}}>{i.name} {i.st.isLast?<span style={{background:C.greenBg,color:C.green,borderRadius:4,padding:"1px 5px",fontSize:10,fontWeight:700}}>✅마지막</span>:<span style={{color:C.muted}}>({i.st.cur}/{i.st.total}회)</span>}</span>
                  <span style={{fontWeight:700,color:C.sh}}>-{fmt(i.amount)}원</span>
                </div>
              ))}
            </div>
          )}
          {dates.length===0&&fixedExps.length===0&&activeInst.length===0?(
            <div style={{textAlign:"center",padding:"64px 20px",color:C.muted}}>
              <div style={{fontSize:38,marginBottom:10}}>📒</div>
              <div style={{fontSize:14,fontWeight:600,color:C.sub}}>아직 내역이 없어요</div>
              <div style={{fontSize:12,color:C.muted,marginTop:5}}>아래 + 버튼으로 추가해보세요</div>
            </div>
          ):dates.map(date=>(
            <div key={date} style={{marginBottom:18}}>
              <div style={{fontSize:11,color:C.muted,fontWeight:600,marginBottom:7}}>{new Date(date+"T00:00:00").toLocaleDateString("ko-KR",{month:"long",day:"numeric",weekday:"short"})}</div>
              {grouped[date].map(e=>(
                <div key={e.id} onClick={()=>setDelE(e.id)} style={{background:C.card,borderRadius:13,padding:"11px 14px",display:"flex",alignItems:"center",gap:10,marginBottom:7,borderLeft:`4px solid ${MEMBERS[e.who]?.color||C.primary}`}}>
                  <div style={{background:MEMBERS[e.who]?.bg,borderRadius:7,padding:"3px 8px",fontSize:11,fontWeight:700,color:MEMBERS[e.who]?.color,whiteSpace:"nowrap"}}>{MEMBERS[e.who]?.initial}</div>
                  <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.cat}{e.memo?` · ${e.memo}`:""}</div></div>
                  <div style={{fontWeight:700,fontSize:14,color:e.type==="income"?C.green:C.primary,whiteSpace:"nowrap"}}>{e.type==="income"?"+":"-"}{fmt(e.amount)}원</div>
                </div>
              ))}
            </div>
          ))}
        </>):tab==="fixed"?(<>
          <div style={{display:"flex",background:C.primaryBg,borderRadius:12,padding:4,marginBottom:14}}>
            {[["income","고정수입"],["expense","고정지출"],["install","할부"]].map(([k,l])=>(
              <button key={k} onClick={()=>setFixedSub(k)} style={{flex:1,padding:"8px 0",border:"none",borderRadius:10,background:fixedSub===k?C.primary:"transparent",color:fixedSub===k?"#fff":C.sub,fontWeight:700,fontSize:12,cursor:"pointer"}}>{l}</button>
            ))}
          </div>

          {fixedSub==="income"?(<>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:700,color:C.text}}>고정수입 <span style={{color:C.green}}>월 {fmt(fixedIncTotal)}원</span></div>
              <button onClick={()=>setShowFI(true)} style={{background:C.greenBg,color:C.green,border:"none",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ 추가</button>
            </div>
            {fixedIncomes.length===0?(
              <div style={{textAlign:"center",padding:"40px 20px",color:C.muted}}><div style={{fontSize:32,marginBottom:8}}>📥</div><div style={{fontSize:13,color:C.sub}}>월급·부수입 등을 등록하면<br/>정산에 자동으로 반영돼요</div></div>
            ):fixedIncomes.map(item=>(
              <div key={item.id} onClick={()=>setDelFI(item.id)} style={{background:C.card,borderRadius:14,padding:"14px 16px",marginBottom:10,borderLeft:`4px solid ${MEMBERS[item.who]?.color||C.green}`}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                      <span style={{background:MEMBERS[item.who]?.bg,color:MEMBERS[item.who]?.color,fontSize:10,fontWeight:700,borderRadius:6,padding:"2px 7px"}}>{MEMBERS[item.who]?.initial}</span>
                      <span style={{background:C.greenBg,color:C.green,fontSize:10,fontWeight:600,borderRadius:6,padding:"2px 7px"}}>{item.incomeType}</span>
                    </div>
                    <div style={{fontSize:14,fontWeight:700,color:C.text}}>{item.name}</div>
                    {item.memo&&<div style={{fontSize:11,color:C.muted,marginTop:2}}>{item.memo}</div>}
                  </div>
                  <div style={{textAlign:"right"}}><div style={{fontSize:15,fontWeight:800,color:C.green}}>+{fmt(item.amount)}원</div><div style={{fontSize:10,color:C.muted}}>매달</div></div>
                </div>
              </div>
            ))}
          </>):fixedSub==="expense"?(<>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:700,color:C.text}}>고정지출 <span style={{color:C.primary}}>월 {fmt(fixedExpTotal)}원</span></div>
              <button onClick={()=>setShowFE(true)} style={{background:C.primaryBg,color:C.primary,border:"none",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ 추가</button>
            </div>
            {fixedExps.length===0?(
              <div style={{textAlign:"center",padding:"40px 20px",color:C.muted}}><div style={{fontSize:32,marginBottom:8}}>📋</div><div style={{fontSize:13,color:C.sub}}>대출·보험 등 고정지출을 등록해보세요</div></div>
            ):fixedExps.map(item=>{const dd=dday(item.expiryDate);return(
              <div key={item.id} onClick={()=>setDelFE(item.id)} style={{background:C.card,borderRadius:14,padding:"14px 16px",marginBottom:10,borderLeft:`4px solid ${MEMBERS[item.who]?.color||C.primary}`}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"}}>
                      <span style={{background:MEMBERS[item.who]?.bg,color:MEMBERS[item.who]?.color,fontSize:10,fontWeight:700,borderRadius:6,padding:"2px 7px"}}>{MEMBERS[item.who]?.initial}</span>
                      <span style={{background:C.bg,color:C.sub,fontSize:10,fontWeight:600,borderRadius:6,padding:"2px 7px"}}>{item.fixedType}</span>
                      {dd&&<span style={{background:dd.bg,color:dd.color,fontSize:10,fontWeight:700,borderRadius:6,padding:"2px 7px"}}>{dd.label}</span>}
                    </div>
                    <div style={{fontSize:14,fontWeight:700,color:C.text}}>{item.name}</div>
                    {item.expiryDate&&<div style={{fontSize:11,color:C.muted,marginTop:3}}>만기일 {new Date(item.expiryDate+"T00:00:00").toLocaleDateString("ko-KR",{year:"numeric",month:"long",day:"numeric"})}</div>}
                    {item.memo&&<div style={{fontSize:11,color:C.muted,marginTop:2}}>{item.memo}</div>}
                  </div>
                  <div style={{textAlign:"right"}}><div style={{fontSize:15,fontWeight:800,color:C.primary}}>-{fmt(item.amount)}원</div><div style={{fontSize:10,color:C.muted}}>매달</div></div>
                </div>
              </div>
            );})}
          </>):(<>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:700,color:C.text}}>할부 <span style={{color:C.sh}}>이번달 {fmt(instTotal)}원</span></div>
              <button onClick={()=>setShowIN(true)} style={{background:C.shBg,color:C.sh,border:"none",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ 추가</button>
            </div>
            {installs.length===0?(
              <div style={{textAlign:"center",padding:"40px 20px",color:C.muted}}><div style={{fontSize:32,marginBottom:8}}>💳</div><div style={{fontSize:13,color:C.sub}}>카드 할부를 등록하면 회차가 자동 추적돼요</div></div>
            ):installs.map(item=>{
              const st=getInstSt(item,year,month);
              const endD=new Date(item.sy,item.sm+item.months-1,1);
              const isPast=new Date(year,month,1)>endD;
              return(
                <div key={item.id} onClick={()=>setDelIN(item.id)} style={{background:C.card,borderRadius:14,padding:"14px 16px",marginBottom:10,borderLeft:`4px solid ${isPast?C.border:st?.isLast?C.green:MEMBERS[item.who]?.color}`,opacity:isPast?0.55:1}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5,flexWrap:"wrap"}}>
                        <span style={{background:MEMBERS[item.who]?.bg,color:MEMBERS[item.who]?.color,fontSize:10,fontWeight:700,borderRadius:6,padding:"2px 7px"}}>{MEMBERS[item.who]?.initial}</span>
                        <span style={{background:C.shBg,color:C.sh,fontSize:10,fontWeight:600,borderRadius:6,padding:"2px 7px"}}>💳 {item.card}</span>
                        {isPast&&<span style={{background:C.bg,color:C.muted,fontSize:10,fontWeight:700,borderRadius:6,padding:"2px 7px"}}>완료</span>}
                        {st?.isLast&&<span style={{background:C.greenBg,color:C.green,fontSize:10,fontWeight:700,borderRadius:6,padding:"2px 7px"}}>✅ 이번달 끝!</span>}
                      </div>
                      <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:5}}>{item.name}</div>
                      {!isPast&&st&&(<>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted,marginBottom:4}}><span>{st.cur}/{st.total}회차</span><span>{item.sy}년 {MONTH_NAMES[item.sm]} ~ {endD.getFullYear()}년 {MONTH_NAMES[endD.getMonth()]}</span></div>
                        <div style={{background:C.bg,borderRadius:99,height:6}}><div style={{width:`${(st.cur/st.total)*100}%`,height:"100%",background:st.isLast?C.green:C.sh,borderRadius:99,transition:"width .5s"}}/></div>
                      </>)}
                      {isPast&&<div style={{fontSize:11,color:C.muted}}>{item.sy}년 {MONTH_NAMES[item.sm]} ~ {endD.getFullYear()}년 {MONTH_NAMES[endD.getMonth()]} 완료</div>}
                      {item.memo&&<div style={{fontSize:11,color:C.muted,marginTop:4}}>{item.memo}</div>}
                    </div>
                    <div style={{textAlign:"right"}}><div style={{fontSize:15,fontWeight:800,color:isPast?C.muted:C.sh}}>-{fmt(item.amount)}원</div><div style={{fontSize:10,color:C.muted}}>월 납입</div></div>
                  </div>
                </div>
              );
            })}
          </>)}

        </>):tab==="stats"?(<>
          <div style={{background:C.card,borderRadius:16,padding:16,marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>카테고리별 지출</div>
            {catList.length===0?<div style={{color:C.muted,fontSize:13,textAlign:"center",padding:"14px 0"}}>지출 내역이 없어요</div>:catList.map(([cat,amt])=>(
              <div key={cat} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}><span style={{fontWeight:600,color:C.text}}>{cat}</span><span style={{color:C.sub}}>{fmt(amt)}원</span></div>
                <div style={{background:C.bg,borderRadius:99,height:8}}><div style={{width:`${(amt/maxCat)*100}%`,height:"100%",background:`linear-gradient(90deg,${C.primary},${C.accent})`,borderRadius:99}}/></div>
              </div>
            ))}
          </div>
          <div style={{background:C.card,borderRadius:16,padding:16,marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>수입 vs 지출</div>
            <div style={{display:"flex",gap:12,alignItems:"flex-end",height:110}}>
              {[["수입",totalInc,C.green],["지출",totalExp,C.primary]].map(([l,v,col])=>{
                const max=Math.max(totalInc,totalExp,1);const h=Math.max((v/max)*86,4);
                return<div key={l} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                  <div style={{fontSize:11,color:col,fontWeight:700}}>{fmt(v)}</div>
                  <div style={{width:"55%",height:h,background:col,borderRadius:"6px 6px 0 0"}}/>
                  <div style={{fontSize:11,color:C.muted}}>{l}</div>
                </div>;
              })}
            </div>
          </div>
        </>):tab==="budget"?(<>
          <div style={{background:C.card,borderRadius:16,padding:20,marginBottom:14}}>
            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:3}}>{MONTH_NAMES[month]} 예산 설정</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:16}}>고정지출이 자동 반영돼요</div>
            {editBudget||!budgetLimit?(
              <div style={{display:"flex",gap:8}}>
                <input value={budgetInput} onChange={e=>setBudgetInput(e.target.value)} placeholder="예: 2,000,000" style={{...inp,flex:1,fontSize:15}}/>
                <button onClick={saveBudget} style={{background:C.primary,color:"#fff",border:"none",borderRadius:10,padding:"10px 16px",fontSize:13,fontWeight:700,cursor:"pointer"}}>저장</button>
              </div>
            ):(<>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <span style={{fontSize:22,fontWeight:800,color:C.primary}}>{fmt(budgetLimit)}원</span>
                <button onClick={()=>{setEditBudget(true);setBudgetInput(String(budgetLimit));}} style={{background:C.primaryBg,color:C.primary,border:"none",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>수정</button>
              </div>
              <div style={{background:C.bg,borderRadius:99,height:12,marginBottom:8}}><div style={{width:`${budgetUsed*100}%`,height:"100%",background:budgetUsed>.9?C.red:budgetUsed>.7?C.yellow:C.primary,borderRadius:99}}/></div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.muted}}><span>{fmt(totalExp)}원 사용</span><span>{Math.round(budgetUsed*100)}%</span></div>
              {budgetUsed>.9&&<div style={{marginTop:12,background:C.redBg,borderRadius:10,padding:"10px 14px",fontSize:12,color:C.red,fontWeight:600}}>⚠️ 예산의 90%를 넘었어요!</div>}
              {budgetUsed>.7&&budgetUsed<=.9&&<div style={{marginTop:12,background:C.yellowBg,borderRadius:10,padding:"10px 14px",fontSize:12,color:C.yellow,fontWeight:600}}>💛 예산의 70%를 넘었어요</div>}
            </>)}
          </div>
        </>):(
          <ProfileTab profiles={profiles} saveProfiles={saveProfiles}/>
        )}
      </div>

      {/* FAB */}
      {tab==="feed"&&<button onClick={()=>setShowEF(true)} style={{position:"fixed",bottom:26,right:"calc(50% - 228px)",width:54,height:54,borderRadius:"50%",background:`linear-gradient(135deg,#6B5236,${C.accent})`,color:"#fff",border:"none",fontSize:26,cursor:"pointer",boxShadow:`0 4px 18px rgba(139,111,71,.45)`,display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>+</button>}

      {/* ── 내역 추가 ── */}
      {showEF&&<Sheet onClose={()=>setShowEF(false)} title="내역 추가">
        <div style={{display:"flex",background:C.bg,borderRadius:12,padding:4,marginBottom:14}}>
          {[["expense","지출"],["income","수입"]].map(([k,l])=>(
            <button key={k} onClick={()=>setEf(f=>({...f,type:k,cat:k==="income"?"월급":"식비"}))} style={{flex:1,padding:"8px 0",border:"none",borderRadius:10,background:ef.type===k?(k==="income"?C.green:C.primary):"transparent",color:ef.type===k?"#fff":C.muted,fontWeight:700,fontSize:14,cursor:"pointer"}}>{l}</button>
          ))}
        </div>
        <div style={{marginBottom:14}}><Label>누구?</Label><MemberToggle value={ef.who} onChange={v=>setEf(f=>({...f,who:v}))}/></div>
        <div style={{marginBottom:14}}><Label>카테고리</Label><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{(ef.type==="income"?CATS_INC:CATS_EXP).map(c=><button key={c} onClick={()=>setEf(f=>({...f,cat:c}))} style={chip(ef.cat===c,C.primary,C.primaryBg)}>{c}</button>)}</div></div>
        <div style={{marginBottom:12}}><Label>금액</Label><input value={ef.amount} onChange={e=>setEf(f=>({...f,amount:e.target.value}))} placeholder="0" type="number" style={{...inp,fontSize:17,fontWeight:700}}/></div>
        <div style={{marginBottom:12}}><Label>메모 (선택)</Label><input value={ef.memo} onChange={e=>setEf(f=>({...f,memo:e.target.value}))} placeholder="예: 마트에서 장보기" style={inp}/></div>
        <div style={{marginBottom:22}}><Label>날짜</Label><input value={ef.date} onChange={e=>setEf(f=>({...f,date:e.target.value}))} type="date" style={inp}/></div>
        <button onClick={addEntry} style={bigBtn("#fff",`linear-gradient(135deg,#6B5236,${C.accent})`)}>저장하기</button>
      </Sheet>}

      {/* ── 고정수입 추가 ── */}
      {showFI&&<Sheet onClose={()=>setShowFI(false)} title="📥 고정수입 추가">
        <div style={{marginBottom:14}}><Label>누구 수입?</Label><MemberToggle value={fiForm.who} onChange={v=>setFiForm(f=>({...f,who:v}))}/></div>
        <div style={{marginBottom:14}}><Label>수입 종류</Label><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{INCOME_TYPES.map(t=><button key={t} onClick={()=>setFiForm(f=>({...f,incomeType:t}))} style={chip(fiForm.incomeType===t,C.green,C.greenBg)}>{t}</button>)}</div></div>
        <div style={{marginBottom:14}}><Label>이름</Label><input value={fiForm.name} onChange={e=>setFiForm(f=>({...f,name:e.target.value}))} placeholder="예: 변지원 월급, 정수현 월급" style={inp}/></div>
        <div style={{marginBottom:14}}><Label>월 수령액</Label><input value={fiForm.amount} onChange={e=>setFiForm(f=>({...f,amount:e.target.value}))} placeholder="0" type="number" style={{...inp,fontSize:16,fontWeight:700}}/></div>
        <div style={{marginBottom:22}}><Label>메모 (선택)</Label><input value={fiForm.memo} onChange={e=>setFiForm(f=>({...f,memo:e.target.value}))} placeholder="예: 매월 25일 입금" style={inp}/></div>
        <div style={{marginBottom:22,background:C.greenBg,borderRadius:10,padding:"10px 14px",fontSize:12,color:C.green,fontWeight:600}}>
          💡 등록한 월급은 정산 탭에서 잔액 풀에 자동으로 더해져요
        </div>
        <button onClick={addFixedInc} style={bigBtn("#fff",`linear-gradient(135deg,${C.green},#5ab87a)`)}>저장하기</button>
      </Sheet>}

      {/* ── 고정지출 추가 ── */}
      {showFE&&<Sheet onClose={()=>setShowFE(false)} title="고정지출 추가">
        <div style={{marginBottom:14}}><Label>누구 지출?</Label><MemberToggle value={feForm.who} onChange={v=>setFeForm(f=>({...f,who:v}))}/></div>
        <div style={{marginBottom:14}}><Label>종류</Label><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{FIXED_TYPES.map(t=><button key={t} onClick={()=>setFeForm(f=>({...f,fixedType:t}))} style={chip(feForm.fixedType===t,C.primary,C.primaryBg)}>{t}</button>)}</div></div>
        <div style={{marginBottom:14}}><Label>이름</Label><input value={feForm.name} onChange={e=>setFeForm(f=>({...f,name:e.target.value}))} placeholder="예: 주택담보대출, 실손보험" style={inp}/></div>
        <div style={{marginBottom:14}}><Label>월 납입액</Label><input value={feForm.amount} onChange={e=>setFeForm(f=>({...f,amount:e.target.value}))} placeholder="0" type="number" style={{...inp,fontSize:16,fontWeight:700}}/></div>
        <div style={{marginBottom:14}}><Label>메모 (선택)</Label><input value={feForm.memo} onChange={e=>setFeForm(f=>({...f,memo:e.target.value}))} placeholder="예: OO은행" style={inp}/></div>
        <div style={{marginBottom:22}}>
          <Label>만기일 (선택)</Label>
          <input value={feForm.expiryDate} onChange={e=>setFeForm(f=>({...f,expiryDate:e.target.value}))} type="date" style={inp}/>
          {feForm.expiryDate&&(()=>{const dd=dday(feForm.expiryDate);return dd&&<div style={{marginTop:8,background:dd.bg,borderRadius:8,padding:"8px 12px",fontSize:12,color:dd.color,fontWeight:600}}>{dd.label}</div>;})()}
        </div>
        <button onClick={addFixedExp} style={bigBtn("#fff",`linear-gradient(135deg,#6B5236,${C.accent})`)}>저장하기</button>
      </Sheet>}

      {/* ── 할부 추가 ── */}
      {showIN&&<Sheet onClose={()=>setShowIN(false)} title="💳 할부 추가">
        <div style={{marginBottom:14}}><Label>누구 카드?</Label><MemberToggle value={inForm.who} onChange={v=>setInForm(f=>({...f,who:v}))}/></div>
        <div style={{marginBottom:14}}><Label>카드사</Label><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{CARD_COMPANIES.map(c=><button key={c} onClick={()=>setInForm(f=>({...f,card:c}))} style={chip(inForm.card===c,C.sh,C.shBg)}>{c}</button>)}</div></div>
        <div style={{marginBottom:14}}><Label>항목 이름</Label><input value={inForm.name} onChange={e=>setInForm(f=>({...f,name:e.target.value}))} placeholder="예: 냉장고, 노트북" style={inp}/></div>
        <div style={{marginBottom:14}}><Label>월 납입액</Label><input value={inForm.amount} onChange={e=>setInForm(f=>({...f,amount:e.target.value}))} placeholder="0" type="number" style={{...inp,fontSize:16,fontWeight:700}}/></div>
        <div style={{marginBottom:14}}>
          <Label>시작 월</Label>
          <div style={{display:"flex",gap:8}}>
            <select value={inForm.sy} onChange={e=>setInForm(f=>({...f,sy:Number(e.target.value)}))} style={{...inp,flex:1}}>{[today.getFullYear()-2,today.getFullYear()-1,today.getFullYear(),today.getFullYear()+1].map(y=><option key={y} value={y}>{y}년</option>)}</select>
            <select value={inForm.sm} onChange={e=>setInForm(f=>({...f,sm:Number(e.target.value)}))} style={{...inp,flex:1}}>{MONTH_NAMES.map((m,i)=><option key={i} value={i}>{m}</option>)}</select>
          </div>
        </div>
        <div style={{marginBottom:14}}>
          <Label>할부 기간</Label>
          <div style={{display:"flex",background:C.bg,borderRadius:11,padding:4,marginBottom:12}}>
            {[["months","회차 수 입력"],["endDate","만기 날짜 선택"]].map(([k,l])=>(
              <button key={k} onClick={()=>setInForm(f=>({...f,mode:k}))} style={{flex:1,padding:"8px 6px",border:"none",borderRadius:9,background:inForm.mode===k?C.card:"transparent",color:inForm.mode===k?C.primary:C.muted,fontWeight:inForm.mode===k?700:500,fontSize:12,cursor:"pointer",boxShadow:inForm.mode===k?"0 1px 4px rgba(0,0,0,.08)":"none"}}>{l}</button>
            ))}
          </div>
          {inForm.mode==="months"?(
            <div>
              <input value={inForm.months} onChange={e=>setInForm(f=>({...f,months:e.target.value}))} placeholder="예: 24" type="number" style={inp}/>
              {Number(inForm.months)>0&&<div style={{marginTop:8,background:C.shBg,borderRadius:8,padding:"8px 12px",fontSize:12,color:C.sh,fontWeight:600}}>총 {inForm.months}회 · {instEndLabel(instPreview())}에 완료</div>}
            </div>
          ):(
            <div>
              <div style={{fontSize:11,color:C.muted,marginBottom:6}}>마지막으로 납부하는 달을 선택하세요</div>
              <input value={inForm.endDate} onChange={e=>setInForm(f=>({...f,endDate:e.target.value}))} type="month" style={inp}/>
              {inForm.endDate&&instPreview()>0&&<div style={{marginTop:8,background:C.shBg,borderRadius:8,padding:"8px 12px",fontSize:12,color:C.sh,fontWeight:600}}>총 {instPreview()}회 · {instEndLabel(instPreview())}에 완료</div>}
              {inForm.endDate&&instPreview()<=0&&<div style={{marginTop:8,background:C.redBg,borderRadius:8,padding:"8px 12px",fontSize:12,color:C.red,fontWeight:600}}>만기 날짜가 시작 월보다 빨라요</div>}
            </div>
          )}
        </div>
        <div style={{marginBottom:22}}><Label>메모 (선택)</Label><input value={inForm.memo} onChange={e=>setInForm(f=>({...f,memo:e.target.value}))} placeholder="예: 삼성 냉장고 24개월" style={inp}/></div>
        <button onClick={addInstall} style={bigBtn("#fff",`linear-gradient(135deg,${C.sh},#9b8dc0)`)}>저장하기</button>
      </Sheet>}

      {/* 삭제 모달 */}
      {delE   &&<DelModal onCancel={()=>setDelE(null)}   onConfirm={()=>{saveEntries(entries.filter(e=>e.id!==delE));setDelE(null);}}/>}
      {delFE  &&<DelModal onCancel={()=>setDelFE(null)}  onConfirm={()=>{saveFixedExps(fixedExps.filter(i=>i.id!==delFE));setDelFE(null);}}/>}
      {delFI  &&<DelModal onCancel={()=>setDelFI(null)}  onConfirm={()=>{saveFixedInc(fixedIncomes.filter(i=>i.id!==delFI));setDelFI(null);}}/>}
      {delIN  &&<DelModal onCancel={()=>setDelIN(null)}  onConfirm={()=>{saveInstalls(installs.filter(i=>i.id!==delIN));setDelIN(null);}}/>}
    </div>
  );
}