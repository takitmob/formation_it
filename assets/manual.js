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

/* ===================== PROGRESS SYNC ===================== */
/* Reads the SAME localStorage key/schema used by the Transformation Numérique app.
   Works automatically when the manual and the app are hosted on the same origin.
   Falls back to manual JSON import when opened as local files (file://). */
var TNP_KEY = 'tnp_state_v1';

function readSyncState(){
  try{
    var raw = localStorage.getItem(TNP_KEY);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch(e){ return null; }
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

function applySyncBadges(){
  var syncState = readSyncState();
  var banner = document.getElementById('syncBanner');
  if(banner){
    if(syncState){
      banner.querySelector('.sync-text').textContent = 'Progression synchronisée avec la web app.';
      banner.classList.add('linked');
    } else {
      banner.querySelector('.sync-text').textContent = "Progression non liée — importe ta sauvegarde exportée depuis l'app pour afficher les badges.";
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
}

function initSyncImport(){
  var importBtn = document.getElementById('importSyncBtn');
  var fileInput = document.getElementById('syncFileInput');
  if(!importBtn || !fileInput) return;
  importBtn.addEventListener('click', function(){ fileInput.click(); });
  fileInput.addEventListener('change', function(e){
    var file = e.target.files[0];
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(){
      try{
        var parsed = JSON.parse(reader.result);
        localStorage.setItem(TNP_KEY, JSON.stringify(parsed));
        applySyncBadges();
      }catch(err){ alert('Fichier de sauvegarde invalide.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
}

document.addEventListener('DOMContentLoaded', function(){
  initSidebar();
  initQuiz();
  applySyncBadges();
  initSyncImport();
});
