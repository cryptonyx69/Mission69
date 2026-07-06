
"use strict";

const VERSION = "Nova 6.1.0";
const STORAGE_KEY = "mission69_nova_v61";
const LEGACY_KEYS = ["mission69_nova_v6","mission69_nova_v51","mission69_nova_v5","mission69_withings_v4","mission69_studio_v3","mission69_elite_v2","mission69_dream_v1","mission69_pro_data","mission69_v2_data","mission69_v1_data"];
const $ = s => document.querySelector(s);

function uid(){ return "id_" + Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(-5); }
function clone(o){ return JSON.parse(JSON.stringify(o)); }
function todayISO(){ return toISO(new Date()); }
function toISO(d){ return new Date(d).toISOString().slice(0,10); }
function parseLocalDate(d){ return new Date(d + "T12:00:00"); }
function fmtDate(d){ return parseLocalDate(d).toLocaleDateString("fr-CH",{day:"2-digit",month:"2-digit",year:"numeric"}); }
function fmtShort(d){ return parseLocalDate(d).toLocaleDateString("fr-CH",{weekday:"short",day:"2-digit",month:"2-digit"}); }
function esc(v){ return String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function round1(n){ return Math.round(n*10)/10; }
function num(v){ const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : null; }
function val(id){ return $("#" + id)?.value ?? ""; }

const DEFAULT = {
  meta:{version:VERSION,createdAt:new Date().toISOString()},
  profile:{name:"Patrice",heightCm:178,startDate:"2026-07-03",startWeight:116,targetWeight:78,injectionDay:5,injectionTime:"22:00"},
  doseSchedule:[{fromWeek:0,dose:0.25,clicks:8},{fromWeek:4,dose:0.5,clicks:16},{fromWeek:8,dose:1.0,clicks:32},{fromWeek:12,dose:1.0,clicks:32}],
  weights:[{id:uid(),date:"2026-07-03",kg:116,note:"Départ Wegovy"}],
  injections:[{id:uid(),date:"2026-07-03",time:"22:00",dose:0.25,clicks:8,site:"Ventre gauche",note:"Première injection"}],
  symptoms:[],
  habits:[],
  measurements:[],
  photos:[],
  sites:["Ventre gauche","Ventre droit","Cuisse gauche","Cuisse droite","Bras gauche","Bras droit"],
  goals:[110,105,100,95,90,85,80,78],
  ui:{view:"dashboard",table:"weights",twoDigitCelebrated:false}
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
  if(Array.isArray(input.doseSchedule)) d.doseSchedule = input.doseSchedule.map(s => ({fromWeek:Number(s.fromWeek||0),dose:Number(s.dose||0.25),clicks:Number(s.clicks || defaultClicks(Number(s.dose||0.25)))}));
  if(Array.isArray(input.weights) && input.weights.length) d.weights = input.weights.map(w => ({id:w.id||uid(),date:w.date||todayISO(),kg:Number(w.kg),note:w.note||""})).filter(w => w.date && Number.isFinite(w.kg)).sort((a,b)=>a.date.localeCompare(b.date));
  if(Array.isArray(input.injections)) d.injections = input.injections.map(i => {
    const dose = Number(i.dose || 0.25);
    return {id:i.id||uid(),date:i.date||todayISO(),time:i.time||d.profile.injectionTime,dose,clicks:Number(i.clicks || defaultClicks(dose)),site:i.site||d.sites[0],note:i.note||""};
  }).sort((a,b)=>a.date.localeCompare(b.date));
  if(Array.isArray(input.symptoms)) d.symptoms = input.symptoms.map(s => ({id:s.id||uid(),date:s.date||todayISO(),items:Array.isArray(s.items)?s.items:[s.txt||""],level:Number(s.level||1),note:s.note||""}));
  if(Array.isArray(input.notes) && !Array.isArray(input.symptoms)) d.symptoms = input.notes.map(n => ({id:uid(),date:n.date||todayISO(),items:[n.txt||String(n)],level:1,note:""}));
  if(Array.isArray(input.habits)) d.habits = input.habits.map(h => ({id:h.id||uid(),date:h.date||todayISO(),water:Number(h.water||0),protein:!!h.protein,slow:!!h.slow,fiber:!!h.fiber,movement:!!h.movement}));
  if(Array.isArray(input.measurements)) d.measurements = input.measurements.map(m => ({
    id:m.id||uid(), date:m.date||todayISO(),
    waist:num(m.waist), belly:num(m.belly), hips:num(m.hips), chest:num(m.chest),
    calfL:num(m.calfL), calfR:num(m.calfR), armL:num(m.armL), armR:num(m.armR), thighL:num(m.thighL), thighR:num(m.thighR),
    note:m.note||""
  }));
  if(Array.isArray(input.photos)) d.photos = input.photos.map(p => ({id:p.id||uid(),date:p.date||todayISO(),label:p.label||"Photo",data:p.data}));
  if(Array.isArray(input.goals)) d.goals = input.goals;
  if(Array.isArray(input.targets)) d.goals = input.targets;
  if(input.ui) d.ui = {...d.ui, ...input.ui};
  d.meta.version = VERSION;
  return d;
}
function defaultClicks(dose){ if(dose <= 0.25) return 8; if(dose <= 0.5) return 16; if(dose <= 1.0) return 32; return Math.round(dose / 0.25 * 8); }
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
function doseStepAtWeek(w){ let step = state.doseSchedule[0] || {dose:0.25,clicks:8}; [...state.doseSchedule].sort((a,b)=>a.fromWeek-b.fromWeek).forEach(s=>{ if(w>=Number(s.fromWeek)) step=s; }); return step; }
function doseAtWeek(w){ return Number(doseStepAtWeek(w).dose); }
function clicksAtWeek(w){ return Number(doseStepAtWeek(w).clicks || defaultClicks(doseAtWeek(w))); }
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
  const loss = -((n*sxy-sx*sy)/den)*7;
  return loss>0?loss:null;
}
function estimateDate(goal, rateOverride){ if(currentWeight()<=goal)return"atteint"; const r=rateOverride||trendKgPerWeek()||0.5; const d=new Date(); d.setDate(d.getDate()+Math.ceil((currentWeight()-goal)/Math.max(.1,r)*7)); return d.toLocaleDateString("fr-CH",{day:"2-digit",month:"2-digit",year:"numeric"}); }
function nextGoal(){ return state.goals.find(g=>currentWeight()>g) || Number(state.profile.targetWeight); }
function medLevelAt(timestamp, future=false){
  const half=7*86400000; let list=sorted("injections");
  if(future){ list=[...list]; let d=parseLocalDate(nextInjectionDate()); while(d.getTime()<=timestamp){ const date=toISO(d); if(!list.some(i=>i.date===date)) list.push({date,time:state.profile.injectionTime,dose:doseAtWeek(weeksSinceStart(date)),clicks:clicksAtWeek(weeksSinceStart(date)),site:nextSite()}); d.setDate(d.getDate()+7); } }
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
  $("#app").innerHTML = `<main class="app">${header()}${nav(view)}<div class="bottom-actions"><button class="btn primary" onclick="quickAdd()">+</button></div>${viewHTML(view)}</main>${settingsModal()}${chartModal()}<div class="toast" id="toast"></div>${celebrationOverlay()}`;
  requestAnimationFrame(()=>{ drawAllCharts(); checkTwoDigitCelebration(); });
}
function header(){
  return `<header class="topbar"><div class="brand"><div class="logo">69</div><div><div class="kicker">Mission69 · ${esc(VERSION)}</div><h1>Mission69</h1><p class="sub">Manuel, simple, beau, efficace.</p></div></div><div class="actions"><button class="btn hide-sm" onclick="exportJSON()">Exporter</button><button class="btn primary" onclick="openSettings()">Réglages</button></div></header>`;
}
function nav(view){
  const tabs=[["dashboard","Dashboard"],["add","Ajouter"],["tables","Tableaux"],["injections","Injections"],["daily","Journal"],["goals","Objectifs"],["photos","Photos"],["backup","Backup"]];
  return `<nav class="nav">${tabs.map(([id,l])=>`<button class="tab ${view===id?'active':''}" onclick="setView('${id}')">${l}</button>`).join("")}</nav>`;
}
function setView(v){ state.ui.view=v; persist(); }
function gotoTable(t){ state.ui.view="tables"; state.ui.table=t; persist(); }
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
  const cw=currentWeight(), pg=progressPct(), next=nextInjectionDate(), ng=nextGoal(), rate=trendKgPerWeek(), wk=weeksSinceStart(next);
  return `<section class="layout">
    <div class="grid">
      <div class="card hero clickable" onclick="gotoTable('weights')"><div class="row wrap"><span class="label">Poids actuel</span><span class="btn primary">Modifier les poids</span></div><div class="big">${cw.toFixed(1)} <small>kg</small></div><div class="progress"><div class="bar" style="width:${pg}%"></div></div><div class="row muted"><span>${pg.toFixed(0)} % de la mission</span><span>${Math.max(0,remainingKg()).toFixed(1)} kg restants</span></div></div>
      <div class="grid four">
        ${metric("IMC",bmi().toFixed(1),bmiLabel(),"gotoTable('measurements')")}
        ${metric("Tendance",rate?rate.toFixed(2)+" kg/sem.":"—","Modifier les pesées","gotoTable('weights')")}
        ${metric("2 chiffres", currentWeight()<100 ? "DÉBLOQUÉ" : round1(currentWeight()-100).toFixed(1)+" kg", currentWeight()<100 ? "palier psychologique majeur" : "avant le monde à 2 chiffres", "setView('goals')")}
        ${metric("Prochain palier",ng+" kg",estimateDate(ng),"setView('goals')")}
      </div>
    </div>
    <div class="grid">
      <div class="card clickable" onclick="setView('injections')">${ring(medLevelAt(Date.now()),"niveau estimé")}<p class="muted">Dose actuelle : <b>${doseAtWeek(weeksSinceStart()).toFixed(2)} mg</b> · <b>${clicksAtWeek(weeksSinceStart())} clics</b> · semaine ${weeksSinceStart()}</p></div>
      <div class="card clickable" onclick="gotoTable('injections')"><div class="label">Prochaine injection</div><div class="stat">${fmtShort(next)}</div><p class="muted">${esc(state.profile.injectionTime)} · ${doseAtWeek(wk).toFixed(2)} mg · ${clicksAtWeek(wk)} clics · ${esc(nextSite())}</p><button class="btn primary" onclick="event.stopPropagation();addInjectionQuick()">Injection faite</button></div>
    </div>
  </section>
  <section class="grid two" style="margin-top:18px">
    <div class="card"><div class="row wrap"><h2 class="section-title">Courbe poids + projection</h2><button class="btn primary" onclick="openChart()">Agrandir</button></div><div class="canvas-wrap"><canvas id="weightChart"></canvas></div></div>
    <div class="card"><h2 class="section-title">Coach</h2><p class="notice success">${esc(insight())}</p><hr><div class="grid two">${metric("Objectif 100",estimateDate(100),"si tendance actuelle","gotoTable('weights')")}${metric("Objectif final",estimateDate(Number(state.profile.targetWeight)),state.profile.targetWeight+" kg","setView('goals')")}</div><hr>${miniHabits()}</div>
  </section>`;
}
function metric(label,val,sub,onClick){
  const click = onClick ? ` clickable" onclick="${onClick}` : "";
  return `<div class="metric${click}"><span class="label">${esc(label)}</span><br><b>${esc(val)}</b><small>${esc(sub)}</small></div>`;
}
function ring(val,label){ const off=540-(540*clamp(val,0,100)/100); return `<div class="ring-wrap"><svg class="ring" viewBox="0 0 200 200"><defs><linearGradient id="grad" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#78FFD6"/><stop offset=".55" stop-color="#83A6FF"/><stop offset="1" stop-color="#FF77DC"/></linearGradient></defs><circle class="base" cx="100" cy="100" r="86"></circle><circle class="value" cx="100" cy="100" r="86" style="stroke-dashoffset:${off}"></circle></svg><div class="ring-label"><b>${val}%</b><span>${esc(label)}</span></div></div>`; }

function addView(){
  const wk=weeksSinceStart();
  return `<section class="grid two">
    <div class="card"><h2 class="section-title">Ajouter une pesée</h2><div class="formgrid">${field("Date","newWeightDate",todayISO(),"date")}${field("Poids kg","newWeightKg","","number","ex. 115.4")}</div><br><textarea id="newWeightNote" rows="2" placeholder="Note optionnelle"></textarea><br><br><button class="btn primary" onclick="addWeightForm()">Ajouter</button></div>
    <div class="card"><h2 class="section-title">Ajouter une injection</h2><div class="formgrid">${field("Date","newInjDate",todayISO(),"date")}${field("Heure","newInjTime",state.profile.injectionTime,"time")}${field("Dose mg","newInjDose",doseAtWeek(wk).toFixed(2),"number")}${field("Clics","newInjClicks",clicksAtWeek(wk),"number")}<div class="field"><label>Site</label><select id="newInjSite">${state.sites.map(s=>`<option ${s===nextSite()?"selected":""}>${esc(s)}</option>`).join("")}</select></div><div class="field"><label>Note</label><input id="newInjNote" placeholder="Optionnel"></div></div><br><button class="btn primary" onclick="addInjectionForm()">Ajouter</button></div>
  </section>
  <section class="grid two" style="margin-top:18px">
    <div class="card"><h2 class="section-title">Mensurations</h2><div class="formgrid">${measurementFields("new")}</div><br><button class="btn primary" onclick="addMeasurementForm()">Ajouter</button></div>
    <div class="card"><h2 class="section-title">Journal rapide</h2>${miniHabits()}<hr><div class="chips">${["🙂 rien","🤢 nausée","🔥 reflux","💩 constipation","😴 fatigue","🍽️ satiété","🍺 alcool"].map(s=>`<button class="chip" onclick="addSymptom('${esc(s)}')">${esc(s)}</button>`).join("")}</div></div>
  </section>`;
}
function field(label,id,value,type,ph=""){ return `<div class="field"><label for="${id}">${esc(label)}</label><input id="${id}" type="${type}" value="${esc(value)}" placeholder="${esc(ph)}" step="0.01"></div>`; }
function measurementFields(prefix){
  return `${field("Date",prefix+"MDate",todayISO(),"date")}${field("Taille cm",prefix+"Waist","","number")}${field("Ventre cm",prefix+"Belly","","number")}${field("Hanches cm",prefix+"Hips","","number")}${field("Poitrine cm",prefix+"Chest","","number")}${field("Mollet gauche",prefix+"CalfL","","number")}${field("Mollet droit",prefix+"CalfR","","number")}${field("Bras gauche",prefix+"ArmL","","number")}${field("Bras droit",prefix+"ArmR","","number")}${field("Cuisse gauche",prefix+"ThighL","","number")}${field("Cuisse droite",prefix+"ThighR","","number")}`;
}

function tablesView(){
  const table=state.ui.table||"weights";
  return `<section class="card"><div class="row wrap"><div><h2 class="section-title">Tableaux modifiables</h2><p class="muted">Tu peux tout corriger, puis cliquer une seule fois sur <b>Enregistrer tout</b>.</p></div><div class="chips">${[["weights","Poids"],["injections","Injections"],["measurements","Mensurations"],["symptoms","Journal"]].map(([id,l])=>`<button class="chip ${table===id?"active":""}" onclick="setTable('${id}')">${l}</button>`).join("")}</div></div></section><section style="margin-top:18px">${tableHTML(table)}</section>`;
}
function setTable(t){ state.ui.table=t; persist(); }
function tableHTML(t){ if(t==="injections")return injectionsTable(); if(t==="measurements")return measurementsTable(); if(t==="symptoms")return symptomsTable(); return weightsTable(); }

function weightsTable(){
  return `<div class="card table-card"><div class="table-head"><div><h2 class="section-title">Liste des poids</h2><p class="muted">Modifie toutes les lignes puis sauvegarde en une fois.</p></div></div><div class="table-actions"><button class="btn primary" onclick="saveAllWeights()">Enregistrer tout</button><button class="btn" onclick="addEmptyWeight()">+ ligne</button></div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Poids kg</th><th>Note</th><th>Suppr.</th></tr></thead><tbody>${sorted("weights").slice().reverse().map(w=>`<tr><td><input id="w_date_${w.id}" type="date" value="${esc(w.date)}"></td><td><input id="w_kg_${w.id}" type="number" step="0.1" value="${esc(w.kg)}"></td><td><input class="wide" id="w_note_${w.id}" value="${esc(w.note)}"></td><td><input class="delete-check" id="w_del_${w.id}" type="checkbox"></td></tr>`).join("")}</tbody></table></div></div>`;
}
function injectionsTable(){
  return `<div class="card table-card"><div class="table-head"><div><h2 class="section-title">Liste des injections</h2><p class="muted">Dose, clics, site et date modifiables en masse.</p></div></div><div class="table-actions"><button class="btn primary" onclick="saveAllInjections()">Enregistrer tout</button><button class="btn" onclick="addEmptyInjection()">+ ligne</button></div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Heure</th><th>Dose mg</th><th>Clics</th><th>Site</th><th>Note</th><th>Suppr.</th></tr></thead><tbody>${sorted("injections").slice().reverse().map(i=>`<tr><td><input id="i_date_${i.id}" type="date" value="${esc(i.date)}"></td><td><input id="i_time_${i.id}" type="time" value="${esc(i.time)}"></td><td><input class="narrow" id="i_dose_${i.id}" type="number" step="0.01" value="${esc(i.dose)}"></td><td><input class="narrow" id="i_clicks_${i.id}" type="number" step="1" value="${esc(i.clicks ?? defaultClicks(i.dose))}"></td><td><select id="i_site_${i.id}">${state.sites.map(s=>`<option ${s===i.site?"selected":""}>${esc(s)}</option>`).join("")}</select></td><td><input class="wide" id="i_note_${i.id}" value="${esc(i.note)}"></td><td><input class="delete-check" id="i_del_${i.id}" type="checkbox"></td></tr>`).join("")}</tbody></table></div></div>`;
}
function measurementsTable(){
  return `<div class="card table-card"><div class="table-head"><div><h2 class="section-title">Liste des mensurations</h2><p class="muted">Taille, ventre, hanches, poitrine, mollets, bras et cuisses.</p></div></div><div class="table-actions"><button class="btn primary" onclick="saveAllMeasurements()">Enregistrer tout</button><button class="btn" onclick="addEmptyMeasurement()">+ ligne</button></div><div class="table-wrap"><table style="min-width:1320px"><thead><tr><th>Date</th><th>Taille</th><th>Ventre</th><th>Hanches</th><th>Poitrine</th><th>Mollet G</th><th>Mollet D</th><th>Bras G</th><th>Bras D</th><th>Cuisse G</th><th>Cuisse D</th><th>Note</th><th>Suppr.</th></tr></thead><tbody>${sorted("measurements").slice().reverse().map(m=>`<tr><td><input id="m_date_${m.id}" type="date" value="${esc(m.date)}"></td>${mInput(m,"waist")}${mInput(m,"belly")}${mInput(m,"hips")}${mInput(m,"chest")}${mInput(m,"calfL")}${mInput(m,"calfR")}${mInput(m,"armL")}${mInput(m,"armR")}${mInput(m,"thighL")}${mInput(m,"thighR")}<td><input class="wide" id="m_note_${m.id}" value="${esc(m.note)}"></td><td><input class="delete-check" id="m_del_${m.id}" type="checkbox"></td></tr>`).join("")}</tbody></table></div></div>`;
}
function mInput(m,k){ return `<td><input class="narrow" id="m_${k}_${m.id}" type="number" step="0.1" value="${esc(m[k]??"")}"></td>`; }
function symptomsTable(){
  return `<div class="card table-card"><div class="table-head"><div><h2 class="section-title">Liste du journal</h2><p class="muted">Symptômes séparés par des virgules.</p></div></div><div class="table-actions"><button class="btn primary" onclick="saveAllSymptoms()">Enregistrer tout</button><button class="btn" onclick="addEmptySymptom()">+ ligne</button></div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Symptômes</th><th>Intensité</th><th>Note</th><th>Suppr.</th></tr></thead><tbody>${sorted("symptoms").slice().reverse().map(s=>`<tr><td><input id="s_date_${s.id}" type="date" value="${esc(s.date)}"></td><td><input class="wide" id="s_items_${s.id}" value="${esc((s.items||[]).join(", "))}"></td><td><input class="narrow" id="s_level_${s.id}" type="number" min="0" max="5" value="${esc(s.level||1)}"></td><td><input class="wide" id="s_note_${s.id}" value="${esc(s.note)}"></td><td><input class="delete-check" id="s_del_${s.id}" type="checkbox"></td></tr>`).join("")}</tbody></table></div></div>`;
}

function injectionsView(){
  return `<section class="grid two"><div class="card"><h2 class="section-title">Niveau Wegovy estimé</h2><div class="canvas-wrap small"><canvas id="medChart"></canvas></div><p class="notice"><b>Lecture :</b> axe gauche = niveau relatif estimé en %, axe bas = temps. À gauche : aujourd’hui. À droite : dans 42 jours. La courbe projette l’effet des injections enregistrées et prévues.</p></div><div class="card"><h2 class="section-title">Prochaine injection</h2><div class="stat">${fmtShort(nextInjectionDate())}</div><p class="muted">${esc(state.profile.injectionTime)} · ${doseAtWeek(weeksSinceStart(nextInjectionDate())).toFixed(2)} mg · ${clicksAtWeek(weeksSinceStart(nextInjectionDate()))} clics · ${esc(nextSite())}</p><button class="btn primary" onclick="addInjectionQuick()">Injection faite</button><hr><div class="grid two">${state.doseSchedule.map(s=>metric("Semaine "+s.fromWeek+"+", Number(s.dose).toFixed(2)+" mg", (s.clicks||defaultClicks(s.dose))+" clics")).join("")}</div></div></section><section style="margin-top:18px">${injectionsTable()}</section>`;
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
  const two = currentWeight() < 100;
  return `<section class="card two-digit-hero">
    <div class="row wrap">
      <div>
        <span class="badge-legend">🔥 Palier mental majeur</span>
        <h2 class="section-title" style="margin-top:14px">Le monde à 2 chiffres</h2>
        <p class="muted">${two ? "Tu es passé sous les 100 kg. Ce n’est pas juste un nombre : c’est un cap psychologique énorme." : "Le passage sous 100 kg est un objectif spécial. À 99.9 kg, la tête comprend enfin que la mission a vraiment basculé."}</p>
      </div>
      <div>
        <div class="stat">${two ? "DÉBLOQUÉ" : round1(currentWeight()-100).toFixed(1)+" kg"}</div>
        <button class="btn primary" onclick="showCelebration()">Rejouer la fête</button>
      </div>
    </div>
  </section>
  <section class="card" style="margin-top:18px"><h2 class="section-title">Paliers</h2><div class="targets">${state.goals.map(g=>`<div class="target ${currentWeight()<=g?"done":""}"><b>${g} kg</b><small>${currentWeight()<=g?"débloqué 🏆":"reste "+round1(currentWeight()-g).toFixed(1)+" kg · "+estimateDate(g)}</small></div>`).join("")}</div></section>
  <section class="grid four" style="margin-top:18px">${metric("0.3 kg/sem.",estimateDate(Number(state.profile.targetWeight),.3),"lent")}${metric("0.5 kg/sem.",estimateDate(Number(state.profile.targetWeight),.5),"réaliste")}${metric("0.7 kg/sem.",estimateDate(Number(state.profile.targetWeight),.7),"très bon")}${metric("1 kg/sem.",estimateDate(Number(state.profile.targetWeight),1),"agressif")}</section>`;
}
function photosView(){
  const first=state.photos[0], last=state.photos.at(-1);
  return `<section class="grid two"><div class="card"><h2 class="section-title">Ajouter photo</h2><input id="photoInput" type="file" accept="image/*"><br><br><input id="photoLabel" placeholder="Label : face, profil, mois 1..."><br><br><button class="btn primary" onclick="addPhoto()">Ajouter</button><p class="notice">Photos compressées et stockées localement. Export JSON recommandé.</p></div><div class="card"><h2 class="section-title">Avant / après</h2>${first&&last&&first.id!==last.id?`<div class="compare"><div class="photo"><img src="${first.data}"><div class="cap"><b>${esc(first.label)}</b><br><small class="muted">${fmtDate(first.date)}</small></div></div><div class="photo"><img src="${last.data}"><div class="cap"><b>${esc(last.label)}</b><br><small class="muted">${fmtDate(last.date)}</small></div></div></div>`:"<p class='muted'>Ajoute au moins deux photos.</p>"}</div></section><section class="photo-grid" style="margin-top:18px">${state.photos.slice().reverse().map(p=>`<div class="photo"><img src="${p.data}"><div class="cap"><b>${esc(p.label)}</b><br><small class="muted">${fmtDate(p.date)}</small><br><br><button class="btn danger small" onclick="deletePhoto('${p.id}')">Supprimer</button></div></div>`).join("")||"<div class='card'><p class='muted'>Aucune photo.</p></div>"}</section>`;
}
function backupView(){
  return `<section class="grid two"><div class="card"><h2 class="section-title">Sauvegarde</h2><p class="muted">Tout reste local. Exporte le JSON régulièrement.</p><div class="chips"><button class="btn primary" onclick="exportJSON()">Exporter JSON</button><button class="btn" onclick="importJSON()">Importer JSON</button><button class="btn" onclick="exportCSV()">Exporter CSV</button><button class="btn danger" onclick="resetAll()">Réinitialiser</button></div><hr><button class="btn danger" onclick="hardRefresh()">Forcer mise à jour / vider cache</button></div><div class="card"><h2 class="section-title">Diagnostic</h2>${metric("Version",VERSION,"PWA")}${metric("Données",`${state.weights.length} poids · ${state.injections.length} injections`,`${state.measurements.length} mensurations · ${state.photos.length} photos`)}</div></section>`;
}

function addWeightForm(){ const kg=num(val("newWeightKg")); if(!kg||kg<45||kg>220)return toast("Poids invalide"); state.weights.push({id:uid(),date:val("newWeightDate")||todayISO(),kg:round1(kg),note:val("newWeightNote")||""}); state.weights.sort((a,b)=>a.date.localeCompare(b.date)); persist(); toast("Poids ajouté"); }
function addInjectionForm(){ const dose=num(val("newInjDose")); if(!dose)return toast("Dose invalide"); const clicks=num(val("newInjClicks")) || defaultClicks(dose); state.injections.push({id:uid(),date:val("newInjDate")||todayISO(),time:val("newInjTime")||state.profile.injectionTime,dose,clicks,site:val("newInjSite")||nextSite(),note:val("newInjNote")||""}); state.injections.sort((a,b)=>a.date.localeCompare(b.date)); persist(); toast("Injection ajoutée"); }
function addInjectionQuick(){ const wk=weeksSinceStart(); state.injections.push({id:uid(),date:todayISO(),time:state.profile.injectionTime,dose:doseAtWeek(wk),clicks:clicksAtWeek(wk),site:nextSite(),note:""}); state.injections.sort((a,b)=>a.date.localeCompare(b.date)); persist(); toast("Injection enregistrée"); }
function addMeasurementForm(){ const m={id:uid(),date:val("newMDate")||todayISO(),waist:num(val("newWaist")),belly:num(val("newBelly")),hips:num(val("newHips")),chest:num(val("newChest")),calfL:num(val("newCalfL")),calfR:num(val("newCalfR")),armL:num(val("newArmL")),armR:num(val("newArmR")),thighL:num(val("newThighL")),thighR:num(val("newThighR")),note:""}; if(!hasMeasure(m))return toast("Ajoute au moins une mesure"); state.measurements.push(m); state.measurements.sort((a,b)=>a.date.localeCompare(b.date)); persist(); toast("Mensuration ajoutée"); }
function hasMeasure(m){ return ["waist","belly","hips","chest","calfL","calfR","armL","armR","thighL","thighR"].some(k=>m[k]); }

function addEmptyWeight(){ state.weights.push({id:uid(),date:todayISO(),kg:currentWeight(),note:""}); state.ui.view="tables"; state.ui.table="weights"; persist(); }
function addEmptyInjection(){ const wk=weeksSinceStart(); state.injections.push({id:uid(),date:todayISO(),time:state.profile.injectionTime,dose:doseAtWeek(wk),clicks:clicksAtWeek(wk),site:nextSite(),note:""}); state.ui.view="tables"; state.ui.table="injections"; persist(); }
function addEmptyMeasurement(){ state.measurements.push({id:uid(),date:todayISO(),waist:null,belly:null,hips:null,chest:null,calfL:null,calfR:null,armL:null,armR:null,thighL:null,thighR:null,note:""}); state.ui.view="tables"; state.ui.table="measurements"; persist(); }
function addEmptySymptom(){ state.symptoms.push({id:uid(),date:todayISO(),items:[],level:1,note:""}); state.ui.view="tables"; state.ui.table="symptoms"; persist(); }

function saveAllWeights(){
  const next=[]; for(const w of state.weights){ if($("#w_del_"+w.id)?.checked) continue; const kg=num(val("w_kg_"+w.id)); if(!kg||kg<45||kg>220)return toast("Poids invalide"); next.push({id:w.id,date:val("w_date_"+w.id)||todayISO(),kg:round1(kg),note:val("w_note_"+w.id)||""}); }
  state.weights=next.sort((a,b)=>a.date.localeCompare(b.date)); persist(); toast("Tableau poids enregistré");
}
function saveAllInjections(){
  const next=[]; for(const i of state.injections){ if($("#i_del_"+i.id)?.checked) continue; const dose=num(val("i_dose_"+i.id)); if(!dose)return toast("Dose invalide"); next.push({id:i.id,date:val("i_date_"+i.id)||todayISO(),time:val("i_time_"+i.id)||state.profile.injectionTime,dose,clicks:num(val("i_clicks_"+i.id))||defaultClicks(dose),site:val("i_site_"+i.id)||state.sites[0],note:val("i_note_"+i.id)||""}); }
  state.injections=next.sort((a,b)=>a.date.localeCompare(b.date)); persist(); toast("Tableau injections enregistré");
}
function saveAllMeasurements(){
  const next=[]; for(const m of state.measurements){ if($("#m_del_"+m.id)?.checked) continue; const row={id:m.id,date:val("m_date_"+m.id)||todayISO(),waist:num(val("m_waist_"+m.id)),belly:num(val("m_belly_"+m.id)),hips:num(val("m_hips_"+m.id)),chest:num(val("m_chest_"+m.id)),calfL:num(val("m_calfL_"+m.id)),calfR:num(val("m_calfR_"+m.id)),armL:num(val("m_armL_"+m.id)),armR:num(val("m_armR_"+m.id)),thighL:num(val("m_thighL_"+m.id)),thighR:num(val("m_thighR_"+m.id)),note:val("m_note_"+m.id)||""}; if(hasMeasure(row)) next.push(row); }
  state.measurements=next.sort((a,b)=>a.date.localeCompare(b.date)); persist(); toast("Tableau mensurations enregistré");
}
function saveAllSymptoms(){
  const next=[]; for(const s of state.symptoms){ if($("#s_del_"+s.id)?.checked) continue; next.push({id:s.id,date:val("s_date_"+s.id)||todayISO(),items:(val("s_items_"+s.id)||"").split(",").map(x=>x.trim()).filter(Boolean),level:Number(val("s_level_"+s.id))||1,note:val("s_note_"+s.id)||""}); }
  state.symptoms=next.sort((a,b)=>a.date.localeCompare(b.date)); persist(); toast("Tableau journal enregistré");
}

function toggleHabit(k){ const h=habitToday(); h[k]=!h[k]; persist(); }
function addWater(d){ const h=habitToday(); h.water=clamp(round1(Number(h.water||0)+d),0,8); persist(); }
function addSymptom(item){ let s=state.symptoms.find(x=>x.date===todayISO()); if(!s){ s={id:uid(),date:todayISO(),items:[],level:1,note:""}; state.symptoms.push(s); } if(!s.items.includes(item))s.items.push(item); persist(); toast("Journal mis à jour"); }
function saveTodayNote(){ let s=state.symptoms.find(x=>x.date===todayISO()); if(!s){ s={id:uid(),date:todayISO(),items:[],level:1,note:""}; state.symptoms.push(s); } s.note=val("symptomNote")||""; persist(); toast("Note enregistrée"); }
function quickAdd(){ if((state.ui.view||"")==="injections")addInjectionQuick(); else setView("add"); }


function celebrationOverlay(){
  const colors=["#78ffd6","#83a6ff","#ff77dc","#ffc66e","#ffffff"];
  const pieces=Array.from({length:90},(_,i)=>{
    const left=(i*37)%100, delay=((i*0.073)%2.8).toFixed(2), dur=(2.6+(i%9)*0.16).toFixed(2), color=colors[i%colors.length];
    return `<span class="confetti" style="left:${left}%;background:${color};animation-delay:${delay}s;animation-duration:${dur}s"></span>`;
  }).join("");
  return `<div class="celebration" id="twoDigitCelebration">
    ${pieces}
    <div class="celebration-card">
      <div class="badge-legend">🏆 PALIER LÉGENDAIRE</div>
      <div class="celebration-title">2 CHIFFRES</div>
      <p class="celebration-sub">Tu es passé sous les 100 kg.</p>
      <p class="muted">C’est le palier psychologique qui change tout. Mission69 vient de basculer dans une autre dimension.</p>
      <div class="chips" style="justify-content:center;margin-top:18px">
        <button class="btn primary" onclick="closeCelebration()">Je savoure 🔥</button>
        <button class="btn" onclick="gotoTable('weights');closeCelebration()">Voir mes poids</button>
      </div>
    </div>
  </div>`;
}
function checkTwoDigitCelebration(){
  if(currentWeight() < 100 && !state.ui.twoDigitCelebrated){
    state.ui.twoDigitCelebrated = true;
    save();
    setTimeout(showCelebration, 250);
  }
}
function showCelebration(){
  const el=$("#twoDigitCelebration");
  if(el) el.classList.add("open");
}
function closeCelebration(){
  const el=$("#twoDigitCelebration");
  if(el) el.classList.remove("open");
}

function chartModal(){ return `<div class="modal" id="chartModal"><div class="sheet"><div class="row wrap"><div><h2 class="section-title">Courbe du poids</h2><p class="muted">Trait plein = mesures réelles. Pointillé = projection selon la tendance actuelle.</p></div><button class="btn" onclick="closeChart()">Fermer</button></div><div class="canvas-wrap big"><canvas id="bigWeightChart"></canvas></div></div></div>`; }
function openChart(){ $("#chartModal").classList.add("open"); requestAnimationFrame(drawAllCharts); }
function closeChart(){ $("#chartModal").classList.remove("open"); }

function drawAllCharts(){ drawWeight("weightChart",true); drawWeight("bigWeightChart",true); drawMed("medChart"); }
function setupCanvas(id){ const c=document.getElementById(id); if(!c)return null; const r=c.getBoundingClientRect(), dpr=devicePixelRatio||1; c.width=Math.max(1,Math.round(r.width*dpr)); c.height=Math.max(1,Math.round(r.height*dpr)); const ctx=c.getContext("2d"); ctx.setTransform(dpr,0,0,dpr,0,0); return {ctx,W:r.width,H:r.height}; }
function drawWeight(id,proj){ const s=setupCanvas(id); if(!s)return; let pts=sorted("weights").map(w=>({v:Number(w.kg),real:true})); if(pts.length===1)pts.push({v:pts[0].v,real:true}); const rate=trendKgPerWeek()||.5; if(proj&&pts.length){ const last=pts.at(-1).v; for(let i=1;i<=24;i++)pts.push({v:Math.max(Number(state.profile.targetWeight),last-rate*i),real:false}); } drawLine(s.ctx,s.W,s.H,pts,{target:Number(state.profile.targetWeight),unit:"kg",split:pts.findIndex(p=>!p.real),xLabel:"Semaines"}); }
function drawMed(id){
  const s=setupCanvas(id); if(!s)return; const {ctx,W,H}=s, pad=38, now=Date.now(), pts=[]; for(let i=0;i<=42;i++)pts.push({x:i,v:medLevelAt(now+i*86400000,true)});
  ctx.clearRect(0,0,W,H);
  const sx=x=>pad+(x/42)*(W-pad*2), sy=v=>pad+(1-v/100)*(H-pad*2);
  ctx.strokeStyle="rgba(255,255,255,.10)"; ctx.lineWidth=1;
  [0,25,50,75,100].forEach(v=>{ const y=sy(v); ctx.beginPath(); ctx.moveTo(pad,y); ctx.lineTo(W-pad,y); ctx.stroke(); });
  [0,14,28,42].forEach(x=>{ const xx=sx(x); ctx.beginPath(); ctx.moveTo(xx,pad); ctx.lineTo(xx,H-pad); ctx.stroke(); });
  ctx.strokeStyle="#83a6ff"; ctx.lineWidth=4; ctx.lineCap="round"; ctx.lineJoin="round"; ctx.beginPath(); pts.forEach((p,i)=>i?ctx.lineTo(sx(p.x),sy(p.v)):ctx.moveTo(sx(p.x),sy(p.v))); ctx.stroke();
  ctx.fillStyle="rgba(255,255,255,.78)"; ctx.font="800 12px -apple-system,BlinkMacSystemFont,Arial";
  ctx.fillText("100%",6,sy(100)+4); ctx.fillText("50%",12,sy(50)+4); ctx.fillText("0%",18,sy(0)+4);
  ctx.fillText("Aujourd’hui",pad,H-10); ctx.fillText("+14j",sx(14)-12,H-10); ctx.fillText("+28j",sx(28)-12,H-10); ctx.fillText("+42j",W-pad-28,H-10);
  ctx.fillText("niveau relatif estimé",pad,18);
}
function drawLine(ctx,W,H,pts,opt){
  if(!pts.length)return; const pad=38, vals=pts.map(p=>p.v); if(opt.target!==null&&opt.target!==undefined)vals.push(opt.target); vals.push(Number(state.profile.startWeight)||pts[0].v); const min=Math.floor(Math.min(...vals)-2), max=Math.ceil(Math.max(...vals)+2);
  const sx=i=>pad+(i/Math.max(1,pts.length-1))*(W-pad*2), sy=v=>pad+(1-(v-min)/Math.max(1,max-min))*(H-pad*2);
  ctx.clearRect(0,0,W,H); ctx.strokeStyle="rgba(255,255,255,.10)"; ctx.lineWidth=1; for(let i=0;i<5;i++){ const y=pad+i*(H-pad*2)/4; ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(W-pad,y);ctx.stroke(); }
  if(opt.target!==null&&opt.target!==undefined){ const y=sy(opt.target); ctx.strokeStyle="rgba(255,198,110,.65)"; ctx.setLineDash([6,6]); ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(W-pad,y);ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle="rgba(255,255,255,.72)"; ctx.font="800 12px -apple-system"; ctx.fillText("objectif "+opt.target+" "+opt.unit,Math.max(pad,W-pad-110),y-8); }
  const split=opt.split&&opt.split>0?opt.split:pts.length, real=pts.slice(0,split), fut=pts.slice(split); ctx.lineWidth=4; ctx.lineCap="round"; ctx.lineJoin="round"; ctx.strokeStyle=opt.color||"#78ffd6"; ctx.beginPath(); real.forEach((p,i)=>i?ctx.lineTo(sx(i),sy(p.v)):ctx.moveTo(sx(i),sy(p.v))); ctx.stroke();
  if(fut.length){ ctx.strokeStyle="rgba(131,166,255,.68)"; ctx.setLineDash([9,8]); ctx.beginPath(); ctx.moveTo(sx(real.length-1),sy(real.at(-1).v)); fut.forEach((p,j)=>ctx.lineTo(sx(real.length+j),sy(p.v))); ctx.stroke(); ctx.setLineDash([]); }
  ctx.fillStyle="#fff"; real.forEach((p,i)=>{ctx.beginPath();ctx.arc(sx(i),sy(p.v),5,0,Math.PI*2);ctx.fill();}); ctx.fillStyle="rgba(255,255,255,.72)"; ctx.font="800 12px -apple-system"; ctx.fillText(max+" "+opt.unit,pad,18); ctx.fillText(min+" "+opt.unit,pad,H-10);
}

async function addPhoto(){ const f=$("#photoInput")?.files?.[0]; if(!f)return toast("Choisis une photo"); const data=await compressImage(f,1200,.78); state.photos.push({id:uid(),date:todayISO(),label:val("photoLabel")||"Photo",data}); persist(); toast("Photo ajoutée"); }
function compressImage(file,max,quality){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onerror=rej; r.onload=()=>{ const img=new Image(); img.onerror=rej; img.onload=()=>{ const scale=Math.min(1,max/Math.max(img.width,img.height)); const c=document.createElement("canvas"); c.width=Math.round(img.width*scale); c.height=Math.round(img.height*scale); c.getContext("2d").drawImage(img,0,0,c.width,c.height); res(c.toDataURL("image/jpeg",quality)); }; img.src=r.result; }; r.readAsDataURL(file); }); }
function deletePhoto(id){ if(!confirm("Supprimer cette photo ?"))return; state.photos=state.photos.filter(p=>p.id!==id); persist(); }

function exportJSON(){ download(new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),"mission69-"+todayISO()+".json"); }
function exportCSV(){ const rows=["type,date,value1,value2,value3,value4,value5,value6,value7,value8,value9,value10,note",...state.weights.map(w=>`poids,${w.date},${w.kg},,,,,,,,,,${csv(w.note)}`),...state.injections.map(i=>`injection,${i.date},${i.dose},${i.clicks},${csv(i.site)},${csv(i.time)},,,,,,${csv(i.note)}`),...state.measurements.map(m=>`mensuration,${m.date},${m.waist??""},${m.belly??""},${m.hips??""},${m.chest??""},${m.calfL??""},${m.calfR??""},${m.armL??""},${m.armR??""},${m.thighL??""},${m.thighR??""},${csv(m.note)}`),...state.symptoms.map(s=>`journal,${s.date},${csv((s.items||[]).join(" | "))},${s.level||""},,,,,,,,,${csv(s.note)}`)]; download(new Blob([rows.join("\n")],{type:"text/csv;charset=utf-8"}),"mission69-"+todayISO()+".csv"); }
function csv(v){ return '"' + String(v||"").replace(/"/g,'""') + '"'; }
function download(blob,name){ const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; a.click(); URL.revokeObjectURL(a.href); }
function importJSON(){ const i=document.createElement("input"); i.type="file"; i.accept=".json,application/json"; i.onchange=()=>{ const f=i.files[0]; if(!f)return; const r=new FileReader(); r.onload=()=>{ try{ state=migrate(JSON.parse(r.result)); persist(); toast("Import réussi"); } catch(e){ toast("JSON invalide"); } }; r.readAsText(f); }; i.click(); }
function resetAll(){ if(!confirm("Réinitialiser toutes les données ?"))return; state=clone(DEFAULT); persist(); }
async function hardRefresh(){ if("serviceWorker" in navigator){ const regs=await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r=>r.unregister())); } if("caches" in window){ const keys=await caches.keys(); await Promise.all(keys.map(k=>caches.delete(k))); } location.reload(); }

function settingsModal(){
  return `<div class="modal" id="settingsModal"><div class="sheet"><div class="row wrap"><h2 class="section-title">Réglages</h2><button class="btn" onclick="closeSettings()">Fermer</button></div><div class="formgrid">${field("Nom","setName",state.profile.name,"text")}${field("Taille cm","setHeight",state.profile.heightCm,"number")}${field("Poids départ","setStart",state.profile.startWeight,"number")}${field("Objectif kg","setTarget",state.profile.targetWeight,"number")}${field("Date début","setDate",state.profile.startDate,"date")}${field("Heure injection","setTime",state.profile.injectionTime,"time")}</div><hr><h3>Plan dose + clics</h3><div class="formgrid">${doseSettingsFields()}</div><br><button class="btn primary" onclick="saveSettings()">Enregistrer</button></div></div>`;
}
function doseSettingsFields(){
  return state.doseSchedule.map((s,idx)=>`${field("Semaine "+s.fromWeek+" dose", "dose_"+idx, s.dose, "number")}${field("Semaine "+s.fromWeek+" clics", "clicks_"+idx, s.clicks||defaultClicks(s.dose), "number")}`).join("");
}
function openSettings(){ $("#settingsModal").classList.add("open"); }
function closeSettings(){ $("#settingsModal").classList.remove("open"); }
function saveSettings(){
  state.profile.name=val("setName")||"Patrice"; state.profile.heightCm=Number(val("setHeight"))||178; state.profile.startWeight=Number(val("setStart"))||116; state.profile.targetWeight=Number(val("setTarget"))||78; state.profile.startDate=val("setDate")||"2026-07-03"; state.profile.injectionTime=val("setTime")||"22:00";
  state.doseSchedule = state.doseSchedule.map((s,idx)=>({fromWeek:s.fromWeek,dose:Number(val("dose_"+idx))||s.dose,clicks:Number(val("clicks_"+idx))||defaultClicks(Number(val("dose_"+idx))||s.dose)}));
  closeSettings(); persist(); toast("Réglages enregistrés");
}
function toast(msg){ const el=$("#toast"); if(!el)return; el.textContent=msg; el.style.display="block"; clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.style.display="none",2200); }
window.addEventListener("resize",()=>requestAnimationFrame(drawAllCharts));
if("serviceWorker" in navigator) window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
render();
