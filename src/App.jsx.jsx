import { useState, useEffect, useCallback, useRef } from "react";

// ── 팔레트 ────────────────────────────────────────────
const C = {
  bg:"#F5F0E8", card:"#FDFAF4", border:"#E8DFD0",
  primary:"#8B6F47", primaryBg:"#EDE5D8",
  accent:"#C4956A",
  jw:"#7A8E6A", jwBg:"#EBF0E6",
  sh:"#7A6E9E", shBg:"#EDE9F5",
  green:"#6A9E7A", greenBg:"#EAF3EC",
  red:"#C46A6A", redBg:"#F7ECEC",
  yellow:"#C4A647", yellowBg:"#F7F3E3",
  text:"#3D2E1E", sub:"#9E8B78", muted:"#BDB09E",
};
const MEMBERS = {
  jiwon:  { label:"변지원", initial:"지원", color:C.jw, bg:C.jwBg },
  suhyun: { label:"정수현", initial:"수현", color:C.sh, bg:C.shBg },
};

// ── 스토리지 키 ───────────────────────────────────────
const SK_JW   = "cb_snaps_jiwon_v2";
const SK_SH   = "cb_snaps_suhyun_v2";
const FIXED_K = "cb_fixed_exp_v1";
const INST_K  = "cb_installments_v1";
const PROF_K  = "cb_profiles_v1";
const CHAT_K  = "cb_chat_v1";

// ── 유틸 ─────────────────────────────────────────────
const fmt    = n => n==null?"0":Number(n).toLocaleString("ko-KR");
const fmtAbs = n => fmt(Math.abs(n));
const pn     = s => Number((s||"").toString().replace(/,/g,""))||0;
const todayStr = () => new Date().toISOString().slice(0,10);
const daysBetween = (a,b) => Math.round((new Date(b)-new Date(a))/86400000);

function getInstSt(item,y,m){
  const diff=(y-item.sy)*12+(m-item.sm);
  if(diff<0||diff>=item.months)return null;
  return{cur:diff+1,total:item.months,isLast:diff+1===item.months};
}
function ddayInfo(ds){
  if(!ds)return null;
  const d=Math.ceil((new Date(ds)-new Date(todayStr()))/86400000);
  return{
    label:d<0?`만기 ${Math.abs(d)}일 지남`:d===0?"D-Day":`D-${d}`,
    color:d<0?C.muted:d<=30?C.red:d<=90?C.yellow:C.green,
    bg:d<0?"#f3ede5":d<=30?C.redBg:d<=90?C.yellowBg:C.greenBg,
  };
}

// 개인 스냅샷 기반 사용액 계산
function calcUsage(prev, curr){
  if(!prev||!curr) return null;
  const prevCash = pn(prev.cash);
  const currCash = pn(curr.cash);
  const prevCard = pn(prev.card);
  const currCard = pn(curr.card);
  const salary   = pn(curr.salary);
  const addInc   = pn(curr.addIncome);
  const cardPaid = pn(curr.cardPaid);
  const used = prevCash + salary + addInc - currCash + currCard - prevCard - cardPaid;
  const days = daysBetween(prev.date, curr.date);
  return { used, days, perDay: days>0 ? Math.round(used/days) : 0 };
}

// ── 스타일 헬퍼 ──────────────────────────────────────
const inp = {
  width:"100%", border:`1.5px solid ${C.border}`, borderRadius:10,
  padding:"12px 14px", fontSize:16, outline:"none",
  fontFamily:"inherit", boxSizing:"border-box",
  background:C.card, color:C.text,
};
const chip = (on,ac,ab) => ({
  padding:"7px 14px", borderRadius:99, cursor:"pointer", fontSize:13,
  border:`1.5px solid ${on?ac:C.border}`,
  background:on?ab:C.card, color:on?ac:C.muted, fontWeight:on?700:400,
});
const bigBtn = (fg,bg) => ({
  width:"100%", padding:"15px 0", border:"none", borderRadius:12,
  fontSize:15, fontWeight:700, cursor:"pointer", background:bg, color:fg,
});

// ── 공통 컴포넌트 ────────────────────────────────────
const Label = ({children, sub}) => (
  <div style={{marginBottom:7}}>
    <div style={{fontSize:12,color:C.sub,fontWeight:600}}>{children}</div>
    {sub&&<div style={{fontSize:11,color:C.muted,marginTop:1}}>{sub}</div>}
  </div>
);

function Avatar({src, initial, color, size=36}){
  return(
    <div style={{width:size,height:size,borderRadius:"50%",overflow:"hidden",background:color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.38,fontWeight:700,color:"#fff",flexShrink:0}}>
      {src?<img src={src} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:initial}
    </div>
  );
}

function Sheet({onClose, title, children}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(61,46,30,.45)",zIndex:200,display:"flex",alignItems:"flex-end"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:C.card,borderRadius:"22px 22px 0 0",padding:"24px 20px 44px",width:"100%",maxWidth:480,margin:"0 auto",maxHeight:"95vh",overflowY:"auto"}}>
        {title&&<div style={{fontSize:17,fontWeight:800,color:C.text,marginBottom:22}}>{title}</div>}
        {children}
      </div>
    </div>
  );
}

function DelModal({onCancel, onConfirm}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(61,46,30,.45)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:C.card,borderRadius:18,padding:24,width:280,textAlign:"center"}}>
        <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:6}}>삭제할까요?</div>
        <div style={{fontSize:12,color:C.sub,marginBottom:20}}>삭제한 기록은 복구할 수 없어요</div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onCancel} style={{flex:1,padding:"10px 0",border:`1.5px solid ${C.border}`,borderRadius:10,background:C.card,color:C.sub,fontWeight:600,cursor:"pointer"}}>취소</button>
          <button onClick={onConfirm} style={{flex:1,padding:"10px 0",border:"none",borderRadius:10,background:C.red,color:"#fff",fontWeight:700,cursor:"pointer"}}>삭제</button>
        </div>
      </div>
    </div>
  );
}

// ── 입력 시트 ────────────────────────────────────────
function InputSheet({who, onClose, onSave, prevSnap}){
  const m = MEMBERS[who];
  const [form, setForm] = useState({
    date:todayStr(), cash:"", card:"",
    salary:"", addIncome:"", cardPaid:"", memo:"",
  });
  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  const usage = calcUsage(prevSnap, form);

  const numInp = (label, key, color, sub) => (
    <div style={{marginBottom:14}}>
      <Label sub={sub}><span style={{color:color||C.sub}}>{label}</span></Label>
      <input value={form[key]} onChange={e=>f(key,e.target.value)}
        type="number" placeholder="0"
        style={{...inp, borderColor:form[key]?m.color:C.border}}/>
    </div>
  );

  return(
    <Sheet onClose={onClose} title={`${m.label} 입력`}>
      {/* 날짜 */}
      <div style={{marginBottom:16}}>
        <Label>입력일</Label>
        <input value={form.date} onChange={e=>f("date",e.target.value)} type="date" style={inp}/>
      </div>

      {/* 현금/카드 */}
      <div style={{background:C.bg,borderRadius:12,padding:"14px",marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:12}}>💰 현재 잔액</div>
        {numInp("보유 현금", "cash", m.color)}
        {numInp("카드 결제 예정액", "card", C.red, "이번달 나올 카드값")}
      </div>

      {/* 급여 */}
      <div style={{background:C.greenBg,borderRadius:12,padding:"14px",marginBottom:12,border:`1px solid ${C.green}33`}}>
        <div style={{fontSize:12,fontWeight:700,color:C.green,marginBottom:12}}>💵 이번달 급여 (받은 경우)</div>
        {numInp("실수령 급여", "salary", C.green, "추가근무 포함 실수령액")}
      </div>

      {/* 조정 */}
      <div style={{background:C.bg,borderRadius:12,padding:"14px",marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:12}}>⚡ 기간 중 조정</div>
        {numInp("기타 추가 수입", "addIncome", C.green, "급여 외 입금 (용돈·부수입 등)")}
        {numInp("카드 결제/상환", "cardPaid", C.primary, "실제 카드값 납부 금액")}
      </div>

      {/* 메모 */}
      <div style={{marginBottom:16}}>
        <Label>메모 (선택)</Label>
        <input value={form.memo} onChange={e=>f("memo",e.target.value)}
          placeholder="예: 여행 다녀옴, 명절 지출 있었음"
          style={{...inp,fontSize:14}}/>
      </div>

      {/* 미리보기 */}
      {prevSnap && usage && (
        <div style={{background:usage.used>=0?C.redBg:C.greenBg,borderRadius:12,padding:"14px 16px",marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:700,color:usage.used>=0?C.red:C.green,marginBottom:8}}>
            📊 {usage.days}일간 사용 예상
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontSize:13,color:C.sub}}>총 사용액</span>
            <span style={{fontSize:17,fontWeight:800,color:usage.used>=0?C.red:C.green}}>
              {usage.used>=0?"":"-"}{fmtAbs(usage.used)}원
            </span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <span style={{fontSize:13,color:C.sub}}>하루 평균</span>
            <span style={{fontSize:14,fontWeight:700,color:C.text}}>{fmt(Math.abs(usage.perDay))}원</span>
          </div>
        </div>
      )}

      <button onClick={()=>{if(form.cash||form.card)onSave(form);}} style={bigBtn("#fff",`linear-gradient(135deg,${m.color},${m.color}cc)`)}>
        저장하기
      </button>
    </Sheet>
  );
}

// ── 홈 탭 ────────────────────────────────────────────
function HomeTab({snapJw, snapSh, prevJw, prevSh, profiles, fixedExps, installs, onAdd}){
  const now = new Date();
  const y=now.getFullYear(), m=now.getMonth();

  const usageJw = calcUsage(prevJw, snapJw);
  const usageSh = calcUsage(prevSh, snapSh);

  const cashJw  = snapJw ? pn(snapJw.cash) : 0;
  const cashSh  = snapSh ? pn(snapSh.cash) : 0;
  const cardJw  = snapJw ? pn(snapJw.card) : 0;
  const cardSh  = snapSh ? pn(snapSh.card) : 0;
  const totalCash = cashJw + cashSh;
  const totalCard = cardJw + cardSh;

  const fixedExpTotal = fixedExps.reduce((s,i)=>s+i.amount,0);
  const instTotal = installs.reduce((s,i)=>{const st=getInstSt(i,y,m);return st?s+i.amount:s;},0);
  const avail = totalCash - totalCard - fixedExpTotal - instTotal;

  const totalUsed = (usageJw?.used||0) + (usageSh?.used||0);

  // 이번달 누적 (두 사람 합산)
  const daysInMonth = new Date(y,m+1,0).getDate();
  const dayOfMonth  = now.getDate();

  return(
    <div style={{paddingBottom:20}}>
      {/* 프로필 카드 */}
      <div style={{display:"flex",gap:10,marginBottom:14}}>
        {Object.entries(MEMBERS).map(([k,mb])=>{
          const snap = k==="jiwon"?snapJw:snapSh;
          return(
            <div key={k} style={{flex:1,background:C.card,borderRadius:14,padding:"14px",display:"flex",flexDirection:"column",gap:8}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <Avatar src={profiles[k]?.photo} initial={mb.initial} color={mb.color} size={40}/>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:mb.color}}>{mb.label}</div>
                  <div style={{fontSize:10,color:C.muted}}>{snap?.date||"미입력"} 기준</div>
                </div>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                <span style={{color:C.sub}}>현금</span>
                <span style={{fontWeight:700,color:C.text}}>{fmt(k==="jiwon"?cashJw:cashSh)}원</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                <span style={{color:C.sub}}>카드</span>
                <span style={{fontWeight:700,color:C.red}}>-{fmt(k==="jiwon"?cardJw:cardSh)}원</span>
              </div>
              <button onClick={()=>onAdd(k)} style={{marginTop:4,padding:"7px 0",border:`1.5px solid ${mb.color}`,borderRadius:9,background:mb.bg,color:mb.color,fontWeight:700,fontSize:12,cursor:"pointer"}}>
                + 입력
              </button>
            </div>
          );
        })}
      </div>

      {/* 가용금액 메인 카드 */}
      <div style={{background:`linear-gradient(135deg,#6B5236,${C.accent})`,borderRadius:20,padding:"22px 20px",marginBottom:14,color:"#fff"}}>
        <div style={{fontSize:12,opacity:.8,marginBottom:4}}>합산 실질 가용금액</div>
        <div style={{fontSize:38,fontWeight:800,marginBottom:4,color:avail>=0?"#fff":"#fca5a5"}}>
          {avail>=0?"":"-"}{fmtAbs(avail)}원
        </div>
        <div style={{fontSize:11,opacity:.7,marginBottom:16}}>
          현금 {fmt(totalCash)} - 카드 {fmt(totalCard)} - 고정 {fmt(fixedExpTotal+instTotal)}원
        </div>
        <div style={{display:"flex",gap:8}}>
          {[
            ["총 현금", fmt(totalCash)+"원", "#fff"],
            ["카드 예정", "-"+fmt(totalCard)+"원", "#ffd4d4"],
            ["고정지출", "-"+fmt(fixedExpTotal+instTotal)+"원", "#ffd4d4"],
          ].map(([l,v,c])=>(
            <div key={l} style={{flex:1,background:"rgba(255,255,255,.14)",borderRadius:10,padding:"8px 10px"}}>
              <div style={{fontSize:10,opacity:.75,marginBottom:2}}>{l}</div>
              <div style={{fontSize:12,fontWeight:700,color:c}}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 사용액 분석 */}
      {(usageJw||usageSh) && (
        <div style={{background:C.card,borderRadius:16,padding:18,marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>📊 최근 사용 분석</div>
          {[["jiwon",usageJw,snapJw,prevJw],["suhyun",usageSh,snapSh,prevSh]].map(([k,usage,snap,prev])=>{
            if(!usage||!snap) return null;
            const mb = MEMBERS[k];
            return(
              <div key={k} style={{marginBottom:12,padding:"12px 14px",background:mb.bg,borderRadius:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <Avatar src={profiles[k]?.photo} initial={mb.initial} color={mb.color} size={24}/>
                    <span style={{fontSize:13,fontWeight:700,color:mb.color}}>{mb.label}</span>
                    <span style={{fontSize:10,color:C.muted}}>{prev?.date}→{snap.date} ({usage.days}일)</span>
                  </div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <div style={{flex:1,background:usage.used>=0?C.redBg:C.greenBg,borderRadius:8,padding:"8px 10px"}}>
                    <div style={{fontSize:10,color:C.sub,marginBottom:2}}>사용액</div>
                    <div style={{fontSize:15,fontWeight:800,color:usage.used>=0?C.red:C.green}}>
                      {usage.used>=0?"":"-"}{fmtAbs(usage.used)}원
                    </div>
                  </div>
                  <div style={{flex:1,background:C.card,borderRadius:8,padding:"8px 10px"}}>
                    <div style={{fontSize:10,color:C.sub,marginBottom:2}}>일평균</div>
                    <div style={{fontSize:15,fontWeight:800,color:C.primary}}>{fmt(Math.abs(usage.perDay))}원</div>
                  </div>
                </div>
              </div>
            );
          })}
          {usageJw && usageSh && (
            <div style={{padding:"10px 14px",background:C.primaryBg,borderRadius:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:13,color:C.sub}}>합산 총 사용액</span>
              <span style={{fontSize:17,fontWeight:800,color:totalUsed>=0?C.red:C.green}}>
                {totalUsed>=0?"":"-"}{fmtAbs(totalUsed)}원
              </span>
            </div>
          )}
        </div>
      )}

      {/* 고정비 요약 */}
      <div style={{background:C.card,borderRadius:16,padding:18,marginBottom:14}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:12}}>📌 이번달 고정비</div>
        <div style={{display:"flex",gap:8}}>
          {[
            ["고정지출", "-"+fmt(fixedExpTotal), C.primary, C.primaryBg],
            ["할부",     "-"+fmt(instTotal),     C.sh,      C.shBg],
          ].map(([l,v,c,bg])=>(
            <div key={l} style={{flex:1,background:bg,borderRadius:10,padding:"10px"}}>
              <div style={{fontSize:10,color:c,fontWeight:600,marginBottom:3}}>{l}</div>
              <div style={{fontSize:15,fontWeight:800,color:c}}>{v}원</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 기록 탭 ──────────────────────────────────────────
function RecordTab({snapsJw, snapsSh, onDelete}){
  const [who, setWho] = useState("jiwon");
  const [delTarget, setDelTarget] = useState(null);
  const snaps = who==="jiwon" ? snapsJw : snapsSh;
  const mb = MEMBERS[who];

  return(
    <div style={{paddingBottom:20}}>
      <div style={{display:"flex",background:C.primaryBg,borderRadius:12,padding:4,marginBottom:16}}>
        {Object.entries(MEMBERS).map(([k,m])=>(
          <button key={k} onClick={()=>setWho(k)} style={{flex:1,padding:"9px 0",border:"none",borderRadius:10,background:who===k?m.color:"transparent",color:who===k?"#fff":C.sub,fontWeight:700,fontSize:13,cursor:"pointer"}}>{m.label}</button>
        ))}
      </div>

      {snaps.length===0?(
        <div style={{textAlign:"center",padding:"60px 20px",color:C.muted}}>
          <div style={{fontSize:36,marginBottom:10}}>📷</div>
          <div style={{fontSize:14,fontWeight:600,color:C.sub}}>아직 기록이 없어요</div>
          <div style={{fontSize:12,color:C.muted,marginTop:5}}>홈에서 입력해보세요</div>
        </div>
      ):snaps.map((snap,i)=>{
        const prev  = snaps[i+1];
        const usage = calcUsage(prev, snap);
        return(
          <div key={snap.id} style={{background:C.card,borderRadius:16,padding:18,marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
              <div>
                <div style={{fontSize:15,fontWeight:800,color:C.text}}>{snap.date}</div>
                {prev&&<div style={{fontSize:11,color:C.muted,marginTop:2}}>직전: {prev.date} ({daysBetween(prev.date,snap.date)}일 후)</div>}
              </div>
              <button onClick={()=>setDelTarget(snap.id)} style={{background:C.redBg,color:C.red,border:"none",borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>삭제</button>
            </div>
            {usage&&(
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                <div style={{flex:1,background:usage.used>=0?C.redBg:C.greenBg,borderRadius:10,padding:"10px 12px"}}>
                  <div style={{fontSize:10,color:C.sub,marginBottom:2}}>사용액</div>
                  <div style={{fontSize:16,fontWeight:800,color:usage.used>=0?C.red:C.green}}>
                    {usage.used>=0?"":"-"}{fmtAbs(usage.used)}원
                  </div>
                </div>
                <div style={{flex:1,background:C.primaryBg,borderRadius:10,padding:"10px 12px"}}>
                  <div style={{fontSize:10,color:C.sub,marginBottom:2}}>일평균</div>
                  <div style={{fontSize:16,fontWeight:800,color:C.primary}}>{fmt(Math.abs(usage.perDay))}원</div>
                </div>
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              {[
                ["현금", pn(snap.cash), mb.color],
                ["카드", pn(snap.card), C.red],
                ["급여", pn(snap.salary), C.green],
                ["카드결제", pn(snap.cardPaid), C.primary],
              ].filter(([,v])=>v>0).map(([l,v,c])=>(
                <div key={l} style={{background:C.bg,borderRadius:8,padding:"7px 10px"}}>
                  <div style={{fontSize:10,color:C.muted}}>{l}</div>
                  <div style={{fontSize:13,fontWeight:700,color:c}}>{fmt(v)}원</div>
                </div>
              ))}
            </div>
            {snap.memo&&<div style={{marginTop:8,fontSize:12,color:C.muted,background:C.bg,borderRadius:8,padding:"7px 10px"}}>💬 {snap.memo}</div>}
          </div>
        );
      })}
      {delTarget&&<DelModal onCancel={()=>setDelTarget(null)} onConfirm={()=>{onDelete(who,delTarget);setDelTarget(null);}}/>}
    </div>
  );
}

// ── 채팅 탭 ──────────────────────────────────────────
function ChatTab({chats, onSend}){
  const [who, setWho]   = useState("jiwon");
  const [text, setText] = useState("");
  const bottomRef = useRef(null);

  useEffect(()=>{
    bottomRef.current?.scrollIntoView({behavior:"smooth"});
  },[chats]);

  const send = () => {
    if(!text.trim()) return;
    onSend({ id:Date.now()+Math.random(), who, text:text.trim(), ts:new Date().toISOString() });
    setText("");
  };

  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 180px)"}}>
      {/* 메시지 목록 */}
      <div style={{flex:1,overflowY:"auto",paddingBottom:16}}>
        {chats.length===0?(
          <div style={{textAlign:"center",padding:"60px 20px",color:C.muted}}>
            <div style={{fontSize:36,marginBottom:10}}>💬</div>
            <div style={{fontSize:14,fontWeight:600,color:C.sub}}>아직 대화가 없어요</div>
            <div style={{fontSize:12,color:C.muted,marginTop:5}}>서로 메시지를 남겨보세요 😊</div>
          </div>
        ):chats.map(chat=>{
          const mb = MEMBERS[chat.who];
          const isJw = chat.who==="jiwon";
          const time = new Date(chat.ts).toLocaleString("ko-KR",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"});
          return(
            <div key={chat.id} style={{display:"flex",flexDirection:isJw?"row":"row-reverse",alignItems:"flex-end",gap:8,marginBottom:12}}>
              <Avatar src={undefined} initial={mb.initial} color={mb.color} size={32}/>
              <div style={{maxWidth:"70%"}}>
                <div style={{fontSize:10,color:C.muted,marginBottom:3,textAlign:isJw?"left":"right"}}>{mb.label} · {time}</div>
                <div style={{background:isJw?mb.bg:C.card,border:`1.5px solid ${isJw?mb.color:C.border}`,borderRadius:isJw?"4px 16px 16px 16px":"16px 4px 16px 16px",padding:"10px 14px",fontSize:14,color:C.text,lineHeight:1.5}}>
                  {chat.text}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef}/>
      </div>

      {/* 입력창 */}
      <div style={{borderTop:`1px solid ${C.border}`,paddingTop:12,background:C.bg}}>
        {/* 발신자 선택 */}
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          {Object.entries(MEMBERS).map(([k,mb])=>(
            <button key={k} onClick={()=>setWho(k)} style={{flex:1,padding:"7px 0",border:`2px solid ${who===k?mb.color:C.border}`,borderRadius:9,background:who===k?mb.bg:C.card,color:who===k?mb.color:C.muted,fontWeight:700,fontSize:12,cursor:"pointer"}}>{mb.label}</button>
          ))}
        </div>
        <div style={{display:"flex",gap:8}}>
          <input value={text} onChange={e=>setText(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&send()}
            placeholder="메시지를 입력하세요..."
            style={{...inp,flex:1,padding:"10px 14px",fontSize:14}}/>
          <button onClick={send} style={{background:MEMBERS[who].color,color:"#fff",border:"none",borderRadius:10,padding:"10px 16px",fontSize:15,fontWeight:700,cursor:"pointer"}}>전송</button>
        </div>
      </div>
    </div>
  );
}

// ── 고정비 탭 ─────────────────────────────────────────
const FIXED_TYPES = ["대출","보험","구독","관리비","기타"];
const CARD_COS    = ["현대카드","신한카드","국민카드","삼성카드","롯데카드","하나카드","우리카드","NH카드","기타"];

function FixedTab({fixedExps, installs, onSave}){
  const [sub, setSub] = useState("expense");
  const [showFE, setShowFE] = useState(false);
  const [showIN, setShowIN] = useState(false);
  const [delFE, setDelFE]   = useState(null);
  const [delIN, setDelIN]   = useState(null);
  const [fe, setFe] = useState({name:"",who:"jiwon",type:"대출",amount:"",memo:"",expiry:""});
  const [ins,setIns]= useState({name:"",who:"jiwon",card:"현대카드",amount:"",memo:"",sy:new Date().getFullYear(),sm:new Date().getMonth(),mode:"months",months:"",endDate:""});

  const now=new Date(); const y=now.getFullYear(),m=now.getMonth();
  const instTotal = installs.reduce((s,i)=>{const st=getInstSt(i,y,m);return st?s+i.amount:s;},0);

  const MemberBtn = ({value,onChange}) => (
    <div style={{display:"flex",gap:8,marginBottom:14}}>
      {Object.entries(MEMBERS).map(([k,mb])=>(
        <button key={k} onClick={()=>onChange(k)} style={{flex:1,padding:"9px 0",border:`2px solid ${value===k?mb.color:C.border}`,borderRadius:10,background:value===k?mb.bg:C.card,color:value===k?mb.color:C.muted,fontWeight:700,fontSize:13,cursor:"pointer"}}>{mb.label}</button>
      ))}
    </div>
  );

  const addFE=()=>{
    if(!fe.name||!fe.amount)return;
    onSave("expense",[...fixedExps,{id:Date.now()+Math.random(),...fe,amount:pn(fe.amount)}]);
    setShowFE(false); setFe({name:"",who:"jiwon",type:"대출",amount:"",memo:"",expiry:""});
  };
  const addIN=()=>{
    if(!ins.name||!ins.amount)return;
    let months=Number(ins.months);
    if(ins.mode==="endDate"&&ins.endDate){const[ey,em]=ins.endDate.split("-").map(Number);months=(ey-ins.sy)*12+(em-1-ins.sm)+1;}
    if(!months||months<=0)return;
    onSave("install",[...installs,{id:Date.now()+Math.random(),name:ins.name,who:ins.who,card:ins.card,amount:pn(ins.amount),months,sy:ins.sy,sm:ins.sm,memo:ins.memo}]);
    setShowIN(false); setIns({name:"",who:"jiwon",card:"현대카드",amount:"",memo:"",sy:now.getFullYear(),sm:now.getMonth(),mode:"months",months:"",endDate:""});
  };

  return(
    <div style={{paddingBottom:20}}>
      <div style={{display:"flex",background:C.primaryBg,borderRadius:12,padding:4,marginBottom:16}}>
        {[["expense","고정지출"],["install","할부"]].map(([k,l])=>(
          <button key={k} onClick={()=>setSub(k)} style={{flex:1,padding:"9px 0",border:"none",borderRadius:10,background:sub===k?C.primary:"transparent",color:sub===k?"#fff":C.sub,fontWeight:700,fontSize:13,cursor:"pointer"}}>{l}</button>
        ))}
      </div>

      {sub==="expense"&&(<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text}}>고정지출 <span style={{color:C.primary}}>월 {fmt(fixedExps.reduce((s,i)=>s+i.amount,0))}원</span></div>
          <button onClick={()=>setShowFE(true)} style={{background:C.primaryBg,color:C.primary,border:"none",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ 추가</button>
        </div>
        {fixedExps.length===0
          ?<div style={{textAlign:"center",padding:"40px 0",color:C.muted}}><div style={{fontSize:30,marginBottom:8}}>📋</div><div style={{fontSize:13,color:C.sub}}>대출·보험 등을 등록해보세요</div></div>
          :fixedExps.map(item=>{const dd=ddayInfo(item.expiry);return(
            <div key={item.id} onClick={()=>setDelFE(item.id)} style={{background:C.card,borderRadius:14,padding:"14px 16px",marginBottom:10,borderLeft:`4px solid ${MEMBERS[item.who]?.color}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{display:"flex",gap:6,marginBottom:4,flexWrap:"wrap"}}>
                    <span style={{background:MEMBERS[item.who]?.bg,color:MEMBERS[item.who]?.color,fontSize:10,fontWeight:700,borderRadius:6,padding:"2px 7px"}}>{MEMBERS[item.who]?.initial}</span>
                    <span style={{background:C.bg,color:C.sub,fontSize:10,borderRadius:6,padding:"2px 7px"}}>{item.type}</span>
                    {dd&&<span style={{background:dd.bg,color:dd.color,fontSize:10,fontWeight:700,borderRadius:6,padding:"2px 7px"}}>{dd.label}</span>}
                  </div>
                  <div style={{fontSize:14,fontWeight:700,color:C.text}}>{item.name}</div>
                  {item.expiry&&<div style={{fontSize:11,color:C.muted,marginTop:2}}>만기 {item.expiry}</div>}
                  {item.memo&&<div style={{fontSize:11,color:C.muted,marginTop:2}}>{item.memo}</div>}
                </div>
                <div style={{textAlign:"right"}}><div style={{fontSize:15,fontWeight:800,color:C.primary}}>-{fmt(item.amount)}원</div><div style={{fontSize:10,color:C.muted}}>매달</div></div>
              </div>
            </div>
          );})}
        {delFE&&<DelModal onCancel={()=>setDelFE(null)} onConfirm={()=>{onSave("expense",fixedExps.filter(i=>i.id!==delFE));setDelFE(null);}}/>}
        {showFE&&(
          <Sheet onClose={()=>setShowFE(false)} title="고정지출 추가">
            <MemberBtn value={fe.who} onChange={v=>setFe(p=>({...p,who:v}))}/>
            <div style={{marginBottom:14}}><Label>종류</Label><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{FIXED_TYPES.map(t=><button key={t} onClick={()=>setFe(p=>({...p,type:t}))} style={chip(fe.type===t,C.primary,C.primaryBg)}>{t}</button>)}</div></div>
            <div style={{marginBottom:14}}><Label>이름</Label><input value={fe.name} onChange={e=>setFe(p=>({...p,name:e.target.value}))} placeholder="예: 주택담보대출" style={inp}/></div>
            <div style={{marginBottom:14}}><Label>월 납입액</Label><input value={fe.amount} onChange={e=>setFe(p=>({...p,amount:e.target.value}))} type="number" placeholder="0" style={{...inp,fontSize:18,fontWeight:700}}/></div>
            <div style={{marginBottom:14}}><Label>만기일 (선택)</Label><input value={fe.expiry} onChange={e=>setFe(p=>({...p,expiry:e.target.value}))} type="date" style={inp}/></div>
            <div style={{marginBottom:22}}><Label>메모 (선택)</Label><input value={fe.memo} onChange={e=>setFe(p=>({...p,memo:e.target.value}))} placeholder="예: OO은행" style={inp}/></div>
            <button onClick={addFE} style={bigBtn("#fff",`linear-gradient(135deg,#6B5236,${C.accent})`)}>저장하기</button>
          </Sheet>
        )}
      </>)}

      {sub==="install"&&(<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontSize:13,fontWeight:700,color:C.text}}>할부 <span style={{color:C.sh}}>이번달 {fmt(instTotal)}원</span></div>
          <button onClick={()=>setShowIN(true)} style={{background:C.shBg,color:C.sh,border:"none",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>+ 추가</button>
        </div>
        {installs.length===0
          ?<div style={{textAlign:"center",padding:"40px 0",color:C.muted}}><div style={{fontSize:30,marginBottom:8}}>💳</div><div style={{fontSize:13,color:C.sub}}>카드 할부를 등록해보세요</div></div>
          :installs.map(item=>{
            const st=getInstSt(item,y,m);
            const endD=new Date(item.sy,item.sm+item.months-1,1);
            const isPast=new Date(y,m,1)>endD;
            return(
              <div key={item.id} onClick={()=>setDelIN(item.id)} style={{background:C.card,borderRadius:14,padding:"14px 16px",marginBottom:10,borderLeft:`4px solid ${isPast?C.border:st?.isLast?C.green:MEMBERS[item.who]?.color}`,opacity:isPast?0.55:1}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",gap:6,marginBottom:5,flexWrap:"wrap"}}>
                      <span style={{background:MEMBERS[item.who]?.bg,color:MEMBERS[item.who]?.color,fontSize:10,fontWeight:700,borderRadius:6,padding:"2px 7px"}}>{MEMBERS[item.who]?.initial}</span>
                      <span style={{background:C.shBg,color:C.sh,fontSize:10,borderRadius:6,padding:"2px 7px"}}>💳 {item.card}</span>
                      {isPast&&<span style={{background:C.bg,color:C.muted,fontSize:10,fontWeight:700,borderRadius:6,padding:"2px 7px"}}>완료</span>}
                      {st?.isLast&&<span style={{background:C.greenBg,color:C.green,fontSize:10,fontWeight:700,borderRadius:6,padding:"2px 7px"}}>✅ 이번달 끝!</span>}
                    </div>
                    <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:6}}>{item.name}</div>
                    {!isPast&&st&&(<>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.muted,marginBottom:4}}>
                        <span>{st.cur}/{st.total}회차</span>
                        <span>{item.sy}년 {item.sm+1}월 ~ {endD.getFullYear()}년 {endD.getMonth()+1}월</span>
                      </div>
                      <div style={{background:C.bg,borderRadius:99,height:6}}><div style={{width:`${(st.cur/st.total)*100}%`,height:"100%",background:st.isLast?C.green:C.sh,borderRadius:99}}/></div>
                    </>)}
                  </div>
                  <div style={{textAlign:"right",marginLeft:10}}><div style={{fontSize:15,fontWeight:800,color:isPast?C.muted:C.sh}}>-{fmt(item.amount)}원</div><div style={{fontSize:10,color:C.muted}}>월 납입</div></div>
                </div>
              </div>
            );
          })}
        {delIN&&<DelModal onCancel={()=>setDelIN(null)} onConfirm={()=>{onSave("install",installs.filter(i=>i.id!==delIN));setDelIN(null);}}/>}
        {showIN&&(
          <Sheet onClose={()=>setShowIN(false)} title="💳 할부 추가">
            <MemberBtn value={ins.who} onChange={v=>setIns(p=>({...p,who:v}))}/>
            <div style={{marginBottom:14}}><Label>카드사</Label><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{CARD_COS.map(c=><button key={c} onClick={()=>setIns(p=>({...p,card:c}))} style={chip(ins.card===c,C.sh,C.shBg)}>{c}</button>)}</div></div>
            <div style={{marginBottom:14}}><Label>항목 이름</Label><input value={ins.name} onChange={e=>setIns(p=>({...p,name:e.target.value}))} placeholder="예: 냉장고" style={inp}/></div>
            <div style={{marginBottom:14}}><Label>월 납입액</Label><input value={ins.amount} onChange={e=>setIns(p=>({...p,amount:e.target.value}))} type="number" placeholder="0" style={{...inp,fontSize:18,fontWeight:700}}/></div>
            <div style={{marginBottom:14}}>
              <Label>시작 월</Label>
              <div style={{display:"flex",gap:8}}>
                <select value={ins.sy} onChange={e=>setIns(p=>({...p,sy:Number(e.target.value)}))} style={{...inp,flex:1}}>{[y-2,y-1,y,y+1].map(yr=><option key={yr} value={yr}>{yr}년</option>)}</select>
                <select value={ins.sm} onChange={e=>setIns(p=>({...p,sm:Number(e.target.value)}))} style={{...inp,flex:1}}>{Array.from({length:12},(_,i)=><option key={i} value={i}>{i+1}월</option>)}</select>
              </div>
            </div>
            <div style={{marginBottom:14}}>
              <Label>기간</Label>
              <div style={{display:"flex",background:C.bg,borderRadius:11,padding:4,marginBottom:10}}>
                {[["months","회차 수"],["endDate","만기 날짜"]].map(([k,l])=>(
                  <button key={k} onClick={()=>setIns(p=>({...p,mode:k}))} style={{flex:1,padding:"8px 0",border:"none",borderRadius:9,background:ins.mode===k?C.card:"transparent",color:ins.mode===k?C.primary:C.muted,fontWeight:ins.mode===k?700:500,fontSize:13,cursor:"pointer"}}>{l}</button>
                ))}
              </div>
              {ins.mode==="months"
                ?<input value={ins.months} onChange={e=>setIns(p=>({...p,months:e.target.value}))} type="number" placeholder="예: 24" style={inp}/>
                :<input value={ins.endDate} onChange={e=>setIns(p=>({...p,endDate:e.target.value}))} type="month" style={inp}/>}
            </div>
            <div style={{marginBottom:22}}><Label>메모 (선택)</Label><input value={ins.memo} onChange={e=>setIns(p=>({...p,memo:e.target.value}))} placeholder="예: 삼성 냉장고" style={inp}/></div>
            <button onClick={addIN} style={bigBtn("#fff",`linear-gradient(135deg,${C.sh},#9b8dc0)`)}>저장하기</button>
          </Sheet>
        )}
      </>)}
    </div>
  );
}

// ── 설정 탭 ──────────────────────────────────────────
function SettingTab({profiles, saveProfiles}){
  const [local, setLocal] = useState(profiles);
  useEffect(()=>setLocal(profiles),[profiles]);
  return(
    <div style={{paddingBottom:20}}>
      {Object.entries(MEMBERS).map(([k,mb])=>(
        <div key={k} style={{background:C.card,borderRadius:16,padding:20,marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16}}>
            <Avatar src={local[k]?.photo} initial={mb.initial} color={mb.color} size={52}/>
            <div>
              <div style={{fontSize:16,fontWeight:800,color:mb.color}}>{mb.label}</div>
              <label style={{marginTop:4,display:"inline-block",fontSize:11,color:C.sub,border:`1px solid ${C.border}`,borderRadius:6,padding:"3px 10px",cursor:"pointer"}}>
                사진 변경
                <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{
                  const file=e.target.files[0]; if(!file)return;
                  const r=new FileReader();
                  r.onload=ev=>{const next={...local,[k]:{...local[k],photo:ev.target.result}};setLocal(next);saveProfiles(next);};
                  r.readAsDataURL(file);
                }}/>
              </label>
            </div>
          </div>
          <Label>한마디</Label>
          <input value={local[k]?.bio||""} onChange={e=>{const n={...local,[k]:{...local[k],bio:e.target.value}};setLocal(n);}}
            onBlur={()=>saveProfiles(local)} placeholder="예: 절약왕 💪" style={inp}/>
        </div>
      ))}
    </div>
  );
}

// ── 메인 앱 ──────────────────────────────────────────
export default function App(){
  const [tab, setTab]     = useState("home");
  const [loading, setLoading] = useState(true);
  const [inputWho, setInputWho] = useState(null); // "jiwon" | "suhyun" | null

  const [snapsJw,  setSnapsJw]  = useState([]);
  const [snapsSh,  setSnapsSh]  = useState([]);
  const [fixedExps,setFixedExps]= useState([]);
  const [installs, setInstalls] = useState([]);
  const [profiles, setProfiles] = useState({jiwon:{},suhyun:{}});
  const [chats,    setChats]    = useState([]);

  const load = useCallback(async()=>{
    setLoading(true);
    const ld=async(k,fb)=>{try{const r=await window.storage.get(k,true);return r?JSON.parse(r.value):fb;}catch{return fb;}};
    setSnapsJw( await ld(SK_JW,   []));
    setSnapsSh( await ld(SK_SH,   []));
    setFixedExps(await ld(FIXED_K, []));
    setInstalls( await ld(INST_K,  []));
    setProfiles( await ld(PROF_K,  {jiwon:{},suhyun:{}}));
    setChats(    await ld(CHAT_K,  []));
    setLoading(false);
  },[]);
  useEffect(()=>{load();},[load]);

  const sv = async(k,v)=>{ await window.storage.set(k,JSON.stringify(v),true); };

  const saveSnap = async(who, form)=>{
    const snap = {id:Date.now()+Math.random(),...form};
    if(who==="jiwon"){ const nx=[snap,...snapsJw]; await sv(SK_JW,nx); setSnapsJw(nx); }
    else             { const nx=[snap,...snapsSh]; await sv(SK_SH,nx); setSnapsSh(nx); }
    setInputWho(null);
  };
  const deleteSnap = async(who, id)=>{
    if(who==="jiwon"){ const nx=snapsJw.filter(s=>s.id!==id); await sv(SK_JW,nx); setSnapsJw(nx); }
    else             { const nx=snapsSh.filter(s=>s.id!==id); await sv(SK_SH,nx); setSnapsSh(nx); }
  };
  const saveFixed = async(type,data)=>{
    if(type==="expense"){ await sv(FIXED_K,data); setFixedExps(data); }
    if(type==="install"){ await sv(INST_K, data); setInstalls(data);  }
  };
  const saveProfiles = async(data)=>{ await sv(PROF_K,data); setProfiles(data); };
  const sendChat = async(msg)=>{
    const nx=[...chats,msg]; await sv(CHAT_K,nx); setChats(nx);
  };

  const TABS=[["home","🏠","홈"],["record","📋","기록"],["chat","💬","채팅"],["fixed","📌","고정비"],["setting","⚙️","설정"]];

  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Pretendard','Apple SD Gothic Neo',sans-serif",maxWidth:480,margin:"0 auto",paddingBottom:72}}>
      {/* 헤더 */}
      <div style={{background:`linear-gradient(135deg,#6B5236,${C.accent})`,padding:"18px 20px 14px",color:"#fff"}}>
        <div style={{fontSize:11,opacity:.7,marginBottom:2}}>부부 가계부</div>
        <div style={{fontSize:18,fontWeight:800}}>변지원 · 정수현 💑</div>
      </div>

      {/* 콘텐츠 */}
      <div style={{padding:"16px 16px 0"}}>
        {loading
          ?<div style={{textAlign:"center",padding:80,color:C.muted}}>불러오는 중...</div>
          :tab==="home"   ?<HomeTab snapJw={snapsJw[0]} snapSh={snapsSh[0]} prevJw={snapsJw[1]} prevSh={snapsSh[1]} profiles={profiles} fixedExps={fixedExps} installs={installs} onAdd={setInputWho}/>
          :tab==="record" ?<RecordTab snapsJw={snapsJw} snapsSh={snapsSh} onDelete={deleteSnap}/>
          :tab==="chat"   ?<ChatTab chats={chats} onSend={sendChat}/>
          :tab==="fixed"  ?<FixedTab fixedExps={fixedExps} installs={installs} onSave={saveFixed}/>
          :<SettingTab profiles={profiles} saveProfiles={saveProfiles}/>
        }
      </div>

      {/* 하단 탭바 */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:C.card,borderTop:`1px solid ${C.border}`,display:"flex",zIndex:100}}>
        {TABS.map(([k,icon,label])=>(
          <button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:"10px 0 8px",border:"none",background:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
            <span style={{fontSize:18}}>{icon}</span>
            <span style={{fontSize:10,fontWeight:tab===k?700:400,color:tab===k?C.primary:C.muted}}>{label}</span>
          </button>
        ))}
      </div>

      {/* 입력 시트 */}
      {inputWho && (
        <InputSheet
          who={inputWho}
          onClose={()=>setInputWho(null)}
          onSave={(form)=>saveSnap(inputWho,form)}
          prevSnap={inputWho==="jiwon"?snapsJw[0]:snapsSh[0]}
        />
      )}
    </div>
  );
}
