import { useState, useMemo, useCallback, useEffect } from "react";
import Papa from "papaparse";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

const P=["#D4845A","#5B8A72","#C2785C","#6B94B0","#A67B5B","#7BA68A","#CC9966","#5F8FA0","#B8896B","#6DAD8A","#D4A06A","#7CAAB0","#9E7B6B","#85B89A","#C49470"];
const KC={A:"#D4845A",B:"#5B8A72",C:"#C2785C",D:"#6B94B0",E:"#A67B5B",F:"#7BA68A",G:"#CC9966","Ab":"#D4845A","A#":"#D4845A","Bb":"#5B8A72","C#":"#C2785C","Db":"#6B94B0","D#":"#A67B5B","Eb":"#7BA68A","F#":"#CC9966","G#":"#5F8FA0","Gb":"#5F8FA0"};
const pD=d=>{if(!d)return null;const p=String(d).split("-");if(p.length===3)return new Date(+p[0],+p[1]-1,+p[2]);return null;};
const fD=d=>{const dt=pD(d);return dt?dt.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):String(d||"");};
const $="'DM Sans',sans-serif";
const CD={background:"rgba(250,247,242,0.03)",borderRadius:14,padding:22,border:"1px solid rgba(250,247,242,0.06)"};
const SL={background:"rgba(250,247,242,0.05)",border:"1px solid rgba(250,247,242,0.08)",borderRadius:7,color:"#faf7f2",padding:"7px 11px",fontSize:12,outline:"none",fontFamily:$};
const TH0={textAlign:"left",padding:"8px 10px",borderBottom:"1px solid rgba(250,247,242,0.08)",color:"rgba(250,247,242,0.35)",fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:.5};
const TD={padding:"7px 10px",color:"rgba(250,247,242,0.6)"};
const tg=(c,bg)=>({background:bg||"rgba(250,247,242,0.04)",borderRadius:5,padding:"2px 9px",fontSize:12,fontWeight:600,color:c||"rgba(250,247,242,0.55)",display:"inline-block"});
const lk={cursor:"pointer",textDecoration:"underline",textDecorationColor:"rgba(250,247,242,0.2)",textUnderlineOffset:2};
const CT=({active,payload,label})=>active&&payload?.length?<div style={{background:"#1c1917",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#fff"}}><div style={{fontWeight:600,marginBottom:3}}>{label}</div>{payload.map((p,i)=><div key={i} style={{color:p.color||P[0]}}>{p.name}: {p.value}</div>)}</div>:null;

// Date range helpers
function getDatePresets(){
  const now=new Date();
  const fmt=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const today=fmt(now);
  const daysAgo=n=>{const d=new Date(now);d.setDate(d.getDate()-n);return fmt(d);};
  const monthsAgo=n=>{const d=new Date(now);d.setMonth(d.getMonth()-n);return fmt(d);};
  return[
    {label:"All Time",from:null,to:null},
    {label:"Last 7 Days",from:daysAgo(7),to:today},
    {label:"Last 30 Days",from:daysAgo(30),to:today},
    {label:"Last 3 Months",from:monthsAgo(3),to:today},
    {label:"Last 6 Months",from:monthsAgo(6),to:today},
    {label:"Last Year",from:monthsAgo(12),to:today},
  ];
}

function useSort(defaultField,defaultDir="desc"){
  const [s,setS]=useState({f:defaultField,d:defaultDir});
  const toggle=useCallback(f=>setS(prev=>({f,d:prev.f===f&&prev.d==="desc"?"asc":"desc"})),[]);
  const th=useCallback((label,field)=>({
    children:<>{label}{s.f===field?(s.d==="desc"?" ↓":" ↑"):""}</>,
    onClick:()=>toggle(field),
    style:{...TH0,cursor:"pointer",userSelect:"none",color:s.f===field?"#D4845A":"rgba(250,247,242,0.35)"}
  }),[s,toggle]);
  const sort=useCallback((arr,getVal)=>{const m=s.d==="asc"?1:-1;
    return[...arr].sort((a,b)=>{const va=getVal(a,s.f),vb=getVal(b,s.f);
      if(typeof va==="number"&&typeof vb==="number")return m*(va-vb);
      return m*String(va||"").localeCompare(String(vb||""));});},[s]);
  return{s,th,sort};
}

export default function App(){
  const [data,setData]=useState(null);
  const [photos,setPhotos]=useState({});
  const [view,setView]=useState("overview");
  const [lf,setLf]=useState("All");
  const [kf,setKf]=useState("All");
  const [search,setSearch]=useState("");
  const [sel,setSel]=useState({type:null,val:null,extra:null});
  const [loading,setLoading]=useState(true);
  // Date range state
  const [datePreset,setDatePreset]=useState("All Time");
  const [dateFrom,setDateFrom]=useState("");
  const [dateTo,setDateTo]=useState("");
  const [showCustomDate,setShowCustomDate]=useState(false);

  const songS=useSort("count");
  const histS=useSort("date");
  const ldrSongS=useSort("count");
  const ldrHistS=useSort("date");
  const songHistS=useSort("date");
  const keySongS=useSort("count");
  const rosterS=useSort("date");
  const go=(t,v,extra)=>{setSel({type:t,val:v,extra:extra||null});window.scrollTo(0,0);};
  const back=()=>setSel({type:null,val:null,extra:null});

  const loadCSV=(text)=>{
    const r=Papa.parse(text,{header:true,skipEmptyLines:true});const h=r.meta.fields||[];
    const bc=h.filter(x=>x.startsWith("Band:"));const pc=h.filter(x=>x.startsWith("Prod:"));
    setData({rows:r.data.map(r=>({date:r["Date"]||"",title:r["Song Title"]||"",key:r["Key"]||"",arrangement:r["Arrangement"]||"",leader1:r["Song Leader 1"]||"",leader2:r["Song Leader 2"]||"",author:r["Author"]||"",ccli:r["CCLI #"]||"",desc:r["Raw Description"]||"",
      band:bc.reduce((o,c)=>{if(r[c])o[c.replace("Band: ","")]=r[c];return o;},{}),prod:pc.reduce((o,c)=>{if(r[c])o[c.replace("Prod: ","")]=r[c];return o;},{})})),bandCols:bc.map(c=>c.replace("Band: ","")),prodCols:pc.map(c=>c.replace("Prod: ",""))});
  };

  useEffect(()=>{
    Promise.all([
      fetch("/data.csv").then(r=>r.ok?r.text():null).catch(()=>null),
      fetch("/photos.csv").then(r=>r.ok?r.text():null).catch(()=>null),
    ]).then(([csv,photosCsv])=>{
      if(csv)loadCSV(csv);
      if(photosCsv){
        const pr=Papa.parse(photosCsv,{header:true,skipEmptyLines:true});
        const pm={};pr.data.forEach(r=>{if(r["Photo URL"]&&!r["Photo URL"].includes("/initials/"))pm[r["Name"]]=r["Photo URL"];});
        setPhotos(pm);
      }
      setLoading(false);
    });
  },[]);

  const handleDatePreset=(label)=>{
    setDatePreset(label);
    if(label==="Custom"){setShowCustomDate(true);return;}
    setShowCustomDate(false);
    const presets=getDatePresets();
    const p=presets.find(x=>x.label===label);
    if(p){setDateFrom(p.from||"");setDateTo(p.to||"");}
  };

  const filtered=useMemo(()=>{
    if(!data)return[];
    let r=[...data.rows];
    if(dateFrom)r=r.filter(x=>x.date>=dateFrom);
    if(dateTo)r=r.filter(x=>x.date<=dateTo);
    if(lf!=="All")r=r.filter(x=>x.leader1===lf||x.leader2===lf);
    if(kf!=="All")r=r.filter(x=>x.key===kf);
    if(search)r=r.filter(x=>x.title.toLowerCase().includes(search.toLowerCase()));
    return r;
  },[data,lf,kf,search,dateFrom,dateTo]);

  const stats=useMemo(()=>{
    if(!filtered.length)return null;
    const sc={},sk={},slp={},sld={},kc={},lc={},mc={},upm={},sa={};
    filtered.forEach(r=>{sc[r.title]=(sc[r.title]||0)+1;const d=r.date;if(d&&(!slp[r.title]||d>slp[r.title]))slp[r.title]=d;
      if(r.key){kc[r.key]=(kc[r.key]||0)+1;if(!sk[r.title])sk[r.title]={};sk[r.title][r.key]=(sk[r.title][r.key]||0)+1;}
      [r.leader1,r.leader2].filter(Boolean).forEach(l=>{lc[l]=(lc[l]||0)+1;if(!sld[r.title])sld[r.title]={};sld[r.title][l]=(sld[r.title][l]||0)+1;});
      if(r.arrangement)sa[r.title]=r.arrangement;
      if(d){const mk=d.slice(0,7);mc[mk]=(mc[mk]||0)+1;if(!upm[mk])upm[mk]=new Set();upm[mk].add(r.title);}});
    return{total:filtered.length,uniqueSongs:Object.keys(sc).length,uniqueLeaders:Object.keys(lc).length,
      topSongs:Object.entries(sc).sort((a,b)=>b[1]-a[1]).map(([t,c])=>({title:t,count:c,lastPlayed:slp[t]||"",arrangement:sa[t]||"",topKey:sk[t]?Object.entries(sk[t]).sort((a,b)=>b[1]-a[1])[0]?.[0]||"":"",topLeader:sld[t]?Object.entries(sld[t]).sort((a,b)=>b[1]-a[1])[0]?.[0]||"":""})),
      keyData:Object.entries(kc).sort((a,b)=>b[1]-a[1]).map(([k,c])=>({key:k,count:c})),
      leaderData:Object.entries(lc).sort((a,b)=>b[1]-a[1]).map(([n,c])=>({name:n,count:c})),
      timeline:Object.entries(mc).sort((a,b)=>a[0].localeCompare(b[0])).map(([m,c])=>({month:m,label:new Date(+m.split("-")[0],+m.split("-")[1]-1,1).toLocaleDateString("en-US",{month:"short",year:"2-digit"}),count:c,unique:(upm[m]||new Set()).size}))};
  },[filtered]);

  const sortedSongs=useMemo(()=>stats?songS.sort(stats.topSongs,(x,f)=>f==="count"?x.count:x[f]||""):[], [stats,songS]);
  const sortedHist=useMemo(()=>filtered.length?histS.sort(filtered,(x,f)=>x[f]||""):[],[filtered,histS]);

  const dateDetail=useMemo(()=>{if(sel.type!=="date"||!data)return null;const rows=data.rows.filter(r=>r.date===sel.val);if(!rows.length)return null;
    return{date:sel.val,songs:rows,band:rows[0].band,prod:rows[0].prod};},[sel,data]);

  const songDetail=useMemo(()=>{if(sel.type!=="song"||!data)return null;const rows=data.rows.filter(r=>r.title===sel.val);
    const km={},lm={},am={},hist=[];let fp="",lp="";
    rows.forEach(r=>{if(r.key)km[r.key]=(km[r.key]||0)+1;if(r.arrangement)am[r.arrangement]=(am[r.arrangement]||0)+1;[r.leader1,r.leader2].filter(Boolean).forEach(l=>lm[l]=(lm[l]||0)+1);
      hist.push({date:r.date,key:r.key,leader1:r.leader1,leader2:r.leader2,arrangement:r.arrangement});if(!fp||r.date<fp)fp=r.date;if(!lp||r.date>lp)lp=r.date;});
    return{title:sel.val,total:rows.length,author:rows[0]?.author||"",ccli:rows[0]?.ccli||"",arrangement:rows[0]?.arrangement||"",firstPlayed:fp,lastPlayed:lp,
      keys:Object.entries(km).sort((a,b)=>b[1]-a[1]).map(([k,c])=>({key:k,count:c})),leaders:Object.entries(lm).sort((a,b)=>b[1]-a[1]).map(([n,c])=>({name:n,count:c})),
      arrangements:Object.entries(am).sort((a,b)=>b[1]-a[1]).map(([n,c])=>({name:n,count:c})),history:hist};},[sel,data]);

  const leaderDetail=useMemo(()=>{if(sel.type!=="leader"||!data)return null;const nm=sel.val;const rows=data.rows.filter(r=>r.leader1===nm||r.leader2===nm);
    const sm={},km={},cm={};const hist=[];
    rows.forEach(r=>{if(!sm[r.title])sm[r.title]={count:0,keys:{},dates:[],co:{},arr:r.arrangement||""};sm[r.title].count++;
      if(r.key)sm[r.title].keys[r.key]=(sm[r.title].keys[r.key]||0)+1;sm[r.title].dates.push(r.date);if(r.key)km[r.key]=(km[r.key]||0)+1;
      const ot=r.leader1===nm?r.leader2:(r.leader1||"");if(ot&&ot!==nm){cm[ot]=(cm[ot]||0)+1;sm[r.title].co[ot]=(sm[r.title].co[ot]||0)+1;}
      let co="";if(r.leader1&&r.leader2)co=r.leader1===nm?r.leader2:r.leader1;
      hist.push({date:r.date,title:r.title,key:r.key,coLeader:co,arrangement:r.arrangement});});
    return{name:nm,totalSongs:rows.length,uniqueSongs:Object.keys(sm).length,
      songs:Object.entries(sm).sort((a,b)=>b[1].count-a[1].count).map(([t,d])=>({title:t,count:d.count,arrangement:d.arr,keys:Object.entries(d.keys).sort((a,b)=>b[1]-a[1]).map(([k,c])=>({key:k,count:c})),lastDate:d.dates.sort().reverse()[0],coLeaders:Object.entries(d.co).sort((a,b)=>b[1]-a[1]).map(([n,c])=>({name:n,count:c})),coLeadName:Object.entries(d.co).sort((a,b)=>b[1]-a[1])[0]?.[0]||""})),
      keys:Object.entries(km).sort((a,b)=>b[1]-a[1]).map(([k,c])=>({key:k,count:c})),history:hist,
      coLeaders:Object.entries(cm).sort((a,b)=>b[1]-a[1]).map(([n,c])=>({name:n,count:c})),
      soloCount:rows.filter(r=>!(r.leader1&&r.leader2)).length,duetCount:rows.filter(r=>r.leader1&&r.leader2).length};},[sel,data]);

  const artistDetail=useMemo(()=>{if(sel.type!=="artist"||!data)return null;const rows=data.rows.filter(r=>r.arrangement===sel.val);
    const sm={},km={},lm={};rows.forEach(r=>{sm[r.title]=(sm[r.title]||0)+1;if(r.key)km[r.key]=(km[r.key]||0)+1;[r.leader1,r.leader2].filter(Boolean).forEach(l=>lm[l]=(lm[l]||0)+1);});
    return{name:sel.val,total:rows.length,songs:Object.entries(sm).sort((a,b)=>b[1]-a[1]).map(([t,c])=>({title:t,count:c})),keys:Object.entries(km).sort((a,b)=>b[1]-a[1]).map(([k,c])=>({key:k,count:c})),leaders:Object.entries(lm).sort((a,b)=>b[1]-a[1]).map(([n,c])=>({name:n,count:c}))};},[sel,data]);

  const keyDetail=useMemo(()=>{
    if(sel.type!=="key"||!data)return null;
    const k=sel.val;const rows=filtered.filter(r=>r.key===k);
    const sm={},lm={};
    rows.forEach(r=>{
      if(!sm[r.title])sm[r.title]={count:0,arrangement:r.arrangement||"",lastPlayed:"",leaders:{},topLeader:""};
      sm[r.title].count++;
      if(r.date>sm[r.title].lastPlayed)sm[r.title].lastPlayed=r.date;
      [r.leader1,r.leader2].filter(Boolean).forEach(l=>{lm[l]=(lm[l]||0)+1;sm[r.title].leaders[l]=(sm[r.title].leaders[l]||0)+1;});
    });
    return{key:k,total:rows.length,uniqueSongs:Object.keys(sm).length,
      songs:Object.entries(sm).sort((a,b)=>b[1].count-a[1].count).map(([t,d])=>({title:t,count:d.count,arrangement:d.arrangement,lastPlayed:d.lastPlayed,topLeader:Object.entries(d.leaders).sort((a,b)=>b[1]-a[1])[0]?.[0]||""})),
      leaders:Object.entries(lm).sort((a,b)=>b[1]-a[1]).map(([n,c])=>({name:n,count:c}))};
  },[sel,data,filtered]);

  const leaderFilteredList=useMemo(()=>{
    if(sel.type!=="leaderFilter"||!data||!sel.extra)return null;
    const nm=sel.extra.leader;const filter=sel.extra.filter;
    const rows=data.rows.filter(r=>r.leader1===nm||r.leader2===nm);
    let result=[];
    if(filter==="total"){result=rows.map(r=>({date:r.date,title:r.title,key:r.key,leader1:r.leader1,leader2:r.leader2,arrangement:r.arrangement}));}
    else if(filter==="unique"){const seen=new Set();rows.forEach(r=>{if(!seen.has(r.title)){seen.add(r.title);result.push({date:r.date,title:r.title,key:r.key,leader1:r.leader1,leader2:r.leader2,arrangement:r.arrangement});}});}
    else if(filter==="solo"){result=rows.filter(r=>!(r.leader1&&r.leader2)).map(r=>({date:r.date,title:r.title,key:r.key,leader1:r.leader1,leader2:r.leader2,arrangement:r.arrangement}));}
    else if(filter==="coled"){result=rows.filter(r=>r.leader1&&r.leader2).map(r=>({date:r.date,title:r.title,key:r.key,leader1:r.leader1,leader2:r.leader2,arrangement:r.arrangement}));}
    return{leader:nm,filter,title:filter==="total"?"All Songs Led":filter==="unique"?"Unique Songs":filter==="solo"?"Solo Songs":"Co-Led Songs",rows:result};
  },[sel,data]);

  const allLeaders=useMemo(()=>{if(!data)return[];const s=new Set();data.rows.forEach(r=>{if(r.leader1)s.add(r.leader1);if(r.leader2)s.add(r.leader2);});return["All",...Array.from(s).sort()];},[data]);
  const allKeys=useMemo(()=>{if(!data)return[];const s=new Set();data.rows.forEach(r=>{if(r.key)s.add(r.key);});return["All",...Array.from(s).sort()];},[data]);

  const KL=({data:kd,clickable})=><div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center",marginTop:8}}>{kd.map((e,i)=><div key={i} onClick={clickable?()=>go("key",e.key):undefined} style={{display:"flex",alignItems:"center",gap:4,fontSize:12,fontFamily:$,color:"rgba(250,247,242,0.5)",cursor:clickable?"pointer":"default"}} onMouseEnter={clickable?ev=>ev.currentTarget.style.color="#faf7f2":undefined} onMouseLeave={clickable?ev=>ev.currentTarget.style.color="rgba(250,247,242,0.5)":undefined}><div style={{width:10,height:10,borderRadius:3,background:KC[e.key]||P[i%P.length]}}/>{e.key} ({e.count})</div>)}</div>;
  const HBar=({data:d,labelKey,valKey,valName,onItemClick,height})=>(
    <ResponsiveContainer width="100%" height={height||Math.max(150,d.length*34)}>
      <BarChart data={d} layout="vertical" margin={{left:140,right:16}} onClick={e=>{if(e&&e.activeLabel)onItemClick(e.activeLabel)}} style={{cursor:"pointer"}}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(250,247,242,0.05)"/>
        <XAxis type="number" tick={{fill:"rgba(250,247,242,0.35)",fontSize:11,fontFamily:$}} allowDecimals={false}/>
        <YAxis type="category" dataKey={labelKey} tick={{fill:"rgba(250,247,242,0.55)",fontSize:12,fontFamily:$}} width={130}/>
        <Tooltip content={<CT/>}/><Bar dataKey={valKey} name={valName} radius={[0,5,5,0]} cursor="pointer">{d.map((_,i)=><Cell key={i} fill={P[i%P.length]}/>)}</Bar>
      </BarChart></ResponsiveContainer>);
  const leaders2=r=>[r.leader1,r.leader2].filter(Boolean).map((l,li)=><span key={li}>{li>0&&" & "}<span onClick={()=>go("leader",l)} style={{color:"rgba(250,247,242,0.5)",...lk}}>{l}</span></span>);
  const keyBadge=k=>k?<span onClick={()=>go("key",k)} style={{...tg(KC[k]||"#aaa",`${KC[k]||"#666"}22`),cursor:"pointer"}}>{k}</span>:null;
  const artistLink=a=>a?<span onClick={()=>go("artist",a)} style={{color:"rgba(250,247,242,0.35)",fontSize:12,...lk}}>{a}</span>:null;
  const songLink=t=><span onClick={()=>go("song",t)} style={{...lk,color:"#faf7f2",fontWeight:500,fontFamily:"'Newsreader',serif"}}>{t}</span>;
  const dateLink=d=><span onClick={()=>go("date",d)} style={{...lk,color:"rgba(250,247,242,0.6)",whiteSpace:"nowrap"}}>{fD(d)}</span>;
  const avatar=name=>{const url=photos[name];return url?<img src={url} alt="" style={{width:32,height:32,borderRadius:16,objectFit:"cover",flexShrink:0}}/>:<div style={{width:32,height:32,borderRadius:16,background:"rgba(250,247,242,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"rgba(250,247,242,0.3)",fontFamily:$,flexShrink:0}}>{(name||"?")[0]}</div>;};

  const StatCard=({label,value,color,onClick,small})=>(
    <div onClick={onClick} style={{...CD,textAlign:"center",flex:1,minWidth:small?110:130,cursor:onClick?"pointer":"default",transition:"border-color .2s"}}
      onMouseEnter={onClick?e=>e.currentTarget.style.borderColor="rgba(212,132,90,0.3)":undefined}
      onMouseLeave={onClick?e=>e.currentTarget.style.borderColor="rgba(250,247,242,0.06)":undefined}>
      <div style={{fontSize:small?32:34,fontWeight:500,color}}>{value}</div>
      <div style={{fontSize:12,color:"rgba(250,247,242,0.35)",fontFamily:$}}>{label}</div>
      {onClick&&<div style={{fontSize:10,color:"rgba(250,247,242,0.2)",fontFamily:$,marginTop:4}}>Click to view</div>}
    </div>
  );

  const DateRangeFilter=()=>{
    const presetLabels=["All Time","Last 7 Days","Last 30 Days","Last 3 Months","Last 6 Months","Last Year","Custom"];
    return(
      <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
        <select value={showCustomDate?"Custom":datePreset} onChange={e=>handleDatePreset(e.target.value)} style={SL}>
          {presetLabels.map(l=><option key={l} value={l}>{l}</option>)}
        </select>
        {showCustomDate&&<>
          <input type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setDatePreset("Custom");}} style={{...SL,width:140}} />
          <span style={{color:"rgba(250,247,242,0.3)",fontSize:11}}>to</span>
          <input type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value);setDatePreset("Custom");}} style={{...SL,width:140}} />
        </>}
      </div>
    );
  };

  if(loading)return <div style={{minHeight:"100vh",background:"#1c1917",display:"flex",alignItems:"center",justifyContent:"center",color:"#D4845A",fontFamily:$,fontSize:16}}>Loading worship data...</div>;

  if(!data)return(
    <div style={{minHeight:"100vh",background:"#1c1917",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Newsreader',Georgia,serif",padding:20}}>
      <link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet"/>
      <div style={{background:"rgba(255,255,255,0.02)",border:"1.5px dashed rgba(255,255,255,0.12)",borderRadius:20,padding:"56px 44px",textAlign:"center",maxWidth:480,width:"100%"}}>
        <div style={{fontSize:13,letterSpacing:3,textTransform:"uppercase",color:"#D4845A",marginBottom:20,fontFamily:$,fontWeight:600}}>Worship Dashboard</div>
        <h1 style={{color:"#faf7f2",fontSize:32,margin:"0 0 10px",fontWeight:400}}>Upload Data</h1>
        <p style={{color:"rgba(250,247,242,0.4)",margin:"0 0 32px",fontSize:15,fontFamily:$}}>No data.csv found. Upload your CSV export.</p>
        <label style={{display:"inline-block",background:"#D4845A",color:"#1c1917",fontWeight:600,fontSize:14,padding:"13px 30px",borderRadius:10,cursor:"pointer",fontFamily:$}}>
          Choose .csv File<input type="file" accept=".csv" style={{display:"none"}} onChange={e=>{if(e.target.files[0])e.target.files[0].text().then(loadCSV)}}/></label>
      </div></div>);

  const wrap=inner=><div style={{minHeight:"100vh",background:"#1c1917",fontFamily:"'Newsreader',Georgia,serif",color:"#faf7f2"}}>
    <link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet"/>{inner}</div>;
  const hdr=(title,sub,name)=>(<div style={{padding:"16px 24px",borderBottom:"1px solid rgba(250,247,242,0.06)",display:"flex",alignItems:"center",gap:14}}>
    <button onClick={back} style={{background:"rgba(250,247,242,0.06)",border:"none",borderRadius:7,padding:"7px 14px",cursor:"pointer",color:"rgba(250,247,242,0.6)",fontSize:13,fontFamily:$}}>← Back</button>
    {name&&avatar(name)}
    <div><span style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",color:"#D4845A",fontFamily:$,fontWeight:600}}>{sub}</span><h1 style={{fontSize:22,fontWeight:400,margin:"2px 0 0"}}>{title}</h1></div></div>);

  // ===== DETAIL VIEWS =====

  // KEY DETAIL
  if(sel.type==="key"&&keyDetail){const kd=keyDetail;
    const sortedKS=keySongS.sort(kd.songs,(x,f)=>{if(f==="count")return x.count;if(f==="title")return x.title;if(f==="lastPlayed")return x.lastPlayed;if(f==="topLeader")return x.topLeader;return x[f]||"";});
    return wrap(<>{hdr(`Key of ${kd.key}`,"Key Detail")}
    <div style={{padding:24,maxWidth:1200,margin:"0 auto",display:"flex",flexDirection:"column",gap:22}}>
      <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
        <StatCard label="Times Played" value={kd.total} color={KC[kd.key]||"#D4845A"}/>
        <StatCard label="Unique Songs" value={kd.uniqueSongs} color="#5B8A72"/>
        <StatCard label="Leaders" value={kd.leaders.length} color="#6B94B0"/>
      </div>
      <div style={{display:"flex",gap:22,flexWrap:"wrap"}}>
        <div style={{...CD,flex:2,minWidth:300}}><h3 style={{margin:"0 0 14px",fontWeight:400,fontSize:17}}>Songs in {kd.key}</h3>
          <HBar data={kd.songs.slice(0,15)} labelKey="title" valKey="count" valName="Times Played" onItemClick={t=>go("song",t)} height={Math.max(200,Math.min(kd.songs.length,15)*32)}/></div>
        <div style={{...CD,flex:1,minWidth:220}}><h3 style={{margin:"0 0 14px",fontWeight:400,fontSize:17}}>Leaders in This Key</h3>
          {kd.leaders.map((l,i)=><div key={i} onClick={()=>go("leader",l.name)} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:"1px solid rgba(250,247,242,0.04)",cursor:"pointer"}}>
            {avatar(l.name)}<span style={{fontSize:13,color:"rgba(250,247,242,0.6)",fontFamily:$,flex:1}}>{l.name}</span>
            <span style={{fontSize:12,color:"rgba(250,247,242,0.35)",fontFamily:$}}>{l.count}</span></div>)}</div>
      </div>
      <div style={CD}><h3 style={{margin:"0 0 14px",fontWeight:400,fontSize:17}}>All Songs ({kd.songs.length})</h3>
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13,fontFamily:$}}>
          <thead><tr><th {...keySongS.th("Song","title")}/><th {...keySongS.th("Artist","arrangement")}/><th {...keySongS.th("Qty","count")}/><th {...keySongS.th("Last Played","lastPlayed")}/><th {...keySongS.th("Top Leader","topLeader")}/></tr></thead>
          <tbody>{sortedKS.map((x,i)=><tr key={i} style={{borderBottom:"1px solid rgba(250,247,242,0.04)"}}>
            <td style={TD}>{songLink(x.title)}</td><td style={TD}>{artistLink(x.arrangement)}</td>
            <td style={TD}><span style={tg("#D4845A","rgba(212,132,90,0.12)")}>{x.count}</span></td>
            <td style={{...TD,fontSize:12,color:"rgba(250,247,242,0.4)"}}>{fD(x.lastPlayed)}</td>
            <td style={TD}><span onClick={()=>x.topLeader&&go("leader",x.topLeader)} style={{color:"rgba(250,247,242,0.5)",...(x.topLeader?lk:{})}}>{x.topLeader}</span></td>
          </tr>)}</tbody></table></div></div>
    </div></>);}

  // LEADER FILTERED LIST
  if(sel.type==="leaderFilter"&&leaderFilteredList){const lfl=leaderFilteredList;
    return wrap(<>{hdr(`${lfl.title} — ${lfl.leader}`,"Leader Detail",lfl.leader)}
    <div style={{padding:24,maxWidth:1200,margin:"0 auto",display:"flex",flexDirection:"column",gap:22}}>
      <div style={CD}><h3 style={{margin:"0 0 14px",fontWeight:400,fontSize:17}}>{lfl.title} ({lfl.rows.length})</h3>
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13,fontFamily:$}}>
          <thead><tr><th style={TH0}>Date</th><th style={TH0}>Song</th><th style={TH0}>Key</th><th style={TH0}>Leader(s)</th><th style={TH0}>Arrangement</th></tr></thead>
          <tbody>{lfl.rows.sort((a,b)=>b.date.localeCompare(a.date)).map((r,i)=><tr key={i} style={{borderBottom:"1px solid rgba(250,247,242,0.04)"}}>
            <td style={TD}>{dateLink(r.date)}</td><td style={TD}>{songLink(r.title)}</td><td style={TD}>{keyBadge(r.key)}</td>
            <td style={TD}>{leaders2(r)}</td><td style={{...TD,color:"rgba(250,247,242,0.3)",fontSize:12}}>{r.arrangement}</td></tr>)}</tbody></table></div></div>
    </div></>);}

  // ARTIST
  if(sel.type==="artist"&&artistDetail){const ad=artistDetail;return wrap(<>{hdr(ad.name,"Artist")}
    <div style={{padding:24,maxWidth:1200,margin:"0 auto",display:"flex",flexDirection:"column",gap:22}}>
      <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
        <StatCard label="Times Played" value={ad.total} color="#D4845A"/>
        <StatCard label="Songs" value={ad.songs.length} color="#5B8A72"/>
        <StatCard label="Leaders" value={ad.leaders.length} color="#6B94B0"/>
      </div>
      <div style={{display:"flex",gap:22,flexWrap:"wrap"}}>
        <div style={{...CD,flex:1,minWidth:260}}><h3 style={{margin:"0 0 14px",fontWeight:400,fontSize:17}}>Songs</h3>
          <HBar data={ad.songs.slice(0,10)} labelKey="title" valKey="count" valName="Plays" onItemClick={t=>go("song",t)}/></div>
        <div style={{...CD,flex:1,minWidth:220}}>
          {ad.keys.length>0&&<><h3 style={{margin:"0 0 14px",fontWeight:400,fontSize:17}}>Keys</h3>
            <ResponsiveContainer width="100%" height={160}><PieChart><Pie data={ad.keys} dataKey="count" nameKey="key" cx="50%" cy="50%" outerRadius={60} innerRadius={25} onClick={(d)=>{if(d&&d.key)go("key",d.key)}} style={{cursor:"pointer"}}>
              {ad.keys.map((e,i)=><Cell key={i} fill={KC[e.key]||P[i%P.length]} style={{cursor:"pointer"}}/>)}</Pie><Tooltip content={<CT/>}/></PieChart></ResponsiveContainer><KL data={ad.keys} clickable/></>}
          <h3 style={{margin:"20px 0 10px",fontWeight:400,fontSize:17}}>Leaders</h3>
          {ad.leaders.map((l,i)=><div key={i} onClick={()=>go("leader",l.name)} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:"1px solid rgba(250,247,242,0.04)",cursor:"pointer"}}>
            {avatar(l.name)}<span style={{fontSize:13,color:"rgba(250,247,242,0.6)",fontFamily:$,flex:1}}>{l.name}</span>
            <span style={{fontSize:12,color:"rgba(250,247,242,0.35)",fontFamily:$}}>{l.count}</span></div>)}
        </div></div></div></>);}

  // DATE
  if(sel.type==="date"&&dateDetail){const dd=dateDetail;return wrap(<>{hdr(fD(dd.date),"Service")}
    <div style={{padding:24,maxWidth:1200,margin:"0 auto",display:"flex",flexDirection:"column",gap:22}}>
      <div style={CD}><h3 style={{margin:"0 0 14px",fontWeight:400,fontSize:17}}>Set List</h3>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,fontFamily:$}}>
          <thead><tr>{["#","Song","Artist","Key","Leader(s)"].map(h=><th key={h} style={TH0}>{h}</th>)}</tr></thead>
          <tbody>{dd.songs.map((s,i)=><tr key={i} style={{borderBottom:"1px solid rgba(250,247,242,0.04)"}}>
            <td style={{...TD,color:"rgba(250,247,242,0.25)",width:30}}>{i+1}</td>
            <td style={TD}>{songLink(s.title)}</td><td style={TD}>{artistLink(s.arrangement)}</td>
            <td style={TD}>{keyBadge(s.key)}</td><td style={TD}>{leaders2(s)}</td></tr>)}</tbody></table></div>
      <div style={{display:"flex",gap:22,flexWrap:"wrap"}}>
        <div style={{...CD,flex:1,minWidth:260}}><h3 style={{margin:"0 0 14px",fontWeight:400,fontSize:17,color:"#D4845A"}}>Band</h3>
          {data.bandCols.map(c=>dd.band[c]?<div key={c} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid rgba(250,247,242,0.04)"}}>
            <span style={{fontSize:12,color:"rgba(250,247,242,0.35)",fontFamily:$,textTransform:"uppercase",letterSpacing:.5}}>{c}</span>
            <div style={{display:"flex",alignItems:"center",gap:6}}>{avatar(dd.band[c])}<span style={{fontSize:13,color:"rgba(250,247,242,0.7)",fontFamily:$}}>{dd.band[c]}</span></div></div>:null)}</div>
        <div style={{...CD,flex:1,minWidth:260}}><h3 style={{margin:"0 0 14px",fontWeight:400,fontSize:17,color:"#6B94B0"}}>Production</h3>
          {data.prodCols.map(c=>dd.prod[c]?<div key={c} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid rgba(250,247,242,0.04)"}}>
            <span style={{fontSize:12,color:"rgba(250,247,242,0.35)",fontFamily:$,textTransform:"uppercase",letterSpacing:.5}}>{c}</span>
            <div style={{display:"flex",alignItems:"center",gap:6}}>{avatar(dd.prod[c])}<span style={{fontSize:13,color:"rgba(250,247,242,0.7)",fontFamily:$}}>{dd.prod[c]}</span></div></div>:null)}</div>
      </div></div></>);}

  // SONG
  if(sel.type==="song"&&songDetail){const sd=songDetail;
    const sorted=songHistS.sort(sd.history,(x,f)=>x[f]||"");
    return wrap(<>{hdr(sd.title,"Song Profile")}
    <div style={{padding:24,maxWidth:1200,margin:"0 auto",display:"flex",flexDirection:"column",gap:22}}>
      <div style={{...CD,padding:"14px 22px",display:"flex",flexWrap:"wrap",gap:16,alignItems:"center"}}>
        {sd.arrangement&&<span onClick={()=>go("artist",sd.arrangement)} style={{fontSize:14,color:"rgba(250,247,242,0.5)",fontFamily:$,...lk}}>{sd.arrangement}</span>}
        {sd.author&&<span style={{fontSize:12,color:"rgba(250,247,242,0.3)",fontFamily:$}}>{sd.author}</span>}
        {sd.ccli&&<span style={{fontSize:12,color:"rgba(250,247,242,0.2)",fontFamily:$}}>CCLI #{sd.ccli}</span>}</div>
      <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
        {[{l:"Times Played",v:sd.total,c:"#D4845A"},{l:"First Played",v:fD(sd.firstPlayed),c:"#5B8A72",s:1},{l:"Last Played",v:fD(sd.lastPlayed),c:"#6B94B0",s:1},{l:"Leaders",v:sd.leaders.length,c:"#A67B5B"}].map((x,i)=>
          <div key={i} style={{...CD,textAlign:"center",flex:1,minWidth:120}}><div style={{fontSize:x.s?16:32,fontWeight:500,color:x.c}}>{x.v}</div><div style={{fontSize:12,color:"rgba(250,247,242,0.35)",fontFamily:$}}>{x.l}</div></div>)}
      </div>
      <div style={{display:"flex",gap:22,flexWrap:"wrap"}}>
        <div style={{...CD,flex:1,minWidth:260}}><h3 style={{margin:"0 0 14px",fontWeight:400,fontSize:17}}>Who Leads This Song</h3>
          {sd.leaders.length>0&&<HBar data={sd.leaders} labelKey="name" valKey="count" valName="Times Led" onItemClick={n=>go("leader",n)}/>}</div>
        <div style={{...CD,flex:1,minWidth:220}}><h3 style={{margin:"0 0 14px",fontWeight:400,fontSize:17}}>Keys</h3>
          {sd.keys.length>0&&<><ResponsiveContainer width="100%" height={160}><PieChart><Pie data={sd.keys} dataKey="count" nameKey="key" cx="50%" cy="50%" outerRadius={60} innerRadius={25} onClick={(d)=>{if(d&&d.key)go("key",d.key)}} style={{cursor:"pointer"}}>
            {sd.keys.map((e,i)=><Cell key={i} fill={KC[e.key]||P[i%P.length]} style={{cursor:"pointer"}}/>)}</Pie><Tooltip content={<CT/>}/></PieChart></ResponsiveContainer><KL data={sd.keys} clickable/></>}</div>
      </div>
      <div style={CD}><h3 style={{margin:"0 0 14px",fontWeight:400,fontSize:17}}>Every Time Played ({sd.history.length})</h3>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,fontFamily:$}}>
          <thead><tr><th {...songHistS.th("Date","date")}/><th {...songHistS.th("Key","key")}/><th {...songHistS.th("Leader(s)","leader1")}/><th {...songHistS.th("Arrangement","arrangement")}/></tr></thead>
          <tbody>{sorted.map((h,i)=><tr key={i} style={{borderBottom:"1px solid rgba(250,247,242,0.04)"}}>
            <td style={TD}>{dateLink(h.date)}</td><td style={TD}>{keyBadge(h.key)}</td><td style={TD}>{leaders2(h)}</td>
            <td style={{...TD,color:"rgba(250,247,242,0.3)",fontSize:12}}>{h.arrangement}</td></tr>)}</tbody></table></div>
    </div></>);}

  // LEADER
  if(sel.type==="leader"&&leaderDetail){const ld=leaderDetail;
    const sortedS=ldrSongS.sort(ld.songs,(x,f)=>{if(f==="count")return x.count;if(f==="title")return x.title;if(f==="lastDate")return x.lastDate;if(f==="coLeadName")return x.coLeadName;return x[f]||"";});
    const sortedH=ldrHistS.sort(ld.history,(x,f)=>x[f]||"");
    const goFilter=(filter)=>go("leaderFilter",filter,{leader:ld.name,filter});
    return wrap(<>{hdr(ld.name,"Leader Profile",ld.name)}
    <div style={{padding:24,maxWidth:1200,margin:"0 auto",display:"flex",flexDirection:"column",gap:22}}>
      <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
        <StatCard label="Total Led" value={ld.totalSongs} color="#D4845A" onClick={()=>goFilter("total")} small/>
        <StatCard label="Unique Songs" value={ld.uniqueSongs} color="#5B8A72" onClick={()=>goFilter("unique")} small/>
        <StatCard label="Solo" value={ld.soloCount} color="#6B94B0" onClick={()=>goFilter("solo")} small/>
        <StatCard label="Co-Led" value={ld.duetCount} color="#A67B5B" onClick={()=>goFilter("coled")} small/>
      </div>
      {ld.coLeaders.length>0&&<div style={CD}><h3 style={{margin:"0 0 12px",fontWeight:400,fontSize:17}}>Co-Leads With</h3>
        <div style={{display:"flex",flexWrap:"wrap",gap:10}}>{ld.coLeaders.map((cl,i)=><div key={i} onClick={()=>go("leader",cl.name)} style={{display:"flex",alignItems:"center",gap:10,background:"rgba(250,247,242,0.04)",borderRadius:10,padding:"10px 16px",cursor:"pointer",border:"1px solid rgba(250,247,242,0.06)"}}
          onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(212,132,90,0.3)"} onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(250,247,242,0.06)"}>
          {avatar(cl.name)}<div><div style={{fontWeight:600,color:P[i%P.length],fontFamily:$,fontSize:14}}>{cl.name}</div>
          <div style={{fontSize:12,color:"rgba(250,247,242,0.35)",fontFamily:$}}>{cl.count} together</div></div></div>)}</div></div>}
      <div style={{display:"flex",gap:22,flexWrap:"wrap"}}>
        <div style={{...CD,flex:2,minWidth:300}}><h3 style={{margin:"0 0 14px",fontWeight:400,fontSize:17}}>Top Songs</h3>
          <HBar data={ld.songs.slice(0,12)} labelKey="title" valKey="count" valName="Times Led" onItemClick={t=>go("song",t)} height={Math.max(200,Math.min(ld.songs.length,12)*32)}/></div>
        <div style={{...CD,flex:1,minWidth:220}}><h3 style={{margin:"0 0 14px",fontWeight:400,fontSize:17}}>Keys</h3>
          <ResponsiveContainer width="100%" height={160}><PieChart><Pie data={ld.keys} dataKey="count" nameKey="key" cx="50%" cy="50%" outerRadius={60} innerRadius={25} onClick={(d)=>{if(d&&d.key)go("key",d.key)}} style={{cursor:"pointer"}}>
            {ld.keys.map((e,i)=><Cell key={i} fill={KC[e.key]||P[i%P.length]} style={{cursor:"pointer"}}/>)}</Pie><Tooltip content={<CT/>}/></PieChart></ResponsiveContainer><KL data={ld.keys} clickable/></div>
      </div>
      <div style={CD}><h3 style={{margin:"0 0 14px",fontWeight:400,fontSize:17}}>All Songs</h3>
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13,fontFamily:$}}>
          <thead><tr><th {...ldrSongS.th("Song","title")}/><th {...ldrSongS.th("Artist","arrangement")}/><th {...ldrSongS.th("Qty","count")}/><th {...ldrSongS.th("Keys","topKey")}/><th {...ldrSongS.th("Co-Led","coLeadName")}/><th {...ldrSongS.th("Last","lastDate")}/></tr></thead>
          <tbody>{sortedS.map((x,i)=><tr key={i} style={{borderBottom:"1px solid rgba(250,247,242,0.04)"}}>
            <td style={TD}>{songLink(x.title)}</td><td style={TD}>{artistLink(x.arrangement)}</td>
            <td style={TD}><span style={tg("#D4845A","rgba(212,132,90,0.12)")}>{x.count}</span></td>
            <td style={TD}><div style={{display:"flex",gap:3,flexWrap:"wrap"}}>{x.keys.map((k,ki)=><span key={ki} onClick={()=>go("key",k.key)} style={{...tg(KC[k.key]||"#aaa",`${KC[k.key]||"#666"}22`),cursor:"pointer"}}>{k.key}{k.count>1?` ×${k.count}`:""}</span>)}</div></td>
            <td style={TD}>{x.coLeaders.length>0?x.coLeaders.map((cl,ci)=><span key={ci} onClick={()=>go("leader",cl.name)} style={{...tg("#A67B5B","rgba(166,123,91,0.12)"),cursor:"pointer",marginRight:3}}>{cl.name}</span>):<span style={{fontSize:12,color:"rgba(250,247,242,0.2)"}}>Solo</span>}</td>
            <td style={{...TD,fontSize:12,color:"rgba(250,247,242,0.4)"}}>{fD(x.lastDate)}</td></tr>)}</tbody></table></div></div>
      <div style={CD}><h3 style={{margin:"0 0 14px",fontWeight:400,fontSize:17}}>History</h3>
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13,fontFamily:$}}>
          <thead><tr><th {...ldrHistS.th("Date","date")}/><th {...ldrHistS.th("Song","title")}/><th {...ldrHistS.th("Key","key")}/><th {...ldrHistS.th("With","coLeader")}/></tr></thead>
          <tbody>{sortedH.map((h,i)=><tr key={i} style={{borderBottom:"1px solid rgba(250,247,242,0.04)"}}>
            <td style={TD}>{dateLink(h.date)}</td><td style={TD}>{songLink(h.title)}</td><td style={TD}>{keyBadge(h.key)}</td>
            <td style={TD}>{h.coLeader?<span onClick={()=>go("leader",h.coLeader)} style={{color:"#A67B5B",...lk,fontFamily:$,fontSize:12}}>{h.coLeader}</span>:<span style={{fontSize:12,color:"rgba(250,247,242,0.2)"}}>Solo</span>}</td></tr>)}</tbody></table></div></div>
    </div></>);}

  // ===== MAIN DASHBOARD =====
  const nav=[{id:"overview",label:"Overview"},{id:"songs",label:"Songs"},{id:"leaders",label:"Leaders"},{id:"keys",label:"Keys"},{id:"timeline",label:"Timeline"},{id:"roster",label:"Roster"},{id:"history",label:"History"}];
  return wrap(<>
    <div style={{padding:"16px 24px",borderBottom:"1px solid rgba(250,247,242,0.06)",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
      <div style={{display:"flex",alignItems:"baseline",gap:10}}><span style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",color:"#D4845A",fontFamily:$,fontWeight:600}}>Worship</span><h1 style={{fontSize:20,fontWeight:400,margin:0}}>Dashboard</h1></div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
        <DateRangeFilter/>
        <select value={lf} onChange={e=>setLf(e.target.value)} style={SL}>{allLeaders.map(l=><option key={l} value={l}>{l==="All"?"All Leaders":l}</option>)}</select>
        <select value={kf} onChange={e=>setKf(e.target.value)} style={SL}>{allKeys.map(k=><option key={k} value={k}>{k==="All"?"All Keys":`Key: ${k}`}</option>)}</select>
        <input type="text" placeholder="Search songs..." value={search} onChange={e=>setSearch(e.target.value)} style={{...SL,width:150}}/>
      </div></div>
    <div style={{display:"flex",gap:2,padding:"10px 24px",borderBottom:"1px solid rgba(250,247,242,0.06)",overflowX:"auto"}}>
      {nav.map(n=><button key={n.id} onClick={()=>setView(n.id)} style={{background:view===n.id?"rgba(212,132,90,0.12)":"transparent",color:view===n.id?"#D4845A":"rgba(250,247,242,0.4)",border:"none",borderRadius:7,padding:"7px 14px",cursor:"pointer",fontSize:13,fontWeight:500,fontFamily:$,whiteSpace:"nowrap"}}>{n.label}</button>)}
    </div>
    <div style={{padding:24,maxWidth:1200,margin:"0 auto"}}>
      {!stats?<div style={{textAlign:"center",padding:60,color:"rgba(250,247,242,0.3)",fontFamily:$}}>No data matches filters</div>

      :view==="overview"?<div style={{display:"flex",flexDirection:"column",gap:22}}>
        <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
          <StatCard label="Songs Played" value={stats.total} color="#D4845A" onClick={()=>setView("history")}/>
          <StatCard label="Unique Songs" value={stats.uniqueSongs} color="#5B8A72" onClick={()=>setView("songs")}/>
          <StatCard label="Leaders" value={stats.uniqueLeaders} color="#6B94B0" onClick={()=>setView("leaders")}/>
          <StatCard label="Keys" value={stats.keyData.length} color="#A67B5B" onClick={()=>setView("keys")}/>
        </div>
        <div style={CD}><h3 style={{margin:"0 0 14px",fontWeight:400,fontSize:17}}>Most Played Songs</h3>
          <HBar data={stats.topSongs.slice(0,10)} labelKey="title" valKey="count" valName="Times Played" onItemClick={t=>go("song",t)} height={320}/></div>
        <div style={{display:"flex",gap:22,flexWrap:"wrap"}}>
          <div style={{...CD,flex:1,minWidth:260}}><h3 style={{margin:"0 0 14px",fontWeight:400,fontSize:17}}>Key Distribution</h3>
            <ResponsiveContainer width="100%" height={200}><PieChart><Pie data={stats.keyData} dataKey="count" nameKey="key" cx="50%" cy="50%" outerRadius={75} innerRadius={38} onClick={(d)=>{if(d&&d.key)go("key",d.key)}} style={{cursor:"pointer"}}>
              {stats.keyData.map((e,i)=><Cell key={i} fill={KC[e.key]||P[i%P.length]} style={{cursor:"pointer"}}/>)}</Pie><Tooltip content={<CT/>}/></PieChart></ResponsiveContainer><KL data={stats.keyData} clickable/></div>
          <div style={{...CD,flex:1,minWidth:260}}><h3 style={{margin:"0 0 14px",fontWeight:400,fontSize:17}}>Song Leaders</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.leaderData.slice(0,8)} margin={{left:0,right:16}} onClick={e=>{if(e&&e.activeLabel)go("leader",e.activeLabel)}} style={{cursor:"pointer"}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(250,247,242,0.05)"/>
                <XAxis dataKey="name" tick={{fill:"rgba(250,247,242,0.5)",fontSize:10,fontFamily:$}} tickFormatter={n=>n.split(" ")[0]}/>
                <YAxis tick={{fill:"rgba(250,247,242,0.35)",fontSize:11,fontFamily:$}}/>
                <Tooltip content={<CT/>}/><Bar dataKey="count" name="Songs Led" radius={[5,5,0,0]} cursor="pointer">{stats.leaderData.slice(0,8).map((_,i)=><Cell key={i} fill={P[i%P.length]}/>)}</Bar>
              </BarChart></ResponsiveContainer></div>
        </div></div>

      :view==="songs"?<div style={CD}><h3 style={{margin:"0 0 14px",fontWeight:400,fontSize:17}}>All Songs ({sortedSongs.length})</h3>
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13,fontFamily:$}}>
          <thead><tr><th {...songS.th("Song","title")}/><th {...songS.th("Artist","arrangement")}/><th {...songS.th("Qty","count")}/><th {...songS.th("Last Played","lastPlayed")}/><th {...songS.th("Key","topKey")}/><th {...songS.th("Top Leader","topLeader")}/></tr></thead>
          <tbody>{sortedSongs.map((x,i)=><tr key={i} style={{borderBottom:"1px solid rgba(250,247,242,0.04)"}}>
            <td style={TD}>{songLink(x.title)}</td><td style={TD}>{artistLink(x.arrangement)}</td>
            <td style={TD}><span style={tg("#D4845A","rgba(212,132,90,0.12)")}>{x.count}</span></td>
            <td style={{...TD,fontSize:12,color:"rgba(250,247,242,0.4)"}}>{fD(x.lastPlayed)}</td>
            <td style={TD}>{keyBadge(x.topKey)}</td>
            <td style={TD}><span onClick={()=>x.topLeader&&go("leader",x.topLeader)} style={{color:"rgba(250,247,242,0.5)",...(x.topLeader?lk:{})}}>{x.topLeader}</span></td>
          </tr>)}</tbody></table></div></div>

      :view==="leaders"?<div style={{display:"flex",flexDirection:"column",gap:22}}>
        <div style={CD}><h3 style={{margin:"0 0 14px",fontWeight:400,fontSize:17}}>Songs Led Per Person</h3>
          <HBar data={stats.leaderData} labelKey="name" valKey="count" valName="Songs Led" onItemClick={n=>go("leader",n)}/></div>
        <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
          {stats.leaderData.map((ld,li)=><div key={li} onClick={()=>go("leader",ld.name)} style={{...CD,display:"flex",alignItems:"center",gap:12,flex:"1 1 250px",minWidth:220,cursor:"pointer",transition:"border-color .2s"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(212,132,90,0.3)"} onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(250,247,242,0.06)"}>
            {avatar(ld.name)}
            <div style={{flex:1}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontWeight:600,color:P[li%P.length],fontFamily:$,fontSize:15}}>{ld.name}</span><span style={tg("#D4845A","rgba(212,132,90,0.12)")}>{ld.count}</span></div>
            <div style={{fontSize:11,color:"#D4845A",fontFamily:$,marginTop:4}}>View profile →</div></div></div>)}
        </div></div>

      :view==="keys"?<div style={{display:"flex",flexDirection:"column",gap:22}}>
        <div style={CD}><h3 style={{margin:"0 0 14px",fontWeight:400,fontSize:17}}>Songs by Key</h3>
          <ResponsiveContainer width="100%" height={300}><BarChart data={stats.keyData} onClick={e=>{if(e&&e.activeLabel)go("key",e.activeLabel)}} style={{cursor:"pointer"}}><CartesianGrid strokeDasharray="3 3" stroke="rgba(250,247,242,0.05)"/>
            <XAxis dataKey="key" tick={{fill:"rgba(250,247,242,0.55)",fontSize:13,fontFamily:$}}/><YAxis tick={{fill:"rgba(250,247,242,0.35)",fontSize:11,fontFamily:$}} allowDecimals={false}/>
            <Tooltip content={<CT/>}/><Bar dataKey="count" name="Songs" radius={[5,5,0,0]} cursor="pointer">{stats.keyData.map((e,i)=><Cell key={i} fill={KC[e.key]||P[i%P.length]}/>)}</Bar></BarChart></ResponsiveContainer></div>
        <div style={CD}><h3 style={{margin:"0 0 14px",fontWeight:400,fontSize:17}}>Songs in Each Key</h3>
          {stats.keyData.map((kd,ki)=>{const sgs={};filtered.forEach(r=>{if(r.key===kd.key)sgs[r.title]=(sgs[r.title]||0)+1;});const allSongs=Object.entries(sgs).sort((a,b)=>b[1]-a[1]);
            return <div key={ki} style={{marginBottom:14}}>
              <div onClick={()=>go("key",kd.key)} style={{fontWeight:600,marginBottom:6,color:KC[kd.key]||P[ki%P.length],fontFamily:$,fontSize:14,cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.textDecoration="underline"} onMouseLeave={e=>e.currentTarget.style.textDecoration="none"}>Key of {kd.key} — {kd.count} plays, {allSongs.length} songs</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>{allSongs.map(([t,c],si)=><span key={si} onClick={()=>go("song",t)} style={{background:"rgba(250,247,242,0.04)",borderRadius:5,padding:"3px 10px",fontSize:12,color:"rgba(250,247,242,0.55)",fontFamily:$,cursor:"pointer"}}>{t} ({c}x)</span>)}</div></div>;})}</div></div>

      :view==="timeline"?<div style={{display:"flex",flexDirection:"column",gap:22}}>
        <div style={CD}><h3 style={{margin:"0 0 14px",fontWeight:400,fontSize:17}}>Songs Per Month</h3>
          <ResponsiveContainer width="100%" height={280}><BarChart data={stats.timeline}><CartesianGrid strokeDasharray="3 3" stroke="rgba(250,247,242,0.05)"/>
            <XAxis dataKey="label" tick={{fill:"rgba(250,247,242,0.4)",fontSize:10,fontFamily:$}} interval={Math.max(0,Math.floor(stats.timeline.length/14))}/><YAxis tick={{fill:"rgba(250,247,242,0.35)",fontSize:11,fontFamily:$}}/>
            <Tooltip content={<CT/>}/><Bar dataKey="count" name="Total" fill="#D4845A" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
        <div style={CD}><h3 style={{margin:"0 0 14px",fontWeight:400,fontSize:17}}>Unique Songs Per Month</h3>
          <ResponsiveContainer width="100%" height={280}><LineChart data={stats.timeline}><CartesianGrid strokeDasharray="3 3" stroke="rgba(250,247,242,0.05)"/>
            <XAxis dataKey="label" tick={{fill:"rgba(250,247,242,0.4)",fontSize:10,fontFamily:$}} interval={Math.max(0,Math.floor(stats.timeline.length/14))}/><YAxis tick={{fill:"rgba(250,247,242,0.35)",fontSize:11,fontFamily:$}}/>
            <Tooltip content={<CT/>}/><Line type="monotone" dataKey="unique" stroke="#5B8A72" name="Unique" strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer></div></div>

      :view==="roster"?<div style={CD}><h3 style={{margin:"0 0 14px",fontWeight:400,fontSize:17}}>Weekly Roster</h3>
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12,fontFamily:$}}>
          <thead><tr><th {...rosterS.th("Date","date")}/>{data.bandCols.map(c=><th key={c} style={{...TH0,color:"#D4845A"}}>{c}</th>)}{data.prodCols.map(c=><th key={c} style={{...TH0,color:"#6B94B0"}}>{c}</th>)}</tr></thead>
          <tbody>{(()=>{const seen=new Set();const rows=filtered.filter(r=>{if(seen.has(r.date))return false;seen.add(r.date);return true;});
            const sorted=rosterS.sort(rows,(x,f)=>{if(f==="date")return x.date;const bv=x.band[f];if(bv)return bv;const pv=x.prod[f];if(pv)return pv;return"";});
            return sorted.map((r,i)=>
            <tr key={i} style={{borderBottom:"1px solid rgba(250,247,242,0.04)"}}><td style={TD}>{dateLink(r.date)}</td>
              {data.bandCols.map(c=><td key={c} style={TD}>{r.band[c]||"—"}</td>)}{data.prodCols.map(c=><td key={c} style={TD}>{r.prod[c]||"—"}</td>)}</tr>);})()}</tbody>
        </table></div></div>

      :view==="history"?<div style={CD}><h3 style={{margin:"0 0 14px",fontWeight:400,fontSize:17}}>Full History ({filtered.length})</h3>
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12,fontFamily:$}}>
          <thead><tr><th {...histS.th("Date","date")}/><th {...histS.th("Song","title")}/><th {...histS.th("Artist","arrangement")}/><th {...histS.th("Key","key")}/><th {...histS.th("Leader(s)","leader1")}/></tr></thead>
          <tbody>{sortedHist.slice(0,400).map((r,i)=><tr key={i} style={{borderBottom:"1px solid rgba(250,247,242,0.04)"}}>
            <td style={TD}>{dateLink(r.date)}</td><td style={TD}>{songLink(r.title)}</td>
            <td style={TD}>{artistLink(r.arrangement)}</td><td style={TD}>{keyBadge(r.key)}</td>
            <td style={TD}>{leaders2(r)}</td></tr>)}</tbody></table>
          {filtered.length>400&&<p style={{color:"rgba(250,247,242,0.25)",fontSize:12,textAlign:"center",marginTop:14}}>Showing 400 of {filtered.length}</p>}</div></div>

      :null}
    </div></>);
}
