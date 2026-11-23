'use strict';
/* Extracted from the original 4.3.3 application without changing business logic. */
function on(id,ev,fn){var e=$(id);if(e)e.addEventListener(ev,fn)}
function delegate(id,fn){var e=$(id);if(!e)return;e.addEventListener('click',ev=>{var b=ev.target.closest('button');if(b&&b.dataset.action)fn(b.dataset.action,b.dataset.id)})}

async function startApp(){
  $('login_modal').style.display='none';
  $('main_app').style.display='block';
  
  await seedImportance();
  refreshDropdowns();applyPermissions();
  var today=getTodayJalali().split('/');
  $('cal_year').value=parseInt(today[0],10);$('cal_month').value=parseInt(today[1],10);$('h_default_year').value=parseInt(today[0],10);
  if(!$('act_start_date').value)$('act_start_date').value=getTodayJalali();
  var tp=today.map(n=>parseInt(n,10));
  if(!$('rep_from').value)$('rep_from').value=fmtJalali(tp[0],tp[1],1);
  if(!$('rep_to').value)$('rep_to').value=fmtJalali(tp[0],tp[1],jalaliMonthLength(tp[0],tp[1]));
  
  populateParticipants();renderPersons();renderImportance();renderLocations();
  
  if ($('cal_week_mode')) {
    $('cal_week_mode').checked = true;
    $('cal_month_group').style.display = 'none';
    $('cal_year_group').style.display = 'none';
    $('monthly_summary').style.display = 'none';
  }
  
  renderCalendar(); updateCalculatedHours(); updatePlanningBadge();
  startIdleWatch();
  showSection('calendar');
}
async function seedImportance(){
  if(localStorage.getItem('actbk_importance_seeded'))return;
  if(!getData(KEYS.importance).length){if(!(await setData(KEYS.importance,DEFAULT_IMPORTANCE.slice())))return}
  localStorage.setItem('actbk_importance_seeded','1');
}

function bindEvents(){
  on('main_nav','click',e=>{var b=e.target.closest('button');if(b&&b.dataset.target)showSection(b.dataset.target)});
  on('btn_sync_cloud','click',()=>syncFromCloud(true));
  on('btn_logout','click',handleLogout);
  on('btn_change_password','click',openChangePasswordModal);
  on('btn_submit_change_pass','click',submitChangePassword);
  on('btn_cancel_change_pass','click',()=>$('modal_change_password').classList.add('hidden'));
  on('btn_setup','click',handleSetup);
  on('btn_retry_connection','click',()=>showLogin());
  on('login_username','keypress',e=>{if(e.key==='Enter')handleLogin()});
  on('login_password','keypress',e=>{if(e.key==='Enter')handleLogin()});

  on('btn_save_person','click',savePerson);
  on('btn_cancel_person','click',resetPersonForm);
  delegate('person_list_container',(a,id)=>{if(a==='edit')editPerson(id);else if(a==='delete')deletePerson(id);else if(a==='pwd')changePersonPassword(id)});
  on('btn_repair_emails','click',repairLoginEmails);
  on('btn_save_topic','click',saveTopic);
  delegate('topic_list_container',(a,id)=>{if(a==='delete')deleteTopic(id);else if(a==='up')moveTopic(id,-1);else if(a==='down')moveTopic(id,1)});
  on('btn_save_imp','click',saveImportance);
  on('btn_cancel_imp','click',resetImportanceForm);
  delegate('imp_list_container',(a,id)=>{if(a==='edit')editImportance(id);else if(a==='delete')deleteImportance(id)});
  on('btn_save_holiday','click',saveHoliday);
  on('btn_load_default_holidays','click',loadDefaultHolidays);
  delegate('holiday_list_container',(a,id)=>{if(a==='delete')deleteHoliday(id)});
  on('btn_save_loc','click',saveLocation);
  on('btn_cancel_loc','click',resetLocationForm);
  delegate('loc_list_container',(a,id)=>{if(a==='edit')editLocation(id);else if(a==='delete')deleteLocation(id);else if(a==='up')moveLocation(id,-1);else if(a==='down')moveLocation(id,1)});

  ['cal_person','cal_month','cal_year'].forEach(k=>on(k,'change',renderCalendar));
  on('calendar_container','click',e=>{var c=e.target.closest('.day-cell');if(!c)return;openDayActivitiesModal(c.dataset.date)});
  on('week_grid','click',e=>{
    var add=e.target.closest('.btn-add-week');if(add){openNewActivityForDate(add.dataset.date);return}
    var ed=e.target.closest('.btn-edit-week');if(ed){editAct(ed.dataset.id);return}
    var cell=e.target.closest('.slot-act');if(cell)showActivityDetails(cell.dataset.id);
  });

  on('btn_day_modal_new', 'click', () => {
    $('modal_day_activities').classList.add('hidden');
    openNewActivityForDate(_currentModalDate);
  });
  on('btn_day_modal_close', 'click', () => {
    $('modal_day_activities').classList.add('hidden');
  });
  on('modal_day_activities', 'click', (e) => {
    if (e.target.id === 'modal_day_activities') $('modal_day_activities').classList.add('hidden');
  });
  // مدیریت دکمه‌های جزئیات و پیوستن در کارت‌های پنجره اقدامات روز
  on('day_modal_list', 'click', (e) => {
    var joinBtn = e.target.closest('[data-join-activity]');
    if (joinBtn) { joinFromModal(joinBtn.dataset.joinActivity); return; }
    var detailsBtn = e.target.closest('[data-details-activity]');
    if (detailsBtn) showActivityDetails(detailsBtn.dataset.detailsActivity);
  });

  on('btn_save_plan','click',savePlan);
  on('btn_cancel_plan','click',resetPlanForm);
  on('plan_list_container','click',e=>{
    var btn=e.target.closest('button[data-plan-action]');if(!btn)return;
    var action=btn.dataset.planAction,id=btn.dataset.id;
    if(action==='edit')editPlan(id);
    else if(action==='delete')deletePlan(id);
    else if(action==='cancel')advancePlanStatus(id,'cancelled');
    else if(action==='advance')advancePlanStatus(id,btn.dataset.next);
    else if(action==='convert')convertPlanToActivity(id);
    else if(action==='goto'){var act=getData(KEYS.acts).find(a=>a.id===id);if(act&&canSeeAct(act)){showSection('activity');$('act_start_date').value=act.date;renderDayActs();window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'})}}
  });
  on('plan_search','input',debounce(renderPlanning,250));

  on('btn_save_act','click',saveActivity);
  on('btn_reset_act','click',()=>resetActivityForm(true));
  on('btn_cancel_edit_act','click',cancelEditAct);
  ['act_start_time','act_end_date','act_end_time'].forEach(k=>on(k,'change',updateCalculatedHours));
  on('act_start_date','change',()=>{updateCalculatedHours();renderDayActs()});
  delegate('day_acts_container',(a,id)=>{if(a==='edit')editAct(id);else if(a==='delete')deleteAct(id);else if(a==='join')joinActivity(id)});

  ['rec_person','rec_topic','rec_imp','rec_from','rec_to'].forEach(k=>on(k,'change',renderRecords));
  on('rec_search','input',debounce(renderRecords,250));
  on('btn_clear_rec','click',()=>{$('rec_person').value='';$('rec_topic').value='';$('rec_imp').value='';$('rec_search').value='';$('rec_from').value='';$('rec_to').value='';renderRecords()});
  on('btn_print_records','click',()=>printData('records_list_container',true));
  delegate('records_list_container',(a,id)=>{if(a==='edit')editAct(id);else if(a==='delete')deleteAct(id);else if(a==='join')joinActivity(id)});

  on('btn_gen_report','click',generateReport);
  on('btn_print_report','click',printReport);
  on('btn_export_word','click',exportWord);
  on('btn_export_pptx','click',exportPPTX);
  on('btn_export','click',exportJSON);
  on('btn_import','click',importJSON);
}

async function init(){
  // Keep the login screen visible during boot. If initialization fails, users
  // still see a usable entry point instead of a blank page.
  var login = $('login_modal');
  if (login) login.style.display = 'flex';
    if (typeof setConnectionStatus === 'function') setConnectionStatus('offline');
  try {
    initTheme();
    document.addEventListener('click',closePopups);
    loadAppVersion();
    bindEvents();
    initDatepickers();
    
    var dbReady=await initDbClient();
    if(dbReady)startConnectionMonitor();else setConnectionStatus('offline');

    if(!dbReady){ await showLogin(); return; }

    const sessionResult = await withTimeout(
      () => dbClient.auth.getSession(),
      10000,
      'بازیابی نشست کاربر'
    );
    const { data: { session } } = sessionResult;
    if(!session){ await showLogin(); return; }

    const profileResult = await withTimeout(
      () => dbClient.from('persons').select('*').eq('user_id', session.user.id).single(),
      12000,
      'دریافت پروفایل کاربر'
    );
    const { data: person, error } = profileResult;
    if (error || !person) { await dbClient.auth.signOut(); await showLogin(); return; }

    setSession({ personId: person.id, username: person.username, role: person.role, name: person.firstname + ' ' + person.lastname });
    
    if (person.must_change_password) { showForcePasswordChange(session.user.id); return; }
    
    await withTimeout(
      () => syncFromCloud(false),
      20000,
      'همگام‌سازی اولیه اطلاعات'
    );
    await withTimeout(
      () => startApp(),
      20000,
      'راه‌اندازی محیط برنامه'
    );
  } catch (err) {
    console.error('[App] Initialization failed:', err);
    if (login) login.style.display = 'flex';
    var msg = $('login_msg');
    if (msg) msg.innerHTML = '<div class="alert alert-error" style="display:block;margin-bottom:12px">راه‌اندازی برنامه کامل نشد: ' + (err.name === 'TimeoutError' ? 'پاسخ سرور در زمان مقرر دریافت نشد.' : (err.message || 'خطای نامشخص')) + ' اتصال و تنظیمات Supabase را بررسی کنید و دوباره تلاش کنید.</div>';
    var form = $('login_form');
    if (form) form.classList.remove('hidden');
    var setup = $('setup_form');
    if (setup) setup.classList.add('hidden');
    var title = $('login_title');
    if (title) title.textContent = 'ورود به سیستم';
  }
}

// رویداد دکمه ورود در ماژول auth.js متصل می‌شود تا به App.js وابسته نباشد.

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();

window.toggleNav=toggleNav;
window.toggleTheme=toggleTheme;
window.onWeekModeChange=onWeekModeChange;
window.weekShift=weekShift;
window.weekGoToday=weekGoToday;
window.cancelPendingConversion=cancelPendingConversion;
window.renderPlanning=renderPlanning;
window.onLocationChange=onLocationChange;
window.joinFromModal = function(id) {
  joinActivity(id).then(() => {
    renderDayActivitiesModal();
    renderCalendar();
  });
};

