import { useState, useEffect, useRef } from "react";
import { isSupabaseEnabled } from "./lib/supabaseClient";
import {
  getSessionUser,
  getProfileById,
  insertAuditLog,
  insertBooking,
  insertReview,
  insertReviewReport,
  listBookings,
  listClinicProfiles,
  listClinicDoctors,
  listReviews,
  signInWithEmail,
  signOutSession,
  signUpWithEmail,
  updateReview,
  upsertClinicDoctor,
  upsertClinic,
  upsertProfile,
} from "./lib/supabaseApi";

const STORAGE_KEYS = {
  users: "clinic_app_users_v1",
  session: "clinic_app_session_v1",
  bookings: "clinic_app_bookings_v1",
  favorites: "clinic_app_favorites_v1",
  clinicProfiles: "clinic_app_clinic_profiles_v1",
  reviewReports: "clinic_app_review_reports_v1",
  auditLogs: "clinic_app_audit_logs_v1",
  reviews: "clinic_app_reviews_v1",
  clinicDoctors: "clinic_app_clinic_doctors_v1",
};

const readJSON = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeJSON = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const passHash = (pass) => btoa(unescape(encodeURIComponent(`clinic::${pass}`)));
const createId = (prefix) => `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

/* ═══════════════════════════════════════════
   DATA
═══════════════════════════════════════════ */
const SYMPTOMS = [
  { s:"発熱・悪寒", dept:"内科", icon:"🤒" },
  { s:"頭痛・偏頭痛", dept:"神経内科", icon:"🤕" },
  { s:"腹痛・下痢", dept:"内科", icon:"🤢" },
  { s:"咳・鼻水・喉", dept:"内科", icon:"😷" },
  { s:"腰痛・肩こり", dept:"整形外科", icon:"🦴" },
  { s:"膝・関節痛", dept:"整形外科", icon:"🦵" },
  { s:"皮膚のかゆみ・湿疹", dept:"皮膚科", icon:"🩹" },
  { s:"不眠・うつ", dept:"神経内科", icon:"😴" },
  { s:"動悸・息切れ", dept:"内科", icon:"💓" },
  { s:"子どもの急な発熱", dept:"小児科", icon:"👶" },
  { s:"妊娠・婦人科", dept:"産婦人科", icon:"🤰" },
  { s:"めまい・耳鳴り", dept:"神経内科", icon:"😵" },
];
const ALL_DEPTS = ["すべて","内科","外科","整形外科","小児科","産婦人科","皮膚科","神経内科"];
const CFILTERS = [
  { k:"nightService", l:"夜間対応", i:"🌙" },
  { k:"parking", l:"駐車場", i:"🚗" },
  { k:"female", l:"女性医師在籍", i:"👩‍⚕️" },
  { k:"online", l:"オンライン診療", i:"💻" },
  { k:"verified", l:"認証済み", i:"✅" },
  { k:"today", l:"本日診療", i:"📅" },
];
const TAGS = ["説明が丁寧","待ち時間短め","スタッフ親切","設備が充実","清潔","話しやすい","専門的","予約しやすい"];

const doctors = [
  { id:1, name:"山田 一郎", title:"院長・内科専門医", hid:1, dept:"内科", exp:22, edu:"東京大学医学部", certs:["日本内科学会認定医","糖尿病専門医","総合内科専門医"], specialties:["糖尿病","高血圧","メタボリックシンドローム"], bio:"患者様一人ひとりの生活背景を大切にした診療を心がけています。難治性の生活習慣病も、長期的なサポートで改善を目指します。", rating:4.7, cnt:64, photo:"👨‍⚕️", female:false },
  { id:2, name:"佐藤 二郎", title:"整形外科部長", hid:1, dept:"整形外科", exp:15, edu:"慶應義塾大学医学部", certs:["整形外科専門医","スポーツ医学専門医"], specialties:["膝関節","腰椎ヘルニア","スポーツ外傷"], bio:"スポーツ医学を専門とし、アスリートから高齢者まで幅広く対応。できる限り手術を避けた治療を提案します。", rating:4.4, cnt:38, photo:"🧑‍⚕️", female:false },
  { id:3, name:"伊藤 花子", title:"産婦人科部長", hid:1, dept:"産婦人科", exp:18, edu:"大阪大学医学部", certs:["産科婦人科専門医","母体保護法指定医","生殖医療専門医"], specialties:["ハイリスク妊娠","不妊治療","低侵襲手術"], bio:"妊娠・出産・婦人科疾患まで、女性のライフステージを通じてサポートします。女性患者様が安心して相談できる環境づくりを大切にしています。", rating:4.9, cnt:52, photo:"👩‍⚕️", female:true },
  { id:4, name:"加藤 賢司", title:"院長・小児科専門医", hid:2, dept:"小児科", exp:12, edu:"京都大学医学部", certs:["小児科専門医","小児アレルギー専門医"], specialties:["小児アレルギー","夜尿症","発達支援"], bio:"子どもの「なんで？」に向き合い、保護者の方と一緒に考える診療をしています。ワクチンや健診もお気軽にご相談ください。", rating:4.8, cnt:47, photo:"👨‍⚕️", female:false },
  { id:5, name:"田中 美穂", title:"皮膚科院長", hid:3, dept:"皮膚科", exp:9, edu:"東北大学医学部", certs:["皮膚科専門医","レーザー専門医"], specialties:["アトピー","美容皮膚科","皮膚腫瘍"], bio:"皮膚の悩みは見た目だけでなく心にも影響します。保険診療から自由診療まで、患者様のニーズに合わせた提案をします。", rating:4.6, cnt:29, photo:"👩‍⚕️", female:true },
];

const hospitals = [
  {
    id:1, name:"東京中央メディカルセンター", short:"東京中央MC",
    address:"東京都千代田区丸の内1-1-1", lat:35.6812, lng:139.7671,
    tel:"03-1234-5678", hours:"月〜金 8:30〜17:00 / 土 8:30〜12:30 / 日祝 休診",
    depts:["内科","外科","整形外科","小児科","産婦人科"],
    rating:4.3, cnt:128, wait:"約30分", parking:true, nightService:true,
    female:true, online:true, verified:true, today:true, emoji:"🏥",
    desc:"都心に位置する総合病院。最新MRI・CT設備完備、専門医チームによる高度医療を提供。2024年新棟完成。",
    access:"東京駅丸の内南口より徒歩5分 / 地下鉄二重橋前駅より徒歩2分",
    beds:320, founded:1978,
    reviews:[
      { id:1, uid:"u1", author:"田中 花子", av:"田", age:"40代", date:"2024-12-10", rating:5, dept:"内科", did:1, title:"丁寧な説明で安心できました", body:"初めて受診しましたが、先生がとても丁寧に説明してくださり、不安が和らぎました。電子カルテで過去の経過もすぐ確認していただき、スムーズな診察でした。スタッフの方も皆さん親切で、また来院したいと思います。", tags:["説明が丁寧","待ち時間短め","スタッフ親切"], helpful:24, dr:5, fr:4, wr:4, reply:"このたびはご来院いただきありがとうございます。スタッフ一同、今後もより良い診療を心がけてまいります。" },
      { id:2, uid:"u2", author:"鈴木 太郎", av:"鈴", age:"50代", date:"2024-11-28", rating:4, dept:"整形外科", did:2, title:"設備が充実していて安心", body:"MRIが当日撮れて、結果もその日のうちに説明してもらえました。画像を見ながら分かりやすく解説してくれて、治療方針もすぐ決まりました。午後は待ち時間が長めなので午前中の受診がおすすめです。", tags:["設備が充実","専門的"], helpful:15, dr:4, fr:5, wr:3 },
      { id:3, uid:"u3", author:"佐藤 美咲", av:"佐", age:"30代", date:"2024-11-15", rating:5, dept:"産婦人科", did:3, title:"出産でお世話になりました", body:"妊娠初期から出産まで約10ヶ月間お世話になりました。伊藤先生はとても話しやすく、不安なことがあると丁寧に答えてくれました。助産師さんや看護師さんも皆さん優しく、安心してお産に臨めました。個室も清潔で快適でした。", tags:["スタッフ親切","設備が充実","清潔"], helpful:32, dr:5, fr:5, wr:4 },
      { id:4, uid:"u4", author:"高橋 正一", av:"高", age:"60代", date:"2024-10-30", rating:3, dept:"内科", did:1, title:"待ち時間が長い", body:"評判通り先生は良いのですが、予約をしても1時間以上待つことが多く困っています。混んでいるのは人気の証拠とは思いますが、高齢の患者には少し辛いです。待合室の椅子は座り心地が良いので助かっています。", tags:["説明が丁寧"], helpful:8, dr:5, fr:4, wr:1 },
    ]
  },
  {
    id:2, name:"渋谷ファミリークリニック", short:"渋谷FC",
    address:"東京都渋谷区渋谷2-3-4", lat:35.6598, lng:139.7025,
    tel:"03-2345-6789", hours:"月〜土 9:00〜18:00 / 日祝 休診",
    depts:["内科","小児科","皮膚科"],
    rating:4.7, cnt:89, wait:"約15分", parking:false, nightService:false,
    female:false, online:true, verified:true, today:true, emoji:"🏨",
    desc:"地域密着型のアットホームなクリニック。子どもから高齢者まで家族全員のかかりつけ医として親しまれています。",
    access:"渋谷駅ハチ公口より徒歩8分 / 表参道駅より徒歩10分",
    beds:0, founded:2012,
    reviews:[
      { id:5, uid:"u5", author:"山田 健一", av:"山", age:"40代", date:"2024-12-05", rating:5, dept:"内科", did:4, title:"先生がとても話しやすい", body:"3年ほど通っています。加藤先生は子どもの話もじっくり聞いてくれて、薬の説明も分かりやすいです。待ち時間もほとんどなく、予約アプリで空き状況もすぐ確認できて便利です。", tags:["話しやすい","待ち時間短め","予約しやすい"], helpful:18, dr:5, fr:4, wr:5 },
      { id:6, uid:"u6", author:"中村 由紀", av:"中", age:"30代", date:"2024-11-20", rating:5, dept:"小児科", did:4, title:"子どもが安心して受診できます", body:"1歳の子の予防接種で通っています。先生が子どもの扱いがとても上手で、泣かずに終わることも多いです。親への説明も丁寧で、何かあればメッセージで相談できるのもありがたいです。", tags:["スタッフ親切","説明が丁寧"], helpful:22, dr:5, fr:5, wr:4, reply:"いつもご来院いただきありがとうございます。お子様の成長を一緒に見守れて嬉しいです！" },
    ]
  },
  {
    id:3, name:"新宿皮フ科クリニック", short:"新宿皮フ科",
    address:"東京都新宿区新宿4-2-8", lat:35.6896, lng:139.7006,
    tel:"03-3456-7890", hours:"月〜金 10:00〜19:30 / 土 10:00〜17:00",
    depts:["皮膚科"],
    rating:4.6, cnt:73, wait:"約20分", parking:false, nightService:false,
    female:true, online:false, verified:true, today:true, emoji:"✨",
    desc:"皮膚科専門クリニック。アトピー・ニキビから美容皮膚科まで対応。最新レーザー機器完備。",
    access:"新宿三丁目駅E5出口より徒歩1分",
    beds:0, founded:2019,
    reviews:[
      { id:7, uid:"u7", author:"林 さつき", av:"林", age:"20代", date:"2024-12-08", rating:5, dept:"皮膚科", did:5, title:"ニキビが劇的に改善しました", body:"10年悩んでいたニキビが3ヶ月で劇的に改善！田中先生は肌質や生活習慣まで丁寧に聞いてくださり、内服・外用・ケアの3方向から治療してくれます。少し価格は高めですがそれだけの価値があります。", tags:["専門的","説明が丁寧"], helpful:35, dr:5, fr:5, wr:4 },
      { id:8, uid:"u8", author:"吉田 亜矢", av:"吉", age:"30代", date:"2024-11-10", rating:4, dept:"皮膚科", did:5, title:"アトピーの相談に来ました", body:"長年のアトピーで相談に来ました。先生の知識が豊富で、新しい薬についても詳しく説明してくれました。予約必須ですが待ち時間は少なめです。", tags:["専門的","待ち時間短め"], helpful:12, dr:4, fr:4, wr:4 },
    ]
  },
  {
    id:4, name:"六本木夜間・休日クリニック", short:"六本木夜間",
    address:"東京都港区六本木3-1-2", lat:35.6628, lng:139.7322,
    tel:"03-4567-8901", hours:"月〜日 18:00〜翌2:00（年中無休）",
    depts:["内科","小児科"],
    rating:4.1, cnt:56, wait:"約45分", parking:false, nightService:true,
    female:false, online:false, verified:false, today:true, emoji:"🌙",
    desc:"夜間・深夜専門クリニック。仕事帰りや休日の急な体調不良に年中無休で対応します。",
    access:"六本木駅2番出口より徒歩3分",
    beds:0, founded:2020,
    reviews:[
      { id:9, uid:"u9", author:"伊藤 良子", av:"伊", age:"30代", date:"2024-12-01", rating:4, dept:"内科", did:null, title:"夜間でも診てもらえて助かりました", body:"深夜に急な発熱で困っていたところ、こちらで診ていただけました。待ち時間は1時間ほどありましたが、夜間に診てもらえるだけで十分です。インフルの検査・処方まで全部対応してもらえました。", tags:["夜間対応","専門的"], helpful:21, dr:4, fr:3, wr:2 },
    ]
  },
];

const DEPT_OPTIONS = ALL_DEPTS.filter((d) => d !== "すべて");
const toHospitalFromProfile = (profile) => ({
  id: profile.id,
  name: profile.name,
  short: profile.short || profile.name.slice(0, 8),
  address: profile.address,
  lat: Number(profile.lat) || 35.6812,
  lng: Number(profile.lng) || 139.7671,
  tel: profile.tel || "未設定",
  hours: profile.hours || "未設定",
  depts: profile.depts?.length ? profile.depts : ["内科"],
  rating: 0,
  cnt: 0,
  wait: "予約制",
  parking: !!profile.parking,
  nightService: !!profile.nightService,
  female: !!profile.female,
  online: !!profile.online,
  verified: false,
  today: true,
  emoji: "🏥",
  desc: profile.desc || "施設情報を準備中です。",
  access: profile.access || "アクセス情報を準備中です。",
  beds: Number(profile.beds) || 0,
  founded: Number(profile.founded) || new Date().getFullYear(),
  reviews: [],
});

/* ═══════════════════════════════════════════
   DESIGN SYSTEM
═══════════════════════════════════════════ */
const C = {
  green:"#059669", greenD:"#064e3b", greenL:"#d1fae5", greenLL:"#ecfdf5",
  blue:"#1e40af", blueD:"#1e3a8a", blueL:"#dbeafe",
  gold:"#f59e0b", red:"#ef4444", gray:"#6b7280", grayL:"#f3f4f6",
  text:"#111827", textS:"#4b5563", textM:"#9ca3af",
  white:"white", border:"#e5e7eb",
};
const G = `linear-gradient(135deg,${C.green},${C.greenD})`;
const GB = `linear-gradient(135deg,${C.blue},${C.blueD})`;
const ff = { fontFamily:"'Hiragino Kaku Gothic Pro','ヒラギノ角ゴ Pro W3',YuGothic,'Yu Gothic',Meiryo,sans-serif" };

/* ═══════════════════════════════════════════
   ATOMS
═══════════════════════════════════════════ */
function StarSVG({ filled, size=14 }) {
  return <svg width={size} height={size} viewBox="0 0 20 20" fill={filled?C.gold:C.border} style={{flexShrink:0}}>
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
  </svg>;
}
function Stars({ rating, size=13, interactive=false, onRate }) {
  const [hov, setHov] = useState(0);
  return <div style={{display:"flex",gap:1,cursor:interactive?"pointer":"default"}}>
    {[1,2,3,4,5].map(s=><span key={s} onMouseEnter={()=>interactive&&setHov(s)} onMouseLeave={()=>interactive&&setHov(0)} onClick={()=>interactive&&onRate?.(s)}>
      <StarSVG filled={s<=(interactive?(hov||rating):rating)} size={size}/>
    </span>)}
  </div>;
}
function RatingBar({ label, value, color=G }) {
  return <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
    <span style={{fontSize:11,color:C.gray,width:72,textAlign:"right",flexShrink:0}}>{label}</span>
    <div style={{flex:1,height:5,background:C.grayL,borderRadius:99,overflow:"hidden"}}>
      <div style={{width:`${(value/5)*100}%`,height:"100%",background:color,borderRadius:99,transition:"width .8s ease"}}/>
    </div>
    <span style={{fontSize:11,fontWeight:700,color:C.text,width:26}}>{value.toFixed(1)}</span>
  </div>;
}
function Chip({ children, active, onClick, blue, sm, color }) {
  const bg = active ? (blue?"#eff6ff":color?"#fef3c7":C.greenLL) : C.grayL;
  const clr = active ? (blue?C.blue:color?"#92400e":C.greenD) : C.gray;
  const bdr = active ? (blue?"1px solid #93c5fd":color?"1px solid #fcd34d":`1px solid ${C.greenL}`) : "1px solid transparent";
  return <button onClick={onClick} style={{fontSize:sm?10:11,fontWeight:600,padding:sm?"3px 8px":"4px 11px",borderRadius:99,background:bg,color:clr,border:bdr,cursor:onClick?"pointer":"default",transition:"all .15s",...ff}}>{children}</button>;
}
function Av({ text, size=36, bg=G, emoji }) {
  return <div style={{width:size,height:size,borderRadius:"50%",background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:emoji?size*.46:size*.4,fontWeight:800,color:"white",flexShrink:0}}>{emoji||text}</div>;
}
function Btn({ children, onClick, style={}, variant="green", sm, disabled }) {
  const bg = variant==="green"?G:variant==="blue"?GB:variant==="outline"?C.white:variant==="ghost"?"transparent":C.grayL;
  const clr = (variant==="outline"||variant==="gray"||variant==="ghost") ? C.text : C.white;
  const bdr = variant==="outline"?`1.5px solid ${C.border}`:variant==="ghost"?"none":"none";
  return <button onClick={onClick} disabled={disabled} style={{padding:sm?"7px 14px":"11px 20px",borderRadius:99,border:bdr,background:bg,color:clr,fontSize:sm?11:13,fontWeight:700,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.5:1,transition:"all .15s",...ff,...style}}>{children}</button>;
}
function Badge({ children, green, blue, gold }) {
  const bg = green?C.greenLL:blue?C.blueL:gold?"#fef3c7":C.grayL;
  const clr = green?C.greenD:blue?C.blue:gold?"#92400e":C.gray;
  return <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:99,background:bg,color:clr,...ff}}>{children}</span>;
}

/* ═══════════════════════════════════════════
   SHEET / MODAL
═══════════════════════════════════════════ */
function Sheet({ children, title, onClose, wide }) {
  return <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
    <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.45)",backdropFilter:"blur(4px)"}} onClick={onClose}/>
    <div style={{position:"relative",width:"100%",maxWidth:wide?780:680,background:C.white,borderRadius:"24px 24px 0 0",padding:"20px 20px 44px",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 -12px 60px rgba(0,0,0,.2)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
        <span style={{fontWeight:900,fontSize:16,color:C.text}}>{title}</span>
        <button onClick={onClose} style={{width:30,height:30,borderRadius:"50%",border:"none",background:C.grayL,cursor:"pointer",fontSize:16,color:C.gray}}> × </button>
      </div>
      {children}
    </div>
  </div>;
}

/* ═══════════════════════════════════════════
   MAP VIEW  (static SVG map — no API key needed)
═══════════════════════════════════════════ */
function MapView({ hospitals, onSelect, userLocation, onLocate, locationError }) {
  const center = userLocation || { lat: 35.6812, lng: 139.7671 };
  const mapSrc = `https://www.google.com/maps?q=${center.lat},${center.lng}&z=13&output=embed`;
  const distanceKm = (a, b) => {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const aa =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((a.lat * Math.PI) / 180) *
        Math.cos((b.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
    return R * c;
  };
  const nearHospitals = [...hospitals]
    .map((h) => ({
      ...h,
      distanceKm: distanceKm(center, { lat: h.lat, lng: h.lng }),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return <div style={{background:"#e8f5e9",borderRadius:16,overflow:"hidden",position:"relative",marginBottom:16,border:`1px solid ${C.border}`}}>
    <div style={{padding:"8px 12px",background:"white",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:6}}>
      <span style={{fontSize:14}}>🗺️</span>
      <span style={{fontSize:12,fontWeight:700,color:C.text}}>Googleマップ（現在地中心）</span>
      <button onClick={onLocate} style={{marginLeft:"auto",fontSize:11,padding:"4px 10px",borderRadius:99,border:`1px solid ${C.border}`,background:"#f8fafc",color:C.text,cursor:"pointer",...ff}}>
        📍 現在地を取得
      </button>
    </div>
    <iframe
      title="google-map"
      src={mapSrc}
      style={{width:"100%",height:240,border:"none",display:"block"}}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
    <div style={{padding:"10px 12px",background:"white",borderTop:`1px solid ${C.border}`}}>
      <div style={{fontSize:11,fontWeight:700,color:C.text,marginBottom:8}}>近くの医療機関</div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {nearHospitals.slice(0, 5).map((h)=>(
          <div key={h.id} style={{display:"flex",alignItems:"center",gap:8}}>
            <button onClick={()=>onSelect(h)} style={{border:"none",background:"#f0fdf4",padding:"5px 9px",borderRadius:8,cursor:"pointer",fontSize:11,fontWeight:700,color:C.green,...ff}}>
              {h.emoji} {h.name}
            </button>
            <span style={{fontSize:11,color:C.textM}}>約 {h.distanceKm.toFixed(1)}km</span>
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.address)}`} target="_blank" rel="noreferrer" style={{fontSize:11,color:C.blue,textDecoration:"none",marginLeft:"auto"}}>
              Googleマップで開く
            </a>
          </div>
        ))}
      </div>
    </div>
    <div style={{padding:"6px 12px",background:"white",borderTop:`1px solid ${C.border}`,fontSize:10,color:C.gray}}>
      {userLocation ? `現在地: 緯度 ${userLocation.lat.toFixed(4)} / 経度 ${userLocation.lng.toFixed(4)}` : (locationError || "現在地は未取得です。ブラウザの位置情報許可が必要です。")}
    </div>
  </div>;
}

/* ═══════════════════════════════════════════
   ONLINE CONSULTATION UI
═══════════════════════════════════════════ */
function OnlineConsult({ hospital, user, onCreateBooking, onRequireLogin }) {
  const [step, setStep] = useState(1);
  const [concern, setConcern] = useState("");
  const [time, setTime] = useState("");
  const [done, setDone] = useState(false);
  const slots = ["09:00","09:30","10:00","10:30","14:00","14:30","15:00","16:00","16:30"];

  if (done) return <div style={{textAlign:"center",padding:"40px 0"}}>
    <div style={{fontSize:52,marginBottom:14}}>💻✅</div>
    <p style={{fontWeight:900,fontSize:17,color:C.text,marginBottom:6}}>オンライン診療の予約完了！</p>
    <p style={{fontSize:13,color:C.textS}}>{time} にビデオ通話でつながります</p>
    <p style={{fontSize:12,color:C.textM,marginTop:8}}>確認メールとリマインダーをお送りしました</p>
  </div>;

  const confirmOnlineBooking = () => {
    if (!user) {
      onRequireLogin?.();
      return;
    }
    if (!time) return;
    onCreateBooking?.({
      type: "online",
      hospitalId: hospital.id,
      hospitalName: hospital.name,
      date: new Date().toISOString().slice(0, 10),
      time,
      dept: hospital.depts[0],
      status: "確定",
      concern,
    });
    setDone(true);
  };

  return <div>
    <div style={{padding:"12px 14px",background:"#eff6ff",borderRadius:12,marginBottom:16,border:"1px solid #bfdbfe",display:"flex",gap:10,alignItems:"flex-start"}}>
      <span style={{fontSize:20}}>ℹ️</span>
      <div>
        <div style={{fontSize:12,fontWeight:700,color:C.blue,marginBottom:2}}>オンライン診療とは</div>
        <div style={{fontSize:11,color:"#1e40af",lineHeight:1.6}}>スマートフォン・PCのカメラを使って、自宅から医師の診察を受けられます。処方箋は薬局へ電送します。</div>
      </div>
    </div>
    {step===1&&<div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div>
        <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:6}}>相談内容（簡単に）</label>
        <textarea value={concern} onChange={e=>setConcern(e.target.value)} placeholder="例：2日前から発熱と喉の痛みがあります" rows={3}
          style={{width:"100%",padding:"10px 12px",borderRadius:12,border:`1.5px solid ${C.border}`,fontSize:13,resize:"none",outline:"none",boxSizing:"border-box",...ff}}
          onFocus={e=>e.target.style.borderColor=C.green} onBlur={e=>e.target.style.borderColor=C.border}/>
      </div>
      <Btn onClick={()=>setStep(2)} style={{width:"100%",padding:12,borderRadius:14,fontSize:14}}>時間帯を選ぶ →</Btn>
    </div>}
    {step===2&&<div>
      <label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:10}}>診療可能な時間帯（本日）</label>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>
        {slots.map(s=><button key={s} onClick={()=>setTime(s)} style={{padding:"10px 16px",borderRadius:12,border:`2px solid ${time===s?C.green:C.border}`,background:time===s?C.greenLL:C.white,color:time===s?C.greenD:C.text,fontSize:13,fontWeight:700,cursor:"pointer",...ff}}>{s}</button>)}
      </div>
      {!user && <div style={{padding:"10px 13px",background:"#fef3c7",borderRadius:12,border:"1px solid #fcd34d",fontSize:12,color:"#92400e",marginBottom:10}}>ログインすると予約を確定できます</div>}
      <Btn onClick={confirmOnlineBooking} disabled={!time} style={{width:"100%",padding:12,borderRadius:14,fontSize:14}}>💻 オンライン診療を予約する</Btn>
    </div>}
  </div>;
}

/* ═══════════════════════════════════════════
   BOOKING MODAL
═══════════════════════════════════════════ */
function Booking({ hospital, user, onCreateBooking, onRequireLogin }) {
  const [dept, setDept] = useState(hospital.depts[0]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [done, setDone] = useState(false);
  const times = ["08:30","09:00","09:30","10:00","10:30","11:00","14:00","14:30","15:00","15:30","16:00","16:30"];
  const confirmBooking = () => {
    if (!user) {
      onRequireLogin?.();
      return;
    }
    if (!date || !time) return;
    onCreateBooking?.({
      type: "visit",
      hospitalId: hospital.id,
      hospitalName: hospital.name,
      date,
      time,
      dept,
      status: "確定",
    });
    setDone(true);
  };
  if (done) return <div style={{textAlign:"center",padding:"36px 0"}}>
    <div style={{fontSize:52,marginBottom:14}}>📅✅</div>
    <p style={{fontWeight:900,fontSize:17,color:C.text,marginBottom:4}}>予約が確定しました！</p>
    <p style={{fontSize:13,color:C.textS}}>{date} {time} · {dept}</p>
    <p style={{fontSize:12,color:C.textM,marginTop:8}}>前日にリマインダーをお送りします</p>
  </div>;
  return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div><label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:7}}>診療科</label>
    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{hospital.depts.map(d=><Chip key={d} active={dept===d} onClick={()=>setDept(d)}>{d}</Chip>)}</div></div>
    <div><label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:6}}>ご希望の日付</label>
    <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{width:"100%",padding:"11px 14px",borderRadius:12,border:`1.5px solid ${C.border}`,fontSize:13,outline:"none",boxSizing:"border-box",...ff}}
      onFocus={e=>e.target.style.borderColor=C.green} onBlur={e=>e.target.style.borderColor=C.border}/></div>
    <div><label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:7}}>時間帯</label>
    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{times.map(t=><Chip key={t} active={time===t} onClick={()=>setTime(t)}>{t}</Chip>)}</div></div>
    <div style={{padding:"10px 13px",background:"#eff6ff",borderRadius:12,border:"1px solid #bfdbfe",fontSize:12,color:C.blue}}>ℹ️ 前日18時にリマインドメールをお送りします</div>
    {!user && <div style={{padding:"10px 13px",background:"#fef3c7",borderRadius:12,border:"1px solid #fcd34d",fontSize:12,color:"#92400e"}}>ログインすると予約を確定できます</div>}
    <Btn onClick={confirmBooking} disabled={!date||!time} style={{width:"100%",padding:13,borderRadius:14,fontSize:14}}>📅 予約を確定する</Btn>
  </div>;
}

/* ═══════════════════════════════════════════
   AUTH
═══════════════════════════════════════════ */
function Auth({ onLogin, onSignup, onSocialLogin, onClose }) {
  const [tab, setTab] = useState("login");
  const [email, setEmail] = useState(""); const [pass, setPass] = useState(""); const [name, setName] = useState(""); const [role, setRole] = useState("patient");
  const [err, setErr] = useState("");
  const inp = {width:"100%",padding:"11px 14px",borderRadius:12,border:`1.5px solid ${C.border}`,fontSize:13,outline:"none",boxSizing:"border-box",...ff};
  const submit = async () => {
    setErr("");
    const payload = { name, email: email.trim(), pass, role };
    const res = tab === "login" ? await onLogin?.(payload) : await onSignup?.(payload);
    if (!res?.ok) {
      setErr(res?.error || "認証に失敗しました");
      return;
    }
    onClose?.();
  };
  const social = async (provider) => {
    setErr("");
    const res = await onSocialLogin?.({
      provider,
      name,
      email: email.trim(),
      role,
    });
    if (!res?.ok) {
      setErr(res?.error || "ログインに失敗しました");
      return;
    }
    onClose?.();
  };
  return <div style={{position:"fixed",inset:0,zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 16px"}}>
    <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.5)",backdropFilter:"blur(5px)"}} onClick={onClose}/>
    <div style={{position:"relative",width:"100%",maxWidth:380,background:C.white,borderRadius:24,padding:28,boxShadow:"0 24px 80px rgba(0,0,0,.25)"}}>
      <div style={{textAlign:"center",marginBottom:24}}>
        <div style={{width:56,height:56,borderRadius:16,background:G,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 10px"}}>🏥</div>
        <div style={{fontWeight:900,fontSize:20,color:C.text}}>ドクターレビュー</div>
        <div style={{fontSize:12,color:C.textM,marginTop:4}}>アカウントで便利に使いこなす</div>
      </div>
      <div style={{display:"flex",background:C.grayL,borderRadius:12,padding:3,gap:2,marginBottom:20}}>
        {[["login","ログイン"],["signup","新規登録"]].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:"8px",borderRadius:9,border:"none",fontWeight:700,fontSize:12,cursor:"pointer",...ff,background:tab===t?C.white:"transparent",color:tab===t?C.text:C.textM,boxShadow:tab===t?"0 1px 4px rgba(0,0,0,.1)":"none",transition:"all .2s"}}>{l}</button>
        ))}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:18}}>
        {[["🔵 Googleでログイン","#4285f4"],["⬛ Appleでログイン","#111827"]].map(([l,c])=>(
          <button key={l} onClick={()=>social(l.includes("Google") ? "google" : "apple")} style={{padding:"11px",borderRadius:12,border:`1.5px solid ${C.border}`,background:C.white,fontSize:13,fontWeight:700,color:c,cursor:"pointer",...ff,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>{l}</button>
        ))}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}><div style={{flex:1,height:1,background:C.border}}/><span style={{fontSize:11,color:C.textM}}>メールで登録</span><div style={{flex:1,height:1,background:C.border}}/></div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {tab==="signup"&&<>
          <input placeholder="お名前" value={name} onChange={e=>setName(e.target.value)} style={inp} onFocus={e=>e.target.style.borderColor=C.green} onBlur={e=>e.target.style.borderColor=C.border}/>
          <div style={{display:"flex",background:"#f9fafb",borderRadius:12,padding:3,gap:2}}>
            {[["patient","患者"],["clinic","医療機関"]].map(([r,l])=>(
              <button key={r} onClick={()=>setRole(r)} style={{flex:1,padding:"7px",borderRadius:9,border:"none",fontWeight:700,fontSize:12,cursor:"pointer",...ff,background:role===r?C.white:"transparent",color:role===r?C.text:C.textM,transition:"all .2s"}}>{l}</button>
            ))}
          </div>
        </>}
        <input placeholder="メールアドレス" value={email} onChange={e=>setEmail(e.target.value)} style={inp} onFocus={e=>e.target.style.borderColor=C.green} onBlur={e=>e.target.style.borderColor=C.border}/>
        <input placeholder="パスワード" type="password" value={pass} onChange={e=>setPass(e.target.value)} style={inp} onFocus={e=>e.target.style.borderColor=C.green} onBlur={e=>e.target.style.borderColor=C.border}/>
        {err && <div style={{fontSize:12,color:C.red,background:"#fee2e2",border:"1px solid #fecaca",padding:"8px 10px",borderRadius:10}}>{err}</div>}
        <Btn onClick={submit} style={{width:"100%",padding:12,borderRadius:14,fontSize:14}}>{tab==="login"?"ログイン →":"アカウントを作成 →"}</Btn>
      </div>
    </div>
  </div>;
}

/* ═══════════════════════════════════════════
   NOTIFICATION PANEL
═══════════════════════════════════════════ */
function NotifPanel({ bookings = [] }) {
  const bookingNotifs = bookings.slice(0, 5).map((b) => ({
    id: b.id,
    icon: "✅",
    title: "予約確定",
    body: `${b.hospitalName}（${b.dept}） ${b.date} ${b.time} の予約が確定しました`,
    time: "最新",
    unread: true,
  }));
  const notifs = bookingNotifs.length > 0 ? bookingNotifs : [
    { id:"empty", icon:"ℹ️", title:"お知らせ", body:"まだ通知はありません", time:"", unread:false },
  ];
  return <div>
    {notifs.map(n=><div key={n.id} style={{display:"flex",gap:12,padding:"12px 0",borderBottom:`1px solid ${C.grayL}`,alignItems:"flex-start"}}>
      <div style={{width:38,height:38,borderRadius:12,background:n.unread?C.greenLL:C.grayL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{n.icon}</div>
      <div style={{flex:1}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
          <span style={{fontWeight:700,fontSize:13,color:C.text}}>{n.title}</span>
          {n.unread&&<span style={{width:6,height:6,borderRadius:"50%",background:C.green,flexShrink:0}}/>}
        </div>
        <div style={{fontSize:12,color:C.textS,lineHeight:1.5,marginBottom:2}}>{n.body}</div>
        <div style={{fontSize:10,color:C.textM}}>{n.time}</div>
      </div>
    </div>)}
  </div>;
}

/* ═══════════════════════════════════════════
   REVIEW FORM
═══════════════════════════════════════════ */
function ReviewForm({ hospital, user, onClose, onSubmit, doctorsData }) {
  const [step, setStep] = useState(1);
  const [f, setF] = useState({dept:"",did:null,overall:0,dr:0,fr:0,wr:0,title:"",body:"",tags:[],anon:!user});
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const set = (k,v)=>setF(p=>({...p,[k]:v}));
  const toggleTag = t=>set("tags",f.tags.includes(t)?f.tags.filter(x=>x!==t):[...f.tags,t]);
  const deptDocs = doctorsData.filter(d=>String(d.hid)===String(hospital.id)&&(!f.dept||d.dept===f.dept));
  const submitReview = async () => {
    if (!f.dept || !f.overall || !f.title.trim() || !f.body.trim()) return;
    setSubmitting(true);
    const ok = await onSubmit?.(f);
    setSubmitting(false);
    if (ok) setDone(true);
  };
  if (done) return <div style={{textAlign:"center",padding:"32px 0"}}><div style={{fontSize:52,marginBottom:12}}>✅</div><p style={{fontWeight:900,fontSize:17,color:C.text,marginBottom:4}}>投稿ありがとうございます！</p><p style={{fontSize:13,color:C.textM}}>確認後に公開されます（通常1〜2営業日）</p></div>;
  const inp = {width:"100%",padding:"11px 14px",borderRadius:12,border:`1.5px solid ${C.border}`,fontSize:13,outline:"none",boxSizing:"border-box",...ff};
  return <div>
    <div style={{display:"flex",alignItems:"center",marginBottom:22}}>
      {["診療科","評価","コメント"].map((l,i)=>{const s=i+1,act=step===s,past=step>s;return<div key={s} style={{display:"flex",alignItems:"center",flex:1}}>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",flex:1}}>
          <div style={{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:12,background:past?C.green:act?G:C.grayL,color:act||past?C.white:C.textM,transition:"all .3s"}}>{past?"✓":s}</div>
          <span style={{fontSize:10,color:act?C.green:C.textM,marginTop:3,fontWeight:act?700:400}}>{l}</span>
        </div>
        {i<2&&<div style={{height:2,width:"100%",background:step>s?C.green:C.border,marginTop:-14,transition:"all .3s"}}/>}
      </div>;})}
    </div>
    {step===1&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div><label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:8}}>受診した診療科</label>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{hospital.depts.map(d=><Chip key={d} active={f.dept===d} onClick={()=>set("dept",d)}>{d}</Chip>)}</div></div>
      {f.dept&&deptDocs.length>0&&<div><label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:8}}>担当の先生（任意）</label>
      {deptDocs.map(d=><div key={d.id} onClick={()=>set("did",f.did===d.id?null:d.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:12,border:`2px solid ${f.did===d.id?C.green:C.border}`,background:f.did===d.id?C.greenLL:C.white,cursor:"pointer",marginBottom:6,transition:"all .15s"}}>
        <Av emoji={d.photo} size={34} bg="linear-gradient(135deg,#d1fae5,#6ee7b7)"/>
        <div><div style={{fontWeight:700,fontSize:13,color:C.text}}>{d.name} 先生</div><div style={{fontSize:11,color:C.textM}}>{d.title}</div></div>
        {f.did===d.id&&<span style={{marginLeft:"auto",color:C.green,fontSize:18}}>✓</span>}
      </div>)}</div>}
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"#f9fafb",borderRadius:12}}>
        <input type="checkbox" id="anon3" checked={f.anon} onChange={e=>set("anon",e.target.checked)} style={{width:15,height:15,accentColor:C.green}}/>
        <label htmlFor="anon3" style={{fontSize:13,color:C.text,cursor:"pointer"}}>匿名で投稿する</label>
      </div>
    </div>}
    {step===2&&<div style={{display:"flex",flexDirection:"column",gap:16}}>
      {[{k:"overall",l:"⭐ 総合評価"},{k:"dr",l:"👨‍⚕️ 先生の対応"},{k:"fr",l:"🏥 施設・設備"},{k:"wr",l:"⏱ 待ち時間"}].map(({k,l})=><div key={k}>
        <label style={{fontSize:13,fontWeight:700,color:"#374151",display:"block",marginBottom:7}}>{l}</label>
        <Stars rating={f[k]} size={30} interactive onRate={r=>set(k,r)}/>
      </div>)}
      <div><label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:6}}>当てはまるタグ</label>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{TAGS.map(t=><Chip key={t} active={f.tags.includes(t)} onClick={()=>toggleTag(t)}>{f.tags.includes(t)?"✓ ":""}{t}</Chip>)}</div></div>
    </div>}
    {step===3&&<div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div><label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:5}}>タイトル</label>
      <input placeholder="受診の感想を一言で" value={f.title} onChange={e=>set("title",e.target.value)} style={inp} onFocus={e=>e.target.style.borderColor=C.green} onBlur={e=>e.target.style.borderColor=C.border}/></div>
      <div><label style={{fontSize:12,fontWeight:700,color:"#374151",display:"block",marginBottom:5}}>口コミ本文</label>
      <textarea placeholder="診察の雰囲気、待ち時間、先生の対応など（100文字以上推奨）" value={f.body} onChange={e=>set("body",e.target.value)} rows={5}
        style={{...inp,resize:"none",lineHeight:1.6}} onFocus={e=>e.target.style.borderColor=C.green} onBlur={e=>e.target.style.borderColor=C.border}/>
      <div style={{textAlign:"right",fontSize:11,color:C.textM}}>{f.body.length}文字</div></div>
      <div style={{padding:"10px 12px",background:"#fefce8",borderRadius:12,border:"1px solid #fde68a",fontSize:12,color:"#92400e"}}>⚠️ 個人情報（氏名・住所・電話番号等）は記載しないでください</div>
    </div>}
    <div style={{display:"flex",gap:8,marginTop:20}}>
      {step>1&&<Btn onClick={()=>setStep(s=>s-1)} variant="outline" style={{flex:1,padding:12,borderRadius:14,fontSize:14}}>← 戻る</Btn>}
      <Btn onClick={()=>step<3?setStep(s=>s+1):submitReview()} disabled={submitting} style={{flex:2,padding:12,borderRadius:14,fontSize:14}}>{step<3?"次へ →":(submitting?"投稿中...":"投稿する ✓")}</Btn>
    </div>
  </div>;
}

/* ═══════════════════════════════════════════
   REVIEW CARD
═══════════════════════════════════════════ */
function ReviewCard({ review, onDoctorClick, clinicView=false, onReport, onHelpful, onReply, doctorsData }) {
  const [helpful, setHelpful] = useState(review.helpful);
  const [voted, setVoted] = useState(false);
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText] = useState(review.reply||"");
  const [replySaved, setReplySaved] = useState(!!review.reply);
  useEffect(() => {
    setHelpful(review.helpful || 0);
    setReplyText(review.reply || "");
    setReplySaved(!!review.reply);
  }, [review.helpful, review.reply]);
  const doc = doctorsData.find(d=>String(d.id)===String(review.did));
  return <div style={{background:C.white,borderRadius:16,padding:16,border:`1px solid ${C.border}`,boxShadow:"0 2px 8px rgba(0,0,0,.04)"}}>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
      <div style={{display:"flex",gap:10,alignItems:"center"}}>
        <Av text={review.av} size={36}/>
        <div><div style={{fontWeight:700,fontSize:13,color:C.text}}>{review.author}</div><div style={{fontSize:11,color:C.textM}}>{review.age} · {review.date}</div></div>
      </div>
      <div style={{textAlign:"right"}}><Stars rating={review.rating} size={12}/><div style={{fontSize:11,color:C.textM,marginTop:2}}>{review.dept}</div></div>
    </div>
    {doc&&<button onClick={()=>onDoctorClick?.(doc)} style={{display:"inline-flex",alignItems:"center",gap:5,marginBottom:8,padding:"4px 10px",borderRadius:99,background:C.greenLL,border:`1px solid ${C.greenL}`,fontSize:11,fontWeight:700,color:C.greenD,cursor:"pointer",...ff}}>
      <span>{doc.photo}</span>{doc.name} 先生<span style={{opacity:.6,fontSize:10}}>→ 詳細</span>
    </button>}
    <div style={{fontWeight:800,fontSize:14,color:C.text,marginBottom:5}}>{review.title}</div>
    <p style={{fontSize:13,color:C.textS,lineHeight:1.7,margin:"0 0 8px"}}>{review.body}</p>
    <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>{review.tags.map(t=><Chip key={t} sm>#{t}</Chip>)}</div>
    <div style={{background:"#f9fafb",borderRadius:10,padding:"10px 12px",marginBottom:10}}>
      <RatingBar label="先生の対応" value={review.dr}/>
      <RatingBar label="施設・設備" value={review.fr}/>
      <RatingBar label="待ち時間" value={review.wr}/>
    </div>
    {replySaved&&<div style={{padding:"10px 12px",background:"#eff6ff",borderRadius:12,marginBottom:10,border:"1px solid #bfdbfe"}}>
      <div style={{fontSize:11,fontWeight:700,color:C.blue,marginBottom:3}}>🏥 医療機関からの返信</div>
      <p style={{fontSize:12,color:"#1e40af",lineHeight:1.6,margin:0}}>{replyText}</p>
    </div>}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <span style={{fontSize:11,color:C.textM}}>参考になりましたか？</span>
      <div style={{display:"flex",gap:7}}>
        {!clinicView&&<Btn sm variant="outline" onClick={()=>onReport?.(review)}>通報</Btn>}
        {clinicView&&!replySaved&&<Btn sm variant="outline" onClick={()=>setShowReplyBox(!showReplyBox)}>返信する</Btn>}
        <button onClick={async ()=>{if(!voted){const next = helpful + 1;setHelpful(next);setVoted(true);await onHelpful?.(review, next);}}} style={{display:"flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:99,border:`1px solid ${voted?C.green:C.border}`,background:voted?C.greenLL:"#f9fafb",color:voted?C.green:C.gray,fontSize:11,fontWeight:700,cursor:"pointer",...ff}}>
          👍 {helpful}
        </button>
      </div>
    </div>
    {showReplyBox&&!replySaved&&<div style={{marginTop:10}}>
      <textarea value={replyText} onChange={e=>setReplyText(e.target.value)} placeholder="患者様へのメッセージ" rows={3}
        style={{width:"100%",padding:"10px 12px",borderRadius:10,border:`1.5px solid ${C.border}`,fontSize:12,resize:"none",outline:"none",boxSizing:"border-box",...ff}}/>
      <div style={{display:"flex",gap:8,marginTop:8}}>
        <Btn sm variant="outline" onClick={()=>setShowReplyBox(false)}>キャンセル</Btn>
        <Btn sm onClick={async ()=>{await onReply?.(review, replyText);setReplySaved(true);setShowReplyBox(false);}}>返信を送信</Btn>
      </div>
    </div>}
  </div>;
}

/* ═══════════════════════════════════════════
   HOSPITAL CARD
═══════════════════════════════════════════ */
function HospitalCard({ h, onClick, isFav, onFavToggle, user }) {
  const [hov, setHov] = useState(false);
  return <div onClick={()=>onClick(h)} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
    style={{background:C.white,borderRadius:18,border:`1px solid ${C.border}`,padding:16,cursor:"pointer",transition:"all .25s",boxShadow:hov?"0 8px 28px rgba(16,185,129,.14)":"0 2px 10px rgba(0,0,0,.05)",transform:hov?"translateY(-2px)":"none"}}>
    <div style={{display:"flex",gap:14}}>
      <div style={{width:52,height:52,borderRadius:14,background:C.greenLL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0}}>{h.emoji}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:2}}>
          <div style={{fontWeight:800,fontSize:14,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.name}</div>
          {h.verified&&<span title="認証済み" style={{fontSize:12,flexShrink:0}}>✅</span>}
        </div>
        <div style={{fontSize:11,color:C.textM,marginBottom:6}}>{h.address}</div>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
          <Stars rating={Math.round(h.rating)} size={12}/>
          <span style={{fontWeight:800,color:C.gold,fontSize:13}}>{h.rating}</span>
          <span style={{fontSize:11,color:C.textM}}>({h.cnt}件)</span>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
          {h.depts.slice(0,3).map(d=><Chip key={d} sm>{d}</Chip>)}
          {h.depts.length>3&&<Chip sm>+{h.depts.length-3}</Chip>}
        </div>
      </div>
      <button onClick={e=>{e.stopPropagation();user?onFavToggle(h):(alert("お気に入りはログインが必要です"));}} style={{fontSize:20,background:"none",border:"none",cursor:"pointer",flexShrink:0,alignSelf:"flex-start",opacity:user?1:.35}}>{isFav?"❤️":"🤍"}</button>
    </div>
    <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${C.grayL}`,display:"flex",flexWrap:"wrap",gap:10,fontSize:11,color:C.textM}}>
      <span>⏱ {h.wait}</span>
      {h.parking&&<span>🚗 駐車場</span>}
      {h.nightService&&<span>🌙 夜間対応</span>}
      {h.female&&<span>👩‍⚕️ 女性医師</span>}
      {h.online&&<span>💻 オンライン</span>}
      {h.today&&<Badge green>本日診療</Badge>}
    </div>
  </div>;
}

/* ═══════════════════════════════════════════
   HOSPITAL DETAIL
═══════════════════════════════════════════ */
function HospitalDetail({ hospital, doctorsData, onBack, onDoctorClick, isFav, onFavToggle, user, onCreateBooking, onRequireLogin, onReportReview, onCreateReview, onReviewHelpful, onReviewReply }) {
  const [tab, setTab] = useState("reviews");
  const [showForm, setShowForm] = useState(false);
  const [modal, setModal] = useState(null); // "book" | "online"
  const hospDocs = doctorsData.filter(d=>String(d.hid)===String(hospital.id));
  const avg = k=>hospital.reviews.length ? hospital.reviews.reduce((a,r)=>a+r[k],0)/hospital.reviews.length : 0;

  return <div>
    {modal==="book"&&<Sheet title="📅 ネット予約" onClose={()=>setModal(null)}><Booking hospital={hospital} user={user} onCreateBooking={onCreateBooking} onRequireLogin={onRequireLogin}/></Sheet>}
    {modal==="online"&&<Sheet title="💻 オンライン診療" onClose={()=>setModal(null)}><OnlineConsult hospital={hospital} user={user} onCreateBooking={onCreateBooking} onRequireLogin={onRequireLogin}/></Sheet>}

    {/* Hero */}
    <div style={{background:"linear-gradient(135deg,#059669,#064e3b)",borderRadius:20,padding:20,marginBottom:14,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:-30,right:-30,width:130,height:130,borderRadius:"50%",background:"rgba(255,255,255,.06)"}}/>
      <button onClick={onBack} style={{background:"rgba(255,255,255,.15)",border:"none",borderRadius:99,padding:"6px 12px",color:C.white,fontSize:12,cursor:"pointer",marginBottom:12,...ff}}>← 戻る</button>
      <div style={{display:"flex",gap:14}}>
        <div style={{width:54,height:54,borderRadius:16,background:"rgba(255,255,255,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0}}>{hospital.emoji}</div>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4}}>
            <h2 style={{fontWeight:900,fontSize:17,color:C.white,margin:0}}>{hospital.name}</h2>
            {hospital.verified&&<span style={{fontSize:14}}>✅</span>}
            <button onClick={()=>user?onFavToggle(hospital):(alert("ログインが必要です"))} style={{fontSize:18,background:"none",border:"none",cursor:"pointer",marginLeft:"auto"}}>{isFav?"❤️":"🤍"}</button>
          </div>
          <p style={{fontSize:12,color:"#a7f3d0",margin:"0 0 6px"}}>{hospital.address}</p>
          <div style={{display:"flex",alignItems:"center",gap:8}}><Stars rating={Math.round(hospital.rating)} size={13}/><span style={{fontWeight:900,color:"#fcd34d",fontSize:15}}>{hospital.rating}</span><span style={{fontSize:12,color:"#6ee7b7"}}>({hospital.cnt}件)</span></div>
        </div>
      </div>
      <div style={{marginTop:14,display:"flex",gap:8}}>
        <button onClick={()=>setModal("book")} style={{flex:1,padding:"10px",borderRadius:12,border:"none",background:C.white,color:C.green,fontSize:13,fontWeight:800,cursor:"pointer",...ff}}>📅 ネット予約</button>
        {hospital.online&&<button onClick={()=>setModal("online")} style={{flex:1,padding:"10px",borderRadius:12,border:"1px solid rgba(255,255,255,.4)",background:"rgba(255,255,255,.15)",color:C.white,fontSize:13,fontWeight:700,cursor:"pointer",...ff}}>💻 オンライン診療</button>}
        <button style={{padding:"10px 14px",borderRadius:12,border:"1px solid rgba(255,255,255,.4)",background:"rgba(255,255,255,.15)",color:C.white,fontSize:13,cursor:"pointer",...ff}}>📞</button>
      </div>
    </div>

    {/* Feature chips */}
    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:14}}>
      {CFILTERS.filter(f=>hospital[f.k]).map(f=><Chip key={f.k} active>{f.i} {f.l}</Chip>)}
    </div>

    {/* Ratings */}
    <div style={{background:C.white,borderRadius:16,padding:14,marginBottom:14,border:`1px solid ${C.border}`}}>
      <div style={{fontWeight:800,fontSize:13,color:C.text,marginBottom:10}}>評価サマリー</div>
      <RatingBar label="先生の対応" value={avg("dr")}/>
      <RatingBar label="施設・設備" value={avg("fr")}/>
      <RatingBar label="待ち時間" value={avg("wr")}/>
    </div>

    {/* Tabs */}
    <div style={{display:"flex",borderBottom:`2px solid ${C.border}`,marginBottom:14}}>
      {[["reviews","口コミ"],["doctors","医師一覧"],["access","アクセス"],["info","施設情報"]].map(([k,l])=>(
        <button key={k} onClick={()=>setTab(k)} style={{padding:"9px 13px",fontSize:12,fontWeight:700,border:"none",background:"none",cursor:"pointer",...ff,color:tab===k?C.green:C.textM,borderBottom:tab===k?`2px solid ${C.green}`:"2px solid transparent",marginBottom:-2}}>{l}</button>
      ))}
    </div>

    {tab==="reviews"&&<div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <span style={{fontWeight:700,fontSize:13,color:"#374151"}}>口コミ ({hospital.reviews.length}件)</span>
        <Btn sm onClick={()=>{if(!user){alert("口コミの投稿はログインが必要です");return;}setShowForm(!showForm);}}>✏️ 口コミを書く</Btn>
      </div>
      {showForm&&<div style={{background:C.white,borderRadius:16,padding:18,marginBottom:14,border:`2px solid ${C.green}`}}>
        <div style={{fontWeight:800,fontSize:14,color:C.text,marginBottom:14}}>口コミを投稿する</div>
        <ReviewForm hospital={hospital} user={user} doctorsData={doctorsData} onClose={()=>setShowForm(false)} onSubmit={async (form)=>{
          const ok = await onCreateReview?.(hospital, form);
          if (ok) setShowForm(false);
          return ok;
        }}/>
      </div>}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {hospital.reviews.map(r=><ReviewCard key={r.id} review={r} doctorsData={doctorsData} onDoctorClick={onDoctorClick} onReport={(review)=>onReportReview?.(review, hospital)} onHelpful={onReviewHelpful} onReply={onReviewReply}/>)}
      </div>
    </div>}

    {tab==="doctors"&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
      {hospDocs.length===0&&<div style={{textAlign:"center",padding:"32px",color:C.textM}}>この病院の医師プロフィールは準備中です</div>}
      {hospDocs.map(doc=><div key={doc.id} onClick={()=>onDoctorClick(doc)} style={{background:C.white,borderRadius:16,padding:14,border:`1px solid ${C.border}`,cursor:"pointer",transition:"all .2s"}} onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 14px rgba(16,185,129,.1)"} onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
        <div style={{display:"flex",gap:12,alignItems:"center"}}>
          <Av emoji={doc.photo} size={48} bg="linear-gradient(135deg,#d1fae5,#6ee7b7)"/>
          <div style={{flex:1}}>
            <div style={{fontWeight:800,fontSize:13,color:C.text,marginBottom:2}}>
              {doc.name} 先生 {doc.female&&<Badge green>女性医師</Badge>}
            </div>
            <div style={{fontSize:11,color:C.green,fontWeight:600,marginBottom:4}}>{doc.title}</div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <Stars rating={Math.round(doc.rating)} size={11}/>
              <span style={{fontSize:11,color:C.gold,fontWeight:700}}>{doc.rating}</span>
              <span style={{fontSize:10,color:C.textM}}>({doc.cnt}件)</span>
            </div>
          </div>
          <span style={{color:C.textM,fontSize:14}}>→</span>
        </div>
        <div style={{marginTop:8,display:"flex",flexWrap:"wrap",gap:4}}>{doc.specialties.map(s=><Chip key={s} active blue sm>{s}</Chip>)}</div>
      </div>)}
    </div>}

    {tab==="access"&&<div style={{background:C.white,borderRadius:16,padding:14,border:`1px solid ${C.border}`}}>
      <div style={{background:C.greenLL,borderRadius:12,height:160,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:14,border:`1px solid ${C.greenL}`,flexDirection:"column",gap:8}}>
        <span style={{fontSize:32}}>🗺️</span>
        <span style={{fontSize:12,color:C.green,fontWeight:700}}>{hospital.address}</span>
        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hospital.address)}`} target="_blank" rel="noreferrer"
          style={{fontSize:11,color:C.blue,fontWeight:700,textDecoration:"none",padding:"5px 12px",borderRadius:99,background:"#eff6ff",border:"1px solid #bfdbfe"}}>
          Googleマップで開く →
        </a>
      </div>
      <div style={{fontSize:13,color:C.text,marginBottom:8}}><span style={{fontWeight:700}}>アクセス：</span>{hospital.access}</div>
      <div style={{fontSize:13,color:C.text,marginBottom:8}}><span style={{fontWeight:700}}>電話：</span>{hospital.tel}</div>
      <div style={{fontSize:13,color:C.text}}><span style={{fontWeight:700}}>診療時間：</span>{hospital.hours}</div>
    </div>}

    {tab==="info"&&<div style={{background:C.white,borderRadius:16,padding:14,border:`1px solid ${C.border}`}}>
      {[
        {l:"施設紹介",c:<p style={{fontSize:13,color:C.textS,lineHeight:1.7,marginTop:6}}>{hospital.desc}</p>},
        {l:"診療科目",c:<div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:6}}>{hospital.depts.map(d=><Chip key={d}>{d}</Chip>)}</div>},
        {l:"開設年",c:<p style={{fontSize:13,color:C.text,marginTop:6}}>{hospital.founded}年</p>},
        {l:"病床数",c:<p style={{fontSize:13,color:C.text,marginTop:6}}>{hospital.beds>0?`${hospital.beds}床`:"外来専門"}</p>},
      ].map(({l,c},i,arr)=><div key={l} style={{borderBottom:i<arr.length-1?`1px solid ${C.grayL}`:"none",paddingBottom:i<arr.length-1?14:0,marginBottom:i<arr.length-1?14:0}}>
        <div style={{fontSize:10,fontWeight:700,color:C.textM,textTransform:"uppercase",letterSpacing:1}}>{l}</div>{c}
      </div>)}
    </div>}
  </div>;
}

/* ═══════════════════════════════════════════
   DOCTOR PROFILE MODAL CONTENT
═══════════════════════════════════════════ */
function DoctorProfile({ doc, hospitalsData }) {
  const reviews = hospitalsData.flatMap(h=>h.reviews.filter(r=>r.did===doc.id));
  return <div>
    <div style={{display:"flex",gap:14,marginBottom:18,padding:14,background:C.greenLL,borderRadius:14,border:`1px solid ${C.greenL}`}}>
      <Av emoji={doc.photo} size={60} bg="linear-gradient(135deg,#6ee7b7,#34d399)"/>
      <div>
        <div style={{fontWeight:900,fontSize:18,color:C.text,marginBottom:2}}>{doc.name} 先生 {doc.female&&<Badge green>女性医師</Badge>}</div>
        <div style={{fontSize:12,color:C.green,fontWeight:700,marginBottom:6}}>{doc.title}</div>
        <div style={{display:"flex",alignItems:"center",gap:7}}><Stars rating={Math.round(doc.rating)} size={13}/><span style={{fontWeight:900,color:C.gold,fontSize:14}}>{doc.rating}</span><span style={{fontSize:11,color:C.textM}}>({doc.cnt}件)</span></div>
      </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
      {[{l:"経験年数",v:`${doc.exp}年`},{l:"出身大学",v:doc.edu}].map(({l,v})=>(
        <div key={l} style={{padding:"10px 12px",background:"#f9fafb",borderRadius:10}}><div style={{fontSize:10,color:C.textM,marginBottom:3}}>{l}</div><div style={{fontSize:12,fontWeight:700,color:"#374151"}}>{v}</div></div>
      ))}
    </div>
    <div style={{marginBottom:12}}>
      <div style={{fontSize:12,fontWeight:700,color:"#374151",marginBottom:6}}>専門分野</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:5}}>{doc.specialties.map(s=><Chip key={s} active blue sm>{s}</Chip>)}</div>
    </div>
    <div style={{marginBottom:12}}>
      <div style={{fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>資格・認定</div>
      {doc.certs.map(c=><div key={c} style={{fontSize:12,color:"#374151",padding:"2px 0",display:"flex",gap:6}}><span style={{color:C.green}}>✓</span>{c}</div>)}
    </div>
    <div style={{padding:12,background:"#f9fafb",borderRadius:12,marginBottom:reviews.length>0?16:0}}>
      <div style={{fontSize:12,fontWeight:700,color:"#374151",marginBottom:5}}>ひとこと</div>
      <p style={{fontSize:13,color:C.textS,lineHeight:1.7,margin:0}}>{doc.bio}</p>
    </div>
    {reviews.length>0&&<div>
      <div style={{fontSize:13,fontWeight:700,color:"#374151",marginBottom:10}}>この先生への口コミ</div>
      {reviews.map(r=><div key={r.id} style={{padding:"12px",background:C.white,borderRadius:12,border:`1px solid ${C.border}`,marginBottom:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><Stars rating={r.rating} size={11}/><span style={{fontSize:11,color:C.textM}}>{r.date}</span></div>
        <div style={{fontWeight:700,fontSize:13,color:C.text,marginBottom:3}}>{r.title}</div>
        <p style={{fontSize:12,color:C.textS,lineHeight:1.6,margin:0}}>{r.body.slice(0,100)}…</p>
      </div>)}
    </div>}
  </div>;
}

/* ═══════════════════════════════════════════
   MYPAGE
═══════════════════════════════════════════ */
function MyPage({ user, favs, bookings, myReviews, onUnfav, onLogout, onHospitalClick, onUpgradeToClinic }) {
  const [tab, setTab] = useState("fav");
  const myRevs = myReviews;
  const sortedBookings = [...bookings].sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1));
  return <div>
    <div style={{background:G,borderRadius:20,padding:20,marginBottom:14,color:C.white}}>
      <div style={{display:"flex",gap:14,alignItems:"center"}}>
        <Av text={user.photo} size={54} bg="rgba(255,255,255,.2)" emoji={user.photo}/>
        <div>
          <div style={{fontWeight:900,fontSize:18}}>{user.name}</div>
          <div style={{fontSize:12,color:"#a7f3d0",marginTop:2}}>{user.email}</div>
          <div style={{marginTop:6}}><Badge>{user.role==="patient"?"患者会員":"医療機関会員"}</Badge></div>
        </div>
        <button onClick={onLogout} style={{marginLeft:"auto",padding:"6px 12px",borderRadius:99,border:"1px solid rgba(255,255,255,.4)",background:"rgba(255,255,255,.15)",color:C.white,fontSize:11,fontWeight:700,cursor:"pointer",...ff}}>ログアウト</button>
      </div>
      {user.role!=="clinic"&&<div style={{marginTop:10}}>
        <button onClick={onUpgradeToClinic} style={{padding:"6px 12px",borderRadius:99,border:"1px solid rgba(255,255,255,.45)",background:"rgba(255,255,255,.18)",color:C.white,fontSize:11,fontWeight:700,cursor:"pointer",...ff}}>医療機関会員に切り替える</button>
      </div>}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
      {[{l:"お気に入り",v:favs.length,i:"❤️"},{l:"投稿口コミ",v:myRevs.length,i:"✏️"},{l:"予約件数",v:bookings.length,i:"📅"}].map(({l,v,i})=>(
        <div key={l} style={{background:C.white,borderRadius:14,padding:12,border:`1px solid ${C.border}`,textAlign:"center"}}>
          <div style={{fontSize:20,marginBottom:4}}>{i}</div>
          <div style={{fontSize:20,fontWeight:900,color:C.text}}>{v}</div>
          <div style={{fontSize:10,color:C.textM}}>{l}</div>
        </div>
      ))}
    </div>
    <div style={{display:"flex",borderBottom:`2px solid ${C.border}`,marginBottom:14}}>
      {[["fav","❤️ お気に入り"],["reviews","✏️ 投稿履歴"],["bookings","📅 予約履歴"]].map(([k,l])=>(
        <button key={k} onClick={()=>setTab(k)} style={{padding:"9px 12px",fontSize:12,fontWeight:700,border:"none",background:"none",cursor:"pointer",...ff,color:tab===k?C.green:C.textM,borderBottom:tab===k?`2px solid ${C.green}`:"2px solid transparent",marginBottom:-2}}>{l}</button>
      ))}
    </div>
    {tab==="fav"&&(favs.length===0?
      <div style={{textAlign:"center",padding:"32px",color:C.textM}}><div style={{fontSize:36,marginBottom:10}}>❤️</div><div style={{fontWeight:700}}>お気に入りはまだありません</div></div>:
      favs.map(h=><div key={h.id} onClick={()=>onHospitalClick(h)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:C.white,borderRadius:14,border:`1px solid ${C.border}`,marginBottom:8,cursor:"pointer"}}>
        <div style={{width:40,height:40,borderRadius:12,background:C.greenLL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{h.emoji}</div>
        <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13,color:C.text}}>{h.name}</div><div style={{fontSize:11,color:C.textM}}>{h.address}</div></div>
        <button onClick={e=>{e.stopPropagation();onUnfav(h.id);}} style={{fontSize:20,background:"none",border:"none",cursor:"pointer"}}>❤️</button>
      </div>)
    )}
    {tab==="reviews"&&(myRevs.length===0?
      <div style={{textAlign:"center",padding:"32px",color:C.textM}}><div style={{fontSize:36,marginBottom:10}}>✏️</div><div style={{fontWeight:700}}>口コミはまだありません</div></div>:
      myRevs.map(r=><div key={r.id} style={{background:C.white,borderRadius:14,padding:14,border:`1px solid ${C.border}`,marginBottom:8}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><Stars rating={r.rating} size={12}/><span style={{fontSize:11,color:C.textM}}>{r.date}</span></div>
        <div style={{fontWeight:700,fontSize:13,color:C.text,marginBottom:3}}>{r.title}</div>
        <p style={{fontSize:12,color:C.textS,lineHeight:1.6,margin:0}}>{r.body.slice(0,80)}…</p>
      </div>)
    )}
    {tab==="bookings"&&<div>
      {sortedBookings.length===0 ? <div style={{textAlign:"center",padding:"32px",color:C.textM}}><div style={{fontSize:36,marginBottom:10}}>📅</div><div style={{fontWeight:700}}>予約履歴はまだありません</div></div> : sortedBookings.map((b)=>(
        <div key={b.id} style={{background:C.white,borderRadius:14,padding:14,border:`1px solid ${C.border}`,marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
            <div style={{fontWeight:700,fontSize:13,color:C.text}}>{b.hospitalName}</div>
            <Badge green={b.status==="確定"} gold={b.status==="受診済"}>{b.status}</Badge>
          </div>
          <div style={{fontSize:12,color:C.textS}}>📅 {b.date} {b.time} · {b.dept} {b.type==="online" ? "· オンライン" : "· 来院"}</div>
        </div>
      ))}
    </div>}
  </div>;
}

/* ═══════════════════════════════════════════
   CLINIC DASHBOARD
═══════════════════════════════════════════ */
function ClinicDash({ user, clinicProfile, clinicHospital, clinicBookings, clinicReports, clinicDoctorsList, onSaveClinicProfile, onSaveDoctor, onDoctorClick, onReviewReply }) {
  const [f, setF] = useState(() => ({
    name: clinicProfile?.name || "",
    short: clinicProfile?.short || "",
    address: clinicProfile?.address || "",
    tel: clinicProfile?.tel || "",
    hours: clinicProfile?.hours || "",
    access: clinicProfile?.access || "",
    desc: clinicProfile?.desc || "",
    lat: clinicProfile?.lat ?? 35.6812,
    lng: clinicProfile?.lng ?? 139.7671,
    beds: clinicProfile?.beds ?? 0,
    founded: clinicProfile?.founded ?? 2020,
    depts: clinicProfile?.depts?.length ? clinicProfile.depts : ["内科"],
    parking: !!clinicProfile?.parking,
    nightService: !!clinicProfile?.nightService,
    female: !!clinicProfile?.female,
    online: !!clinicProfile?.online,
  }));
  const [saved, setSaved] = useState(false);
  const [mapUrl, setMapUrl] = useState("");
  const [docSaved, setDocSaved] = useState(false);
  const [docF, setDocF] = useState({ name:"", title:"", dept:"内科", exp:5, specialties:"", bio:"", female:false, photo:"🧑‍⚕️" });
  useEffect(() => {
    setF({
      name: clinicProfile?.name || "",
      short: clinicProfile?.short || "",
      address: clinicProfile?.address || "",
      tel: clinicProfile?.tel || "",
      hours: clinicProfile?.hours || "",
      access: clinicProfile?.access || "",
      desc: clinicProfile?.desc || "",
      lat: clinicProfile?.lat ?? 35.6812,
      lng: clinicProfile?.lng ?? 139.7671,
      beds: clinicProfile?.beds ?? 0,
      founded: clinicProfile?.founded ?? 2020,
      depts: clinicProfile?.depts?.length ? clinicProfile.depts : ["内科"],
      parking: !!clinicProfile?.parking,
      nightService: !!clinicProfile?.nightService,
      female: !!clinicProfile?.female,
      online: !!clinicProfile?.online,
    });
  }, [clinicProfile]);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const toggleDept = (d) => set("depts", f.depts.includes(d) ? f.depts.filter((x) => x !== d) : [...f.depts, d]);
  const toggleFlag = (k) => set(k, !f[k]);
  const setDoc = (k, v) => setDocF((p) => ({ ...p, [k]: v }));
  const applyMapUrl = () => {
    const hit = mapUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || mapUrl.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (!hit) {
      alert("GoogleマップURLから緯度経度を抽出できませんでした。");
      return;
    }
    set("lat", Number(hit[1]));
    set("lng", Number(hit[2]));
  };
  const submit = () => {
    if (!f.name.trim() || !f.address.trim()) return;
    onSaveClinicProfile({
      ...f,
      lat: Number(f.lat),
      lng: Number(f.lng),
      beds: Number(f.beds),
      founded: Number(f.founded),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };
  const submitDoctor = async () => {
    if (!clinicProfile) {
      alert("先に自院情報を保存してください。");
      return;
    }
    if (!docF.name.trim() || !docF.title.trim()) return;
    await onSaveDoctor?.({
      hid: clinicProfile.id,
      name: docF.name.trim(),
      title: docF.title.trim(),
      dept: docF.dept,
      exp: Number(docF.exp) || 0,
      specialties: docF.specialties.split(",").map((s) => s.trim()).filter(Boolean),
      bio: docF.bio.trim(),
      female: !!docF.female,
      photo: docF.photo || "🧑‍⚕️",
    });
    setDocSaved(true);
    setTimeout(() => setDocSaved(false), 1600);
    setDocF({ name:"", title:"", dept:"内科", exp:5, specialties:"", bio:"", female:false, photo:"🧑‍⚕️" });
  };

  if (!user || user.role !== "clinic") {
    return <div style={{background:C.white,borderRadius:16,padding:20,border:`1px solid ${C.border}`,textAlign:"center"}}>
      <div style={{fontSize:30,marginBottom:8}}>🏥</div>
      <div style={{fontSize:14,fontWeight:800,color:C.text,marginBottom:6}}>医療機関会員でログインしてください</div>
      <div style={{fontSize:12,color:C.textM}}>自院情報の登録・編集は医療機関アカウントで利用できます</div>
    </div>;
  }

  const profileReady = !!clinicProfile;
  return <div>
    <div style={{background:GB,borderRadius:20,padding:20,marginBottom:14,color:C.white}}>
      <div style={{fontSize:10,color:"#93c5fd",fontWeight:700,marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>医療機関管理ダッシュボード</div>
      <div style={{fontWeight:900,fontSize:17,marginBottom:2}}>{profileReady ? clinicProfile.name : "自院情報を登録してください"}</div>
      <div style={{fontSize:12,color:"#bfdbfe",marginBottom:10}}>{profileReady ? clinicProfile.address : "登録後に患者向け画面へ表示されます"}</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
        <Badge blue>🏥 医療機関会員</Badge>
        <Badge blue>📅 予約 {clinicBookings.length}件</Badge>
        <Badge blue>🚨 通報 {clinicReports.length}件</Badge>
        {profileReady && <Badge blue>📝 公開中</Badge>}
      </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
      {[{l:"登録状態",v:profileReady?"公開中":"未登録",u:"",i:"🧾"},{l:"予約件数",v:clinicBookings.length,u:"件",i:"📅"},{l:"通報件数",v:clinicReports.length,u:"件",i:"🚨"},{l:"夜間対応",v:f.nightService?"対応":"未対応",u:"",i:"🌙"}].map(({l,v,u,i})=>(
        <div key={l} style={{background:C.white,borderRadius:14,padding:14,border:`1px solid ${C.border}`}}>
          <div style={{fontSize:18,marginBottom:4}}>{i}</div>
          <div style={{fontSize:11,color:C.textM,marginBottom:2}}>{l}</div>
          <div style={{display:"flex",alignItems:"baseline",gap:3}}><span style={{fontSize:22,fontWeight:900,color:C.text}}>{v}</span><span style={{fontSize:11,color:C.textM}}>{u}</span></div>
        </div>
      ))}
    </div>
    <div style={{background:C.white,borderRadius:16,padding:14,marginBottom:14,border:`1px solid ${C.border}`}}>
      <div style={{fontWeight:800,fontSize:13,color:C.text,marginBottom:12}}>自院情報の登録・更新</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <input value={f.name} onChange={(e)=>set("name", e.target.value)} placeholder="医療機関名" style={{padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:12,...ff}} />
        <input value={f.short} onChange={(e)=>set("short", e.target.value)} placeholder="略称（地図ラベル）" style={{padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:12,...ff}} />
        <input value={f.tel} onChange={(e)=>set("tel", e.target.value)} placeholder="電話番号" style={{padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:12,...ff}} />
        <input value={f.hours} onChange={(e)=>set("hours", e.target.value)} placeholder="診療時間" style={{padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:12,...ff}} />
        <input value={f.lat} onChange={(e)=>set("lat", e.target.value)} placeholder="緯度" style={{padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:12,...ff}} />
        <input value={f.lng} onChange={(e)=>set("lng", e.target.value)} placeholder="経度" style={{padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:12,...ff}} />
      </div>
      <input value={f.address} onChange={(e)=>set("address", e.target.value)} placeholder="住所" style={{marginTop:8,width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:12,boxSizing:"border-box",...ff}} />
      <div style={{display:"flex",gap:8,marginTop:8}}>
        <input value={mapUrl} onChange={(e)=>setMapUrl(e.target.value)} placeholder="GoogleマップURLを貼り付け（地点共有リンク）" style={{flex:1,padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:12,boxSizing:"border-box",...ff}} />
        <Btn sm onClick={applyMapUrl}>座標反映</Btn>
      </div>
      <div style={{fontSize:11,color:C.textM,marginTop:4}}>Googleマップで病院地点を開いてURLを貼ると、緯度経度に反映されます</div>
      <textarea value={f.access} onChange={(e)=>set("access", e.target.value)} placeholder="アクセス情報" rows={2} style={{marginTop:8,width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:12,boxSizing:"border-box",resize:"none",...ff}} />
      <textarea value={f.desc} onChange={(e)=>set("desc", e.target.value)} placeholder="施設紹介" rows={3} style={{marginTop:8,width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:12,boxSizing:"border-box",resize:"none",...ff}} />
      <div style={{marginTop:8}}>
        <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:6}}>診療科目</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {DEPT_OPTIONS.map((d)=><Chip key={d} active={f.depts.includes(d)} onClick={()=>toggleDept(d)}>{f.depts.includes(d)?"✓ ":""}{d}</Chip>)}
        </div>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:8}}>
        {[["parking","🚗 駐車場"],["nightService","🌙 夜間対応"],["female","👩‍⚕️ 女性医師"],["online","💻 オンライン診療"]].map(([k, label]) => (
          <Chip key={k} active={!!f[k]} onClick={() => toggleFlag(k)}>{label}</Chip>
        ))}
      </div>
      <div style={{display:"flex",gap:8,marginTop:12,alignItems:"center"}}>
        <Btn onClick={submit} style={{padding:"10px 18px"}}>保存する</Btn>
        {saved && <span style={{fontSize:12,color:C.green,fontWeight:700}}>保存しました</span>}
      </div>
    </div>
    <div style={{background:C.white,borderRadius:16,padding:14,marginBottom:14,border:`1px solid ${C.border}`}}>
      <div style={{fontWeight:800,fontSize:13,color:C.text,marginBottom:12}}>医師情報の登録</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <input value={docF.name} onChange={(e)=>setDoc("name", e.target.value)} placeholder="氏名" style={{padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:12,...ff}} />
        <input value={docF.title} onChange={(e)=>setDoc("title", e.target.value)} placeholder="役職・資格" style={{padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:12,...ff}} />
        <select value={docF.dept} onChange={(e)=>setDoc("dept", e.target.value)} style={{padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:12,...ff}}>
          {DEPT_OPTIONS.map((d)=><option key={d} value={d}>{d}</option>)}
        </select>
        <input type="number" value={docF.exp} onChange={(e)=>setDoc("exp", e.target.value)} placeholder="経験年数" style={{padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:12,...ff}} />
      </div>
      <input value={docF.specialties} onChange={(e)=>setDoc("specialties", e.target.value)} placeholder="専門分野（カンマ区切り）" style={{marginTop:8,width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:12,boxSizing:"border-box",...ff}} />
      <textarea value={docF.bio} onChange={(e)=>setDoc("bio", e.target.value)} rows={3} placeholder="紹介文" style={{marginTop:8,width:"100%",padding:"10px 12px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:12,boxSizing:"border-box",resize:"none",...ff}} />
      <div style={{display:"flex",gap:8,alignItems:"center",marginTop:8}}>
        <Chip active={docF.female} onClick={()=>setDoc("female", !docF.female)}>👩‍⚕️ 女性医師</Chip>
        <input value={docF.photo} onChange={(e)=>setDoc("photo", e.target.value)} placeholder="絵文字" style={{width:90,padding:"8px 10px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:12,...ff}} />
        <Btn sm onClick={submitDoctor}>医師を追加</Btn>
        {docSaved && <span style={{fontSize:12,color:C.green,fontWeight:700}}>保存しました</span>}
      </div>
      <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:8}}>
        {clinicDoctorsList.length===0 ? <div style={{fontSize:12,color:C.textM}}>登録済み医師はまだありません</div> : clinicDoctorsList.map((d)=>(
          <div key={d.id} style={{padding:"10px 12px",border:`1px solid ${C.border}`,borderRadius:12}}>
            <div style={{fontSize:13,fontWeight:700,color:C.text}}>{d.photo} {d.name} 先生 {d.female&&<Badge green>女性医師</Badge>}</div>
            <div style={{fontSize:11,color:C.textM,marginTop:2}}>{d.title} · {d.dept} · 経験{d.exp}年</div>
          </div>
        ))}
      </div>
    </div>
    <div style={{background:C.white,borderRadius:16,padding:14,border:`1px solid ${C.border}`}}>
      <div style={{fontWeight:800,fontSize:13,color:C.text,marginBottom:10}}>口コミ通報キュー</div>
      {clinicReports.length===0 ? <div style={{fontSize:12,color:C.textM}}>現在、通報はありません</div> : clinicReports.slice(0, 8).map((r)=>(
        <div key={r.id} style={{padding:"10px 0",borderBottom:`1px solid ${C.grayL}`}}>
          <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:2}}>理由: {r.reason}</div>
          <div style={{fontSize:11,color:C.textM}}>reviewId: {r.reviewId} / {new Date(r.createdAt).toLocaleString()}</div>
        </div>
      ))}
    </div>
    {clinicProfile && <div style={{fontWeight:800,fontSize:13,color:C.text,margin:"14px 0 10px"}}>返信待ちの口コミ</div>}
    {clinicProfile && <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {clinicHospital?.reviews?.filter(r=>!r.reply).map(r=><ReviewCard key={r.id} review={r} doctorsData={[...doctors, ...clinicDoctorsList]} onDoctorClick={onDoctorClick} clinicView onReply={onReviewReply}/>)}
    </div>}
  </div>;
}

function LegalPage({ type, onBack }) {
  const title = type === "terms" ? "利用規約" : "プライバシーポリシー";
  return <div style={{background:C.white,borderRadius:16,padding:16,border:`1px solid ${C.border}`}}>
    <button onClick={onBack} style={{background:"#f8fafc",border:`1px solid ${C.border}`,borderRadius:99,padding:"6px 12px",fontSize:11,cursor:"pointer",marginBottom:12,...ff}}>← 戻る</button>
    <h2 style={{margin:"0 0 10px",fontSize:18,color:C.text}}>{title}</h2>
    {type === "terms" ? (
      <div style={{fontSize:12,color:C.textS,lineHeight:1.8}}>
        <p>本サービスは医療情報提供プラットフォームです。診断・治療行為を提供するものではありません。</p>
        <p>ユーザーは正確な情報を登録し、第三者の権利を侵害する投稿を行ってはいけません。</p>
        <p>口コミ投稿は運営のガイドラインに基づき、非公開・削除・編集されることがあります。</p>
        <p>予約機能は医療機関側の都合により変更・取消される場合があります。</p>
        <p>本サービスの停止・障害・第三者行為により発生した損害について、当社の故意または重過失を除き責任を負いません。</p>
      </div>
    ) : (
      <div style={{fontSize:12,color:C.textS,lineHeight:1.8}}>
        <p>当社は、会員登録情報、予約情報、投稿情報、アクセスログをサービス提供・改善・不正対策のために利用します。</p>
        <p>取得した個人情報は、法令に基づく場合を除き、本人同意なく第三者提供しません。</p>
        <p>予約の履行に必要な範囲で、医療機関に氏名・連絡先・予約内容を提供します。</p>
        <p>ユーザーは、法令に基づき、自己情報の開示・訂正・削除を請求できます。</p>
        <p>お問い合わせ: support@example.com</p>
      </div>
    )}
  </div>;
}

/* ═══════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════ */
export default function App() {
  const [users, setUsers] = useState(() => readJSON(STORAGE_KEYS.users, []));
  const [bookings, setBookings] = useState(() => readJSON(STORAGE_KEYS.bookings, []));
  const [clinicProfiles, setClinicProfiles] = useState(() => readJSON(STORAGE_KEYS.clinicProfiles, []));
  const [clinicDoctors, setClinicDoctors] = useState(() => readJSON(STORAGE_KEYS.clinicDoctors, []));
  const [reviewReports, setReviewReports] = useState(() => readJSON(STORAGE_KEYS.reviewReports, []));
  const [reviews, setReviews] = useState(() => readJSON(STORAGE_KEYS.reviews, []));
  const [mode, setMode] = useState("patient");
  const [view, setView] = useState("home");
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("すべて");
  const [symptom, setSymptom] = useState(null);
  const [activeF, setActiveF] = useState([]);
  const [sort, setSort] = useState("rating");
  const [selected, setSelected] = useState(null);
  const [docModal, setDocModal] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [legalPage, setLegalPage] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [showSymptoms, setShowSymptoms] = useState(false);
  const [user, setUser] = useState(null);
  const [favs, setFavs] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [mounted, setMounted] = useState(false);
  const isClinic = mode==="clinic";
  const baseHospitals = [...hospitals, ...clinicProfiles.map(toHospitalFromProfile)];
  const allHospitals = baseHospitals.map((h) => {
    const extra = reviews.filter((r) => String(r.clinicId) === String(h.id));
    const merged = [...h.reviews, ...extra];
    const avgRating = merged.length > 0 ? merged.reduce((a, r) => a + r.rating, 0) / merged.length : h.rating;
    return {
      ...h,
      reviews: merged,
      cnt: merged.length,
      rating: Number.isFinite(avgRating) ? Number(avgRating.toFixed(1)) : h.rating,
    };
  });
  const allDoctors = [...doctors, ...clinicDoctors];
  const clinicProfile = user?.role === "clinic" ? clinicProfiles.find((p) => p.ownerUserId === user.id) : null;
  const clinicHospital = clinicProfile ? allHospitals.find((h) => String(h.id) === String(clinicProfile.id)) : null;
  const clinicDoctorsList = clinicProfile ? clinicDoctors.filter((d) => String(d.hid) === String(clinicProfile.id)) : [];
  const clinicBookings = clinicProfile ? bookings.filter((b) => String(b.hospitalId) === String(clinicProfile.id)) : [];
  const clinicReports = clinicProfile ? reviewReports.filter((r) => r.clinicId === String(clinicProfile.id)) : [];

  useEffect(()=>{setTimeout(()=>setMounted(true),80);},[]);
  useEffect(() => {
    if (!isSupabaseEnabled) return;
    (async () => {
      const userFromSession = await getSessionUser();
      if (!userFromSession) return;
      const { data: profile } = await getProfileById(userFromSession.id);
      if (!profile) return;
      setUser({
        id: profile.id,
        name: profile.display_name,
        email: profile.email,
        role: profile.role,
        photo: profile.avatar,
      });
      const { data: cloudClinics } = await listClinicProfiles();
      if (cloudClinics) {
        const normalized = cloudClinics.map((c) => ({
          id: c.id,
          ownerUserId: c.owner_user_id,
          name: c.name,
          short: c.short || "",
          address: c.address,
          tel: c.tel || "",
          hours: c.hours || "",
          access: c.access || "",
          desc: c.description || "",
          lat: c.lat,
          lng: c.lng,
          beds: c.beds,
          founded: c.founded,
          depts: c.depts || [],
          parking: c.parking,
          nightService: c.night_service,
          female: c.female,
          online: c.online,
        }));
        setClinicProfiles(normalized);
      }
      const { data: cloudBookings } = await listBookings();
      if (cloudBookings) {
        const normalized = cloudBookings.map((b) => ({
          id: b.id,
          userId: b.user_id,
          hospitalId: b.clinic_id,
          hospitalName: allHospitals.find((h) => String(h.id) === String(b.clinic_id))?.name || b.clinic_name || "医療機関",
          type: b.booking_type,
          date: b.date,
          time: b.time,
          dept: b.dept,
          status: b.status,
          concern: b.concern || "",
          createdAt: b.created_at,
        }));
        setBookings(normalized);
      }
      const { data: cloudReviews } = await listReviews();
      if (cloudReviews) {
        const normalizedReviews = cloudReviews.map((r) => ({
          id: r.id,
          clinicId: r.clinic_id,
          uid: r.user_id,
          author: r.author,
          av: r.av,
          age: r.age || "",
          date: r.date,
          rating: r.rating,
          dept: r.dept,
          did: r.did,
          title: r.title,
          body: r.body,
          tags: r.tags || [],
          helpful: r.helpful || 0,
          dr: r.dr || 0,
          fr: r.fr || 0,
          wr: r.wr || 0,
          reply: r.reply || undefined,
        }));
        setReviews(normalizedReviews);
      }
      const { data: cloudDoctors } = await listClinicDoctors();
      if (cloudDoctors) {
        const normalizedDoctors = cloudDoctors.map((d) => ({
          id: d.id,
          hid: d.clinic_id,
          name: d.name,
          title: d.title,
          dept: d.dept,
          exp: d.exp || 0,
          specialties: d.specialties || [],
          bio: d.bio || "",
          rating: 0,
          cnt: 0,
          photo: d.photo || "🧑‍⚕️",
          female: !!d.female,
        }));
        setClinicDoctors(normalizedDoctors);
      }
    })();
  }, []);

  useEffect(() => {
    const session = readJSON(STORAGE_KEYS.session, null);
    if (!session?.userId) return;
    const hit = users.find((u) => u.id === session.userId);
    if (!hit) return;
    setUser({ id: hit.id, name: hit.name, email: hit.email, role: hit.role, photo: hit.photo });
  }, [users]);

  useEffect(() => {
    if (!user) {
      setFavs([]);
      return;
    }
    const favoriteMap = readJSON(STORAGE_KEYS.favorites, {});
    const ids = favoriteMap[user.id] || [];
    setFavs(allHospitals.filter((h) => ids.includes(h.id)));
  }, [user, clinicProfiles]);

  useEffect(() => {
    if (!user) return;
    const favoriteMap = readJSON(STORAGE_KEYS.favorites, {});
    favoriteMap[user.id] = favs.map((f) => f.id);
    writeJSON(STORAGE_KEYS.favorites, favoriteMap);
  }, [favs, user]);

  const toggleF = k=>setActiveF(p=>p.includes(k)?p.filter(x=>x!==k):[...p,k]);
  const toggleFav = h=>setFavs(p=>p.find(f=>f.id===h.id)?p.filter(f=>f.id!==h.id):[...p,h]);
  const isFav = h=>!!favs.find(f=>f.id===h.id);
  const userBookings = user ? bookings.filter((b) => b.userId === user.id) : [];
  const notifCount = Math.min(userBookings.length, 9);

  const saveSession = (uid) => writeJSON(STORAGE_KEYS.session, { userId: uid });
  const clearSession = async () => {
    localStorage.removeItem(STORAGE_KEYS.session);
    if (isSupabaseEnabled) {
      await signOutSession();
    }
  };
  const toClientUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, photo: u.photo });
  const normalizeAuthError = (message = "") => {
    const m = message.toLowerCase();
    if (m.includes("email not confirmed")) return "メール確認が未完了です。受信した確認メールのリンクを開いてからログインしてください。";
    if (m.includes("invalid login credentials")) return "メールアドレスまたはパスワードが違います。";
    if (m.includes("user already registered")) return "このメールアドレスは既に登録済みです。ログインしてください。";
    return message || "認証に失敗しました";
  };
  const logAction = async (action, metadata = {}) => {
    const entry = {
      id: createId("log"),
      actorUserId: user?.id || null,
      action,
      metadata,
      createdAt: new Date().toISOString(),
    };
    const next = [entry, ...readJSON(STORAGE_KEYS.auditLogs, [])].slice(0, 1000);
    writeJSON(STORAGE_KEYS.auditLogs, next);
    if (isSupabaseEnabled && user?.id) {
      await insertAuditLog({
        actor_user_id: user.id,
        action,
        metadata,
      });
    }
  };

  const signup = async ({ name, email, pass, role }) => {
    if (!name.trim()) return { ok: false, error: "お名前を入力してください" };
    if (!email.includes("@")) return { ok: false, error: "正しいメールアドレスを入力してください" };
    if (pass.length < 6) return { ok: false, error: "パスワードは6文字以上にしてください" };
    if (!isSupabaseEnabled && users.some((u) => u.email.toLowerCase() === email.toLowerCase())) return { ok: false, error: "このメールアドレスは既に登録済みです" };
    if (isSupabaseEnabled) {
      const { data, error } = await signUpWithEmail({ email: email.toLowerCase(), pass });
      if (error) return { ok: false, error: normalizeAuthError(error.message) };
      const uid = data.user?.id;
      if (!uid) return { ok: false, error: "ユーザー作成に失敗しました" };
      if (!data.session) {
        return { ok: false, error: "確認メールを送信しました。メールのリンクを開いてからログインしてください。" };
      }
      await upsertProfile({
        id: uid,
        email: email.toLowerCase(),
        display_name: name.trim(),
        role,
        avatar: role === "clinic" ? "🏥" : "👤",
      });
      setUser({ id: uid, name: name.trim(), email: email.toLowerCase(), role, photo: role === "clinic" ? "🏥" : "👤" });
      await logAction("signup", { role });
      return { ok: true };
    }
    const created = {
      id: createId("u"),
      name: name.trim(),
      email: email.toLowerCase(),
      passHash: passHash(pass),
      role,
      photo: role === "clinic" ? "🏥" : "👤",
      createdAt: new Date().toISOString(),
    };
    const nextUsers = [...users, created];
    setUsers(nextUsers);
    writeJSON(STORAGE_KEYS.users, nextUsers);
    saveSession(created.id);
    setUser(toClientUser(created));
    await logAction("signup", { role });
    return { ok: true };
  };

  const login = async ({ email, pass }) => {
    if (isSupabaseEnabled) {
      const normalizedEmail = email.toLowerCase();
      let { data, error } = await signInWithEmail({ email: normalizedEmail, pass });
      if (error) {
        const localUser = users.find((u) => u.email.toLowerCase() === normalizedEmail && u.passHash === passHash(pass));
        if (localUser) {
          const up = await signUpWithEmail({ email: normalizedEmail, pass });
          if (up.error && !String(up.error.message || "").toLowerCase().includes("already")) {
            return { ok: false, error: normalizeAuthError(up.error.message) };
          }
          const retry = await signInWithEmail({ email: normalizedEmail, pass });
          if (retry.error) return { ok: false, error: normalizeAuthError(retry.error.message) };
          data = retry.data;
        } else {
          return { ok: false, error: normalizeAuthError(error.message) };
        }
      }
      const uid = data.user?.id;
      if (!uid) return { ok: false, error: "ログインに失敗しました" };
      let { data: profile } = await getProfileById(uid);
      if (!profile) {
        const localUser = users.find((u) => u.email.toLowerCase() === normalizedEmail);
        const fallbackName = localUser?.name || normalizedEmail.split("@")[0];
        const fallbackRole = localUser?.role || "patient";
        await upsertProfile({
          id: uid,
          email: normalizedEmail,
          display_name: fallbackName,
          role: fallbackRole,
          avatar: fallbackRole === "clinic" ? "🏥" : "👤",
        });
        const profRes = await getProfileById(uid);
        profile = profRes.data;
      }
      if (!profile) return { ok: false, error: "プロフィール作成に失敗しました。時間をおいて再試行してください。" };
      const ownerClinic = clinicProfiles.find((c) => c.ownerUserId === uid);
      const localUserRole = users.find((u) => u.email.toLowerCase() === normalizedEmail)?.role;
      const desiredRole = ownerClinic || localUserRole === "clinic" ? "clinic" : profile.role;
      if (desiredRole !== profile.role) {
        await upsertProfile({
          id: profile.id,
          email: profile.email,
          display_name: profile.display_name,
          role: desiredRole,
          avatar: desiredRole === "clinic" ? "🏥" : (profile.avatar || "👤"),
        });
        profile = { ...profile, role: desiredRole, avatar: desiredRole === "clinic" ? "🏥" : (profile.avatar || "👤") };
      }
      setUser({ id: profile.id, name: profile.display_name, email: profile.email, role: profile.role, photo: profile.avatar });
      await logAction("login", {});
      return { ok: true };
    }
    const target = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!target) return { ok: false, error: "ユーザーが見つかりません（Supabase未設定時は、このブラウザで登録したアカウントのみログイン可能です）" };
    if (target.passHash !== passHash(pass)) return { ok: false, error: "メールアドレスまたはパスワードが違います" };
    saveSession(target.id);
    setUser(toClientUser(target));
    await logAction("login", {});
    return { ok: true };
  };

  const socialLogin = async ({ provider, name, email, role }) => {
    const normalizedEmail = (email || `${provider}-${Date.now()}@example.com`).toLowerCase();
    if (isSupabaseEnabled) {
      return { ok: false, error: "本番OAuth設定が必要です。いまはメールログインを使ってください。" };
    }
    const existing = users.find((u) => u.email === normalizedEmail);
    if (existing) {
      saveSession(existing.id);
      setUser(toClientUser(existing));
      await logAction("login_social_local", { provider });
      return { ok: true };
    }
    const created = {
      id: createId("u"),
      name: name?.trim() || (provider === "google" ? "Googleユーザー" : "Appleユーザー"),
      email: normalizedEmail,
      passHash: passHash(createId("social")),
      role,
      photo: role === "clinic" ? "🏥" : "👤",
      createdAt: new Date().toISOString(),
    };
    const nextUsers = [...users, created];
    setUsers(nextUsers);
    writeJSON(STORAGE_KEYS.users, nextUsers);
    saveSession(created.id);
    setUser(toClientUser(created));
    await logAction("signup_social_local", { provider, role });
    return { ok: true };
  };

  const createBooking = async (payload) => {
    if (!user) return;
    if (isSupabaseEnabled) {
      const { error } = await insertBooking({
        user_id: user.id,
        clinic_id: String(payload.hospitalId),
        clinic_name: payload.hospitalName,
        booking_type: payload.type,
        date: payload.date,
        time: payload.time,
        dept: payload.dept,
        status: payload.status,
        concern: payload.concern || "",
      });
      if (!error) {
        const { data: cloudBookings } = await listBookings();
        if (cloudBookings) {
          const normalized = cloudBookings.map((b) => ({
            id: b.id,
            userId: b.user_id,
            hospitalId: b.clinic_id,
            hospitalName: allHospitals.find((h) => String(h.id) === String(b.clinic_id))?.name || b.clinic_name || payload.hospitalName || "医療機関",
            type: b.booking_type,
            date: b.date,
            time: b.time,
            dept: b.dept,
            status: b.status,
            concern: b.concern || "",
            createdAt: b.created_at,
          }));
          setBookings(normalized);
        }
        await logAction("booking_create", { hospitalId: payload.hospitalId, type: payload.type });
      }
      return;
    }
    const nextBooking = {
      id: createId("bk"),
      userId: user.id,
      createdAt: new Date().toISOString(),
      ...payload,
    };
    const next = [nextBooking, ...bookings];
    setBookings(next);
    writeJSON(STORAGE_KEYS.bookings, next);
    await logAction("booking_create", { hospitalId: payload.hospitalId, type: payload.type });
  };

  const createReview = async (hospital, form) => {
    if (!user) return false;
    const newReview = {
      id: createId("rv"),
      clinicId: String(hospital.id),
      uid: user.id,
      author: form.anon ? "匿名ユーザー" : user.name,
      av: form.anon ? "匿" : (user.name?.slice(0, 1) || "匿"),
      age: "非公開",
      date: new Date().toISOString().slice(0, 10),
      rating: form.overall,
      dept: form.dept,
      did: form.did,
      title: form.title.trim(),
      body: form.body.trim(),
      tags: form.tags,
      helpful: 0,
      dr: form.dr,
      fr: form.fr,
      wr: form.wr,
    };

    if (isSupabaseEnabled) {
      const { error } = await insertReview({
        clinic_id: newReview.clinicId,
        user_id: user.id,
        author: newReview.author,
        av: newReview.av,
        age: newReview.age,
        date: newReview.date,
        rating: newReview.rating,
        dept: newReview.dept,
        did: newReview.did,
        title: newReview.title,
        body: newReview.body,
        tags: newReview.tags,
        helpful: newReview.helpful,
        dr: newReview.dr,
        fr: newReview.fr,
        wr: newReview.wr,
      });
      if (error) {
        alert("口コミ投稿に失敗しました。しばらくして再試行してください。");
        return false;
      }
    }

    const nextReviews = [newReview, ...reviews];
    setReviews(nextReviews);
    writeJSON(STORAGE_KEYS.reviews, nextReviews);
    await logAction("review_create", { clinicId: String(hospital.id), rating: form.overall });
    return true;
  };

  const handleReviewHelpful = async (review, nextHelpful) => {
    const hit = reviews.find((r) => String(r.id) === String(review.id) && String(r.clinicId) === String(review.clinicId || selected?.id));
    if (!hit) return;
    const nextReviews = reviews.map((r) => (String(r.id) === String(review.id) && String(r.clinicId) === String(hit.clinicId) ? { ...r, helpful: nextHelpful } : r));
    setReviews(nextReviews);
    writeJSON(STORAGE_KEYS.reviews, nextReviews);
    if (isSupabaseEnabled) {
      await updateReview(hit.id, { helpful: nextHelpful });
    }
    await logAction("review_helpful", { reviewId: String(review.id), helpful: nextHelpful });
  };

  const handleReviewReply = async (review, replyText) => {
    const hit = reviews.find((r) => String(r.id) === String(review.id) && String(r.clinicId) === String(review.clinicId || selected?.id));
    if (!hit || !replyText?.trim()) return;
    const nextReviews = reviews.map((r) => (String(r.id) === String(review.id) && String(r.clinicId) === String(hit.clinicId) ? { ...r, reply: replyText.trim() } : r));
    setReviews(nextReviews);
    writeJSON(STORAGE_KEYS.reviews, nextReviews);
    if (isSupabaseEnabled) {
      await updateReview(hit.id, { reply: replyText.trim() });
    }
    await logAction("review_reply", { reviewId: String(review.id) });
  };

  const reportReview = async (review, hospital) => {
    if (!user) {
      alert("通報にはログインが必要です");
      setShowAuth(true);
      return;
    }
    const reason = window.prompt("通報理由を入力してください（例: 誹謗中傷・個人情報）");
    if (!reason?.trim()) return;
    const report = {
      id: createId("rp"),
      reviewId: String(review.id),
      reporterUserId: user.id,
      clinicId: String(hospital.id),
      reason: reason.trim(),
      createdAt: new Date().toISOString(),
    };
    const next = [report, ...reviewReports];
    setReviewReports(next);
    writeJSON(STORAGE_KEYS.reviewReports, next);
    if (isSupabaseEnabled) {
      await insertReviewReport({
        review_id: report.reviewId,
        reporter_user_id: report.reporterUserId,
        clinic_id: report.clinicId,
        reason: report.reason,
      });
    }
    await logAction("review_report", { reviewId: report.reviewId, clinicId: report.clinicId });
    alert("通報を受け付けました。運営側で確認します。");
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("このブラウザは位置情報取得に対応していません");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationError("");
      },
      () => setLocationError("位置情報が取得できませんでした。ブラウザ設定で許可してください。"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  };

  const saveClinicProfile = async (payload) => {
    if (!user || user.role !== "clinic") return;
    const prev = clinicProfiles.find((p) => p.ownerUserId === user.id);
    const nextProfile = {
      id: prev?.id || createId("clinic"),
      ownerUserId: user.id,
      ...payload,
      updatedAt: new Date().toISOString(),
    };
    const nextProfiles = prev
      ? clinicProfiles.map((p) => (p.ownerUserId === user.id ? nextProfile : p))
      : [...clinicProfiles, nextProfile];
    setClinicProfiles(nextProfiles);
    writeJSON(STORAGE_KEYS.clinicProfiles, nextProfiles);
    if (isSupabaseEnabled) {
      await upsertClinic({
        id: nextProfile.id,
        owner_user_id: user.id,
        name: nextProfile.name,
        short: nextProfile.short || "",
        address: nextProfile.address,
        tel: nextProfile.tel || "",
        hours: nextProfile.hours || "",
        access: nextProfile.access || "",
        description: nextProfile.desc || "",
        lat: Number(nextProfile.lat),
        lng: Number(nextProfile.lng),
        beds: Number(nextProfile.beds || 0),
        founded: Number(nextProfile.founded || new Date().getFullYear()),
        depts: nextProfile.depts?.length ? nextProfile.depts : ["内科"],
        parking: !!nextProfile.parking,
        night_service: !!nextProfile.nightService,
        female: !!nextProfile.female,
        online: !!nextProfile.online,
      });
    }
    await logAction("clinic_profile_upsert", { clinicId: nextProfile.id });
  };

  const saveClinicDoctor = async (payload) => {
    if (!user || user.role !== "clinic") return;
    const created = {
      id: createId("doc"),
      ...payload,
      rating: 0,
      cnt: 0,
    };
    const next = [created, ...clinicDoctors];
    setClinicDoctors(next);
    writeJSON(STORAGE_KEYS.clinicDoctors, next);
    if (isSupabaseEnabled) {
      await upsertClinicDoctor({
        id: created.id,
        clinic_id: String(created.hid),
        owner_user_id: user.id,
        name: created.name,
        title: created.title,
        dept: created.dept,
        exp: Number(created.exp || 0),
        specialties: created.specialties || [],
        bio: created.bio || "",
        photo: created.photo || "🧑‍⚕️",
        female: !!created.female,
      });
    }
    await logAction("clinic_doctor_upsert", { clinicId: String(created.hid), doctorName: created.name });
  };

  const upgradeToClinicRole = async () => {
    if (!user) return;
    if (isSupabaseEnabled) {
      await upsertProfile({
        id: user.id,
        email: user.email,
        display_name: user.name,
        role: "clinic",
        avatar: "🏥",
      });
    }
    setUser((p) => ({ ...p, role: "clinic", photo: "🏥" }));
    const nextUsers = users.map((u) => (u.email.toLowerCase() === user.email.toLowerCase() ? { ...u, role: "clinic", photo: "🏥" } : u));
    setUsers(nextUsers);
    writeJSON(STORAGE_KEYS.users, nextUsers);
    await logAction("role_upgrade_clinic", {});
    alert("医療機関会員へ切り替えました。");
  };

  const filtered = allHospitals
    .filter(h=>{
      if(search&&!(h.name.includes(search)||h.address.includes(search)||h.depts.some(d=>d.includes(search))))return false;
      if(dept!=="すべて"&&!h.depts.includes(dept))return false;
      if(symptom&&!h.depts.includes(symptom.dept))return false;
      for(const k of activeF)if(!h[k])return false;
      return true;
    })
    .sort((a,b)=>sort==="rating"?b.rating-a.rating:b.cnt-a.cnt);

  const openHospital = h=>{ setSelected(h); setView("detail"); };

  return (
    <div style={{...ff,minHeight:"100vh",background:"#f1f5f9"}}>
      {/* Auth */}
      {showAuth&&<Auth onLogin={login} onSignup={signup} onSocialLogin={socialLogin} onClose={()=>setShowAuth(false)}/>}

      {/* Doctor modal */}
      {docModal&&<Sheet title="医師プロフィール" onClose={()=>setDocModal(null)}><DoctorProfile doc={docModal} hospitalsData={allHospitals}/></Sheet>}

      {/* Notif panel */}
      {showNotif&&<Sheet title="🔔 通知" onClose={()=>setShowNotif(false)}><NotifPanel bookings={userBookings}/></Sheet>}

      {/* HEADER */}
      <div style={{background:isClinic?GB:G,transition:"background .4s",position:"sticky",top:0,zIndex:500}}>
        <div style={{maxWidth:680,margin:"0 auto",padding:"12px 16px 0"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <button onClick={()=>{setView("home");setSelected(null);setLegalPage(null);}} style={{display:"flex",alignItems:"center",gap:7,background:"none",border:"none",cursor:"pointer",...ff}}>
              <span style={{fontSize:18}}>🏥</span>
              <span style={{fontSize:17,fontWeight:900,color:C.white,letterSpacing:"-0.5px"}}>ドクターレビュー</span>
            </button>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <div style={{display:"flex",background:"rgba(255,255,255,.15)",borderRadius:99,padding:3,gap:1}}>
                {[["patient","患者"],["clinic","医療機関"]].map(([m,l])=>(
                  <button key={m} onClick={()=>{setMode(m);setView("home");setSelected(null);}} style={{padding:"5px 9px",borderRadius:99,border:"none",fontSize:10,fontWeight:700,cursor:"pointer",...ff,background:mode===m?C.white:"transparent",color:mode===m?(m==="patient"?C.green:C.blue):"rgba(255,255,255,.85)",transition:"all .2s"}}>{l}</button>
                ))}
              </div>
              {user&&<button onClick={()=>setShowNotif(true)} style={{position:"relative",width:32,height:32,borderRadius:"50%",border:"1px solid rgba(255,255,255,.3)",background:"rgba(255,255,255,.15)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>
                🔔
                {notifCount>0&&<span style={{position:"absolute",top:0,right:0,width:14,height:14,borderRadius:"50%",background:C.red,color:C.white,fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{notifCount}</span>}
              </button>}
              {user ? (
                <button onClick={()=>setView("mypage")} style={{width:32,height:32,borderRadius:"50%",border:"2px solid rgba(255,255,255,.4)",background:"rgba(255,255,255,.2)",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{user.photo}</button>
              ) : (
                <button onClick={()=>setShowAuth(true)} style={{padding:"6px 11px",borderRadius:99,border:"1px solid rgba(255,255,255,.5)",background:"rgba(255,255,255,.15)",color:C.white,fontSize:10,fontWeight:700,cursor:"pointer",...ff}}>ログイン</button>
              )}
            </div>
          </div>

          {!isClinic&&view==="home"&&<div style={{paddingBottom:14}}>
            {/* Search bar */}
            <div style={{position:"relative",marginBottom:8}}>
              <span style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",fontSize:14}}>🔍</span>
              <input value={search} onChange={e=>{setSearch(e.target.value);setSymptom(null);}} placeholder="病院名・診療科・地域で検索"
                style={{width:"100%",padding:"11px 42px 11px 38px",borderRadius:14,border:"none",fontSize:13,background:"rgba(255,255,255,.97)",outline:"none",boxSizing:"border-box",boxShadow:"0 4px 16px rgba(0,0,0,.12)",...ff}}/>
              {search&&<button onClick={()=>setSearch("")} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",fontSize:16,background:"none",border:"none",cursor:"pointer",color:C.gray}}>×</button>}
            </div>
            {/* Quick actions */}
            <div style={{display:"flex",gap:6,marginBottom:8}}>
              <button onClick={()=>setShowSymptoms(!showSymptoms)} style={{flex:1,padding:"7px",borderRadius:12,border:"none",background:showSymptoms?"white":"rgba(255,255,255,.2)",color:showSymptoms?C.green:"rgba(255,255,255,.9)",fontSize:11,fontWeight:700,cursor:"pointer",...ff,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
                {symptom?`🩺 ${symptom.s}`:("🩺 症状から検索")} {showSymptoms?"▲":"▼"}
              </button>
              <button onClick={()=>setShowMap(!showMap)} style={{flex:1,padding:"7px",borderRadius:12,border:"none",background:showMap?"white":"rgba(255,255,255,.2)",color:showMap?C.green:"rgba(255,255,255,.9)",fontSize:11,fontWeight:700,cursor:"pointer",...ff,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
                🗺️ 地図で探す {showMap?"▲":"▼"}
              </button>
            </div>
            {/* Symptom picker */}
            {showSymptoms&&<div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
              {SYMPTOMS.map(s=><button key={s.s} onClick={()=>{setSymptom(symptom?.s===s.s?null:s);setShowSymptoms(false);setSearch("");setDept("すべて");}} style={{padding:"5px 11px",borderRadius:99,border:"none",fontSize:11,fontWeight:600,cursor:"pointer",...ff,background:symptom?.s===s.s?C.white:"rgba(255,255,255,.2)",color:symptom?.s===s.s?C.green:"rgba(255,255,255,.9)"}}>{s.icon} {s.s}</button>)}
            </div>}
            {/* Dept tabs */}
            <div style={{display:"flex",gap:5,overflowX:"auto",paddingBottom:4,marginBottom:6}}>
              {ALL_DEPTS.map(d=><button key={d} onClick={()=>{setDept(d);setSymptom(null);}} style={{padding:"4px 11px",borderRadius:99,border:"none",fontSize:11,fontWeight:700,whiteSpace:"nowrap",cursor:"pointer",flexShrink:0,...ff,background:dept===d?C.white:"rgba(255,255,255,.2)",color:dept===d?C.green:"rgba(255,255,255,.9)"}}>{d}</button>)}
            </div>
            {/* Filters */}
            <div style={{display:"flex",gap:5,overflowX:"auto",paddingBottom:3}}>
              {CFILTERS.map(f=><button key={f.k} onClick={()=>toggleF(f.k)} style={{padding:"4px 10px",borderRadius:99,border:"none",fontSize:10,fontWeight:700,whiteSpace:"nowrap",cursor:"pointer",flexShrink:0,...ff,background:activeF.includes(f.k)?C.white:"rgba(255,255,255,.15)",color:activeF.includes(f.k)?C.green:"rgba(255,255,255,.8)"}}>{f.i} {f.l}</button>)}
            </div>
          </div>}
          {(isClinic||view!=="home")&&<div style={{height:12}}/>}
        </div>
      </div>

      {/* BODY */}
      <div style={{maxWidth:680,margin:"0 auto",padding:"16px 16px 80px"}}>
        {legalPage ? (
          <LegalPage type={legalPage} onBack={()=>setLegalPage(null)} />
        ) : view==="mypage"&&user ? (
          <MyPage user={user} favs={favs} bookings={userBookings} myReviews={reviews.filter((r)=>r.uid===user.id)} onUnfav={id=>setFavs(p=>p.filter(f=>f.id!==id))} onLogout={async ()=>{await logAction("logout", {});await clearSession();setUser(null);setView("home");}} onHospitalClick={openHospital} onUpgradeToClinic={upgradeToClinicRole}/>
        ) : isClinic ? (
          <ClinicDash user={user} clinicProfile={clinicProfile} clinicHospital={clinicHospital} clinicBookings={clinicBookings} clinicReports={clinicReports} clinicDoctorsList={clinicDoctorsList} onSaveClinicProfile={saveClinicProfile} onSaveDoctor={saveClinicDoctor} onDoctorClick={setDocModal} onReviewReply={handleReviewReply}/>
        ) : view==="detail"&&selected ? (
          <HospitalDetail hospital={allHospitals.find((h)=>String(h.id)===String(selected.id)) || selected} doctorsData={allDoctors} onBack={()=>{setSelected(null);setView("home");}} onDoctorClick={setDocModal} isFav={isFav(selected)} onFavToggle={toggleFav} user={user} onCreateBooking={createBooking} onRequireLogin={()=>setShowAuth(true)} onReportReview={reportReview} onCreateReview={createReview} onReviewHelpful={handleReviewHelpful} onReviewReply={handleReviewReply}/>
        ) : (
          <div>
            {/* Map */}
            {showMap&&<MapView hospitals={filtered} onSelect={openHospital} userLocation={userLocation} onLocate={requestLocation} locationError={locationError}/>}

            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div>
                {symptom&&<div style={{fontSize:12,color:C.green,fontWeight:700,marginBottom:2}}>{symptom.icon} {symptom.s} → {symptom.dept}</div>}
                <span style={{fontWeight:800,fontSize:13,color:"#374151"}}>{filtered.length}件</span>
                <span style={{fontSize:12,color:C.textM,marginLeft:4}}>の医療機関</span>
              </div>
              <select value={sort} onChange={e=>setSort(e.target.value)} style={{fontSize:12,padding:"6px 10px",borderRadius:10,border:`1px solid ${C.border}`,background:C.white,color:"#374151",outline:"none",...ff}}>
                <option value="rating">評価順</option>
                <option value="reviews">口コミ数順</option>
              </select>
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {filtered.map((h,i)=>(
                <div key={h.id} style={{opacity:mounted?1:0,transform:mounted?"none":"translateY(14px)",transition:`all .4s ease ${i*.07}s`}}>
                  <HospitalCard h={h} onClick={openHospital} isFav={isFav(h)} onFavToggle={toggleFav} user={user}/>
                </div>
              ))}
              {filtered.length===0&&<div style={{textAlign:"center",padding:"48px 0"}}>
                <div style={{fontSize:40,marginBottom:12}}>🔍</div>
                <div style={{fontWeight:700,fontSize:14,color:"#374151"}}>条件に合う医療機関が見つかりません</div>
                <div style={{fontSize:12,color:C.textM,marginTop:6}}>条件を変えて検索してみてください</div>
              </div>}
            </div>
            <div style={{display:"flex",justifyContent:"center",gap:14,marginTop:18,fontSize:11}}>
              <button onClick={()=>setLegalPage("terms")} style={{background:"none",border:"none",color:C.blue,cursor:"pointer",textDecoration:"underline",...ff}}>利用規約</button>
              <button onClick={()=>setLegalPage("privacy")} style={{background:"none",border:"none",color:C.blue,cursor:"pointer",textDecoration:"underline",...ff}}>プライバシーポリシー</button>
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM NAV */}
      {!isClinic&&<div style={{position:"fixed",bottom:0,left:0,right:0,background:C.white,borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-around",padding:"8px 0 18px",zIndex:100,boxShadow:"0 -2px 16px rgba(0,0,0,.06)"}}>
        {[
          {v:"home",i:"🏠",l:"ホーム"},
          {v:"symptoms",i:"🩺",l:"症状検索"},
          {v:"map",i:"🗺️",l:"地図"},
          {v:"fav",i:favs.length>0?"❤️":"🤍",l:`お気に入り${favs.length>0?` (${favs.length})`:""}`,},
          {v:"mypage",i:user?"👤":"🔑",l:user?"マイページ":"ログイン"},
        ].map(({v,i,l})=>(
          <button key={v} onClick={()=>{
            setLegalPage(null);
            if(v==="home"){setView("home");setSelected(null);}
            else if(v==="symptoms"){setView("home");setSelected(null);setShowSymptoms(true);setShowMap(false);window.scrollTo(0,0);}
            else if(v==="map"){setView("home");setSelected(null);setShowMap(true);setShowSymptoms(false);window.scrollTo(0,0);}
            else if(v==="fav"){user?setView("mypage"):setShowAuth(true);}
            else if(v==="mypage"){user?setView("mypage"):setShowAuth(true);}
          }} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,background:"none",border:"none",cursor:"pointer",...ff,minWidth:56}}>
            <span style={{fontSize:19}}>{i}</span>
            <span style={{fontSize:9,fontWeight:600,color:(view===v||(v==="home"&&view==="detail"))?C.green:C.textM,lineHeight:1.2,textAlign:"center"}}>{l}</span>
          </button>
        ))}
      </div>}
    </div>
  );
}
