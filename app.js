
"use strict";

const VERSION = "Dream 1.2.0";
const STORAGE_KEY = "mission69_dream_v1";
const LEGACY_KEYS = ["mission69_pro_data", "mission69_v2_data", "mission69_v1_data", "mission69_v03_data"];
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const DEFAULT = {
  meta: { version: VERSION, createdAt: new Date().toISOString() },
  profile: {
    name: "Patrice",
    heightCm: 178,
    startDate: "2026-07-03",
    startWeight: 116,
    targetWeight: 78,
    injectionDay: 5,
    injectionTime: "22:00",
    officialWeighDay: 5
  },
  doseSchedule: [
    { fromWeek: 0, dose: 0.25 },
    { fromWeek: 4, dose: 0.5 },
    { fromWeek: 8, dose: 1.0 },
    { fromWeek: 12, dose: 1.0 }
  ],
  weights: [{ id: uid(), date: "2026-07-03", kg: 116, note: "Départ Wegovy" }],
  injections: [{ id: uid(), date: "2026-07-03", time: "22:00", dose: 0.25, site: "Ventre gauche", note: "Première injection" }],
  symptoms: [],
  habits: [],
  measurements: [],
  photos: [],
  sites: ["Ventre gauche", "Ventre droit", "Cuisse gauche", "Cuisse droite", "Bras gauche", "Bras droit"],
  selectedSite: "Ventre droit",
  goals: [110, 105, 100, 95, 90, 85, 80, 78],
  ui: { view: "dashboard" }
};

let state = loadState();
let deferredInstallPrompt = null;

function uid(){
  return "id_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-5);
}
function clone(obj){ return JSON.parse(JSON.stringify(obj)); }
function todayISO(){ return toISO(new Date()); }
function toISO(date){ return new Date(date).toISOString().slice(0, 10); }
function parseLocalDate(isoDate){ return new Date(isoDate + "T12:00:00"); }
function fmtDate(isoDate, opts){
  return parseLocalDate(isoDate).toLocaleDateString("fr-CH", opts || { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtShort(isoDate){
  return parseLocalDate(isoDate).toLocaleDateString("fr-CH", { weekday: "short", day: "2-digit", month: "2-digit" });
}
function esc(value){
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
}
function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }
function round1(n){ return Math.round(n * 10) / 10; }
function loadState(){
  let raw = localStorage.getItem(STORAGE_KEY);
  if(!raw){
    for(const key of LEGACY_KEYS){
      if(localStorage.getItem(key)){
        raw = localStorage.getItem(key);
        break;
      }
    }
  }
  if(!raw) return clone(DEFAULT);
  try { return migrate(JSON.parse(raw)); }
  catch(error){ return clone(DEFAULT); }
}
function migrate(input){
  const data = clone(DEFAULT);
  if(input.profile) data.profile = { ...data.profile, ...input.profile };
  if(Array.isArray(input.weights) && input.weights.length){
    data.weights = input.weights.map(w => ({
      id: w.id || uid(),
      date: w.date || todayISO(),
      kg: Number(w.kg),
      note: w.note || ""
    })).filter(w => w.date && Number.isFinite(w.kg)).sort((a,b) => a.date.localeCompare(b.date));
  }
  if(Array.isArray(input.injections)){
    data.injections = input.injections.map(i => ({
      id: i.id || uid(),
      date: i.date || todayISO(),
      time: i.time || data.profile.injectionTime,
      dose: Number(i.dose || doseAtWeek(weeksSinceStart(i.date || todayISO()))),
      site: i.site || data.selectedSite,
      note: i.note || ""
    })).sort((a,b) => a.date.localeCompare(b.date));
  }
  if(Array.isArray(input.symptoms)) data.symptoms = input.symptoms;
  if(Array.isArray(input.notes) && !Array.isArray(input.symptoms)){
    data.symptoms = input.notes.map(n => ({ id: uid(), date: n.date || todayISO(), items: [n.txt || String(n)], level: 1, note: "" }));
  }
  if(Array.isArray(input.habits)) data.habits = input.habits;
  if(Array.isArray(input.measurements)) data.measurements = input.measurements;
  if(Array.isArray(input.photos)) data.photos = input.photos;
  if(Array.isArray(input.goals)) data.goals = input.goals;
  if(Array.isArray(input.targets)) data.goals = input.targets;
  if(input.selectedSite) data.selectedSite = input.selectedSite;
  if(input.ui) data.ui = { ...data.ui, ...input.ui };
  data.meta.version = VERSION;
  return data;
}
function saveState(){
  state.meta.version = VERSION;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch(error) {
    showToast("Stockage plein : exporte puis supprime quelques photos.");
    return false;
  }
}
function persist(){
  if(saveState()) render();
}

function sortedWeights(){ return [...state.weights].sort((a,b) => a.date.localeCompare(b.date)); }
function sortedInjections(){ return [...state.injections].sort((a,b) => a.date.localeCompare(b.date)); }
function currentWeight(){
  const weights = sortedWeights();
  return weights.length ? Number(weights[weights.length - 1].kg) : Number(state.profile.startWeight);
}
function previousWeight(){
  const weights = sortedWeights();
  return weights.length > 1 ? Number(weights[weights.length - 2].kg) : currentWeight();
}
function startWeight(){ return Number(state.profile.startWeight); }
function targetWeight(){ return Number(state.profile.targetWeight); }
function lostKg(){ return round1(startWeight() - currentWeight()); }
function remainingKg(){ return round1(currentWeight() - targetWeight()); }
function progressPct(){
  const total = startWeight() - targetWeight();
  return total > 0 ? clamp((lostKg() / total) * 100, 0, 100) : 0;
}
function bmi(weight = currentWeight()){
  const h = Number(state.profile.heightCm) / 100;
  return weight / (h * h);
}
function bmiLabel(value = bmi()){
  if(value < 25) return "poids normal";
  if(value < 30) return "surpoids";
  if(value < 35) return "obésité I";
  if(value < 40) return "obésité II";
  return "obésité III";
}
function daysBetween(a, b){
  return Math.max(0, Math.round((parseLocalDate(b) - parseLocalDate(a)) / 86400000));
}
function weeksSinceStart(date = todayISO()){
  return Math.max(0, Math.floor((parseLocalDate(date) - new Date(state.profile.startDate + "T00:00:00")) / (7 * 86400000)));
}
function doseAtWeek(week){
  const schedule = [...state.doseSchedule].sort((a,b) => a.fromWeek - b.fromWeek);
  let dose = schedule[0]?.dose || 0.25;
  for(const step of schedule){
    if(week >= step.fromWeek) dose = Number(step.dose);
  }
  return dose;
}
function nextInjectionDate(){
  const now = new Date();
  const currentDay = now.getDay();
  let add = (Number(state.profile.injectionDay) - currentDay + 7) % 7;
  const currentTime = now.toTimeString().slice(0,5);
  if(add === 0 && currentTime >= state.profile.injectionTime) add = 7;
  const next = new Date(now);
  next.setDate(now.getDate() + add);
  return toISO(next);
}
function nextSuggestedSite(){
  const injections = sortedInjections();
  const last = injections[injections.length - 1];
  const sites = state.sites;
  if(!last) return state.selectedSite || sites[0];
  const idx = sites.indexOf(last.site);
  return sites[(idx + 1 + sites.length) % sites.length] || sites[0];
}
function trendKgPerWeek(){
  const weights = sortedWeights().slice(-10);
  if(weights.length < 2) return null;
  const firstDate = parseLocalDate(weights[0].date).getTime() / 86400000;
  const points = weights.map(w => ({
    x: (parseLocalDate(w.date).getTime() / 86400000) - firstDate,
    y: Number(w.kg)
  }));
  const n = points.length;
  const sx = points.reduce((s,p) => s + p.x, 0);
  const sy = points.reduce((s,p) => s + p.y, 0);
  const sxx = points.reduce((s,p) => s + p.x * p.x, 0);
  const sxy = points.reduce((s,p) => s + p.x * p.y, 0);
  const denom = n * sxx - sx * sx;
  if(!denom) return null;
  const slopePerDay = (n * sxy - sx * sy) / denom;
  const lossPerWeek = -slopePerDay * 7;
  return lossPerWeek > 0 ? lossPerWeek : null;
}
function estimateDateForGoal(goal){
  if(currentWeight() <= goal) return "atteint";
  const rate = trendKgPerWeek() || 0.5;
  const weeks = (currentWeight() - goal) / rate;
  const d = new Date();
  d.setDate(d.getDate() + Math.ceil(weeks * 7));
  return d.toLocaleDateString("fr-CH", { day:"2-digit", month:"2-digit", year:"numeric" });
}
function nextGoal(){
  return state.goals.find(g => currentWeight() > g) || targetWeight();
}
function medLevelAt(timestamp, includeFuture = false){
  const halfLife = 7 * 86400000;
  const injections = includeFuture ? projectedInjections(timestamp) : sortedInjections();
  let amount = 0;
  for(const inj of injections){
    const t = new Date(inj.date + "T" + (inj.time || state.profile.injectionTime) + ":00").getTime();
    if(t <= timestamp){
      const dose = Number(inj.dose || doseAtWeek(weeksSinceStart(inj.date)));
      amount += dose * Math.pow(0.5, (timestamp - t) / halfLife);
    }
  }
  const currentDose = doseAtWeek(weeksSinceStart(todayISO()));
  let steady = 0;
  for(let i = 0; i < 14; i++) steady += currentDose * Math.pow(0.5, i);
  return clamp(Math.round((amount / Math.max(steady, 0.25)) * 100), 0, 100);
}
function medLevel(){ return medLevelAt(Date.now(), false); }
function projectedInjections(untilTimestamp){
  const list = sortedInjections();
  const future = [...list];
  let d = parseLocalDate(nextInjectionDate());
  while(d.getTime() <= untilTimestamp){
    const date = toISO(d);
    if(!future.some(i => i.date === date)){
      future.push({ id: "future", date, time: state.profile.injectionTime, dose: doseAtWeek(weeksSinceStart(date)), site: nextSuggestedSite(), note: "projection" });
    }
    d.setDate(d.getDate() + 7);
  }
  return future.sort((a,b) => a.date.localeCompare(b.date));
}
function habitToday(){
  let h = state.habits.find(x => x.date === todayISO());
  if(!h){
    h = { id: uid(), date: todayISO(), water: 0, protein: false, slow: false, fiber: false, movement: false };
    state.habits.push(h);
  }
  return h;
}
function insightText(){
  const rate = trendKgPerWeek();
  const diff = round1(currentWeight() - previousWeight());
  if(state.injections.length === 0) return "Enregistre ta première injection pour activer le cockpit Wegovy.";
  if(sortedWeights().length < 2) return "Ajoute une deuxième pesée pour calculer une tendance fiable.";
  if(rate && rate >= 0.9) return `Grosse dynamique : environ ${rate.toFixed(1)} kg/semaine sur les dernières pesées. Hydratation et protéines prioritaires.`;
  if(rate && rate >= 0.4) return `Très propre : environ ${rate.toFixed(1)} kg/semaine. C’est le genre de rythme durable qu’on veut.`;
  if(diff > 0) return "Petite remontée depuis la dernière pesée : probablement eau, sel, transit ou timing. Regarde surtout la tendance.";
  return "Début de trajectoire. À faible dose, le but est d’installer la régularité avant de juger l’efficacité.";
}

function render(){
  const app = $("#app");
  const view = state.ui.view || "dashboard";
  app.innerHTML = `
    <main class="app">
      ${renderHeader()}
      ${renderNav(view)}
      ${renderView(view)}
    </main>
    ${renderSettingsModal()}
    <div class="toast" id="toast"></div>
  `;
  requestAnimationFrame(drawAllCharts);
}
function renderHeader(){
  return `
    <header class="topbar">
      <div class="brand">
        <div class="logo">69</div>
        <div>
          <div class="kicker">Mission69 · ${esc(VERSION)}</div>
          <h1>Mission69</h1>
          <p class="sub">Le cockpit Wegovy personnel de ${esc(state.profile.name)}.</p>
        </div>
      </div>
      <div class="actions">
        <button class="btn hide-sm" onclick="exportJSON()">Exporter</button>
        <button class="btn primary" onclick="openSettings()">Réglages</button>
      </div>
    </header>
  `;
}
function renderNav(view){
  const tabs = [
    ["dashboard","Dashboard"],
    ["weight","Poids"],
    ["injections","Injections"],
    ["daily","Journal"],
    ["goals","Objectifs"],
    ["photos","Photos"],
    ["history","Historique"],
    ["backup","Backup"]
  ];
  return `<nav class="nav">${tabs.map(([id,label]) => `<button class="tab ${view === id ? "active" : ""}" onclick="setView('${id}')">${label}</button>`).join("")}</nav>`;
}
function renderView(view){
  if(view === "weight") return renderWeight();
  if(view === "injections") return renderInjections();
  if(view === "daily") return renderDaily();
  if(view === "goals") return renderGoals();
  if(view === "photos") return renderPhotos();
  if(view === "history") return renderHistory();
  if(view === "backup") return renderBackup();
  return renderDashboard();
}
function renderDashboard(){
  const cw = currentWeight();
  const pg = progressPct();
  const ng = nextGoal();
  const rate = trendKgPerWeek();
  const next = nextInjectionDate();
  return `
    <section class="layout">
      <div class="grid">
        <div class="card hero">
          <div class="row wrap"><span class="label">Poids actuel</span><span class="btn primary">−${lostKg().toFixed(1)} kg</span></div>
          <div class="big">${cw.toFixed(1)} <small>kg</small></div>
          <div class="progress"><div class="bar" style="width:${pg}%"></div></div>
          <div class="row muted"><span>${pg.toFixed(0)} % de la mission</span><span>${Math.max(0, remainingKg()).toFixed(1)} kg restants</span></div>
        </div>
        <div class="grid three">
          ${metric("IMC", bmi().toFixed(1), bmiLabel())}
          ${metric("Tendance", rate ? rate.toFixed(2) + " kg/sem." : "—", "sur les dernières pesées")}
          ${metric("Prochain palier", ng + " kg", estimateDateForGoal(ng))}
        </div>
      </div>
      <div class="grid">
        <div class="card">
          ${progressRing(medLevel(), "niveau estimé")}
          <p class="muted">Dose théorique actuelle : <b>${doseAtWeek(weeksSinceStart()).toFixed(2)} mg</b> · semaine ${weeksSinceStart()}</p>
        </div>
        <div class="card">
          <div class="label">Prochaine injection</div>
          <div class="stat">${fmtShort(next)}</div>
          <p class="muted">${esc(state.profile.injectionTime)} · ${doseAtWeek(weeksSinceStart(next)).toFixed(2)} mg · site suggéré : <b>${esc(nextSuggestedSite())}</b></p>
          <div class="chips">
            <button class="btn primary" onclick="addInjection()">Injection faite</button>
            <button class="btn" onclick="setView('injections')">Détails</button>
          </div>
        </div>
      </div>
    </section>
    <section class="grid two" style="margin-top:18px">
      <div class="card">
        <h2 class="section-title">Courbe poids + projection</h2>
        <div class="canvas-wrap"><canvas id="weightProjectionChart"></canvas></div>
      </div>
      <div class="card">
        <h2 class="section-title">Coach</h2>
        <p class="notice success">${esc(insightText())}</p>
        <hr>
        <h3>Check du jour</h3>
        ${renderMiniHabits()}
      </div>
    </section>
  `;
}
function metric(label, value, sub){
  return `<div class="metric"><span class="label">${esc(label)}</span><br><b>${esc(value)}</b><small>${esc(sub)}</small></div>`;
}
function progressRing(value, label){
  const offset = 540 - (540 * clamp(value,0,100) / 100);
  return `
    <div class="ring-wrap">
      <svg class="ring" viewBox="0 0 200 200">
        <defs><linearGradient id="grad" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#66FFD1"/><stop offset=".55" stop-color="#8AA2FF"/><stop offset="1" stop-color="#FF7AD9"/></linearGradient></defs>
        <circle class="base" cx="100" cy="100" r="86"></circle>
        <circle class="value" cx="100" cy="100" r="86" style="stroke-dashoffset:${offset}"></circle>
      </svg>
      <div class="ring-label"><b>${value}%</b><span>${esc(label)}</span></div>
    </div>
  `;
}
function renderMiniHabits(){
  const h = habitToday();
  return `
    <div class="chips">
      ${habitChip("protein", "Protéines", h.protein)}
      ${habitChip("slow", "Manger lentement", h.slow)}
      ${habitChip("fiber", "Fibres", h.fiber)}
      ${habitChip("movement", "Marche", h.movement)}
    </div>
    <p class="muted">Eau : <b>${Number(h.water || 0).toFixed(1)} L</b></p>
    <div class="chips"><button class="btn small" onclick="addWater(-0.25)">− 0.25 L</button><button class="btn small primary" onclick="addWater(0.25)">+ 0.25 L</button></div>
  `;
}
function habitChip(key, label, active){
  return `<button class="chip ${active ? "active" : ""}" onclick="toggleHabit('${key}')">${esc(label)}</button>`;
}
function renderWeight(){
  return `
    <section class="grid two">
      <div class="card">
        <h2 class="section-title">Ajouter une pesée</h2>
        <div class="formrow">
          <input id="weightInput" inputmode="decimal" placeholder="ex. 115.4" />
          <button class="btn primary" onclick="addWeight()">Ajouter</button>
        </div>
        <br>
        <textarea id="weightNote" rows="3" placeholder="Note optionnelle : transit, sel, sport, repas tardif..."></textarea>
        <p class="muted">Pesée officielle conseillée : vendredi matin, avant injection et avant déjeuner.</p>
      </div>
      <div class="card">
        <h2 class="section-title">Analyse poids</h2>
        <div class="grid two">
          ${metric("Depuis départ", "−" + lostKg().toFixed(1) + " kg", fmtDate(state.profile.startDate))}
          ${metric("Depuis dernière", (currentWeight() - previousWeight() >= 0 ? "+" : "") + round1(currentWeight() - previousWeight()).toFixed(1) + " kg", "variation brute")}
          ${metric("Tendance", trendKgPerWeek() ? trendKgPerWeek().toFixed(2) + " kg/sem." : "—", "régression 10 pesées max")}
          ${metric("Objectif final", estimateDateForGoal(targetWeight()), targetWeight() + " kg")}
        </div>
      </div>
    </section>
    <section class="card" style="margin-top:18px">
      <div class="row wrap"><h2 class="section-title">Graphique détaillé</h2><button class="btn" onclick="seedDemoWeights()">Simuler 6 semaines</button></div>
      <div class="canvas-wrap"><canvas id="weightDetailChart"></canvas></div>
    </section>
    <section class="card" style="margin-top:18px">
      <h2 class="section-title">Historique poids</h2>
      <div class="history">${historyWeights()}</div>
    </section>
  `;
}
function renderInjections(){
  const next = nextInjectionDate();
  return `
    <section class="grid two">
      <div class="card">
        <h2 class="section-title">Injection</h2>
        <p class="muted">Site suggéré : <b>${esc(nextSuggestedSite())}</b>. Site sélectionné : <b>${esc(state.selectedSite)}</b>.</p>
        <div class="chips">${state.sites.map((site, idx) => `<button class="chip ${site === state.selectedSite ? "active" : ""}" onclick="selectSite(${idx})">${esc(site)}</button>`).join("")}</div>
        <br>
        <div class="chips">
          <button class="btn primary" onclick="addInjection()">Injection effectuée maintenant</button>
          <button class="btn" onclick="addPlannedInjection()">Ajouter prochaine prévue</button>
        </div>
      </div>
      <div class="card">
        <h2 class="section-title">Plan de dose</h2>
        <div class="grid two">
          ${state.doseSchedule.map(step => metric("Semaine " + step.fromWeek + "+", step.dose.toFixed(2) + " mg", step.fromWeek === weeksSinceStart() ? "actuel" : "plan")).join("")}
        </div>
        <p class="notice">Niveau estimé = approximation basée sur les injections enregistrées et la demi-vie moyenne. Ce n’est pas une mesure médicale.</p>
      </div>
    </section>
    <section class="grid two" style="margin-top:18px">
      <div class="card">
        <h2 class="section-title">Niveau Wegovy estimé</h2>
        <div class="canvas-wrap small"><canvas id="medChart"></canvas></div>
      </div>
      <div class="card">
        <h2 class="section-title">Calendrier</h2>
        <p class="muted">Prochaine : <b>${fmtShort(next)}</b> à ${esc(state.profile.injectionTime)}.</p>
        <div class="calendar">${calendarHTML()}</div>
      </div>
    </section>
    <section class="card" style="margin-top:18px">
      <h2 class="section-title">Historique injections</h2>
      <div class="history">${historyInjections()}</div>
    </section>
  `;
}
function renderDaily(){
  const symptoms = ["🙂 rien", "🤢 nausée", "🔥 reflux", "💩 constipation", "💨 diarrhée", "😴 fatigue", "😵‍💫 vertige", "🍽️ satiété", "🍺 alcool", "💧 soif"];
  return `
    <section class="grid two">
      <div class="card">
        <h2 class="section-title">Journal du jour</h2>
        ${renderMiniHabits()}
        <hr>
        <div class="chips">${symptoms.map(s => `<button class="chip" onclick="addSymptom('${esc(s)}')">${esc(s)}</button>`).join("")}</div>
        <br>
        <textarea id="symptomNote" rows="3" placeholder="Note libre du jour"></textarea>
        <br><br>
        <button class="btn primary" onclick="saveTodayNote()">Enregistrer note</button>
      </div>
      <div class="card">
        <h2 class="section-title">Résumé</h2>
        <div class="history">${historySymptoms(8)}</div>
      </div>
    </section>
  `;
}
function renderGoals(){
  return `
    <section class="card">
      <div class="row wrap"><h2 class="section-title">Paliers</h2><button class="btn" onclick="openSettings()">Modifier objectif</button></div>
      <div class="targets">
        ${state.goals.map(goal => {
          const done = currentWeight() <= goal;
          return `<div class="target ${done ? "done" : ""}"><b>${goal} kg</b><small>${done ? "débloqué 🏆" : "reste " + round1(currentWeight() - goal).toFixed(1) + " kg · " + estimateDateForGoal(goal)}</small></div>`;
        }).join("")}
      </div>
    </section>
    <section class="grid two" style="margin-top:18px">
      <div class="card">
        <h2 class="section-title">Badges</h2>
        <div class="chips">${badges().map(b => `<span class="chip active">${esc(b)}</span>`).join("") || "<span class='muted'>Les badges arrivent avec tes données.</span>"}</div>
      </div>
      <div class="card">
        <h2 class="section-title">Mission finale</h2>
        ${progressRing(Math.round(progressPct()), "Mission 78")}
        <p class="muted">Objectif ${targetWeight()} kg estimé : <b>${estimateDateForGoal(targetWeight())}</b>.</p>
      </div>
    </section>
  `;
}
function renderPhotos(){
  return `
    <section class="grid two">
      <div class="card">
        <h2 class="section-title">Ajouter une photo</h2>
        <input id="photoInput" type="file" accept="image/*" />
        <br><br>
        <input id="photoLabel" placeholder="Label : face, profil, avant, mois 1..." />
        <br><br>
        <button class="btn primary" onclick="addPhoto()">Ajouter photo</button>
        <p class="notice">Les photos sont compressées et stockées localement dans le navigateur. Exporte ton JSON régulièrement. Si le stockage est plein, garde les photos hors app.</p>
      </div>
      <div class="card">
        <h2 class="section-title">Photos enregistrées</h2>
        <p class="muted">${state.photos.length} photo(s). Les images ne quittent pas ton appareil.</p>
      </div>
    </section>
    <section class="photo-grid" style="margin-top:18px">
      ${state.photos.slice().reverse().map(p => `
        <div class="photo">
          <img src="${p.data}" alt="${esc(p.label || "photo")}" />
          <div class="cap">
            <b>${esc(p.label || "Photo")}</b>
            <small class="muted">${fmtDate(p.date)}</small><br><br>
            <button class="btn danger small" onclick="deletePhoto('${p.id}')">Supprimer</button>
          </div>
        </div>
      `).join("") || "<div class='card'><p class='muted'>Aucune photo pour l’instant.</p></div>"}
    </section>
  `;
}
function renderHistory(){
  return `
    <section class="grid three">
      <div class="card"><h2 class="section-title">Poids</h2><div class="history">${historyWeights()}</div></div>
      <div class="card"><h2 class="section-title">Injections</h2><div class="history">${historyInjections()}</div></div>
      <div class="card"><h2 class="section-title">Journal</h2><div class="history">${historySymptoms()}</div></div>
    </section>
  `;
}
function renderBackup(){
  return `
    <section class="grid two">
      <div class="card">
        <h2 class="section-title">Sauvegarde</h2>
        <p class="muted">Données stockées localement sur cet appareil. Exporte un JSON après chaque grosse mise à jour ou une fois par semaine.</p>
        <div class="chips">
          <button class="btn primary" onclick="exportJSON()">Exporter JSON</button>
          <button class="btn" onclick="importJSON()">Importer JSON</button>
          <button class="btn danger" onclick="resetAll()">Réinitialiser</button>
        </div>
        <hr>
        <button id="installBtn" class="btn primary install-hint" onclick="installPWA()">Installer l’app</button>
        <p class="notice">Sur iPhone : Safari → Partager → Ajouter à l’écran d’accueil.</p>
      </div>
      <div class="card">
        <h2 class="section-title">Maintenance</h2>
        ${metric("Version", VERSION, "cache PWA inclus")}
        ${metric("Données", `${state.weights.length} pesées · ${state.injections.length} injections`, `${state.photos.length} photos`)}
        <br>
        <button class="btn danger" onclick="hardRefresh()">Forcer mise à jour / vider cache</button>
      </div>
    </section>
  `;
}
function renderSettingsModal(){
  return `
    <div class="modal" id="settingsModal">
      <div class="sheet">
        <div class="row wrap"><h2 class="section-title">Réglages</h2><button class="btn" onclick="closeSettings()">Fermer</button></div>
        <div class="formgrid">
          ${field("Nom", "setName", state.profile.name, "text")}
          ${field("Taille cm", "setHeight", state.profile.heightCm, "number")}
          ${field("Poids départ", "setStartWeight", state.profile.startWeight, "number")}
          ${field("Objectif kg", "setTargetWeight", state.profile.targetWeight, "number")}
          ${field("Date début", "setStartDate", state.profile.startDate, "date")}
          ${field("Heure injection", "setInjectionTime", state.profile.injectionTime, "time")}
        </div>
        <hr>
        <h3>Plan de dose</h3>
        <div class="formgrid">
          ${field("Dose semaine 0", "dose0", doseAtWeek(0), "number")}
          ${field("Dose semaine 4", "dose4", doseAtWeek(4), "number")}
          ${field("Dose semaine 8", "dose8", doseAtWeek(8), "number")}
          ${field("Dose semaine 12", "dose12", doseAtWeek(12), "number")}
        </div>
        <br>
        <button class="btn primary" onclick="saveSettings()">Enregistrer</button>
      </div>
    </div>
  `;
}
function field(label, id, value, type){
  return `<div class="field"><label for="${id}">${esc(label)}</label><input id="${id}" type="${type}" value="${esc(value)}" step="0.01"></div>`;
}

function historyWeights(){
  const weights = sortedWeights().slice().reverse();
  return weights.map(w => `
    <div class="item">
      <span><b>${Number(w.kg).toFixed(1)} kg</b><small>${fmtDate(w.date)}${w.note ? " · " + esc(w.note) : ""}</small></span>
      <button class="btn ghost small" onclick="deleteItem('weights','${w.id}')">×</button>
    </div>`).join("") || "<p class='muted'>Vide.</p>";
}
function historyInjections(){
  const injections = sortedInjections().slice().reverse();
  return injections.map(i => `
    <div class="item">
      <span><b>${Number(i.dose).toFixed(2)} mg · ${esc(i.site)}</b><small>${fmtDate(i.date)} · ${esc(i.time || "")}${i.note ? " · " + esc(i.note) : ""}</small></span>
      <button class="btn ghost small" onclick="deleteItem('injections','${i.id}')">×</button>
    </div>`).join("") || "<p class='muted'>Vide.</p>";
}
function historySymptoms(limit){
  const symptoms = [...state.symptoms].sort((a,b) => a.date.localeCompare(b.date)).reverse();
  const arr = limit ? symptoms.slice(0, limit) : symptoms;
  return arr.map(s => `
    <div class="item">
      <span><b>${esc((s.items || []).join(" · ") || "note")}</b><small>${fmtDate(s.date)}${s.note ? " · " + esc(s.note) : ""}</small></span>
      <button class="btn ghost small" onclick="deleteItem('symptoms','${s.id}')">×</button>
    </div>`).join("") || "<p class='muted'>Vide.</p>";
}
function calendarHTML(){
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  const start = (first.getDay() + 6) % 7;
  const injectionDates = new Set(state.injections.map(i => i.date));
  let html = "";
  ["L","M","M","J","V","S","D"].forEach(d => html += `<div class="label" style="text-align:center">${d}</div>`);
  for(let i = 0; i < start; i++) html += "<div></div>";
  for(let day = 1; day <= last.getDate(); day++){
    const date = toISO(new Date(y, m, day));
    const hit = injectionDates.has(date);
    const isToday = date === todayISO();
    html += `<div class="day ${hit ? "hit" : ""} ${isToday ? "today" : ""}">${day}${hit ? "<span class='dot'></span>" : ""}</div>`;
  }
  return html;
}
function badges(){
  const result = [];
  if(state.injections.length >= 1) result.push("Première injection");
  if(state.injections.length >= 4) result.push("4 semaines");
  if(state.injections.length >= 8) result.push("8 semaines");
  if(lostKg() >= 5) result.push("−5 kg");
  if(lostKg() >= 10) result.push("−10 kg");
  if(currentWeight() < 110) result.push("Sous 110");
  if(currentWeight() < 100) result.push("Deux chiffres");
  if(progressPct() >= 50) result.push("Mi-parcours");
  return result;
}

function setView(view){
  state.ui.view = view;
  persist();
}
function openSettings(){ $("#settingsModal").classList.add("open"); }
function closeSettings(){ $("#settingsModal").classList.remove("open"); }
function saveSettings(){
  state.profile.name = $("#setName").value || "Patrice";
  state.profile.heightCm = Number($("#setHeight").value) || 178;
  state.profile.startWeight = Number($("#setStartWeight").value) || 116;
  state.profile.targetWeight = Number($("#setTargetWeight").value) || 78;
  state.profile.startDate = $("#setStartDate").value || "2026-07-03";
  state.profile.injectionTime = $("#setInjectionTime").value || "22:00";
  state.doseSchedule = [
    { fromWeek: 0, dose: Number($("#dose0").value) || 0.25 },
    { fromWeek: 4, dose: Number($("#dose4").value) || 0.5 },
    { fromWeek: 8, dose: Number($("#dose8").value) || 1.0 },
    { fromWeek: 12, dose: Number($("#dose12").value) || 1.0 }
  ];
  closeSettings();
  persist();
  showToast("Réglages enregistrés");
}
function addWeight(){
  const input = $("#weightInput");
  const value = Number((input?.value || "").replace(",", "."));
  if(!value || value < 45 || value > 220){ showToast("Poids invalide"); return; }
  const note = $("#weightNote")?.value || "";
  if(state.weights.some(w => w.date === todayISO()) && !confirm("Une pesée existe déjà aujourd’hui. Ajouter quand même ?")) return;
  state.weights.push({ id: uid(), date: todayISO(), kg: round1(value), note });
  state.weights.sort((a,b) => a.date.localeCompare(b.date));
  persist();
  showToast("Pesée ajoutée");
}
function seedDemoWeights(){
  if(!confirm("Ajouter des pesées de démonstration pour tester les courbes ?")) return;
  const start = parseLocalDate(state.profile.startDate);
  const existingDates = new Set(state.weights.map(w => w.date));
  let kg = state.profile.startWeight;
  for(let i = 1; i <= 6; i++){
    const d = new Date(start);
    d.setDate(d.getDate() + i * 7);
    kg -= [1.0, 0.8, 0.7, 0.9, 0.6, 0.6][i-1];
    const date = toISO(d);
    if(!existingDates.has(date)) state.weights.push({ id: uid(), date, kg: round1(kg), note: "simulation" });
  }
  persist();
  showToast("Simulation ajoutée");
}
function addInjection(){
  const date = todayISO();
  if(state.injections.some(i => i.date === date) && !confirm("Une injection existe déjà aujourd’hui. Ajouter quand même ?")) return;
  const site = state.selectedSite || nextSuggestedSite();
  state.injections.push({ id: uid(), date, time: state.profile.injectionTime, dose: doseAtWeek(weeksSinceStart(date)), site, note: "" });
  state.selectedSite = nextSuggestedSite();
  state.injections.sort((a,b) => a.date.localeCompare(b.date));
  persist();
  showToast("Injection enregistrée");
}
function addPlannedInjection(){
  const date = nextInjectionDate();
  if(state.injections.some(i => i.date === date) && !confirm("Une injection existe déjà ce jour. Ajouter quand même ?")) return;
  const site = nextSuggestedSite();
  state.injections.push({ id: uid(), date, time: state.profile.injectionTime, dose: doseAtWeek(weeksSinceStart(date)), site, note: "prévue" });
  state.injections.sort((a,b) => a.date.localeCompare(b.date));
  persist();
  showToast("Injection prévue ajoutée");
}
function selectSite(index){
  state.selectedSite = state.sites[index] || state.sites[0];
  persist();
}
function toggleHabit(key){
  const h = habitToday();
  h[key] = !h[key];
  persist();
}
function addWater(delta){
  const h = habitToday();
  h.water = clamp(round1(Number(h.water || 0) + delta), 0, 8);
  persist();
}
function addSymptom(item){
  let s = state.symptoms.find(x => x.date === todayISO());
  if(!s){
    s = { id: uid(), date: todayISO(), items: [], level: 1, note: "" };
    state.symptoms.push(s);
  }
  if(!s.items.includes(item)) s.items.push(item);
  persist();
  showToast("Journal mis à jour");
}
function saveTodayNote(){
  const note = $("#symptomNote")?.value || "";
  let s = state.symptoms.find(x => x.date === todayISO());
  if(!s){
    s = { id: uid(), date: todayISO(), items: [], level: 1, note };
    state.symptoms.push(s);
  } else {
    s.note = note;
  }
  persist();
  showToast("Note enregistrée");
}
async function addPhoto(){
  const input = $("#photoInput");
  const file = input?.files?.[0];
  if(!file){ showToast("Choisis une photo"); return; }
  try{
    const dataUrl = await compressImage(file, 1200, 0.78);
    state.photos.push({ id: uid(), date: todayISO(), label: $("#photoLabel")?.value || "Photo", data: dataUrl });
    persist();
    showToast("Photo ajoutée");
  }catch(error){
    showToast("Impossible d’ajouter la photo");
  }
}
function compressImage(file, maxSize, quality){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
function deletePhoto(id){
  if(!confirm("Supprimer cette photo ?")) return;
  state.photos = state.photos.filter(p => p.id !== id);
  persist();
}
function deleteItem(collection, id){
  if(!confirm("Supprimer cette entrée ?")) return;
  state[collection] = state[collection].filter(x => x.id !== id);
  persist();
}

function drawAllCharts(){
  drawWeightChart("weightProjectionChart", true);
  drawWeightChart("weightDetailChart", true);
  drawMedChart("medChart");
}
function setupCanvas(id){
  const canvas = document.getElementById(id);
  if(!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { canvas, ctx, width: rect.width, height: rect.height };
}
function drawWeightChart(id, projection){
  const setup = setupCanvas(id);
  if(!setup) return;
  const { ctx, width: W, height: H } = setup;
  const pad = 34;
  const weights = sortedWeights();
  let points = weights.map(w => ({ date: w.date, kg: Number(w.kg), real: true }));
  if(points.length === 1) points.push({ date: todayISO(), kg: points[0].kg, real: true });
  const rate = trendKgPerWeek() || 0.5;
  if(projection && points.length){
    const last = points[points.length - 1];
    for(let i = 1; i <= 24; i++){
      const d = parseLocalDate(last.date);
      d.setDate(d.getDate() + i * 7);
      points.push({ date: toISO(d), kg: Math.max(targetWeight(), last.kg - rate * i), real: false });
    }
  }
  const kgValues = points.map(p => p.kg).concat([startWeight(), targetWeight()]);
  const min = Math.floor(Math.min(...kgValues) - 2);
  const max = Math.ceil(Math.max(...kgValues) + 2);
  const sx = i => pad + (i / Math.max(1, points.length - 1)) * (W - pad * 2);
  const sy = kg => pad + (1 - (kg - min) / (max - min)) * (H - pad * 2);
  ctx.clearRect(0,0,W,H);
  ctx.strokeStyle = "rgba(255,255,255,.10)";
  ctx.lineWidth = 1;
  for(let i=0;i<5;i++){
    const y = pad + i * (H - pad*2) / 4;
    ctx.beginPath(); ctx.moveTo(pad,y); ctx.lineTo(W-pad,y); ctx.stroke();
  }
  const targetY = sy(targetWeight());
  ctx.strokeStyle = "rgba(255,196,107,.65)";
  ctx.setLineDash([6,6]);
  ctx.beginPath(); ctx.moveTo(pad,targetY); ctx.lineTo(W-pad,targetY); ctx.stroke();
  ctx.setLineDash([]);
  const real = points.filter(p => p.real);
  const future = points.filter(p => !p.real);
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#66FFD1";
  ctx.beginPath();
  real.forEach((p,i) => i ? ctx.lineTo(sx(i), sy(p.kg)) : ctx.moveTo(sx(i), sy(p.kg)));
  ctx.stroke();
  if(future.length){
    ctx.strokeStyle = "rgba(138,162,255,.68)";
    ctx.setLineDash([9,8]);
    ctx.beginPath();
    ctx.moveTo(sx(real.length-1), sy(real[real.length-1].kg));
    future.forEach((p,j) => ctx.lineTo(sx(real.length+j), sy(p.kg)));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.fillStyle = "#fff";
  real.forEach((p,i) => { ctx.beginPath(); ctx.arc(sx(i), sy(p.kg), 5, 0, Math.PI*2); ctx.fill(); });
  ctx.fillStyle = "rgba(255,255,255,.72)";
  ctx.font = "800 12px -apple-system,BlinkMacSystemFont,Arial";
  ctx.fillText(max + " kg", pad, 18);
  ctx.fillText(min + " kg", pad, H - 10);
  ctx.fillText("objectif " + targetWeight() + " kg", Math.max(pad, W - pad - 108), targetY - 8);
}
function drawMedChart(id){
  const setup = setupCanvas(id);
  if(!setup) return;
  const { ctx, width: W, height: H } = setup;
  const pad = 30;
  const now = Date.now();
  const points = [];
  for(let i=0; i<=42; i++){
    const t = now + i * 86400000;
    points.push({ x:i, y: medLevelAt(t, true) });
  }
  const sx = x => pad + (x / 42) * (W - pad*2);
  const sy = y => pad + (1 - y / 100) * (H - pad*2);
  ctx.clearRect(0,0,W,H);
  ctx.strokeStyle = "rgba(255,255,255,.10)";
  ctx.lineWidth = 1;
  for(let i=0;i<5;i++){
    const y = pad + i * (H - pad*2) / 4;
    ctx.beginPath(); ctx.moveTo(pad,y); ctx.lineTo(W-pad,y); ctx.stroke();
  }
  ctx.strokeStyle = "#8AA2FF";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  points.forEach((p,i) => i ? ctx.lineTo(sx(p.x), sy(p.y)) : ctx.moveTo(sx(p.x), sy(p.y)));
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,.72)";
  ctx.font = "800 12px -apple-system,BlinkMacSystemFont,Arial";
  ctx.fillText("100%", pad, 18);
  ctx.fillText("0%", pad, H - 10);
  ctx.fillText("projection 42 jours", W - pad - 112, H - 10);
}

function exportJSON(){
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "mission69-" + todayISO() + ".json";
  a.click();
  URL.revokeObjectURL(a.href);
}
function importJSON(){
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.onchange = () => {
    const file = input.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try{
        state = migrate(JSON.parse(reader.result));
        persist();
        showToast("Import réussi");
      }catch(error){
        showToast("JSON invalide");
      }
    };
    reader.readAsText(file);
  };
  input.click();
}
function resetAll(){
  if(!confirm("Réinitialiser toutes les données locales ?")) return;
  state = clone(DEFAULT);
  persist();
  showToast("Réinitialisé");
}
async function hardRefresh(){
  if("serviceWorker" in navigator){
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r => r.unregister()));
  }
  if("caches" in window){
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  }
  location.reload();
}
window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  const btn = $("#installBtn");
  if(btn) btn.style.display = "inline-flex";
});
async function installPWA(){
  if(!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
}
function showToast(message){
  const el = $("#toast");
  if(!el) return;
  el.textContent = message;
  el.style.display = "block";
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { el.style.display = "none"; }, 2400);
}
window.addEventListener("resize", () => requestAnimationFrame(drawAllCharts));

if("serviceWorker" in navigator){
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
render();
