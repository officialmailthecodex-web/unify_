import {auth} from "./firebase-init.js";
import {onAuthStateChanged,signOut} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {setupPharmacy,eta} from "./pharmacy.js";
const $=id=>document.getElementById(id);
const el=(t,c,h)=>{const e=document.createElement(t);if(c)e.className=c;if(h!==undefined)e.textContent=h;return e};
const api=async(u,b)=>{const h={Authorization:"Bearer "+await auth.currentUser.getIdToken()};if(b!==undefined)h["Content-Type"]="application/json";
  const r=await fetch(u,{method:b===undefined?"GET":"POST",headers:h,body:b===undefined?undefined:JSON.stringify(b)});
  if(r.status===401){await signOut(auth);location.href="/login.html";throw 0}return r.json()};
const inr=n=>"₹"+n.toLocaleString("en-IN");
const ICON={home:'<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',plus:'<circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>',
 ticket:'<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><path d="M13 5v2M13 11v2M13 17v2"/>',
 building:'<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2M10 6h4M10 10h4M10 14h4M10 18h4"/>',
 bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',user:'<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
 logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',x:'<path d="M18 6 6 18M6 6l12 12"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
 pill:'<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7z"/><path d="m8.5 8.5 7 7"/>',
 shield:'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>'};
const icon=(k,s=20)=>{const d=el("span","ic");d.innerHTML=`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;return d};
let ME,cur,filter="all",seg="mine";
const ROLE={hosteler:"Hosteler",staff:"Staff",pharmacy:"Pharmacy"},WS={hosteler:"Hosteler Workspace",staff:"Staff Workspace",pharmacy:"Pharmacy Workspace"};
const NAV={hosteler:[["home","Home","home"],["report","Report an Issue","plus"],["issues","My Issues","ticket"],["hostel","Hostel","building"],["alerts","Alerts","bell"],["profile","Profile","user"]],
  staff:[["home","Home","home"],["issues","Issues","ticket"],["pharmacy","Pharmacy","pill"],["alerts","Alerts","bell"],["profile","Profile","user"]],
  pharmacy:[["pharmacy","Stock desk","pill"],["profile","Profile","user"]]};
const SECTIONS=["home","report","issues","hostel","alerts","profile","pharmacy"];
const where=()=>ME.hostel?`${ME.hostel}${ME.room?` (Room ${ME.room})`:""}`:"";
const out=async()=>{await signOut(auth);location.href="/login.html"};
$("menu").append(icon("menu"));$("close").append(icon("x"));$("logo").append(icon("shield",28));$("out").prepend(icon("logout",18));$("out").onclick=out;
const drawer=o=>document.body.classList.toggle("open",o);
$("menu").onclick=()=>drawer(true);$("close").onclick=()=>drawer(false);$("scrim").onclick=()=>drawer(false);
addEventListener("keydown",e=>{if(e.key==="Escape")drawer(false)});
const CHIPS=[["AC not working","AC is not cooling"],["Pipe leak","Pipe is leaking and water is on the floor"],["Wi-Fi down","Wi-Fi keeps disconnecting"],["Broken light","Tube light is not working"],["Medical help","Someone needs medical help urgently"]];
CHIPS.forEach(([l,t])=>{const b=el("button","b",l);b.type="button";b.onclick=()=>{$("text").value=t;$("loc").focus()};$("chips").append(b)});
$("toPharm").onclick=()=>show("pharmacy");
const refresh=()=>LOAD[cur]?.();
function chrome(){const w=ME.role==="hosteler"&&where()?`Hosteler · ${where()}`:`${ROLE[ME.role]}${ME.role==="hosteler"?"":" · "+ME.name}`;
  $("pill").textContent=w;$("meName").textContent=ME.name;$("meSub").textContent=w}
function show(t){cur=t;drawer(false);const key=ME.role==="hosteler"&&t==="pharmacy"?"hostel":t;
  document.querySelectorAll("#nv button").forEach(x=>x.classList.toggle("on",x.dataset.t===key));
  SECTIONS.forEach(s=>$(s).hidden=s!==t);
  $("ttl").textContent={home:ME.role==="staff"?"Staff Desk":"Home",report:"Report an Issue",issues:ME.role==="staff"?"Issues":"My Issues",hostel:"Hostel",alerts:"Alerts",profile:"Profile",pharmacy:ME.role==="pharmacy"?"Pharmacy Desk":"Pharmacy"}[t];
  scrollTo(0,0);refresh()}

const ai=t=>{const o=[];
  if(t.ai_reason){const d=el("div","ai");d.append(el("span","tag",t.ai_source==="gemini"?"AI":"Rules"),document.createTextNode(" "+t.ai_reason));o.push(d)}
  if(ME.role==="staff"&&t.ai_action)o.push(el("div","m","Suggested action: "+t.ai_action));
  if(t.why?.length)o.push(el("div","m","Why this priority: "+t.why.join(" · ")));return o};
async function brief(refresh){const b=$("brief");b.hidden=false;b.replaceChildren(el("p","m","AI is reading the queue…"));
  const d=await api("/api/ai/brief"+(refresh?"?refresh=1":""));b.replaceChildren();
  const h=el("div","bh"),r=el("button","b","Refresh");r.onclick=()=>brief(true);h.append(el("h2","","AI briefing"),r);
  b.append(h,el("p","",d.summary),el("p","m",d.source==="gemini"?"Prepared by Gemini from the live queue.":"Ordered by the scoring rules. Add a Gemini API key for AI reasoning."));
  if(d.items.length){const ol=el("ol");d.items.forEach(i=>{const li=el("li");li.append(el("b","",`${i.title} `),el("span","m",`(${i.location} · priority ${i.priority})`),el("div","m","Why first: "+i.why),el("div","m","Do this: "+i.action));ol.append(li)});b.append(ol)}}
function card(t,mode){
  const d=el("div","t "+t.level+(t.status==="resolved"?" done":""));
  const p=el("div","pr");p.append(el("b","",t.priority),el("span","",t.level));
  const b=el("div","bd");b.append(el("h3","",t.summary||t.text),
    el("div","m",`${t.label} · ${t.location} · open ${t.hours_open}h · ${t.people+t.me_too} affected`+(t.similar?` · ${t.similar} similar`:"")),
    el("div","m",`Cost of delay: ${inr(t.cost_of_delay)} now, up to ${inr(t.cost_if_ignored)} later.`),...ai(t));
  if(mode==="mine"){const tr=el("div","track"),n={open:0,in_progress:1,resolved:2}[t.status];
    ["Reported","In progress","Resolved"].forEach((s,i)=>tr.append(el("span",i<=n?"on":"",s)));b.append(tr)}
  if(mode==="board"){const a=el("div","acts");
    if(ME.role==="hosteler"){const mt=el("button","b","Me too");mt.onclick=async()=>{await api(`/api/tickets/${t.id}/metoo`,{});refresh()};a.append(mt)}
    if(ME.role==="staff"){const sel=el("select","b");["open","in_progress","resolved"].forEach(s=>{const o=el("option","",s.replace("_"," "));o.value=s;o.selected=s===t.status;sel.append(o)});
      sel.setAttribute("aria-label","Ticket status");sel.onchange=async()=>{await api(`/api/tickets/${t.id}/status`,{status:sel.value});refresh()};a.append(sel)}
    const m=el("a","","Open in Maps");m.href=t.map;m.target="_blank";m.rel="noopener";a.append(m);b.append(a)}
  d.append(p,b);return d}
const tiles=(id,rows)=>$(id).replaceChildren(...rows.map(([k,v])=>{const x=el("div");x.append(el("b","",v),el("span","m",k));return x}));

async function home(){
  const d=await api("/api/dashboard"),staff=ME.role==="staff";
  $("hi").textContent=ME.name.split(" ")[0];$("sub").textContent=d.critical?`${d.critical} critical problem(s) need attention on campus right now.`:"No critical problems on campus right now.";
  $("hv").textContent=d.health;const arc=$("arc");arc.style.setProperty("--c",d.health<40?"#ff5a6e":d.health<70?"#ffb454":"#3ddc97");
  requestAnimationFrame(()=>arc.style.strokeDashoffset=364.4*(1-d.health/100));
  tiles("tiles",[["Open on campus",d.open],["Critical now",d.critical],["Fixed so far",d.resolved],staff?["Total reports",d.open+d.resolved]:["Your reports",d.mine.length]]);
  $("brief").hidden=!staff;if(staff)brief();
  $("heat").replaceChildren(...(d.blocks.length?d.blocks.map(b=>{const x=el("div","tile "+b.level);x.append(el("b","",b.block),el("span","",`${b.open} open · top priority ${b.top}`));return x}):[el("p","m","All clear.")]));
  $("mineH").textContent=staff?"Needs attention first":"Your reports";
  const list=staff?d.urgent:d.mine.slice(0,3);
  $("mine").replaceChildren(...(list.length?list.map(t=>card(t,staff?"board":"mine")):[el("p","m",staff?"Nothing open. Good work.":"You have not reported anything yet. Small problems are the best ones to report.")]));
  $("lead").replaceChildren(...d.leaderboard.map(l=>el("li","",`${l.name}: ${l.points} pts`)))}
function report(){if(ME.hostel&&!$("loc").value)$("loc").value=`${ME.hostel}${ME.room?" - Room "+ME.room:""}`}
$("f").onsubmit=async e=>{e.preventDefault();$("result").replaceChildren(el("p","m","Analysing…"));
  const t=await api("/api/tickets",{text:$("text").value,location:$("loc").value,people:$("ppl").value});const r=$("result");r.replaceChildren();
  if(t.error){r.append(el("p","m",t.error));return}
  if(t.emergency)r.append(el("div","sos","Emergency: call 108 (ambulance) or 112 now, and contact campus security. Your report is marked critical."));
  r.append(card(t,"mine"),el("p","m",`Sorted by ${t.classified_by==="gemini"?"Gemini":"our rules"}. You earned 10 points.`));$("f").reset();ME.points+=10};
async function issues(){
  const staff=ME.role==="staff";if(staff)seg="board";const ts=await api("/api/tickets");
  $("seg").hidden=staff;$("seg").replaceChildren(...[["mine","My reports"],["board","Campus board"]].map(([k,l])=>{const b=el("button",seg===k?"on":"",l);b.onclick=()=>{seg=k;issues()};return b}));
  $("filters").hidden=seg==="mine";$("filters").replaceChildren();
  if(seg==="board")["all","critical","high","medium","low"].forEach(l=>{const b=el("button","b"+(filter===l?" on":""),l);b.onclick=()=>{filter=l;issues()};$("filters").append(b)});
  const rows=seg==="mine"?ts.filter(t=>t.user_id===ME.uid):ts.filter(t=>filter==="all"||t.level===filter);
  $("list").replaceChildren(...(rows.length?rows.map(t=>card(t,seg==="mine"?"mine":"board")):[el("p","m",seg==="mine"?"You have not reported anything yet. Use Report an Issue.":"No problems match this filter.")]))}
const kv=(k,v)=>{const d=el("div","kv");d.append(el("span","k",k),el("b","",v||"Not set"));return d};
async function hostel(){
  const h=ME.hostel;$("hostelInfo").replaceChildren(kv("Hostel location",where()),kv("Warden desk",ME.warden||(h?`${h} warden desk`:"")),kv("Room",ME.room));
  const ts=await api("/api/tickets"),mine=h?ts.filter(t=>t.status!=="resolved"&&t.location.split("-")[0].trim().toLowerCase()===h.toLowerCase()):[];
  $("hostelIssues").replaceChildren(...(!h?[el("p","m","Add your hostel in Profile to see problems near you.")]:mine.length?mine.slice(0,6).map(t=>card(t,"board")):[el("p","m","No open problems in your hostel.")]))}
async function alerts(){
  const [ts,ins,ms]=await Promise.all([api("/api/tickets"),api("/api/insights"),api("/api/medicines")]);
  tiles("aStats",[["Open problems",ins.open],["Critical now",ins.critical],["Money at risk if ignored",inr(ins.at_risk)],["Saved by fixing early",inr(ins.saved)]]);
  const item=(c,t,m)=>{const d=el("div","alert "+c);d.append(el("h3","",t),el("div","m",m));return d};
  const crit=ts.filter(t=>t.status!=="resolved"&&t.level==="critical").slice(0,5),med=ms.filter(m=>m.status!=="available");
  $("aCrit").replaceChildren(...(crit.length?crit.map(t=>item("critical",t.summary||t.text,`${t.location} · priority ${t.priority} · ${t.status.replace("_"," ")}`)):[el("p","m","No critical problems right now.")]));
  $("aWarn").replaceChildren(...(ins.warnings.length?ins.warnings.map(w=>item("high",w.title,w.detail)):[el("p","m","No repeating patterns right now.")]));
  $("aMed").replaceChildren(...(med.length?med.map(m=>item(m.status==="out"?"critical":"medium",`${m.name}: ${m.status==="out"?"out of stock":"low stock"}`,eta(m))):[el("p","m","All medicines are well stocked.")]))}
function profile(){
  const p=$("profile"),host=ME.role==="hosteler",ini=ME.name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
  const c1=el("div","card who"),nm=el("div"),h=el("h2","",ME.name);h.append(el("span","badge",ROLE[ME.role]));
  nm.append(h,el("p","m",`ID: ${ME.sid}`+(ME.program?` · ${ME.program}`:"")));c1.append(el("div","av",ini),nm);
  const c2=el("div","card"),g=el("div","kvs");c2.append(el("h2","",`${ROLE[ME.role]} Identity Context`),g);
  g.append(...(host?[["Hostel location",where()],["Warden desk",ME.warden||(ME.hostel?`${ME.hostel} warden desk`:"")],["Academic program",ME.program],["University email",ME.email],["Spotter points",String(ME.points)]]:[["ID",ME.sid],["Role",ROLE[ME.role]],["Email",ME.email]]).map(([k,v])=>kv(k,v)));
  const c4=el("div","card who sp"),t=el("div"),so=el("button","b","Sign out");t.append(el("h2","","Sign out"),el("p","m","You will need your email and password to come back."));so.onclick=out;c4.append(t,so);
  p.replaceChildren(c1,c2);
  if(host){const c3=el("form","card"),f=el("div","kvs");c3.append(el("h2","","Edit my details"),f);
    const fld=(k,lab,ph)=>{const l=el("label","",lab),i=el("input");i.value=ME[k]||"";i.placeholder=ph;l.append(i);f.append(l);return i};
    const H=fld("hostel","Hostel","Hostel C"),R=fld("room","Room","214"),G=fld("program","Academic program","Computer Science & Engineering"),sv=el("button","go","Save details");
    c3.append(sv);c3.onsubmit=async e=>{e.preventDefault();await api("/api/me/details",{hostel:H.value,room:R.value,program:G.value});
      Object.assign(ME,{hostel:H.value.trim(),room:R.value.trim(),program:G.value.trim()});chrome();profile()};p.append(c3)}
  p.append(c4)}

const LOAD={home,report,issues,hostel,alerts,profile,pharmacy:setupPharmacy({api,el,getMe:()=>ME})};
onAuthStateChanged(auth,async u=>{
  if(!u){location.href="/login.html";return}
  ME=await api("/api/me");
  if(ME.error){await signOut(auth);location.href="/login.html";return}
  $("ws").textContent=WS[ME.role];chrome();
  $("nv").replaceChildren(...NAV[ME.role].map(([t,l,i])=>{const b=el("button");b.dataset.t=t;b.append(icon(i),document.createTextNode(l));b.onclick=()=>show(t);return b}));
  show(NAV[ME.role][0][0])});
