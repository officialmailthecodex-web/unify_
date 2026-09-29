const LABEL={available:"In stock",low:"Low stock",out:"Out of stock"};
const ILL=["Fever","Cold","Cough","Pain","Stomach","Acidity","Allergy","Asthma","Wound"];
const days=d=>Math.round((new Date(d+"T00:00")-new Date(new Date().toDateString()))/864e5);
const nice=d=>new Date(d+"T00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short"});
const when=t=>new Date(t*1000).toLocaleDateString("en-IN",{day:"numeric",month:"short"})+" "+new Date(t*1000).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});
export function eta(m){
  if(m.status==="available")return "";
  if(!m.restock_date)return "Restock date not confirmed yet. Ask at the pharmacy counter.";
  const n=days(m.restock_date);
  if(n<0)return `Fresh stock was due ${nice(m.restock_date)} and has not arrived yet. Ask at the pharmacy counter.`;
  return `${m.status==="out"?"Expected back":"More stock expected"}: ${n===0?"today":n===1?"tomorrow":`${nice(m.restock_date)} (in ${n} days)`}.`}
export function setupPharmacy({api,el,getMe}){
  const sec=el("section");sec.id="pharmacy";sec.hidden=true;document.querySelector("main").append(sec);
  let data=[],logs=[],q="",f="all";const isP=()=>getMe().role==="pharmacy";
  const title=el("h2","","College pharmacy"),sum=el("div"),
    note=el("p","m","Take medicines only as advised by a doctor or the pharmacist. Medical emergency: call 108 or 112."),
    s=el("input"),ill=el("div","fl"),fl=el("div","fl"),list=el("div","meds"),adm=el("div"),act=el("div");
  s.type="search";s.placeholder="Search a medicine or an illness, e.g. paracetamol, fever";s.setAttribute("aria-label","Search medicines");
  sec.append(title,sum,note,s,ill,fl,list,adm,act);
  s.oninput=()=>{q=s.value.toLowerCase();draw()};
  const field=(lab,props)=>{const l=el("label","mini",lab),i=el("input");Object.assign(i,props);l.append(i);return[l,i]};
  const save=(url,body,msg)=>api(url,body).then(x=>x.error?(msg.textContent=x.error):load());
  function card(m){
    const d=el("div","med s-"+m.status),h=el("div","mh");h.append(el("h3","",m.name),el("span","pill s-"+m.status,LABEL[m.status]));
    d.append(h,el("div","m","For: "+m.used_for),el("div","m",`${Math.max(0,m.stock)} ${m.unit} left`+(m.last_received_at?` · last received ${m.last_received_qty} on ${when(m.last_received_at).split(" ").slice(0,2).join(" ")}`:"")));
    const e=eta(m);if(e)d.append(el("div","eta",e));
    if(isP()){const r=el("div","medEdit"),msg=el("span","m"),b=el("button","b","Save");
      const [a,rc]=field("Received",{type:"number",min:0}),[g,gv]=field("Given out",{type:"number",min:0}),[x,ex]=field("Set exact count",{type:"number",min:0}),
            [u,uf]=field("Used for",{type:"text",value:m.used_for}),[t,dt]=field("Next stock date",{type:"date",value:m.restock_date||""});
      b.onclick=()=>save("/api/medicines/"+m.id,{received:rc.value,given:gv.value,stock:ex.value,used_for:uf.value,restock_date:dt.value},msg);
      r.append(a,g,x,u,t,b,msg);d.append(r)}
    return d}
  function draw(){
    ill.replaceChildren(el("span","m","Find by illness:"),...ILL.map(w=>{const b=el("button","b"+(q===w.toLowerCase()?" on":""),w);b.onclick=()=>{q=q===w.toLowerCase()?"":w.toLowerCase();s.value=q;draw()};return b}));
    fl.replaceChildren(...[["all","All"],["available","In stock"],["low","Low"],["out","Out of stock"]].map(([k,l])=>{const b=el("button","b"+(f===k?" on":""),l);b.onclick=()=>{f=k;draw()};return b}));
    const r=data.filter(m=>(f==="all"||m.status===f)&&(m.name+" "+m.category+" "+m.used_for).toLowerCase().includes(q));
    list.replaceChildren(...(r.length?r.map(card):[el("p","m","No medicine matches. Ask at the pharmacy counter.")]))}
  function desk(){sum.replaceChildren();adm.replaceChildren();act.replaceChildren();title.textContent=isP()?"Pharmacy desk":"College pharmacy";if(!isP())return;
    const wk=Date.now()/1000-7*86400,rec=logs.filter(l=>l.type==="received"&&l.at>wk).reduce((a,l)=>a+l.qty,0),c=k=>data.filter(m=>m.status===k).length;
    sum.className="stats";sum.append(...[["Medicines listed",data.length],["In stock",c("available")],["Low stock",c("low")],["Out of stock",c("out")],["Received this week",rec]].map(([k,v])=>{const d=el("div");d.append(el("b","",v),el("span","m",k));return d}));
    const dt=el("details"),f2=el("div","medEdit"),ins={},msg=el("span","m");dt.append(el("summary","","Add a new medicine"),f2);
    [["name","Name","text"],["used_for","Used for (illnesses)","text"],["category","Type (e.g. Antibiotic)","text"],["stock","Stock","number"],["unit","Unit","text"],["restock_date","","date"]].forEach(([k,p,t])=>{const i=el("input");i.type=t;i.placeholder=p;i.setAttribute("aria-label",p||"Next stock date");ins[k]=i;f2.append(i)});
    const b=el("button","b","Add medicine");b.onclick=()=>save("/api/medicines",Object.fromEntries(Object.entries(ins).map(([k,i])=>[k,i.value])),msg);f2.append(b,msg);adm.append(dt);
    const V={received:l=>`+${l.qty} received`,given:l=>`${l.qty} given out`,set:l=>`count set to ${l.qty}`,added:l=>`added with ${l.qty}`};
    act.append(el("h2","","Recent stock activity"),...(logs.length?logs.slice(0,12).map(l=>el("div","m",`${when(l.at)} · ${l.med}: ${V[l.type](l)} · now ${l.stock_after} · ${l.by}`)):[el("p","m","No activity yet.")]))}
  async function load(){data=await api("/api/medicines");logs=isP()?await api("/api/medicines/log"):[];desk();draw()}
  return load}
