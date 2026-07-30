/* ===================== SIDEBAR (mobile drawer) ===================== */
function initSidebar(){
  var side = document.getElementById('side');
  var scrim = document.getElementById('scrim');
  var menuBtn = document.getElementById('menuBtn');
  if(menuBtn) menuBtn.addEventListener('click', function(){ side.classList.add('open'); scrim.classList.add('show'); });
  if(scrim) scrim.addEventListener('click', function(){ side.classList.remove('open'); scrim.classList.remove('show'); });
}

/* ===================== QUIZ ===================== */
function initQuiz(){
  document.querySelectorAll('.quiz-item').forEach(function(item){
    var btn = item.querySelector('.reveal-btn');
    if(!btn) return;
    btn.addEventListener('click', function(){
      var correct = item.getAttribute('data-correct').split(',').map(Number);
      var opts = item.querySelectorAll('.quiz-opt');
      opts.forEach(function(opt, idx){
        opt.classList.remove('correct-reveal','wrong-reveal');
        var input = opt.querySelector('input');
        var checked = input && input.checked;
        if(correct.indexOf(idx) !== -1) opt.classList.add('correct-reveal');
        else if(checked) opt.classList.add('wrong-reveal');
      });
      var explain = item.querySelector('.quiz-explain');
      if(explain) explain.classList.add('show');
      btn.textContent = 'Réponse révélée ✓';
      btn.disabled = true;
    });
  });
}

/* ===================== PROGRESS SYNC (READ + WRITE) ===================== */
/* Uses the SAME localStorage key/schema as the Transformation Numérique app.
   Works automatically (both ways) when the manual and the app share the same origin.
   Falls back to manual JSON import/export when opened as local files (file://). */
var TNP_KEY = 'tnp_state_v1';

function defaultTnpState(){
  return { activities:{}, journal:{}, evaluation:{}, portfolio:{}, certifications:{} };
}

var _cachedState = null;
var _hasRealData = false;

function readSyncState(){
  try{
    var raw = localStorage.getItem(TNP_KEY);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch(e){ return null; }
}

function getOrInitState(){
  if(_cachedState) return _cachedState;
  var s = readSyncState();
  if(s) _hasRealData = true;
  if(!s) s = defaultTnpState();
  if(!s.activities) s.activities = {};
  if(!s.evaluation) s.evaluation = {};
  _cachedState = s;
  return _cachedState;
}

var writeTimer = null;
function writeSyncState(state){
  _cachedState = state;
  _hasRealData = true;
  clearTimeout(writeTimer);
  writeTimer = setTimeout(function(){
    try{ localStorage.setItem(TNP_KEY, JSON.stringify(state)); }catch(e){}
  }, 80);
}

function flushSyncState(){
  if(!_cachedState) return;
  clearTimeout(writeTimer);
  try{ localStorage.setItem(TNP_KEY, JSON.stringify(_cachedState)); }catch(e){}
}

function activityStatus(syncState, activityId){
  if(!syncState || !syncState.activities) return null;
  var a = syncState.activities[activityId];
  return a ? a.status : null;
}

function moduleCompletionFromSync(syncState, activityIds){
  if(!syncState || !activityIds.length) return null;
  var done = 0;
  activityIds.forEach(function(id){
    if(activityStatus(syncState, id) === 'Terminé') done++;
  });
  return {done: done, total: activityIds.length, pct: done/activityIds.length};
}

/* This module's own activity list (id, type, week, title), embedded per page. */
function moduleActivities(){
  var el = document.getElementById('module-activities');
  if(!el) return [];
  try{ return JSON.parse(el.textContent); }catch(e){ return []; }
}
function moduleNameOf(){
  var el = document.getElementById('module-activities');
  return el ? el.getAttribute('data-module') : null;
}

/* Toggle a single activity's status (checkbox / tracker click) */
function toggleActivity(id){
  var state = getOrInitState();
  if(!state.activities[id]) state.activities[id] = {status:'À faire', hoursActual:0};
  var cur = state.activities[id].status;
  state.activities[id].status = (cur === 'Terminé') ? 'À faire' : 'Terminé';
  if(state.activities[id].status === 'Terminé') state.activities[id].completedDate = new Date().toISOString().slice(0,10);
  recomputeModuleEvaluation(state);
  writeSyncState(state);
  return state.activities[id].status;
}

/* Recompute this module's "Pratique" score (TP + Labos completion ratio × 25)
   and store it into state.evaluation[module] — same schema the app/Planner reads. */
function recomputeModuleEvaluation(state){
  var mod = moduleNameOf();
  var acts = moduleActivities();
  if(!mod || !acts.length) return;
  var practical = acts.filter(function(a){ return a.type==='TP' || a.type==='Labo'; });
  var done = practical.filter(function(a){
    var s = state.activities[a.id];
    return s && s.status === 'Terminé';
  }).length;
  var score = practical.length ? Math.round(done/practical.length*25) : 0;
  if(!state.evaluation[mod]) state.evaluation[mod] = {theorie:0, pratique:0, projet:0, examen:0, comment:''};
  state.evaluation[mod].pratique = score;
}

function weekPracticalScore(state, weekIds){
  /* weekIds = [coursId, tpId, labo1Id, labo2Id, labo3Id] — pratique = TP + 3 labos (skip Cours) */
  var practicalIds = weekIds.slice(1);
  var done = practicalIds.filter(function(id){
    var s = state.activities[id];
    return s && s.status === 'Terminé';
  }).length;
  return Math.round(done/practicalIds.length*25);
}

function refreshAllTrackers(){
  var state = getOrInitState();
  document.querySelectorAll('[data-tracker]').forEach(function(box){
    var ids = box.getAttribute('data-tracker').split(',').map(Number);
    var doneCount = 0;
    box.querySelectorAll('[data-toggle]').forEach(function(btn){
      var id = Number(btn.getAttribute('data-toggle'));
      var s = state.activities[id];
      var done = s && s.status === 'Terminé';
      if(done) doneCount++;
      btn.classList.toggle('checked', !!done);
      btn.setAttribute('aria-checked', done ? 'true':'false');
    });
    var cnt = box.querySelector('[data-tracker-count]');
    if(cnt) cnt.textContent = doneCount+'/'+ids.length;
    var wk = box.getAttribute('data-tracker-week');
    if(wk){
      var evalCell = document.getElementById('eval-pratique-'+wk);
      if(evalCell) evalCell.textContent = weekPracticalScore(state, ids);
    }
  });
}

function applySyncBadges(){
  var syncState = getOrInitState();
  var banner = document.getElementById('syncBanner');
  if(banner){
    if(_hasRealData){
      banner.querySelector('.sync-text').textContent = 'Progression synchronisée avec la web app.';
      banner.classList.add('linked');
    } else {
      banner.querySelector('.sync-text').textContent = "Progression non liée — coche des étapes ci-dessous, ou importe ta sauvegarde exportée depuis l'app.";
    }
  }
  document.querySelectorAll('[data-week-ids]').forEach(function(el){
    var ids = el.getAttribute('data-week-ids').split(',').map(Number);
    var stat = moduleCompletionFromSync(syncState, ids);
    var badge = el.querySelector('.week-badge');
    if(!badge) return;
    if(!stat){ badge.textContent = ''; badge.className='week-badge'; return; }
    if(stat.pct === 1){ badge.textContent = '✅ Terminé'; badge.className='week-badge done'; }
    else if(stat.done > 0){ badge.textContent = stat.done+'/'+stat.total+' en cours'; badge.className='week-badge progress'; }
    else { badge.textContent = ''; badge.className='week-badge'; }
  });
  document.querySelectorAll('.side a.side-link[data-mod-ids]').forEach(function(el){
    var ids = el.getAttribute('data-mod-ids').split(',').filter(Boolean).map(Number);
    var dot = el.querySelector('.badge');
    if(!dot || !ids.length) return;
    var stat = moduleCompletionFromSync(syncState, ids);
    dot.className = 'badge';
    if(stat){
      if(stat.pct===1) dot.classList.add('done');
      else if(stat.done>0) dot.classList.add('progress');
    }
  });
  refreshAllTrackers();
}

function initTracker(){
  document.addEventListener('click', function(e){
    var btn = e.target.closest('[data-toggle]');
    if(!btn) return;
    var id = Number(btn.getAttribute('data-toggle'));
    toggleActivity(id);
    applySyncBadges();
    showManualToast('Progression mise à jour ✓');
  });
}

function showManualToast(msg){
  var t = document.getElementById('manualToast');
  if(!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(function(){ t.classList.remove('show'); }, 1800);
}

function initSyncImportExport(){
  var importBtn = document.getElementById('importSyncBtn');
  var fileInput = document.getElementById('syncFileInput');
  var exportBtn = document.getElementById('exportSyncBtn');
  if(importBtn && fileInput){
    importBtn.addEventListener('click', function(){ fileInput.click(); });
    fileInput.addEventListener('change', function(e){
      var file = e.target.files[0];
      if(!file) return;
      var reader = new FileReader();
      reader.onload = function(){
        try{
          var parsed = JSON.parse(reader.result);
          _cachedState = parsed;
          _hasRealData = true;
          flushSyncState();
          applySyncBadges();
          showManualToast('Progression importée ✓');
        }catch(err){ alert('Fichier de sauvegarde invalide.'); }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
  }
  if(exportBtn){
    exportBtn.addEventListener('click', function(){
      var state = getOrInitState();
      var blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      var d = new Date().toISOString().slice(0,10);
      a.href = url; a.download = 'progression-manuel-'+d+'.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showManualToast('Progression exportée ✓');
    });
  }
}

document.addEventListener('DOMContentLoaded', function(){
  initSidebar();
  initQuiz();
  initTracker();
  applySyncBadges();
  initSyncImportExport();
});
