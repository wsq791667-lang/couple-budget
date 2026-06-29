import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD4l3Jc6ubtaAo7uwIOfrCmYDCYTM0r584",
  authDomain: "couple-budget-52957.firebaseapp.com",
  projectId: "couple-budget-52957",
  storageBucket: "couple-budget-52957.firebasestorage.app",
  messagingSenderId: "1042576621024",
  appId: "1:1042576621024:web:0c5d7d035ac794b30c7f85"
};
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

import { useState, useEffect, useCallback, useRef } from "react";

// Firebase 헬퍼
async function sGet(k, fb) {
  try {
    const snap = await getDoc(doc(db, "couple-budget", k));
    return snap.exists() ? JSON.parse(snap.data().value) : fb;
  } catch { return fb; }
}
function sSet(k, v) {
  setDoc(doc(db, "couple-budget", k), { value: JSON.stringify(v) }).catch(console.error);
}

// 테마
const THEMES = {
  white: { name:"화이트", emoji:"🤍", bg:"#F8F8F8", card:"#FFFFFF", border:"#E8E8E8", primary:"#777777", primaryBg:"#F0F0F0", accent:"#999999", jw:"#7A9E6A", jwBg:"#E8F4E4", sh:"#8A7AB8", shBg:"#EDE9F7" },
  beige: { name:"베이지", emoji:"🤎", bg:"#F7F2EA", card:"#FDFAF4", border:"#EAE0D0", primary:"#A0784A", primaryBg:"#F0E6D6", accent:"#D4A574", jw:"#7A9E6A", jwBg:"#E8F4E4", sh:"#8A7AB8", shBg:"#EDE9F7" },
  sky:   { name:"블루",   emoji:"💙", bg:"#EDF4FB", card:"#F5FAFF", border:"#C8DCF0", primary:"#4A7FA8", primaryBg:"#D8ECF8", accent:"#6AA8D4", jw:"#6AAE8A", jwBg:"#E0F4EA", sh:"#A870C0", shBg:"#F0E0F8" },
  rose:  { name:"핑크",   emoji:"🩷", bg:"#FFF0F5", card:"#FFFAFC", border:"#FFD6E7", primary:"#E8608A", primaryBg:"#FFE4EF", accent:"#FF8FAD", jw:"#E87878", jwBg:"#FFE8E8", sh:"#B088D4", shBg:"#F0E4FF" },
};

// 테마별 이모지
const EM = {
  white: { money:"🪙", card:"💳", salary:"📋", adjust:"📝", fixed:"📌", install:"🗂️", cal:"🗓️", chart:"📊", piggy:"🐰", heart:"🤍", vaultTitle:"🐰 토끼 금고 현황!", reasonTitle:"🕵️ 돈이 왜 바뀌었지?" },
  beige: { money:"☕", card:"🧾", salary:"💼", adjust:"🗒️", fixed:"🏦", install:"🛍️", cal:"📅", chart:"📈", piggy:"🦔", heart:"🤎", vaultTitle:"🦔 고슴도치 금고 현황!", reasonTitle:"🍵 이번달 살림 내역" },
  sky:   { money:"💎", card:"🪄", salary:"🌊", adjust:"🫧", fixed:"🔮", install:"🎐", cal:"🌙", chart:"📡", piggy:"🐳", heart:"💙", vaultTitle:"🐳 고래 지갑 현황!", reasonTitle:"🌊 이번 기간 흐름" },
  rose:  { money:"🍓", card:"🎀", salary:"🌸", adjust:"🌺", fixed:"🎁", install:"🩰", cal:"🌷", chart:"🍰", piggy:"🐷", heart:"🩷", vaultTitle:"🐷 돼지저금통 현황!", reasonTitle:"🎀 이번달 특별 내역" },
};

// 유틸
const fmt = n => n == null ? "0" : Number(n).toLocaleString("ko-KR");
const fmtAbs = n => fmt(Math.abs(n));
const pn = s => Number((s || "").toString().replace(/,/g, "")) || 0;
const todayStr = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const MONTH_KR = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
const DOW = ["일","월","화","수","목","금","토"];

function getInstSt(item, y, m) {
  const diff = (y - item.sy) * 12 + (m - item.sm);
  if (diff < 0 || diff >= item.months) return null;
  return { cur: diff + 1, total: item.months, isLast: diff + 1 === item.months };
}

function calcUsage(prev, curr) {
  if (!prev || !curr) return null;
  const prevCash = pn(prev.cash);
  const currCash = curr.cash !== "" ? pn(curr.cash) : prevCash;
  const prevCard = pn(prev.card);
  const currCard = curr.card !== "" ? pn(curr.card) : prevCard;
  const salary   = pn(curr.salary);
  const addInc   = pn(curr.addIncome);
  const cardPaid = pn(curr.cardPaid);
  // 변동액 = 직전현금 - 현재현금 + 카드증가분 - 카드결제 - 급여 - 추가수입
  // (급여/추가수입이 들어왔으니 그만큼 덜 쓴 것)
  const used = prevCash - currCash + (currCard - prevCard) - cardPaid - salary - addInc;
  const days = daysBetween(prev.date, curr.date);
  return { used, days, perDay: days > 0 ? Math.round(used / days) : 0 };
}

// 날짜 기반 이번달 제외 헬퍼
function isSkippedThisMonth(item, y, m) {
  if (!item.skipMonths) return false;
  return item.skipMonths.includes(`${y}-${String(m + 1).padStart(2, "0")}`);
}
function toggleSkipMonth(item, y, m) {
  const key = `${y}-${String(m + 1).padStart(2, "0")}`;
  const prev = item.skipMonths || [];
  const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
  return { ...item, skipMonths: next };
}

// 드럼롤 날짜 선택 컴포넌트
function DatePicker({ value, onChange, mode = "date" }) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const parsed = value ? value.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1, now.getDate()];
  const [selY, setSelY] = useState(parsed[0] || now.getFullYear());
  const [selM, setSelM] = useState(parsed[1] || now.getMonth() + 1);
  const [selD, setSelD] = useState(parsed[2] || now.getDate());

  const years = Array.from({ length: 10 }, (_, i) => now.getFullYear() - 3 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const daysInMonth = new Date(selY, selM, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const confirm = () => {
    if (mode === "month") onChange(`${selY}-${String(selM).padStart(2, "0")}`);
    else onChange(`${selY}-${String(selM).padStart(2, "0")}-${String(selD).padStart(2, "0")}`);
    setOpen(false);
  };

  const label = mode === "month"
    ? (value ? `${parsed[0]}년 ${parsed[1]}월` : "월 선택")
    : (value ? `${parsed[0]}년 ${parsed[1]}월 ${parsed[2]}일` : "날짜 선택");

  const ScrollCol = ({ items, value, onChange, label: lbl }) => {
    const ref = useRef(null);
    useEffect(() => {
      const idx = items.indexOf(value);
      if (ref.current && idx >= 0) ref.current.scrollTop = idx * 44;
    }, [value]);
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ fontSize: 11, color: "#9E8B78", marginBottom: 4 }}>{lbl}</div>
        <div ref={ref} style={{ height: 180, overflowY: "scroll", scrollSnapType: "y mandatory", borderRadius: 10, background: "#F7F2EA" }}>
          {items.map(v => (
            <div key={v} onClick={() => onChange(v)} style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "center", scrollSnapAlign: "start", fontSize: 16, fontWeight: v === value ? 800 : 400, color: v === value ? "#A0784A" : "#9E8B78", background: v === value ? "#F0E6D6" : "transparent", cursor: "pointer", borderRadius: 8, margin: "0 4px" }}>
              {v}{lbl === "년" ? "" : lbl === "월" ? "" : ""}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <button onClick={() => setOpen(true)} style={{ width: "100%", border: "1.5px solid #EAE0D0", borderRadius: 10, padding: "12px 14px", fontSize: 15, fontWeight: value ? 600 : 400, background: "#FDFAF4", color: value ? "#3D2E1E" : "#BDB09E", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
        {label}
      </button>
      {open && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 400, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#FDFAF4", borderRadius: "22px 22px 0 0", padding: "20px 20px 40px", width: "100%", maxWidth: 480, margin: "0 auto" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#3D2E1E", marginBottom: 16, textAlign: "center" }}>날짜 선택</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <ScrollCol items={years} value={selY} onChange={setSelY} label="년" />
              <ScrollCol items={months} value={selM} onChange={v => { setSelM(v); if (selD > new Date(selY, v, 0).getDate()) setSelD(1); }} label="월" />
              {mode === "date" && <ScrollCol items={days} value={selD} onChange={setSelD} label="일" />}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setOpen(false)} style={{ flex: 1, padding: "12px 0", border: "1.5px solid #EAE0D0", borderRadius: 10, background: "#FDFAF4", color: "#9E8B78", fontWeight: 600, cursor: "pointer" }}>취소</button>
              <button onClick={confirm} style={{ flex: 1, padding: "12px 0", border: "none", borderRadius: 10, background: "#A0784A", color: "#fff", fontWeight: 700, cursor: "pointer" }}>확인</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// 공통 컴포넌트
function Avatar({ src, initial, color, size = 36 }) {
  const style = { width: size, height: size, borderRadius: "50%", overflow: "hidden", background: color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 700, color: "#fff", flexShrink: 0 };
  return <div style={style}>{src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initial}</div>;
}

function Sheet({ onClose, title, children, C }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 200, display: "flex", alignItems: "flex-end" }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.card, borderRadius: "22px 22px 0 0", padding: "24px 20px 44px", width: "100%", maxWidth: 480, margin: "0 auto", maxHeight: "95vh", overflowY: "auto" }}>
        {title && <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginBottom: 22 }}>{title}</div>}
        {children}
      </div>
    </div>
  );
}

function DelModal({ msg, onCancel, onConfirm, C }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: C.card, borderRadius: 18, padding: 24, width: 280, textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>삭제할까요?</div>
        <div style={{ fontSize: 12, color: C.sub, marginBottom: 20 }}>{msg || "삭제한 내용은 복구할 수 없어요"}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "10px 0", border: `1.5px solid ${C.border}`, borderRadius: 10, background: C.card, color: C.sub, fontWeight: 600, cursor: "pointer" }}>취소</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: "10px 0", border: "none", borderRadius: 10, background: "#C46A6A", color: "#fff", fontWeight: 700, cursor: "pointer" }}>삭제</button>
        </div>
      </div>
    </div>
  );
}

function MemberToggle({ value, onChange, MEMBERS, C }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
      {Object.entries(MEMBERS).map(([k, mb]) => (
        <button key={k} onClick={() => onChange(k)} style={{ flex: 1, padding: "9px 0", border: `2px solid ${value === k ? mb.color : C.border}`, borderRadius: 10, background: value === k ? mb.bg : C.card, color: value === k ? mb.color : C.muted, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{mb.label}</button>
      ))}
    </div>
  );
}

// 숫자 입력 행 - InputSheet 밖에 정의해야 리렌더링 안 됨
function NumRow({ label, k, color, sub, value, onChange, borderColor, C }) {
  const inp = { width: "100%", border: `1.5px solid ${borderColor}`, borderRadius: 10, padding: "12px 14px", fontSize: 16, outline: "none", fontFamily: "inherit", boxSizing: "border-box", background: C.card, color: C.text };
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
        <span style={{ color: color || C.sub }}>{label}</span>
        {sub && <span style={{ fontSize: 10, color: C.muted, marginLeft: 4 }}>{sub}</span>}
      </div>
      <input
        value={value}
        onChange={e => onChange(k, e.target.value)}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="0"
        style={inp}
      />
    </div>
  );
}

// 입력 시트
function InputSheet({ who, onClose, onSave, prevSnap, C, MEMBERS, E }) {
  const m = MEMBERS[who];
  const [form, setForm] = useState({ date: todayStr(), cash: "", card: "", salary: "", addIncome: "", cardPaid: "", memo: "" });
  const [preview, setPreview] = useState(null);
  const f = useCallback((k, v) => setForm(p => ({ ...p, [k]: v })), []);
  const hasAny = form.cash !== "" || form.card !== "" || form.salary !== "" || form.addIncome !== "" || form.cardPaid !== "";
  const inp = { width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", fontSize: 16, outline: "none", fontFamily: "inherit", boxSizing: "border-box", background: C.card, color: C.text };

  const handleSave = () => {
    if (!hasAny) return;
    const usage = calcUsage(prevSnap, form);
    setPreview(usage);
    onSave(form);
  };
  return (
    <Sheet onClose={onClose} title={`${m.label} 입력`} C={C}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.sub, marginBottom: 6 }}>입력일</div>
        <DatePicker value={form.date} onChange={v => f("date", v)} mode="date" />
      </div>
      <div style={{ background: C.bg, borderRadius: 12, padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 4 }}>{E.vaultTitle}</div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>현재 실제 보유 금액을 입력해요</div>
        <NumRow label="보유 현금" k="cash" color={m.color} value={form.cash} onChange={f} borderColor={form.cash?m.color:C.border} C={C}/>
        <NumRow label="카드 결제 예정액" k="card" color="#C46A6A" value={form.card} onChange={f} borderColor={form.card?m.color:C.border} C={C}/>
      </div>
      <div style={{ background: C.bg, borderRadius: 12, padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text, marginBottom: 4 }}>{E.reasonTitle}</div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>변동 이유를 기록해요 (선택)</div>
        <NumRow label="급여" k="salary" color="#6A9E7A" sub="이번달 실수령 급여" value={form.salary} onChange={f} borderColor={form.salary?"#6A9E7A":C.border} C={C}/>
        <NumRow label="기타 추가 수입" k="addIncome" color="#6A9E7A" sub="용돈·부수입 등" value={form.addIncome} onChange={f} borderColor={form.addIncome?"#6A9E7A":C.border} C={C}/>
        <NumRow label="카드 결제/상환" k="cardPaid" color={C.primary} sub="실제 카드값 납부" value={form.cardPaid} onChange={f} borderColor={form.cardPaid?C.primary:C.border} C={C}/>
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.sub, marginBottom: 6 }}>메모 (선택)</div>
        <input value={form.memo} onChange={e => f("memo", e.target.value)} placeholder="예: 여행 다녀옴" style={{ ...inp, fontSize: 14 }} />
      </div>
      {prevSnap && preview && (
        <div style={{ background: preview.used >= 0 ? "#F7ECEC" : "#EAF3EC", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: preview.used >= 0 ? "#C46A6A" : "#6A9E7A", marginBottom: 8 }}>📊 {preview.days}일간 변동액</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: C.sub }}>총 변동액</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: preview.used >= 0 ? "#C46A6A" : "#6A9E7A" }}>{preview.used >= 0 ? "" : "-"}{fmtAbs(preview.used)}원</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: C.sub }}>하루 평균</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{fmt(Math.abs(preview.perDay))}원</span>
          </div>
        </div>
      )}
      <button onClick={handleSave} style={{ width: "100%", padding: "15px 0", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", background: hasAny ? `linear-gradient(135deg,${m.color},${m.color}cc)` : "#ccc", color: "#fff" }}>저장하기</button>
    </Sheet>
  );
}

// 홈 달력
function HomeCalendar({ snapsJw, snapsSh, C, MEMBERS }) {
  const now = new Date();
  const [calY, setCalY] = useState(now.getFullYear());
  const [calM, setCalM] = useState(now.getMonth());
  const [selected, setSelected] = useState(null);
  const firstDay = new Date(calY, calM, 1).getDay();
  const daysInMonth = new Date(calY, calM + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const ds = d => `${calY}-${String(calM + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const getSnap = (snaps, d) => snaps.find(s => s.date === ds(d));
  const mStr = `${calY}-${String(calM + 1).padStart(2, "0")}`;
  let monthUsed = 0;
  const mJw = snapsJw.filter(s => s.date.startsWith(mStr));
  const mSh = snapsSh.filter(s => s.date.startsWith(mStr));
  for (let i = 1; i < mJw.length; i++) { const u = calcUsage(mJw[i], mJw[i-1]); if (u) monthUsed += u.used; }
  for (let i = 1; i < mSh.length; i++) { const u = calcUsage(mSh[i], mSh[i-1]); if (u) monthUsed += u.used; }
  const prevM = () => { if (calM === 0) { setCalY(y => y - 1); setCalM(11); } else setCalM(m => m - 1); };
  const nextM = () => { if (calM === 11) { setCalY(y => y + 1); setCalM(0); } else setCalM(m => m + 1); };
  return (
    <div style={{ background: C.card, borderRadius: 16, padding: 16, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button onClick={prevM} style={{ background: C.primaryBg, border: "none", color: C.primary, borderRadius: 8, width: 30, height: 30, fontSize: 15, cursor: "pointer" }}>‹</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{calY}년 {MONTH_KR[calM]}</div>
          {monthUsed > 0 && <div style={{ fontSize: 11, color: "#C46A6A", marginTop: 2 }}>이달 사용 약 {fmt(monthUsed)}원</div>}
        </div>
        <button onClick={nextM} style={{ background: C.primaryBg, border: "none", color: C.primary, borderRadius: 8, width: 30, height: 30, fontSize: 15, cursor: "pointer" }}>›</button>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8, justifyContent: "flex-end" }}>
        {Object.entries(MEMBERS).map(([k, mb]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: mb.color }} />
            <span style={{ fontSize: 10, color: C.muted }}>{mb.label}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 6 }}>
        {DOW.map((d, i) => <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 600, color: i === 0 ? "#C46A6A" : i === 6 ? "#8A7AB8" : C.muted, padding: "3px 0" }}>{d}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const sjw = getSnap(snapsJw, d), ssh = getSnap(snapsSh, d);
          const has = !!(sjw || ssh), isToday = ds(d) === todayStr(), dow = i % 7;
          return (
            <div key={d} onClick={() => has && setSelected({ date: ds(d), snapJw: sjw, snapSh: ssh })}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "4px 2px", borderRadius: 8, background: isToday ? C.primaryBg : "transparent", border: isToday ? `1.5px solid ${C.primary}` : "1.5px solid transparent", cursor: has ? "pointer" : "default", minHeight: 42 }}>
              <span style={{ fontSize: 12, fontWeight: has || isToday ? 700 : 400, color: dow === 0 ? "#C46A6A" : dow === 6 ? "#8A7AB8" : C.text, marginBottom: 2 }}>{d}</span>
              <div style={{ display: "flex", gap: 2 }}>
                {sjw && <div style={{ width: 5, height: 5, borderRadius: "50%", background: MEMBERS.jiwon.color }} />}
                {ssh && <div style={{ width: 5, height: 5, borderRadius: "50%", background: MEMBERS.suhyun.color }} />}
              </div>
            </div>
          );
        })}
      </div>
      {selected && (
        <div style={{ marginTop: 12, background: C.bg, borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{selected.date}</span>
            <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: C.muted, fontSize: 16, cursor: "pointer" }}>✕</button>
          </div>
          {[["jiwon", selected.snapJw], ["suhyun", selected.snapSh]].map(([k, snap]) => {
            if (!snap) return null;
            const mb = MEMBERS[k];
            return (
              <div key={k} style={{ background: mb.bg, borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: mb.color, marginBottom: 6 }}>{mb.label}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {[["현금", pn(snap.cash), mb.color], ["카드", pn(snap.card), "#C46A6A"], ["급여", pn(snap.salary), "#6A9E7A"], ["카드결제", pn(snap.cardPaid), C.primary]].filter(([, v]) => v > 0).map(([l, v, c]) => (
                    <div key={l} style={{ background: C.card, borderRadius: 7, padding: "5px 8px" }}>
                      <div style={{ fontSize: 10, color: C.muted }}>{l}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: c }}>{fmt(v)}원</div>
                    </div>
                  ))}
                </div>
                {snap.memo && <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>💬 {snap.memo}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// 홈 탭
function HomeTab({ snapJw, snapSh, prevJw, prevSh, snapsJw, snapsSh, profiles, fixedExps, installs, onAdd, C, MEMBERS, E }) {
  const now = new Date(); const y = now.getFullYear(), m = now.getMonth();
  const usageJw = calcUsage(prevJw, snapJw), usageSh = calcUsage(prevSh, snapSh);
  const cashJw = snapJw ? pn(snapJw.cash) : 0, cashSh = snapSh ? pn(snapSh.cash) : 0;
  const cardJw = snapJw ? pn(snapJw.card) : 0, cardSh = snapSh ? pn(snapSh.card) : 0;
  const totalCash = cashJw + cashSh, totalCard = cardJw + cardSh;
  const fixedExpTotal = fixedExps.filter(i => !isSkippedThisMonth(i, y, m)).reduce((s, i) => s + i.amount, 0);
  const instTotal = installs.filter(i => !isSkippedThisMonth(i, y, m)).reduce((s, i) => { const st = getInstSt(i, y, m); return st ? s + i.amount : s; }, 0);
  // 가용금액 = 현금 - 카드 - 고정지출 (급여는 현금에 이미 포함)
  const avail = totalCash - totalCard - fixedExpTotal;
  const totalUsed = (usageJw?.used || 0) + (usageSh?.used || 0);
  return (
    <div style={{ paddingBottom: 20 }}>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        {Object.entries(MEMBERS).map(([k, mb]) => {
          const snap = k === "jiwon" ? snapJw : snapSh;
          return (
            <div key={k} style={{ flex: 1, background: C.card, borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Avatar src={profiles[k]?.photo} initial={mb.initial} color={mb.color} size={40} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: mb.color }}>{mb.label}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>{snap?.date || "미입력"} 기준</div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span style={{ color: C.sub }}>현금</span><span style={{ fontWeight: 700, color: C.text }}>{fmt(k === "jiwon" ? cashJw : cashSh)}원</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span style={{ color: C.sub }}>카드</span><span style={{ fontWeight: 700, color: "#C46A6A" }}>-{fmt(k === "jiwon" ? cardJw : cardSh)}원</span></div>
              <button onClick={() => onAdd(k)} style={{ marginTop: 4, padding: "7px 0", border: `1.5px solid ${mb.color}`, borderRadius: 9, background: mb.bg, color: mb.color, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>+ 입력</button>
            </div>
          );
        })}
      </div>
      <div style={{ background: `linear-gradient(135deg,${C.primary},${C.accent})`, borderRadius: 20, padding: "22px 20px", marginBottom: 14, color: "#fff" }}>
        <div style={{ fontSize: 12, opacity: .8, marginBottom: 4 }}>합산 실질 가용금액</div>
        <div style={{ fontSize: 38, fontWeight: 800, marginBottom: 4, color: avail >= 0 ? "#fff" : "#fca5a5" }}>{avail >= 0 ? "" : "-"}{fmtAbs(avail)}원</div>
        <div style={{ fontSize: 11, opacity: .7, marginBottom: 16 }}>현금 {fmt(totalCash)} - 카드 {fmt(totalCard)} - 고정지출 {fmt(fixedExpTotal)}원</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[["총 현금", fmt(totalCash) + "원", "#fff"], ["카드+할부", "-" + fmt(totalCard) + "원", "#ffd4d4"], ["고정지출", "-" + fmt(fixedExpTotal) + "원", "#ffd4d4"]].map(([l, v, c]) => (
            <div key={l} style={{ flex: 1, background: "rgba(255,255,255,.14)", borderRadius: 10, padding: "8px 6px" }}>
              <div style={{ fontSize: 9, opacity: .75, marginBottom: 2 }}>{l}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: c }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
      {(usageJw || usageSh) && (
        <div style={{ background: C.card, borderRadius: 16, padding: 18, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>{E.chart} 최근 변동 분석</div>
          {[["jiwon", usageJw, snapJw, prevJw], ["suhyun", usageSh, snapSh, prevSh]].map(([k, usage, snap, prev]) => {
            if (!usage || !snap) return null;
            const mb = MEMBERS[k];
            return (
              <div key={k} style={{ marginBottom: 10, padding: "12px 14px", background: mb.bg, borderRadius: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <Avatar src={profiles[k]?.photo} initial={mb.initial} color={mb.color} size={24} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: mb.color }}>{mb.label}</span>
                  <span style={{ fontSize: 10, color: C.muted }}>{prev?.date}→{snap.date} ({usage.days}일)</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1, background: usage.used >= 0 ? "#F7ECEC" : "#EAF3EC", borderRadius: 8, padding: "8px 10px" }}>
                    <div style={{ fontSize: 10, color: C.sub, marginBottom: 2 }}>변동액</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: usage.used >= 0 ? "#C46A6A" : "#6A9E7A" }}>{usage.used >= 0 ? "" : "-"}{fmtAbs(usage.used)}원</div>
                  </div>
                  <div style={{ flex: 1, background: C.card, borderRadius: 8, padding: "8px 10px" }}>
                    <div style={{ fontSize: 10, color: C.sub, marginBottom: 2 }}>일평균</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: C.primary }}>{fmt(Math.abs(usage.perDay))}원</div>
                  </div>
                </div>
              </div>
            );
          })}
          {usageJw && usageSh && <div style={{ padding: "10px 14px", background: C.primaryBg, borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontSize: 13, color: C.sub }}>합산 총 변동액</span><span style={{ fontSize: 17, fontWeight: 800, color: totalUsed >= 0 ? "#C46A6A" : "#6A9E7A" }}>{totalUsed >= 0 ? "" : "-"}{fmtAbs(totalUsed)}원</span></div>}
        </div>
      )}
      <div style={{ background: C.card, borderRadius: 16, padding: 18, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>{E.fixed} 이번달 고정비</div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>고정지출은 현금에서 차감 · 할부는 카드값에 포함</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[["고정지출", "-" + fmt(fixedExpTotal), C.primary, C.primaryBg], ["할부", "-" + fmt(instTotal), C.sh, C.shBg]].map(([l, v, c, bg]) => (
            <div key={l} style={{ flex: 1, background: bg, borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 10, color: c, fontWeight: 600, marginBottom: 3 }}>{l}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: c }}>{v}원</div>
            </div>
          ))}
        </div>
      </div>
      <HomeCalendar snapsJw={snapsJw} snapsSh={snapsSh} C={C} MEMBERS={MEMBERS} />
    </div>
  );
}

// 기록 탭
function RecordTab({ snapsJw, snapsSh, onDelete, C, MEMBERS }) {
  const [who, setWho] = useState("jiwon");
  const [delTarget, setDelTarget] = useState(null);
  const snaps = who === "jiwon" ? snapsJw : snapsSh;
  const mb = MEMBERS[who];
  return (
    <div style={{ paddingBottom: 20 }}>
      <div style={{ display: "flex", background: C.primaryBg, borderRadius: 12, padding: 4, marginBottom: 14 }}>
        {Object.entries(MEMBERS).map(([k, m]) => <button key={k} onClick={() => setWho(k)} style={{ flex: 1, padding: "9px 0", border: "none", borderRadius: 10, background: who === k ? m.color : "transparent", color: who === k ? "#fff" : C.sub, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{m.label}</button>)}
      </div>
      {snaps.length === 0 ? <div style={{ textAlign: "center", padding: "60px 20px", color: C.muted }}><div style={{ fontSize: 36, marginBottom: 10 }}>📷</div><div style={{ fontSize: 14, color: C.sub }}>아직 기록이 없어요</div></div>
        : snaps.map((snap, i) => {
          const prev = snaps[i + 1]; const usage = calcUsage(prev, snap);
          return (
            <div key={snap.id} style={{ background: C.card, borderRadius: 16, padding: 18, marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{snap.date}</div>
                  {prev && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>직전: {prev.date} ({daysBetween(prev.date, snap.date)}일 후)</div>}
                </div>
                <button onClick={() => setDelTarget(snap.id)} style={{ background: "#F7ECEC", color: "#C46A6A", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>삭제</button>
              </div>
              {usage && (
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <div style={{ flex: 1, background: usage.used >= 0 ? "#F7ECEC" : "#EAF3EC", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, color: C.sub, marginBottom: 2 }}>변동액</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: usage.used >= 0 ? "#C46A6A" : "#6A9E7A" }}>{usage.used >= 0 ? "" : "-"}{fmtAbs(usage.used)}원</div>
                  </div>
                  <div style={{ flex: 1, background: C.primaryBg, borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ fontSize: 10, color: C.sub, marginBottom: 2 }}>일평균</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: C.primary }}>{fmt(Math.abs(usage.perDay))}원</div>
                  </div>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {[["현금", pn(snap.cash), mb.color], ["카드", pn(snap.card), "#C46A6A"], ["급여", pn(snap.salary), "#6A9E7A"], ["카드결제", pn(snap.cardPaid), C.primary]].filter(([, v]) => v > 0).map(([l, v, c]) => (
                  <div key={l} style={{ background: C.bg, borderRadius: 8, padding: "7px 10px" }}>
                    <div style={{ fontSize: 10, color: C.muted }}>{l}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: c }}>{fmt(v)}원</div>
                  </div>
                ))}
              </div>
              {snap.memo && <div style={{ marginTop: 8, fontSize: 12, color: C.muted, background: C.bg, borderRadius: 8, padding: "7px 10px" }}>💬 {snap.memo}</div>}
            </div>
          );
        })}
      {delTarget && <DelModal C={C} onCancel={() => setDelTarget(null)} onConfirm={() => { onDelete(who, delTarget); setDelTarget(null); }} />}
    </div>
  );
}

// 채팅 탭
function ChatTab({ chats, onSend, onDeleteChat, profiles, C, MEMBERS }) {
  const [who, setWho] = useState("jiwon");
  const [text, setText] = useState("");
  const [delTarget, setDelTarget] = useState(null);
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chats]);
  const send = () => { if (!text.trim()) return; onSend({ id: Date.now() + Math.random(), who, text: text.trim(), ts: new Date().toISOString() }); setText(""); };
  return (
    <div style={{ display: "flex", flexDirection: "column", height: 520 }}>
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 16, minHeight: 0 }}>
        {chats.length === 0
          ? <div style={{ textAlign: "center", padding: "60px 20px", color: C.muted }}><div style={{ fontSize: 36, marginBottom: 10 }}>💬</div><div style={{ fontSize: 14, fontWeight: 600, color: C.sub }}>아직 대화가 없어요</div><div style={{ fontSize: 12, color: C.muted, marginTop: 5 }}>서로 메시지를 남겨보세요 😊</div></div>
          : chats.map(chat => {
            const mb = MEMBERS[chat.who]; const isJw = chat.who === "jiwon";
            const time = new Date(chat.ts).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
            return (
              <div key={chat.id} style={{ display: "flex", flexDirection: isJw ? "row" : "row-reverse", alignItems: "flex-end", gap: 8, marginBottom: 12 }}>
                <Avatar src={profiles[chat.who]?.photo} initial={mb.initial} color={mb.color} size={32} />
                <div style={{ maxWidth: "70%" }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 3, textAlign: isJw ? "left" : "right" }}>{mb.label} · {time}</div>
                  <div onClick={() => setDelTarget(chat.id)} style={{ background: isJw ? mb.bg : C.card, border: `1.5px solid ${isJw ? mb.color : C.border}`, borderRadius: isJw ? "4px 16px 16px 16px" : "16px 4px 16px 16px", padding: "10px 14px", fontSize: 14, color: C.text, lineHeight: 1.5, cursor: "pointer" }}>{chat.text}</div>
                </div>
              </div>
            );
          })}
        <div ref={bottomRef} />
      </div>
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, background: C.bg }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {Object.entries(MEMBERS).map(([k, mb]) => <button key={k} onClick={() => setWho(k)} style={{ flex: 1, padding: "7px 0", border: `2px solid ${who === k ? mb.color : C.border}`, borderRadius: 9, background: who === k ? mb.bg : C.card, color: who === k ? mb.color : C.muted, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{mb.label}</button>)}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="메시지를 입력하세요..." style={{ flex: 1, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none", fontFamily: "inherit", background: C.card, color: C.text }} />
          <button onClick={send} style={{ background: MEMBERS[who].color, color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>전송</button>
        </div>
      </div>
      {delTarget && <DelModal C={C} msg="이 메시지를 삭제할까요?" onCancel={() => setDelTarget(null)} onConfirm={() => { onDeleteChat(delTarget); setDelTarget(null); }} />}
    </div>
  );
}

// 고정비 탭
function FixedTab({ fixedExps, installs, onSave, C, MEMBERS, E }) {
  const now = new Date(); const y = now.getFullYear(), m = now.getMonth();
  const [sub, setSub] = useState("expense");
  const [showFE, setShowFE] = useState(false);
  const [showIN, setShowIN] = useState(false);
  const [delFE, setDelFE] = useState(null);
  const [delIN, setDelIN] = useState(null);
  const [fe, setFe] = useState({ name: "", who: "jiwon", type: "대출", amount: "", memo: "", expiry: "" });
  const [ins, setIns] = useState({ name: "", who: "jiwon", card: "현대카드", amount: "", memo: "", sy: y, sm: m, mode: "months", months: "", endDate: "" });
  const instTotal = installs.filter(i => !isSkippedThisMonth(i, y, m)).reduce((s, i) => { const st = getInstSt(i, y, m); return st ? s + i.amount : s; }, 0);
  const inp = { width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", fontSize: 16, outline: "none", fontFamily: "inherit", boxSizing: "border-box", background: C.card, color: C.text };
  const chip = (on, ac, ab) => ({ padding: "7px 14px", borderRadius: 99, cursor: "pointer", fontSize: 13, border: `1.5px solid ${on ? ac : C.border}`, background: on ? ab : C.card, color: on ? ac : C.muted, fontWeight: on ? 700 : 400 });
  const FIXED_TYPES = ["대출", "보험", "구독", "관리비", "기타"];
  const CARD_COS = ["현대카드", "신한카드", "국민카드", "삼성카드", "롯데카드", "하나카드", "우리카드", "NH카드", "기타"];
  const toggleSkip = (type, id) => {
    if (type === "expense") { const nx = fixedExps.map(i => i.id === id ? toggleSkipMonth(i, y, m) : i); onSave("expense", nx); }
    else { const nx = installs.map(i => i.id === id ? toggleSkipMonth(i, y, m) : i); onSave("install", nx); }
  };
  const addFE = () => { if (!fe.name || !fe.amount) return; onSave("expense", [...fixedExps, { id: Date.now() + Math.random(), ...fe, amount: pn(fe.amount), skipThisMonth: false }]); setShowFE(false); setFe({ name: "", who: "jiwon", type: "대출", amount: "", memo: "", expiry: "" }); };
  const addIN = () => {
    if (!ins.name || !ins.amount) return;
    let months = Number(ins.months);
    if (ins.mode === "endDate" && ins.endDate) { const [ey, em] = ins.endDate.split("-").map(Number); months = (ey - ins.sy) * 12 + (em - 1 - ins.sm) + 1; }
    if (!months || months <= 0) return;
    onSave("install", [...installs, { id: Date.now() + Math.random(), name: ins.name, who: ins.who, card: ins.card, amount: pn(ins.amount), months, sy: ins.sy, sm: ins.sm, memo: ins.memo, skipThisMonth: false }]);
    setShowIN(false); setIns({ name: "", who: "jiwon", card: "현대카드", amount: "", memo: "", sy: y, sm: m, mode: "months", months: "", endDate: "" });
  };
  return (
    <div style={{ paddingBottom: 20 }}>
      <div style={{ background: C.primaryBg, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: C.primary }}>
        {E.fixed} <b>고정지출</b>은 계좌 자동이체 → 가용금액에서 자동 차감<br/>
        <b>할부</b>는 카드값에 이미 포함 → 카드값 입력시 반영
      </div>
      <div style={{ display: "flex", background: C.primaryBg, borderRadius: 12, padding: 4, marginBottom: 16 }}>
        {[["expense", "고정지출"], ["install", "할부"]].map(([k, l]) => <button key={k} onClick={() => setSub(k)} style={{ flex: 1, padding: "9px 0", border: "none", borderRadius: 10, background: sub === k ? C.primary : "transparent", color: sub === k ? "#fff" : C.sub, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{l}</button>)}
      </div>
      {sub === "expense" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>고정지출 <span style={{ color: C.primary }}>월 {fmt(fixedExps.filter(i => !i.skipThisMonth).reduce((s, i) => s + i.amount, 0))}원</span></div>
            <button onClick={() => setShowFE(true)} style={{ background: C.primaryBg, color: C.primary, border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ 추가</button>
          </div>
          {fixedExps.length === 0
            ? <div style={{ textAlign: "center", padding: "40px 0", color: C.muted }}><div style={{ fontSize: 30, marginBottom: 8 }}>📋</div><div style={{ fontSize: 13, color: C.sub }}>대출·보험 등을 등록해보세요</div></div>
            : fixedExps.map(item => {
              const skipped = isSkippedThisMonth(item, y, m);
              return (
              <div key={item.id} style={{ background: skipped ? C.bg : C.card, borderRadius: 14, padding: "14px 16px", marginBottom: 10, borderLeft: `4px solid ${skipped ? C.border : MEMBERS[item.who]?.color}`, opacity: skipped ? 0.6 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 6, marginBottom: 4, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ background: MEMBERS[item.who]?.bg, color: MEMBERS[item.who]?.color, fontSize: 10, fontWeight: 700, borderRadius: 6, padding: "2px 7px" }}>{MEMBERS[item.who]?.initial}</span>
                      <span style={{ background: C.bg, color: C.sub, fontSize: 10, borderRadius: 6, padding: "2px 7px" }}>{item.type}</span>
                      {skipped && <span style={{ background: "#F7ECEC", color: "#C46A6A", fontSize: 10, fontWeight: 700, borderRadius: 6, padding: "2px 7px" }}>이번달 제외</span>}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{item.name}</div>
                    {item.expiry && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>만기 {item.expiry}</div>}
                    {item.memo && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{item.memo}</div>}
                  </div>
                  <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, marginLeft: 10 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: skipped ? C.muted : C.primary }}>-{fmt(item.amount)}원</div>
                    <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 11, color: C.sub }}>
                      <input type="checkbox" checked={skipped} onChange={() => toggleSkip("expense", item.id)} />
                      이번달 제외
                    </label>
                    <button onClick={() => setDelFE(item.id)} style={{ fontSize: 10, color: "#C46A6A", background: "#F7ECEC", border: "none", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>삭제</button>
                  </div>
                </div>
              </div>
            );})}
          {delFE && <DelModal C={C} onCancel={() => setDelFE(null)} onConfirm={() => { onSave("expense", fixedExps.filter(i => i.id !== delFE)); setDelFE(null); }} />}
          {showFE && (
            <Sheet onClose={() => setShowFE(false)} title="고정지출 추가" C={C}>
              <MemberToggle value={fe.who} onChange={v => setFe(p => ({ ...p, who: v }))} MEMBERS={MEMBERS} C={C} />
              <div style={{ marginBottom: 14 }}><div style={{ fontSize: 12, color: C.sub, fontWeight: 600, marginBottom: 6 }}>종류</div><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{FIXED_TYPES.map(t => <button key={t} onClick={() => setFe(p => ({ ...p, type: t }))} style={chip(fe.type === t, C.primary, C.primaryBg)}>{t}</button>)}</div></div>
              <div style={{ marginBottom: 14 }}><div style={{ fontSize: 12, color: C.sub, fontWeight: 600, marginBottom: 6 }}>이름</div><input value={fe.name} onChange={e => setFe(p => ({ ...p, name: e.target.value }))} placeholder="예: 주택담보대출" style={inp} /></div>
              <div style={{ marginBottom: 14 }}><div style={{ fontSize: 12, color: C.sub, fontWeight: 600, marginBottom: 6 }}>월 납입액</div><input value={fe.amount} onChange={e => setFe(p => ({ ...p, amount: e.target.value }))} type="text" inputMode="numeric" pattern="[0-9]*" placeholder="0" style={{ ...inp, fontSize: 18, fontWeight: 700 }} /></div>
              <div style={{ marginBottom: 14 }}><div style={{ fontSize: 12, color: C.sub, fontWeight: 600, marginBottom: 6 }}>만기일 (선택)</div><DatePicker value={fe.expiry} onChange={v => setFe(p => ({ ...p, expiry: v }))} mode="date" /></div>
              <div style={{ marginBottom: 22 }}><div style={{ fontSize: 12, color: C.sub, fontWeight: 600, marginBottom: 6 }}>메모 (선택)</div><input value={fe.memo} onChange={e => setFe(p => ({ ...p, memo: e.target.value }))} placeholder="예: OO은행" style={inp} /></div>
              <button onClick={addFE} style={{ width: "100%", padding: "15px 0", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", background: `linear-gradient(135deg,${C.primary},${C.accent})`, color: "#fff" }}>저장하기</button>
            </Sheet>
          )}
        </>
      )}
      {sub === "install" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>할부 <span style={{ color: C.sh }}>이번달 {fmt(instTotal)}원</span></div>
            <button onClick={() => setShowIN(true)} style={{ background: C.shBg, color: C.sh, border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ 추가</button>
          </div>
          {installs.length === 0
            ? <div style={{ textAlign: "center", padding: "40px 0", color: C.muted }}><div style={{ fontSize: 30, marginBottom: 8 }}>💳</div><div style={{ fontSize: 13, color: C.sub }}>카드 할부를 등록해보세요</div></div>
            : installs.map(item => {
              const st = getInstSt(item, y, m); const endD = new Date(item.sy, item.sm + item.months - 1, 1); const isPast = new Date(y, m, 1) > endD;
              const skipped = isSkippedThisMonth(item, y, m);
              return (
                <div key={item.id} style={{ background: skipped ? C.bg : C.card, borderRadius: 14, padding: "14px 16px", marginBottom: 10, borderLeft: `4px solid ${isPast || skipped ? C.border : st?.isLast ? "#6A9E7A" : MEMBERS[item.who]?.color}`, opacity: isPast || skipped ? 0.6 : 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: 6, marginBottom: 5, flexWrap: "wrap" }}>
                        <span style={{ background: MEMBERS[item.who]?.bg, color: MEMBERS[item.who]?.color, fontSize: 10, fontWeight: 700, borderRadius: 6, padding: "2px 7px" }}>{MEMBERS[item.who]?.initial}</span>
                        <span style={{ background: C.shBg, color: C.sh, fontSize: 10, borderRadius: 6, padding: "2px 7px" }}>💳 {item.card}</span>
                        {isPast && <span style={{ background: C.bg, color: C.muted, fontSize: 10, fontWeight: 700, borderRadius: 6, padding: "2px 7px" }}>완료</span>}
                        {st?.isLast && <span style={{ background: "#EAF3EC", color: "#6A9E7A", fontSize: 10, fontWeight: 700, borderRadius: 6, padding: "2px 7px" }}>✅ 이번달 끝!</span>}
                        {skipped && <span style={{ background: "#F7ECEC", color: "#C46A6A", fontSize: 10, fontWeight: 700, borderRadius: 6, padding: "2px 7px" }}>이번달 제외</span>}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>{item.name}</div>
                      {!isPast && st && <div style={{ fontSize: 11, color: C.muted }}>{st.cur}/{st.total}회차</div>}
                    </div>
                    <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, marginLeft: 10 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: isPast || skipped ? C.muted : C.sh }}>-{fmt(item.amount)}원</div>
                      {!isPast && <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 11, color: C.sub }}><input type="checkbox" checked={skipped} onChange={() => toggleSkip("install", item.id)} />이번달 제외</label>}
                      <button onClick={() => setDelIN(item.id)} style={{ fontSize: 10, color: "#C46A6A", background: "#F7ECEC", border: "none", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>삭제</button>
                    </div>
                  </div>
                </div>
              );
            })}
          {delIN && <DelModal C={C} onCancel={() => setDelIN(null)} onConfirm={() => { onSave("install", installs.filter(i => i.id !== delIN)); setDelIN(null); }} />}
          {showIN && (
            <Sheet onClose={() => setShowIN(false)} title="💳 할부 추가" C={C}>
              <MemberToggle value={ins.who} onChange={v => setIns(p => ({ ...p, who: v }))} MEMBERS={MEMBERS} C={C} />
              <div style={{ marginBottom: 14 }}><div style={{ fontSize: 12, color: C.sub, fontWeight: 600, marginBottom: 6 }}>카드사</div><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{CARD_COS.map(c => <button key={c} onClick={() => setIns(p => ({ ...p, card: c }))} style={chip(ins.card === c, C.sh, C.shBg)}>{c}</button>)}</div></div>
              <div style={{ marginBottom: 14 }}><div style={{ fontSize: 12, color: C.sub, fontWeight: 600, marginBottom: 6 }}>항목 이름</div><input value={ins.name} onChange={e => setIns(p => ({ ...p, name: e.target.value }))} placeholder="예: 냉장고" style={inp} /></div>
              <div style={{ marginBottom: 14 }}><div style={{ fontSize: 12, color: C.sub, fontWeight: 600, marginBottom: 6 }}>월 납입액</div><input value={ins.amount} onChange={e => setIns(p => ({ ...p, amount: e.target.value }))} type="text" inputMode="numeric" pattern="[0-9]*" placeholder="0" style={{ ...inp, fontSize: 18, fontWeight: 700 }} /></div>
              <div style={{ marginBottom: 14 }}><div style={{ fontSize: 12, color: C.sub, fontWeight: 600, marginBottom: 6 }}>시작 월</div><div style={{ display: "flex", gap: 8 }}><select value={ins.sy} onChange={e => setIns(p => ({ ...p, sy: Number(e.target.value) }))} style={{ ...inp, flex: 1 }}>{[y - 2, y - 1, y, y + 1].map(yr => <option key={yr} value={yr}>{yr}년</option>)}</select><select value={ins.sm} onChange={e => setIns(p => ({ ...p, sm: Number(e.target.value) }))} style={{ ...inp, flex: 1 }}>{Array.from({ length: 12 }, (_, i) => <option key={i} value={i}>{i + 1}월</option>)}</select></div></div>
              <div style={{ marginBottom: 14 }}><div style={{ fontSize: 12, color: C.sub, fontWeight: 600, marginBottom: 6 }}>기간</div><div style={{ display: "flex", background: C.bg, borderRadius: 11, padding: 4, marginBottom: 10 }}>{[["months", "회차 수"], ["endDate", "만기 날짜"]].map(([k, l]) => <button key={k} onClick={() => setIns(p => ({ ...p, mode: k }))} style={{ flex: 1, padding: "8px 0", border: "none", borderRadius: 9, background: ins.mode === k ? C.card : "transparent", color: ins.mode === k ? C.primary : C.muted, fontWeight: ins.mode === k ? 700 : 500, fontSize: 13, cursor: "pointer" }}>{l}</button>)}</div>{ins.mode === "months" ? <input value={ins.months} onChange={e => setIns(p => ({ ...p, months: e.target.value }))} type="number" placeholder="예: 24" style={inp} /> : <DatePicker value={ins.endDate} onChange={v => setIns(p => ({ ...p, endDate: v.slice(0,7) }))} mode="month" />}</div>
              <div style={{ marginBottom: 22 }}><div style={{ fontSize: 12, color: C.sub, fontWeight: 600, marginBottom: 6 }}>메모 (선택)</div><input value={ins.memo} onChange={e => setIns(p => ({ ...p, memo: e.target.value }))} placeholder="예: 삼성 냉장고" style={inp} /></div>
              <button onClick={addIN} style={{ width: "100%", padding: "15px 0", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", background: `linear-gradient(135deg,${C.sh},#9b8dc0)`, color: "#fff" }}>저장하기</button>
            </Sheet>
          )}
        </>
      )}
    </div>
  );
}

// 설정 탭
function SettingTab({ profiles, saveProfiles, theme, setTheme, C, MEMBERS, onReset, snapsJw, snapsSh, chats }) {
  const [confirmReset, setConfirmReset] = useState(false);
  const inp = { width: "100%", border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box", background: C.card, color: C.text };
  const [local, setLocal] = useState(profiles);
  useEffect(() => setLocal(profiles), [profiles]);

  const STOP = new Set(["그리고","그래서","근데","하지만","그런데","이랑","에서","에게","부터","까지","또는","혹은","그냥","진짜","너무","정말","되게","약간","조금","많이","등","및","의","을","를","이","가","은","는","와","과","도","로","으로","에","한","하고","했다","있다","없다","했어","이다","한다","했음","이었"]);
  const allText = [...snapsJw,...snapsSh].map(s=>s.memo||"").concat(chats.map(c=>c.text||"")).join(" ");
  const wc = {};
  allText.split(/[\s,./!?~·「」『』()]+/).forEach(w => {
    const c = w.replace(/[^가-힣a-zA-Z0-9]/g,"").trim();
    if (c.length >= 2 && !STOP.has(c)) wc[c] = (wc[c]||0) + 1;
  });
  const words = Object.entries(wc).sort((a,b)=>b[1]-a[1]).slice(0,30);
  const maxC = words[0]?.[1] || 1;
  const COLS = [C.primary,C.accent,C.jw,C.sh,"#C46A6A","#6A9E7A","#C4A647","#8A7AB8","#D4904A","#4A7FA8"];

  return (
    <div style={{ paddingBottom: 20 }}>
      {/* 테마 */}
      <div style={{ background: C.card, borderRadius: 16, padding: 18, marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>🎨 테마 색상</div>
        <div style={{ display: "flex", gap: 10 }}>
          {Object.entries(THEMES).map(([key, t]) => (
            <button key={key} onClick={() => setTheme(key)} style={{ flex: 1, padding: "12px 6px", border: `2px solid ${theme === key ? t.primary : C.border}`, borderRadius: 12, background: theme === key ? t.primaryBg : C.bg, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ fontSize: 20 }}>{t.emoji}</div>
              <div style={{ display: "flex", gap: 3 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: t.primary }} />
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: t.accent }} />
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: t.jw }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: theme === key ? 700 : 400, color: theme === key ? t.primary : C.muted }}>{t.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 프로필 */}
      {Object.entries(MEMBERS).map(([k, mb]) => (
        <div key={k} style={{ background: C.card, borderRadius: 16, padding: 20, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <Avatar src={local[k]?.photo} initial={mb.initial} color={mb.color} size={52} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: mb.color }}>{mb.label}</div>
              <label style={{ marginTop: 4, display: "inline-block", fontSize: 11, color: C.sub, border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 10px", cursor: "pointer" }}>
                사진 변경
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => {
                  const file = e.target.files[0]; if (!file) return;
                  const r = new FileReader(); r.onload = ev => { const next = { ...local, [k]: { ...local[k], photo: ev.target.result } }; setLocal(next); saveProfiles(next); }; r.readAsDataURL(file);
                }} />
              </label>
            </div>
          </div>
          <div style={{ fontSize: 12, color: C.sub, marginBottom: 6, fontWeight: 600 }}>한마디</div>
          <input value={local[k]?.bio || ""} onChange={e => { const n = { ...local, [k]: { ...local[k], bio: e.target.value } }; setLocal(n); }} onBlur={() => saveProfiles(local)} placeholder="예: 절약왕 💪" style={inp} />
        </div>
      ))}

      {/* 키워드 분석 */}
      <div style={{ background: C.card, borderRadius: 16, padding: 18, marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>☁️ 우리의 키워드</div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>메모와 채팅에서 자주 등장한 단어예요</div>
        {words.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 0" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>💭</div>
            <div style={{ fontSize: 13, color: C.sub }}>메모나 채팅을 남기면 여기에 나타나요!</div>
          </div>
        ) : (<>
          {/* 태그 클라우드 */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", alignItems: "center", padding: "16px 8px", background: C.bg, borderRadius: 12, marginBottom: 16, minHeight: 100 }}>
            {words.map(([word, count], i) => {
              const ratio = count / maxC;
              const size = Math.round(11 + ratio * 16);
              return (
                <span key={word} style={{ fontSize: size, fontWeight: ratio > 0.6 ? 800 : ratio > 0.3 ? 700 : 500, color: COLS[i % COLS.length], opacity: 0.55 + ratio * 0.45, lineHeight: 1.4, padding: "2px 3px" }}>
                  {word}
                </span>
              );
            })}
          </div>
          {/* TOP 5 */}
          <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, marginBottom: 10 }}>🏆 TOP 5 키워드</div>
          {words.slice(0,5).map(([word, count], i) => {
            const medals = ["🥇","🥈","🥉","4️⃣","5️⃣"];
            return (
              <div key={word} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{medals[i]} {word}</span>
                  <span style={{ fontSize: 11, color: C.sub }}>{count}번</span>
                </div>
                <div style={{ background: C.bg, borderRadius: 99, height: 7 }}>
                  <div style={{ width: `${Math.round((count/maxC)*100)}%`, height: "100%", background: `linear-gradient(90deg,${C.primary},${C.accent})`, borderRadius: 99 }} />
                </div>
              </div>
            );
          })}
        </>)}
      </div>

      {/* 데이터 초기화 */}
      <div style={{ background: C.card, borderRadius: 16, padding: 18, marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#C46A6A", marginBottom: 8 }}>🗑️ 데이터 초기화</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>스냅샷 기록, 채팅, 고정비를 모두 삭제해요. 되돌릴 수 없어요!</div>
        {!confirmReset
          ? <button onClick={() => setConfirmReset(true)} style={{ width: "100%", padding: "12px 0", border: "1.5px solid #C46A6A", borderRadius: 10, background: "#FFF8FA", color: "#C46A6A", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>초기화하기</button>
          : <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#C46A6A", textAlign: "center", marginBottom: 12 }}>정말 모든 데이터를 삭제할까요?</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setConfirmReset(false)} style={{ flex: 1, padding: "11px 0", border: `1.5px solid ${C.border}`, borderRadius: 10, background: C.card, color: C.sub, fontWeight: 600, cursor: "pointer" }}>취소</button>
                <button onClick={() => { onReset(); setConfirmReset(false); }} style={{ flex: 1, padding: "11px 0", border: "none", borderRadius: 10, background: "#C46A6A", color: "#fff", fontWeight: 700, cursor: "pointer" }}>전체 삭제</button>
              </div>
            </div>
        }
      </div>
    </div>
  );
}
export default function App() {
  const [tab, setTab] = useState("home");
  const [loading, setLoading] = useState(true);
  const [inputWho, setInputWho] = useState(null);
  const [theme, setThemeState] = useState("beige");
  const [snapsJw, setSnapsJw] = useState([]);
  const [snapsSh, setSnapsSh] = useState([]);
  const [fixedExps, setFixedExps] = useState([]);
  const [installs, setInstalls] = useState([]);
  const [profiles, setProfiles] = useState({ jiwon: {}, suhyun: {} });
  const [chats, setChats] = useState([]);

  const TH = THEMES[theme] || THEMES.beige;
  const C = { ...TH, green: "#6A9E7A", greenBg: "#EAF3EC", red: "#C46A6A", redBg: "#F7ECEC", yellow: "#C4A647", yellowBg: "#F7F3E3", text: "#3D2E1E", sub: "#9E8B78", muted: "#BDB09E" };
  const MEMBERS = { jiwon: { label: "변지원", initial: "지원", color: C.jw, bg: C.jwBg }, suhyun: { label: "정수현", initial: "수현", color: C.sh, bg: C.shBg } };
  const E = EM[theme] || EM.beige;
  const TABS = [[`home`,E.money,"홈"], ["record","📋","기록"], ["chat",E.heart,"채팅"], ["fixed",E.fixed,"고정비"], ["setting","⚙️","설정"]];

  const setTheme = k => { setThemeState(k); try { localStorage.setItem("app_theme", k); } catch {} };
  useEffect(() => { try { const t = localStorage.getItem("app_theme"); if (t && THEMES[t]) setThemeState(t); } catch {} }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setSnapsJw(await sGet("snaps_jw", []));
    setSnapsSh(await sGet("snaps_sh", []));
    setFixedExps(await sGet("fixed_exp", []));
    setInstalls(await sGet("installs", []));
    setProfiles(await sGet("profiles", { jiwon: {}, suhyun: {} }));
    setChats(await sGet("chats", []));
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  // 채팅 실시간 구독
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "couple-budget", "chats"), snap => {
      if (snap.exists()) try { setChats(JSON.parse(snap.data().value)); } catch {}
    });
    return () => unsub();
  }, []);

  const saveSnap = (who, form) => {
    const snap = { id: Date.now() + Math.random(), ...form };
    if (who === "jiwon") { const nx = [snap, ...snapsJw]; setSnapsJw(nx); sSet("snaps_jw", nx); }
    else { const nx = [snap, ...snapsSh]; setSnapsSh(nx); sSet("snaps_sh", nx); }
    setInputWho(null);
  };
  const deleteSnap = (who, id) => {
    if (who === "jiwon") { const nx = snapsJw.filter(s => s.id !== id); setSnapsJw(nx); sSet("snaps_jw", nx); }
    else { const nx = snapsSh.filter(s => s.id !== id); setSnapsSh(nx); sSet("snaps_sh", nx); }
  };
  const saveFixed = (type, data) => {
    if (type === "expense") { setFixedExps(data); sSet("fixed_exp", data); }
    if (type === "install") { setInstalls(data); sSet("installs", data); }
  };
  const saveProfiles = (data) => {
    const merged = { ...profiles, ...data };
    setProfiles(merged); sSet("profiles", merged);
  };
  const sendChat = (msg) => {
    const nx = [...chats, msg];
    setChats(nx);
    sSet("chats", nx); // 백그라운드 저장, await 안 함
  };
  const deleteChat = (id) => {
    const nx = chats.filter(c => c.id !== id);
    setChats(nx);
    sSet("chats", nx);
  };
  const resetAll = async () => {
    const keys = ["snaps_jw","snaps_sh","fixed_exp","installs","chats"];
    await Promise.all(keys.map(k => setDoc(doc(db,"couple-budget",k),{value:JSON.stringify([])})));
    setSnapsJw([]); setSnapsSh([]); setFixedExps([]); setInstalls([]); setChats([]);
    setProfiles({ jiwon: {}, suhyun: {} });
  };


  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif", maxWidth: 480, margin: "0 auto", paddingBottom: 72 }}>
      <div style={{ background: `linear-gradient(135deg,${C.primary},${C.accent})`, padding: "18px 20px 14px", color: "#fff" }}>
        <div style={{ fontSize: 11, opacity: .7, marginBottom: 2 }}>부부 가계부</div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>변지원 · 정수현 {E.heart}</div>
      </div>
      <div style={{ padding: "16px 16px 0" }}>
        {loading ? <div style={{ textAlign: "center", padding: 80, color: C.muted }}>불러오는 중...</div>
          : tab === "home" ? <HomeTab snapJw={snapsJw[0]} snapSh={snapsSh[0]} prevJw={snapsJw[1]} prevSh={snapsSh[1]} snapsJw={snapsJw} snapsSh={snapsSh} profiles={profiles} fixedExps={fixedExps} installs={installs} onAdd={setInputWho} C={C} MEMBERS={MEMBERS} E={E}/>
          : tab === "record" ? <RecordTab snapsJw={snapsJw} snapsSh={snapsSh} onDelete={deleteSnap} C={C} MEMBERS={MEMBERS} />
          : tab === "chat" ? <ChatTab chats={chats} onSend={sendChat} onDeleteChat={deleteChat} profiles={profiles} C={C} MEMBERS={MEMBERS} />
          : tab === "fixed" ? <FixedTab fixedExps={fixedExps} installs={installs} onSave={saveFixed} C={C} MEMBERS={MEMBERS} E={E}/>
          : <SettingTab profiles={profiles} saveProfiles={saveProfiles} theme={theme} setTheme={setTheme} C={C} MEMBERS={MEMBERS} onReset={resetAll} snapsJw={snapsJw} snapsSh={snapsSh} chats={chats}/>}
      </div>
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: C.card, borderTop: `1px solid ${C.border}`, display: "flex", zIndex: 100 }}>
        {TABS.map(([k, icon, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{ flex: 1, padding: "10px 0 8px", border: "none", background: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{ fontSize: 18 }}>{icon}</span>
            <span style={{ fontSize: 10, fontWeight: tab === k ? 700 : 400, color: tab === k ? C.primary : C.muted }}>{label}</span>
          </button>
        ))}
      </div>
      {inputWho && <InputSheet who={inputWho} onClose={() => setInputWho(null)} onSave={form => saveSnap(inputWho, form)} prevSnap={inputWho === "jiwon" ? snapsJw[0] : snapsSh[0]} C={C} MEMBERS={MEMBERS} E={E}/>}
    </div>
  );
}