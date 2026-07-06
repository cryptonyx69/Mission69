
"use strict";

const VERSION = "Nova 5.0.0";
const STORAGE_KEY = "mission69_nova_v5";
const LEGACY_KEYS = ["mission69_withings_v4","mission69_studio_v3","mission69_elite_v2","mission69_dream_v1","mission69_pro_data","mission69_v2_data","mission69_v1_data"];
const $ = s => document.querySelector(s);

function uid(){ return "id_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-5); }
function clone(o){ return JSON.parse(JSON.stringify(o)); }
function todayISO(){ return toISO(new Date()); }
function toISO(d){ return new Date(d).toISOString().slice(0, 10); }
function parseLocalDate(d){ return new Date(d + "T12:00:00"); }
function fmtDate(d){ return parseLocalDate(d).toLocaleDateString("fr-CH",{day:"2-digit",month:"2-digit",year:"numeric"}); }
function fmtShort(d){ return parseLocalDate(d).toLocaleDateString("fr-CH",{weekday:"short",day:"2-digit",month:"2-digit"}); }
function esc(v){ return String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function round1(n){ return Math.round(n*10)/10; }
function num(v){ const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : null; }

const DEFAULT = {
  meta:{version:VERSION,createdAt:new Date().toISOString()},
  profile:{name:"Patrice",heightCm:178,startDate:"2026-07-03",startWeight:116,targetWeight:78,injectionDay:5,injectionTime:"22:00"},
  doseSchedule:[{fromWeek:0,dose:0.25},{fromWeek:4,dose:0.5},{fromWeek:8,dose:1.0},{fromWeek:12,dose:1.0}],
  weights:[{id:uid(),date:"2026-07-03",kg:116,note:"Départ Wegovy"}],
  injections:[{id:uid(),date:"2026-07-03",time:"22:00",dose:0.25,site:"Ventre gauche",note:"Première injection"}],
  symptoms:[],
  habits:[],
  measurements:[],
  photos:[],
  sites:["Ventre gauche","Ventre droit","Cuisse gauche","Cuisse droite","Bras gauche","Bras droit"],
  goals:[110,105,100,95,90,85,80,78],
  ui:{view:"dashboard",table:"weights"}
};

let state = loadState();

function loadState(){
  let raw = localStorage.getItem(STORAGE_KEY);
  if(!raw){ for(const k of LEGACY_KEYS){ if(localStorage.getItem(k)){ raw = localStorage.getItem(k); break; } } }
  if(!raw) return clone(DEFAULT);
  try { return migrate(JSON.parse(raw)); } catch(e){ return clone(DEFAULT); }
}
function migrate(input){
  const d = clone(DEFAULT);
  if(input.profile) d.profile = {...d.profile, ...input.profile};
  if(Array.isArray(input.doseSchedule)) d.doseSchedule = input.doseSchedule;
  if(Array.isArray(input.weights) && input.weights.length) d.weights = input.weights.map(w => ({id:w.id||uid(),date:w.date||todayISO(),kg:Number(w.kg),note:w.note||""})).filter(w => w.date && Number.isFinite(w.kg)).sort((a,b)=>a.date.localeCompare(b.date));
  if(Array.isArray(input.injections)) d.injections = input.injections.map(i => ({id:i.id||uid(),date:i.date||todayISO(),time:i.time||d.profile.injectionTime,dose:Number(i.dose||0.25),site:i.site||d.sites[0],note:i.note||""})).sort((a,b)=>a.date.localeCompare(b.date));
  if(Array.isArray(input.symptoms)) d.symptoms = input.symptoms.map(s => ({id:s.id||uid(),date:s.date||todayISO(),items:Array.isArray(s.items)?s.items:[s.txt||""],level:Number(s.level||1),note:s.note||""}));
  if(Array.isArray(input.notes) && !Array.isArray(input.symptoms)) d.symptoms = input.notes.map(n => ({id:uid(),date:n.date||todayISO(),items:[n.txt||String(n)],level:1,note:""}));
  if(Array.isArray(input.habits)) d.habits = input.habits.map(h => ({id:h.id||uid(),date:h.date||todayISO(),water:Number(h.water||0),protein:!!h.protein,slow:!!h.slow,fiber:!!h.fiber,movement:!!h.movement}));
  if(Array.isArray(input.measurements)) d.measurements = input.measurements.map(m => ({id:m.id||uid(),date:m.date||todayISO(),waist:num(m.waist),belly:num(m.belly),hips:num(m.hips),chest:num(m.chest),note:m.note||""}));
  if(Array.isArray(input.photos)) d.photos = input.photos.map(p => ({id:p.id||uid(),date:p.date||todayISO(),label:p.label||"Photo",data:p.data}));
  if(Array.isArray(input.goals)) d.goals = input.goals;
  if(Array.isArray(input.targets)) d.goals = input.targets;
  if(input.ui) d.ui = {...d.ui, ...input.ui};
  d.meta.version = VERSION;
  return d;
}
function save(){ state.meta.version = VERSION; try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; } catch(e){ toast("Stockage plein : exporte puis supprime des photos."); return false; } }
function persist(){ if(save()) render(); }

function sorted(name){ return [...state[name]].sort((a,b)=>(a.date||"").localeCompare(b.date||"")); }
function currentWeight(){ const w = sorted("weights"); return w.length ? Number(w.at(-1).kg) : Number(state.profile.startWeight); }
function previousWeight(){ const w = sorted("weights"); return w.length > 1 ? Number(w.at(-2).kg) : currentWeight(); }
function bmi(weight=currentWeight()){ const h = Number(state.profile.heightCm)/100; return weight/(h*h); }
function bmiLabel(v=bmi()){ if(v<25)return"poids normal"; if(v<30)return"surpoids"; if(v<35)return"obésité I"; if(v<40)return"obésité II"; return"obésité III"; }
function lostKg(){ return round1(Number(state.profile.startWeight) - currentWeight()); }
function remainingKg(){ return round1(currentWeight() - Number(state.profile.targetWeight)); }
function progressPct(){ const total = Number(state.profile.startWeight)-Number(state.profile.targetWeight); return total>0 ? clamp(lostKg()/total*100,0,100) : 0; }
function weeksSinceStart(date=todayISO()){ return Math.max(0, Math.floor((parseLocalDate(date) - new Date(state.profile.startDate+"T00:00:00"))/(7*86400000))); }
function doseAtWeek(w){ let dose = 0.25; [...state.doseSchedule].sort((a,b)=>a.fromWeek-b.fromWeek).forEach(s=>{ if(w>=Number(s.fromWeek)) dose=Number(s.dose); }); return dose; }
function nextInjectionDate(){
  const now = new Date(); let add = (Number(state.profile.injectionDay) - now.getDay() + 7)%7;
  if(add===0 && now.toTimeString().slice(0,5) >= state.profile.injectionTime) add=7;
  const d = new Date(now); d.setDate(d.getDate()+add); return toISO(d);
}
function nextSite(){ const inj = sorted("injections"); const last=inj.at(-1); const sites=state.sites; if(!last)return sites[0]; const i=sites.indexOf(last.site); return sites[(i+1+sites.length)%sites.length]||sites[0]; }
function trendKgPerWeek(){
  const w = sorted("weights").slice(-10); if(w.length<2)return null;
  const base = parseLocalDate(w[0].date).getTime()/86400000;
  const pts = w.map(x=>({x:parseLocalDate(x.date).getTime()/86400000-base,y:Number(x.kg)}));
  const n=pts.length, sx=pts.reduce((s,p)=>s+p.x,0), sy=pts.reduce((s,p)=>s+p.y,0), sxx=pts.reduce((s,p)=>s+p.x*p.x,0), sxy=pts.reduce((s,p)=>s+p.x*p.y,0);
  const den = n*sxx-sx*sx; if(!den)return null;
  const slope = (n*sxy-sx*sy)/den; const loss = -slope*7;
  return loss>0?loss:null;
}
function estimateDate(goal, rateOverride){ if(currentWeight()<=goal)return"atteint"; const r=rateOverride||trendKgPerWeek()||0.5; const d=new Date(); d.setDate(d.getDate()+Math.ceil((currentWeight()-goal)/Math.max(.1,r)*7)); return d.toLocaleDateString("fr-CH",{day:"2-digit",month:"2-digit",year:"numeric"}); }
function nextGoal(){ return state.goals.find(g=>currentWeight()>g) || Number(state.profile.targetWeight); }
function medLevelAt(timestamp, future=false){
  const half=7*86400000; let list=sorted("injections");
  if(future){ list=[...list]; let d=parseLocalDate(nextInjectionDate()); while(d.getTime()<=timestamp){ const date=toISO(d); if(!list.some(i=>i.date===date)) list.push({date,time:state.profile.injectionTime,dose:doseAtWeek(weeksSinceStart(date)),site:nextSite()}); d.setDate(d.getDate()+7); } }
  let amount=0; list.forEach(i=>{ const t=new Date(i.date+"T"+(i.time||state.profile.injectionTime)+":00").getTime(); if(t<=timestamp) amount += Number(i.dose||doseAtWeek(weeksSinceStart(i.date))) * Math.pow(.5,(timestamp-t)/half); });
  const cd=doseAtWeek(weeksSinceStart()); let steady=0; for(let i=0;i<14;i++) steady += cd*Math.pow(.5,i);
  return clamp(Math.round(amount/Math.max(steady,.25)*100),0,100);
}
function habitToday(){ let h=state.habits.find(x=>x.date===todayISO()); if(!h){ h={id:uid(),date:todayISO(),water:0,protein:false,slow:false,fiber:false,movement:false}; state.habits.push(h); } return h; }
function insight(){
  const r=trendKgPerWeek(); if(sorted("weights").length<2)return"Ajoute une deuxième pesée pour activer la tendance.";
  if(r&&r>=.9)return`Très forte dynamique : environ ${r.toFixed(1)} kg/semaine. Priorité aux protéines et à l’hydratation.`;
  if(r&&r>=.4)return`Très propre : environ ${r.toFixed(1)} kg/semaine. Rythme durable et lisible.`;
  if(currentWeight()>previousWeight())return"Petite remontée brute : eau, sel, transit ou timing. Regarde surtout la tendance.";
  return"Trajectoire en place. Continue les pesées régulières et les injections bien notées.";
}

function render(){
  const view=state.ui.view||"dashboard";
  $("#app").innerHTML = `<main class="app">${header()}${nav(view)}<div class="bottom-actions"><button class="btn primary" onclick="quickAdd()">+</button></div>${viewHTML(view)}</main>${settingsModal()}<div class="toast" id="toast"></div>`;
  requestAnimationFrame(drawAllCharts);
}
function header(){
  return `<header class="topbar"><div class="brand"><div class="logo">69</div><div><div class="kicker">Mission69 · ${esc(VERSION)}</div><h1>Mission69</h1><p class="sub">Manuel, simple, beau, efficace.</p></div></div><div class="actions"><button class="btn hide-sm" onclick="exportJSON()">Exporter</button><button class="btn primary" onclick="openSettings()">Réglages</button></div></header>`;
}
function nav(view){
  const tabs=[["dashboard","Dashboard"],["add","Ajouter"],["tables","Tableaux"],["injections","Injections"],["daily","Journal"],["goals","Objectifs"],["photos","Photos"],["backup","Backup"]];
  return `<nav class="nav">${tabs.map(([id,l])=>`<button class="tab ${view===id?'active':''}" onclick="setView('${id}')">${l}</button>`).join("")}</nav>`;
}
function setView(v){ state.ui.view=v; persist(); }
function viewHTML(v){
  if(v==="add")return addView();
  if(v==="tables")return tablesView();
  if(v==="injections")return injectionsView();
  if(v==="daily")return dailyView();
  if(v==="goals")return goalsView();
  if(v==="photos")return photosView();
  if(v==="backup")return backupView();
  return dashboardView();
}
function dashboardView(){
  const cw=currentWeight(), pg=progressPct(), next=nextInjectionDate(), ng=nextGoal(), rate=trendKgPerWeek();
  return `<section class="layout">
    <div class="grid">
      <div class="card hero"><div class="row wrap"><span class="label">Poids actuel</span><span class="btn primary">−${lostKg().toFixed(1)} kg</span></div><div class="big">${cw.toFixed(1)} <small>kg</small></div><div class="progress"><div class="bar" style="width:${pg}%"></div></div><div class="row muted"><span>${pg.toFixed(0)} % de la mission</span><span>${Math.max(0,remainingKg()).toFixed(1)} kg restants</span></div></div>
      <div class="grid three">${metric("IMC",bmi().toFixed(1),bmiLabel())}${metric("Tendance",rate?rate.toFixed(2)+" kg/sem.":"—","10 dernières pesées")}${metric("Prochain palier",ng+" kg",estimateDate(ng))}</div>
    </div>
    <div class="grid">
      <div class="card">${ring(medLevelAt(Date.now()),"niveau estimé")}<p class="muted">Dose actuelle : <b>${doseAtWeek(weeksSinceStart()).toFixed(2)} mg</b> · semaine ${weeksSinceStart()}</p></div>
      <div class="card"><div class="label">Prochaine injection</div><div class="stat">${fmtShort(next)}</div><p class="muted">${esc(state.profile.injectionTime)} · ${doseAtWeek(weeksSinceStart(next)).toFixed(2)} mg · site : <b>${esc(nextSite())}</b></p><div class="chips"><button class="btn primary" onclick="addInjectionQuick()">Injection faite</button><button class="btn" onclick="setView('add')">Ajouter données</button></div></div>
    </div>
  </section>
  <section class="grid two" style="margin-top:18px"><div class="card"><h2 class="section-title">Courbe poids + projection</h2><div class="canvas-wrap"><canvas id="weightChart"></canvas></div></div><div class="card"><h2 class="section-title">Coach</h2><p class="notice success">${esc(insight())}</p><hr><div class="grid two">${metric("Objectif 100",estimateDate(100),"si tendance actuelle")}${metric("Objectif final",estimateDate(Number(state.profile.targetWeight)),state.profile.targetWeight+" kg")}</div><hr>${miniHabits()}</div></section>`;
}
function metric(label,val,sub){ return `<div class="metric"><span class="label">${esc(label)}</span><br><b>${esc(val)}</b><small>${esc(sub)}</small></div>`; }
function ring(val,label){ const off=540-(540*clamp(val,0,100)/100); return `<div class="ring-wrap"><svg class="ring" viewBox="0 0 200 200"><defs><linearGradient id="grad" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#78FFD6"/><stop offset=".55" stop-color="#83A6FF"/><stop offset="1" stop-color="#FF77DC"/></linearGradient></defs><circle class="base" cx="100" cy="100" r="86"></circle><circle class="value" cx="100" cy="100" r="86" style="stroke-dashoffset:${off}"></circle></svg><div class="ring-label"><b>${val}%</b><span>${esc(label)}</span></div></div>`; }

function addView(){
  return `<section class="grid two">
    <div class="card"><h2 class="section-title">Ajouter une pesée</h2><div class="formgrid">${field("Date","newWeightDate",todayISO(),"date")}${field("Poids kg","newWeightKg","","number","ex. 115.4")}</div><br><textarea id="newWeightNote" rows="2" placeholder="Note optionnelle"></textarea><br><br><button class="btn primary" onclick="addWeightForm()">Ajouter</button></div>
    <div class="card"><h2 class="section-title">Ajouter une injection</h2><div class="formgrid">${field("Date","newInjDate",todayISO(),"date")}${field("Heure","newInjTime",state.profile.injectionTime,"time")}${field("Dose mg","newInjDose",doseAtWeek(weeksSinceStart()).toFixed(2),"number")}<div class="field"><label>Site</label><select id="newInjSite">${state.sites.map(s=>`<option ${s===nextSite()?"selected":""}>${esc(s)}</option>`).join("")}</select></div></div><br><textarea id="newInjNote" rows="2" placeholder="Note optionnelle"></textarea><br><br><button class="btn primary" onclick="addInjectionForm()">Ajouter</button></div>
  </section>
  <section class="grid two" style="margin-top:18px">
    <div class="card"><h2 class="section-title">Mensurations</h2><div class="formgrid">${field("Date","newMDate",todayISO(),"date")}${field("Taille cm","newWaist","","number")}${field("Ventre cm","newBelly","","number")}${field("Hanches cm","newHips","","number")}${field("Poitrine cm","newChest","","number")}</div><br><button class="btn primary" onclick="addMeasurementForm()">Ajouter</button></div>
    <div class="card"><h2 class="section-title">Journal rapide</h2>${miniHabits()}<hr><div class="chips">${["🙂 rien","🤢 nausée","🔥 reflux","💩 constipation","😴 fatigue","🍽️ satiété","🍺 alcool"].map(s=>`<button class="chip" onclick="addSymptom('${esc(s)}')">${esc(s)}</button>`).join("")}</div></div>
  </section>`;
}
function field(label,id,value,type,ph=""){ return `<div class="field"><label for="${id}">${esc(label)}</label><input id="${id}" type="${type}" value="${esc(value)}" placeholder="${esc(ph)}" step="0.01"></div>`; }

function tablesView(){
  const table=state.ui.table||"weights";
  return `<section class="card"><div class="row wrap"><div><h2 class="section-title">Tableaux modifiables</h2><p class="muted">Corrige directement les valeurs. Pas de synchro externe : tu gardes le contrôle.</p></div><div class="chips">${[["weights","Poids"],["injections","Injections"],["measurements","Mensurations"],["symptoms","Journal"]].map(([id,l])=>`<button class="chip ${table===id?"active":""}" onclick="setTable('${id}')">${l}</button>`).join("")}</div></div></section><section style="margin-top:18px">${tableHTML(table)}</section>`;
}
function setTable(t){ state.ui.table=t; persist(); }
function tableHTML(t){
  if(t==="injections")return injectionsTable();
  if(t==="measurements")return measurementsTable();
  if(t==="symptoms")return symptomsTable();
  return weightsTable();
}
function weightsTable(){
  return `<div class="card table-card"><div class="table-head"><h2 class="section-title">Liste des poids</h2><button class="btn primary" onclick="addEmptyWeight()">+ ligne</button></div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Poids kg</th><th>Note</th><th>Actions</th></tr></thead><tbody>${sorted("weights").slice().reverse().map(w=>`<tr><td><input id="w_date_${w.id}" type="date" value="${esc(w.date)}"></td><td><input id="w_kg_${w.id}" type="number" step="0.1" value="${esc(w.kg)}"></td><td><input id="w_note_${w.id}" value="${esc(w.note)}"></td><td><button class="btn small primary" onclick="saveWeightRow('${w.id}')">OK</button> <button class="btn small danger" onclick="del('weights','${w.id}')">Suppr.</button></td></tr>`).join("")}</tbody></table></div></div>`;
}
function injectionsTable(){
  return `<div class="card table-card"><div class="table-head"><h2 class="section-title">Liste des injections</h2><button class="btn primary" onclick="addEmptyInjection()">+ ligne</button></div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Heure</th><th>Dose</th><th>Site</th><th>Note</th><th>Actions</th></tr></thead><tbody>${sorted("injections").slice().reverse().map(i=>`<tr><td><input id="i_date_${i.id}" type="date" value="${esc(i.date)}"></td><td><input id="i_time_${i.id}" type="time" value="${esc(i.time)}"></td><td><input id="i_dose_${i.id}" type="number" step="0.01" value="${esc(i.dose)}"></td><td><select id="i_site_${i.id}">${state.sites.map(s=>`<option ${s===i.site?"selected":""}>${esc(s)}</option>`).join("")}</select></td><td><input id="i_note_${i.id}" value="${esc(i.note)}"></td><td><button class="btn small primary" onclick="saveInjectionRow('${i.id}')">OK</button> <button class="btn small danger" onclick="del('injections','${i.id}')">Suppr.</button></td></tr>`).join("")}</tbody></table></div></div>`;
}
function measurementsTable(){
  return `<div class="card table-card"><div class="table-head"><h2 class="section-title">Liste des mensurations</h2><button class="btn primary" onclick="addEmptyMeasurement()">+ ligne</button></div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Taille</th><th>Ventre</th><th>Hanches</th><th>Poitrine</th><th>Note</th><th>Actions</th></tr></thead><tbody>${sorted("measurements").slice().reverse().map(m=>`<tr><td><input id="m_date_${m.id}" type="date" value="${esc(m.date)}"></td><td><input id="m_waist_${m.id}" type="number" step="0.1" value="${esc(m.waist??"")}"></td><td><input id="m_belly_${m.id}" type="number" step="0.1" value="${esc(m.belly??"")}"></td><td><input id="m_hips_${m.id}" type="number" step="0.1" value="${esc(m.hips??"")}"></td><td><input id="m_chest_${m.id}" type="number" step="0.1" value="${esc(m.chest??"")}"></td><td><input id="m_note_${m.id}" value="${esc(m.note)}"></td><td><button class="btn small primary" onclick="saveMeasurementRow('${m.id}')">OK</button> <button class="btn small danger" onclick="del('measurements','${m.id}')">Suppr.</button></td></tr>`).join("")}</tbody></table></div></div>`;
}
function symptomsTable(){
  return `<div class="card table-card"><div class="table-head"><h2 class="section-title">Liste du journal</h2><button class="btn primary" onclick="addEmptySymptom()">+ ligne</button></div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Symptômes</th><th>Intensité</th><th>Note</th><th>Actions</th></tr></thead><tbody>${sorted("symptoms").slice().reverse().map(s=>`<tr><td><input id="s_date_${s.id}" type="date" value="${esc(s.date)}"></td><td><input id="s_items_${s.id}" value="${esc((s.items||[]).join(", "))}"></td><td><input id="s_level_${s.id}" type="number" min="0" max="5" value="${esc(s.level||1)}"></td><td><input id="s_note_${s.id}" value="${esc(s.note)}"></td><td><button class="btn small primary" onclick="saveSymptomRow('${s.id}')">OK</button> <button class="btn small danger" onclick="del('symptoms','${s.id}')">Suppr.</button></td></tr>`).join("")}</tbody></table></div></div>`;
}
function injectionsView(){
  return `<section class="grid two"><div class="card"><h2 class="section-title">Niveau Wegovy estimé</h2><div class="canvas-wrap small"><canvas id="medChart"></canvas></div><p class="notice">Approximation informative basée sur les injections enregistrées et la demi-vie moyenne.</p></div><div class="card"><h2 class="section-title">Prochaine injection</h2><div class="stat">${fmtShort(nextInjectionDate())}</div><p class="muted">${esc(state.profile.injectionTime)} · ${doseAtWeek(weeksSinceStart(nextInjectionDate())).toFixed(2)} mg · ${esc(nextSite())}</p><button class="btn primary" onclick="addInjectionQuick()">Injection faite</button></div></section><section style="margin-top:18px">${injectionsTable()}</section>`;
}
function dailyView(){
  return `<section class="grid two"><div class="card"><h2 class="section-title">Aujourd’hui</h2>${miniHabits()}<hr><textarea id="symptomNote" rows="3" placeholder="Note du jour"></textarea><br><br><button class="btn primary" onclick="saveTodayNote()">Enregistrer note</button></div><div class="card"><h2 class="section-title">Symptômes rapides</h2><div class="chips">${["🙂 rien","🤢 nausée","🔥 reflux","💩 constipation","💨 diarrhée","😴 fatigue","😵‍💫 vertige","🍽️ satiété","🍺 alcool","💧 soif"].map(s=>`<button class="chip" onclick="addSymptom('${esc(s)}')">${esc(s)}</button>`).join("")}</div></div></section><section style="margin-top:18px">${symptomsTable()}</section>`;
}
function miniHabits(){
  const h=habitToday();
  return `<div class="chips">${habitChip("protein","Protéines",h.protein)}${habitChip("slow","Manger lentement",h.slow)}${habitChip("fiber","Fibres",h.fiber)}${habitChip("movement","Marche",h.movement)}</div><p class="muted">Eau : <b>${Number(h.water||0).toFixed(1)} L</b></p><div class="chips"><button class="btn small" onclick="addWater(-0.25)">− 0.25 L</button><button class="btn small primary" onclick="addWater(0.25)">+ 0.25 L</button></div>`;
}
function habitChip(k,l,a){ return `<button class="chip ${a?"active":""}" onclick="toggleHabit('${k}')">${esc(l)}</button>`; }
function goalsView(){
  return `<section class="card"><h2 class="section-title">Paliers</h2><div class="targets">${state.goals.map(g=>`<div class="target ${currentWeight()<=g?"done":""}"><b>${g} kg</b><small>${currentWeight()<=g?"débloqué 🏆":"reste "+round1(currentWeight()-g).toFixed(1)+" kg · "+estimateDate(g)}</small></div>`).join("")}</div></section><section class="grid four" style="margin-top:18px">${metric("0.3 kg/sem.",estimateDate(Number(state.profile.targetWeight),.3),"lent")}${metric("0.5 kg/sem.",estimateDate(Number(state.profile.targetWeight),.5),"réaliste")}${metric("0.7 kg/sem.",estimateDate(Number(state.profile.targetWeight),.7),"très bon")}${metric("1 kg/sem.",estimateDate(Number(state.profile.targetWeight),1),"agressif")}</section>`;
}
function photosView(){
  const first=state.photos[0], last=state.photos.at(-1);
  return `<section class="grid two"><div class="card"><h2 class="section-title">Ajouter photo</h2><input id="photoInput" type="file" accept="image/*"><br><br><input id="photoLabel" placeholder="Label : face, profil, mois 1..."><br><br><button class="btn primary" onclick="addPhoto()">Ajouter</button><p class="notice">Photos compressées et stockées localement. Export JSON recommandé.</p></div><div class="card"><h2 class="section-title">Avant / après</h2>${first&&last&&first.id!==last.id?`<div class="compare"><div class="photo"><img src="${first.data}"><div class="cap"><b>${esc(first.label)}</b><br><small class="muted">${fmtDate(first.date)}</small></div></div><div class="photo"><img src="${last.data}"><div class="cap"><b>${esc(last.label)}</b><br><small class="muted">${fmtDate(last.date)}</small></div></div></div>`:"<p class='muted'>Ajoute au moins deux photos.</p>"}</div></section><section class="photo-grid" style="margin-top:18px">${state.photos.slice().reverse().map(p=>`<div class="photo"><img src="${p.data}"><div class="cap"><b>${esc(p.label)}</b><br><small class="muted">${fmtDate(p.date)}</small><br><br><button class="btn danger small" onclick="deletePhoto('${p.id}')">Supprimer</button></div></div>`).join("")||"<div class='card'><p class='muted'>Aucune photo.</p></div>"}</section>`;
}
function backupView(){
  return `<section class="grid two"><div class="card"><h2 class="section-title">Sauvegarde</h2><p class="muted">Tout reste local. Exporte le JSON régulièrement.</p><div class="chips"><button class="btn primary" onclick="exportJSON()">Exporter JSON</button><button class="btn" onclick="importJSON()">Importer JSON</button><button class="btn" onclick="exportCSV()">Exporter CSV</button><button class="btn danger" onclick="resetAll()">Réinitialiser</button></div><hr><button class="btn danger" onclick="hardRefresh()">Forcer mise à jour / vider cache</button></div><div class="card"><h2 class="section-title">Diagnostic</h2>${metric("Version",VERSION,"PWA")}${metric("Données",`${state.weights.length} poids · ${state.injections.length} injections`,`${state.measurements.length} mensurations · ${state.photos.length} photos`)}</div></section>`;
}

function addWeightForm(){ const kg=num($("#newWeightKg")?.value); if(!kg||kg<45||kg>220)return toast("Poids invalide"); state.weights.push({id:uid(),date:$("#newWeightDate").value||todayISO(),kg:round1(kg),note:$("#newWeightNote").value||""}); state.weights.sort((a,b)=>a.date.localeCompare(b.date)); persist(); toast("Poids ajouté"); }
function addInjectionForm(){ const dose=num($("#newInjDose")?.value); if(!dose)return toast("Dose invalide"); state.injections.push({id:uid(),date:$("#newInjDate").value||todayISO(),time:$("#newInjTime").value||state.profile.injectionTime,dose,site:$("#newInjSite").value||nextSite(),note:$("#newInjNote").value||""}); state.injections.sort((a,b)=>a.date.localeCompare(b.date)); persist(); toast("Injection ajoutée"); }
function addInjectionQuick(){ state.injections.push({id:uid(),date:todayISO(),time:state.profile.injectionTime,dose:doseAtWeek(weeksSinceStart()),site:nextSite(),note:""}); state.injections.sort((a,b)=>a.date.localeCompare(b.date)); persist(); toast("Injection enregistrée"); }
function addMeasurementForm(){ const m={id:uid(),date:$("#newMDate").value||todayISO(),waist:num($("#newWaist").value),belly:num($("#newBelly").value),hips:num($("#newHips").value),chest:num($("#newChest").value),note:""}; if(!m.waist&&!m.belly&&!m.hips&&!m.chest)return toast("Ajoute au moins une mesure"); state.measurements.push(m); state.measurements.sort((a,b)=>a.date.localeCompare(b.date)); persist(); toast("Mensuration ajoutée"); }

function addEmptyWeight(){ state.weights.push({id:uid(),date:todayISO(),kg:currentWeight(),note:""}); state.ui.table="weights"; persist(); }
function addEmptyInjection(){ state.injections.push({id:uid(),date:todayISO(),time:state.profile.injectionTime,dose:doseAtWeek(weeksSinceStart()),site:nextSite(),note:""}); state.ui.table="injections"; persist(); }
function addEmptyMeasurement(){ state.measurements.push({id:uid(),date:todayISO(),waist:null,belly:null,hips:null,chest:null,note:""}); state.ui.table="measurements"; persist(); }
function addEmptySymptom(){ state.symptoms.push({id:uid(),date:todayISO(),items:[],level:1,note:""}); state.ui.table="symptoms"; persist(); }
function saveWeightRow(id){ const w=state.weights.find(x=>x.id===id); if(!w)return; const kg=num($("#w_kg_"+id).value); if(!kg)return toast("Poids invalide"); w.date=$("#w_date_"+id).value||w.date; w.kg=round1(kg); w.note=$("#w_note_"+id).value||""; state.weights.sort((a,b)=>a.date.localeCompare(b.date)); persist(); toast("Poids modifié"); }
function saveInjectionRow(id){ const i=state.injections.find(x=>x.id===id); if(!i)return; i.date=$("#i_date_"+id).value||i.date; i.time=$("#i_time_"+id).value||i.time; i.dose=num($("#i_dose_"+id).value)||i.dose; i.site=$("#i_site_"+id).value||i.site; i.note=$("#i_note_"+id).value||""; state.injections.sort((a,b)=>a.date.localeCompare(b.date)); persist(); toast("Injection modifiée"); }
function saveMeasurementRow(id){ const m=state.measurements.find(x=>x.id===id); if(!m)return; m.date=$("#m_date_"+id).value||m.date; m.waist=num($("#m_waist_"+id).value); m.belly=num($("#m_belly_"+id).value); m.hips=num($("#m_hips_"+id).value); m.chest=num($("#m_chest_"+id).value); m.note=$("#m_note_"+id).value||""; state.measurements.sort((a,b)=>a.date.localeCompare(b.date)); persist(); toast("Mensuration modifiée"); }
function saveSymptomRow(id){ const s=state.symptoms.find(x=>x.id===id); if(!s)return; s.date=$("#s_date_"+id).value||s.date; s.items=($("#s_items_"+id).value||"").split(",").map(x=>x.trim()).filter(Boolean); s.level=Number($("#s_level_"+id).value)||1; s.note=$("#s_note_"+id).value||""; state.symptoms.sort((a,b)=>a.date.localeCompare(b.date)); persist(); toast("Journal modifié"); }
function del(collection,id){ if(!confirm("Supprimer cette ligne ?"))return; state[collection]=state[collection].filter(x=>x.id!==id); persist(); }

function toggleHabit(k){ const h=habitToday(); h[k]=!h[k]; persist(); }
function addWater(d){ const h=habitToday(); h.water=clamp(round1(Number(h.water||0)+d),0,8); persist(); }
function addSymptom(item){ let s=state.symptoms.find(x=>x.date===todayISO()); if(!s){ s={id:uid(),date:todayISO(),items:[],level:1,note:""}; state.symptoms.push(s); } if(!s.items.includes(item))s.items.push(item); persist(); toast("Journal mis à jour"); }
function saveTodayNote(){ let s=state.symptoms.find(x=>x.date===todayISO()); if(!s){ s={id:uid(),date:todayISO(),items:[],level:1,note:""}; state.symptoms.push(s); } s.note=$("#symptomNote").value||""; persist(); toast("Note enregistrée"); }
function quickAdd(){ if((state.ui.view||"")==="injections")addInjectionQuick(); else setView("add"); }

function drawAllCharts(){ drawWeight("weightChart",true); drawMed("medChart"); }
function setupCanvas(id){ const c=document.getElementById(id); if(!c)return null; const r=c.getBoundingClientRect(), dpr=devicePixelRatio||1; c.width=Math.max(1,Math.round(r.width*dpr)); c.height=Math.max(1,Math.round(r.height*dpr)); const ctx=c.getContext("2d"); ctx.setTransform(dpr,0,0,dpr,0,0); return {ctx,W:r.width,H:r.height}; }
function drawWeight(id,proj){ const s=setupCanvas(id); if(!s)return; let pts=sorted("weights").map(w=>({v:Number(w.kg),real:true})); if(pts.length===1)pts.push({v:pts[0].v,real:true}); const rate=trendKgPerWeek()||.5; if(proj&&pts.length){ const last=pts.at(-1).v; for(let i=1;i<=24;i++)pts.push({v:Math.max(Number(state.profile.targetWeight),last-rate*i),real:false}); } drawLine(s.ctx,s.W,s.H,pts,{target:Number(state.profile.targetWeight),unit:"kg",split:pts.findIndex(p=>!p.real)}); }
function drawMed(id){ const s=setupCanvas(id); if(!s)return; const now=Date.now(); const pts=[]; for(let i=0;i<=42;i++)pts.push({v:medLevelAt(now+i*86400000,true),real:true}); drawLine(s.ctx,s.W,s.H,pts,{target:null,unit:"%",color:"#83a6ff"}); }
function drawLine(ctx,W,H,pts,opt){ if(!pts.length)return; const pad=34, vals=pts.map(p=>p.v); if(opt.target!==null&&opt.target!==undefined)vals.push(opt.target); vals.push(Number(state.profile.startWeight)||pts[0].v); const min=Math.floor(Math.min(...vals)-2), max=Math.ceil(Math.max(...vals)+2); const sx=i=>pad+(i/Math.max(1,pts.length-1))*(W-pad*2), sy=v=>pad+(1-(v-min)/Math.max(1,max-min))*(H-pad*2); ctx.clearRect(0,0,W,H); ctx.strokeStyle="rgba(255,255,255,.10)"; ctx.lineWidth=1; for(let i=0;i<5;i++){ const y=pad+i*(H-pad*2)/4; ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(W-pad,y);ctx.stroke(); } if(opt.target!==null&&opt.target!==undefined){ const y=sy(opt.target); ctx.strokeStyle="rgba(255,198,110,.65)"; ctx.setLineDash([6,6]); ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(W-pad,y);ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle="rgba(255,255,255,.72)"; ctx.font="800 12px -apple-system"; ctx.fillText("objectif "+opt.target+" "+opt.unit,Math.max(pad,W-pad-110),y-8); } const split=opt.split&&opt.split>0?opt.split:pts.length; const real=pts.slice(0,split), fut=pts.slice(split); ctx.lineWidth=4; ctx.lineCap="round"; ctx.lineJoin="round"; ctx.strokeStyle=opt.color||"#78ffd6"; ctx.beginPath(); real.forEach((p,i)=>i?ctx.lineTo(sx(i),sy(p.v)):ctx.moveTo(sx(i),sy(p.v))); ctx.stroke(); if(fut.length){ ctx.strokeStyle="rgba(131,166,255,.68)"; ctx.setLineDash([9,8]); ctx.beginPath(); ctx.moveTo(sx(real.length-1),sy(real.at(-1).v)); fut.forEach((p,j)=>ctx.lineTo(sx(real.length+j),sy(p.v))); ctx.stroke(); ctx.setLineDash([]); } ctx.fillStyle="#fff"; real.forEach((p,i)=>{ctx.beginPath();ctx.arc(sx(i),sy(p.v),5,0,Math.PI*2);ctx.fill();}); ctx.fillStyle="rgba(255,255,255,.72)"; ctx.font="800 12px -apple-system"; ctx.fillText(max+" "+opt.unit,pad,18); ctx.fillText(min+" "+opt.unit,pad,H-10); }

async function addPhoto(){ const f=$("#photoInput")?.files?.[0]; if(!f)return toast("Choisis une photo"); const data=await compressImage(f,1200,.78); state.photos.push({id:uid(),date:todayISO(),label:$("#photoLabel").value||"Photo",data}); persist(); toast("Photo ajoutée"); }
function compressImage(file,max,quality){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onerror=rej; r.onload=()=>{ const img=new Image(); img.onerror=rej; img.onload=()=>{ const scale=Math.min(1,max/Math.max(img.width,img.height)); const c=document.createElement("canvas"); c.width=Math.round(img.width*scale); c.height=Math.round(img.height*scale); c.getContext("2d").drawImage(img,0,0,c.width,c.height); res(c.toDataURL("image/jpeg",quality)); }; img.src=r.result; }; r.readAsDataURL(file); }); }
function deletePhoto(id){ if(!confirm("Supprimer cette photo ?"))return; state.photos=state.photos.filter(p=>p.id!==id); persist(); }

function exportJSON(){ download(new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),"mission69-"+todayISO()+".json"); }
function exportCSV(){ const rows=["type,date,value1,value2,value3,value4,note",...state.weights.map(w=>`poids,${w.date},${w.kg},,,,${csv(w.note)}`),...state.injections.map(i=>`injection,${i.date},${i.dose},${csv(i.site)},${csv(i.time)},,${csv(i.note)}`),...state.measurements.map(m=>`mensuration,${m.date},${m.waist??""},${m.belly??""},${m.hips??""},${m.chest??""},${csv(m.note)}`),...state.symptoms.map(s=>`journal,${s.date},${csv((s.items||[]).join(" | "))},${s.level||""},,,${csv(s.note)}`)]; download(new Blob([rows.join("\n")],{type:"text/csv;charset=utf-8"}),"mission69-"+todayISO()+".csv"); }
function csv(v){ return '"' + String(v||"").replace(/"/g,'""') + '"'; }
function download(blob,name){ const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; a.click(); URL.revokeObjectURL(a.href); }
function importJSON(){ const i=document.createElement("input"); i.type="file"; i.accept=".json,application/json"; i.onchange=()=>{ const f=i.files[0]; if(!f)return; const r=new FileReader(); r.onload=()=>{ try{ state=migrate(JSON.parse(r.result)); persist(); toast("Import réussi"); } catch(e){ toast("JSON invalide"); } }; r.readAsText(f); }; i.click(); }
function resetAll(){ if(!confirm("Réinitialiser toutes les données ?"))return; state=clone(DEFAULT); persist(); }
async function hardRefresh(){ if("serviceWorker" in navigator){ const regs=await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r=>r.unregister())); } if("caches" in window){ const keys=await caches.keys(); await Promise.all(keys.map(k=>caches.delete(k))); } location.reload(); }

function settingsModal(){ return `<div class="modal" id="settingsModal"><div class="sheet"><div class="row wrap"><h2 class="section-title">Réglages</h2><button class="btn" onclick="closeSettings()">Fermer</button></div><div class="formgrid">${field("Nom","setName",state.profile.name,"text")}${field("Taille cm","setHeight",state.profile.heightCm,"number")}${field("Poids départ","setStart",state.profile.startWeight,"number")}${field("Objectif kg","setTarget",state.profile.targetWeight,"number")}${field("Date début","setDate",state.profile.startDate,"date")}${field("Heure injection","setTime",state.profile.injectionTime,"time")}</div><hr><h3>Plan de dose</h3><div class="formgrid">${field("Dose semaine 0","dose0",doseAtWeek(0),"number")}${field("Dose semaine 4","dose4",doseAtWeek(4),"number")}${field("Dose semaine 8","dose8",doseAtWeek(8),"number")}${field("Dose semaine 12","dose12",doseAtWeek(12),"number")}</div><br><button class="btn primary" onclick="saveSettings()">Enregistrer</button></div></div>`; }
function openSettings(){ $("#settingsModal").classList.add("open"); }
function closeSettings(){ $("#settingsModal").classList.remove("open"); }
function saveSettings(){ state.profile.name=$("#setName").value||"Patrice"; state.profile.heightCm=Number($("#setHeight").value)||178; state.profile.startWeight=Number($("#setStart").value)||116; state.profile.targetWeight=Number($("#setTarget").value)||78; state.profile.startDate=$("#setDate").value||"2026-07-03"; state.profile.injectionTime=$("#setTime").value||"22:00"; state.doseSchedule=[{fromWeek:0,dose:Number($("#dose0").value)||.25},{fromWeek:4,dose:Number($("#dose4").value)||.5},{fromWeek:8,dose:Number($("#dose8").value)||1},{fromWeek:12,dose:Number($("#dose12").value)||1}]; closeSettings(); persist(); toast("Réglages enregistrés"); }
function toast(msg){ const el=$("#toast"); if(!el)return; el.textContent=msg; el.style.display="block"; clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.style.display="none",2200); }
window.addEventListener("resize",()=>requestAnimationFrame(drawAllCharts));
if("serviceWorker" in navigator) window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
render();
