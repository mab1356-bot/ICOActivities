'use strict';
/* Extracted from the original 4.3.3 application without changing business logic. */
function renderRecords(){
  var personId=val('rec_person'),topicId=val('rec_topic'),imp=val('rec_imp'),search=normText(val('rec_search'));
  var from=val('rec_from'),to=val('rec_to'),vf=isValidJalaliDate(from),vt=isValidJalaliDate(to);
  var fromTs=vf?jalaliToTimestamp(from):0,toTs=vt?jalaliToTimestamp(to):0;
  var list=getVisibleActs().filter(a=>{
    if(personId&&(!a.participants||a.participants.indexOf(personId)===-1))return false;
    if(topicId&&a.topicId!==topicId)return false;
    if(imp&&a.importance!==imp)return false;
    if(search&&(normText(a.description)+' '+normText(a.privateDescription||'')).indexOf(search)===-1)return false;
    if(vf||vt){var t=jalaliToTimestamp(a.date);if(vf&&t<fromTs)return false;if(vt&&t>toTs)return false}
    return true;
  });
  var tsCache={};list.forEach(a=>{tsCache[a.id]=jalaliToTimestamp(a.date)});
  list.sort((x,y)=>(tsCache[y.id]-tsCache[x.id])||(getImpOrder(y.importance)-getImpOrder(x.importance)));
  var c=$('records_list_container'),session=getSession();
  if(!list.length){c.innerHTML='<p style="padding:24px;text-align:center;color:var(--text3)">رکوردی یافت نشد.</p>';return}
  var h='<table class="records-table"><thead><tr><th style="width:6%;">تاریخ</th><th style="width:8%;">موضوع</th><th style="width:8%;">محل</th><th style="width:5%;">مدت</th><th style="width:7%;">اهمیت</th><th style="width:20%;">شرح</th><th style="width:15%;">📝 توضیحات تکمیلی</th><th style="width:12%;">شرکت‌کنندگان</th><th style="width:7%;">ثبت‌کننده</th><th style="width:12%;">عملیات</th></tr></thead><tbody>';
  list.forEach(a=>{h+=actRowHtml(a,session,true)});
  c.innerHTML=h+'</tbody></table>';
}

const PLAN_STATUS={draft:{label:'ثبت اولیه',color:'#64748b',icon:'📥'},coordinating:{label:'در حال هماهنگی',color:'#d97706',icon:'🔄'},ready:{label:'آماده برنامه‌ریزی',color:'#2563eb',icon:'✅'},converted:{label:'تبدیل‌شده',color:'#059669',icon:'🔗'},cancelled:{label:'منصرف‌شده',color:'#dc2626',icon:'❌'}};
const PLAN_ACTIVE=['draft','coordinating','ready'];
const PLAN_FLOW={draft:['coordinating','cancelled'],coordinating:['ready','cancelled'],ready:['converted','cancelled'],converted:[],cancelled:['draft']};
let _pendingPlanConvert=null;

function resetPlanForm(){
  $('plan_id').value='';$('plan_title').value='';$('plan_requester').value='';$('plan_assignee').value='';
  $('plan_proposed_date').value='';$('plan_location').value='';$('plan_description').value='';$('plan_notes').value='';
  var imps=getImportanceLevels();$('plan_importance').value=imps.length?imps[0].id:'';
  $('btn_save_plan').textContent='ثبت موضوع';$('btn_cancel_plan').style.display='none';
}
function editPlan(id){
  var p=getData(KEYS.planning).find(x=>x.id===id);if(!p)return;
  if(p.status==='converted'){showAlert('این موضوع تبدیل شده و قابل ویرایش نیست.','warning');return}
  $('plan_id').value=p.id;$('plan_title').value=p.title||'';$('plan_requester').value=p.requester||'';
  $('plan_assignee').value=p.assignee||'';$('plan_proposed_date').value=p.proposedDate||'';
  $('plan_importance').value=p.importanceId||'';$('plan_location').value=p.locationHint||'';
  $('plan_description').value=p.description||'';$('plan_notes').value=p.notes||'';
  $('btn_save_plan').textContent='ذخیره تغییرات';$('btn_cancel_plan').style.display='';
  window.scrollTo({top:0,behavior:'smooth'});
}
async function savePlan(){
  var id=val('plan_id'),title=val('plan_title');
  if(!title){showAlert('عنوان موضوع الزامی.');return}
  var plans=(await getFresh(KEYS.planning)),session=getSession();
  if(id){
    var p=plans.find(x=>x.id===id);if(!p){showAlert('یافت نشد.','error');return}
    p.title=title;p.requester=val('plan_requester');p.assignee=val('plan_assignee');
    p.proposedDate=val('plan_proposed_date')||'';p.importanceId=val('plan_importance');
    p.locationHint=val('plan_location');p.description=val('plan_description');p.notes=val('plan_notes');
    if(await setData(KEYS.planning,plans)){renderPlanning();resetPlanForm();updatePlanningBadge();showAlert('ویرایش شد.','success')}
  }else{
    plans.unshift({id:genId('plan_'),title:title,requester:val('plan_requester'),assignee:val('plan_assignee'),proposedDate:val('plan_proposed_date')||'',importanceId:val('plan_importance'),locationHint:val('plan_location'),description:val('plan_description'),notes:val('plan_notes'),status:'draft',createdBy:session.personId,createdAt:Date.now(),convertedActivityId:'',convertedAt:0});
    if(await setData(KEYS.planning,plans)){renderPlanning();resetPlanForm();updatePlanningBadge();showAlert('موضوع جدید ثبت شد.','success')}
  }
}
async function advancePlanStatus(id,newStatus){
  var plans=await getFresh(KEYS.planning),p=plans.find(x=>x.id===id);if(!p)return;
  if((PLAN_FLOW[p.status]||[]).indexOf(newStatus)===-1){showAlert('این انتقال وضعیت مجاز نیست.','error');return}
  if(newStatus==='cancelled'){var reason=prompt('دلیل انصراف:');if(reason===null)return;p.cancelReason=reason.trim()}
  p.status=newStatus;p.updatedAt=Date.now();
  if(await setData(KEYS.planning,plans)){renderPlanning();updatePlanningBadge();showAlert('وضعیت به «'+PLAN_STATUS[newStatus].label+'» تغییر کرد.','success')}
}
async function deletePlan(id){
  var p=getData(KEYS.planning).find(x=>x.id===id);if(!p)return;
  if(p.status==='converted'){showAlert('موضوع تبدیل‌شده قابل حذف نیست.','warning');return}
  if(!confirm('حذف «'+p.title+'»؟'))return;
  if(!(await deleteRemote('planning_topics',id)))return;
  writeLocal(KEYS.planning,getData(KEYS.planning).filter(x=>x.id!==id));
  renderPlanning();updatePlanningBadge();showAlert('حذف شد.','success');
}
function renderPlanning(){
  var c=$('plan_list_container');if(!c)return;
  var fs=val('plan_filter_status')||'active',search=normText(val('plan_search'));
  var list=readOnly(KEYS.planning).list.filter(p=>{
    if(fs==='active'&&PLAN_ACTIVE.indexOf(p.status)===-1)return false;
    if(fs&&fs!=='active'&&p.status!==fs)return false;
    if(search&&normText(p.title+' '+(p.description||'')+' '+(p.requester||'')).indexOf(search)===-1)return false;
    return true;
  });
  var rank={ready:0,coordinating:1,draft:2,converted:3,cancelled:4};
  list.sort((a,b)=>{
    var r=(rank[a.status]!==undefined?rank[a.status]:9)-(rank[b.status]!==undefined?rank[b.status]:9);if(r!==0)return r;
    return(a.proposedDate?jalaliToTimestamp(a.proposedDate):Infinity)-(b.proposedDate?jalaliToTimestamp(b.proposedDate):Infinity);
  });
  if(!list.length){c.innerHTML='<p style="padding:24px;text-align:center;color:var(--text3)">موضوعی یافت نشد.</p>';return}
  var h='<table><tr><th>عنوان</th><th>مسئول</th><th>تاریخ پیشنهادی</th><th>اولویت</th><th>وضعیت</th><th>عملیات</th></tr>';
  list.forEach(p=>{
    var s=PLAN_STATUS[p.status]||PLAN_STATUS.draft;
    var statusBadge='<span class="badge" style="background:'+s.color+'">'+s.icon+' '+s.label+'</span>',btns='';
    if(p.status!=='converted'&&p.status!=='cancelled')btns+='<button class="btn btn-warning btn-sm" data-plan-action="edit" data-id="'+esc(p.id)+'">ویرایش</button> ';
    (PLAN_FLOW[p.status]||[]).forEach(next=>{
      if(next==='converted')btns+='<button class="btn btn-success btn-sm" data-plan-action="convert" data-id="'+esc(p.id)+'">🚀 تبدیل</button> ';
      else if(next==='cancelled')btns+='<button class="btn btn-danger btn-sm" data-plan-action="cancel" data-id="'+esc(p.id)+'">لغو</button> ';
      else btns+='<button class="btn btn-sm" data-plan-action="advance" data-next="'+esc(next)+'" data-id="'+esc(p.id)+'">'+(next==='coordinating'?'▶ هماهنگی':'✔ آماده')+'</button> ';
    });
    if(p.status==='converted'&&p.convertedActivityId)btns+='<button class="btn btn-secondary btn-sm" data-plan-action="goto" data-id="'+esc(p.convertedActivityId)+'">🔗 مشاهده</button> ';
    if(p.status!=='converted')btns+='<button class="btn btn-danger btn-sm" data-plan-action="delete" data-id="'+esc(p.id)+'">🗑</button>';
    h+='<tr><td data-label="عنوان"><b>'+esc(p.title)+'</b>'+(p.description?'<div style="font-size:11px;color:var(--text2);margin-top:2px">'+esc(p.description.substring(0,80))+(p.description.length>80?'...':'')+'</div>':'')+'</td><td data-label="مسئول">'+esc(p.assignee?personName(p.assignee):'—')+'</td><td data-label="تاریخ">'+(p.proposedDate?esc(p.proposedDate):'—')+'</td><td data-label="اولویت">'+(p.importanceId?impBadge(p.importanceId):'—')+'</td><td data-label="وضعیت">'+statusBadge+'</td><td data-label="عملیات" style="display:flex;gap:4px;flex-wrap:wrap">'+btns+'</td></tr>';
  });
  c.innerHTML=h+'</table>';
}
function updatePlanningBadge(){
  var badge=$('planning_badge');if(!badge)return;
  var n=readOnly(KEYS.planning).list.filter(p=>PLAN_ACTIVE.indexOf(p.status)!==-1).length;
  if(n>0){badge.textContent=n;badge.style.display='inline-block'}else badge.style.display='none';
}
function convertPlanToActivity(id){
  var p=getData(KEYS.planning).find(x=>x.id===id);if(!p)return;
  if(p.status!=='ready'){showAlert('تنها موضوعات «آماده برنامه‌ریزی» قابل تبدیل هستند.','warning');return}
  _pendingPlanConvert=id;
  $('plan_convert_banner').classList.remove('hidden');$('plan_convert_banner').style.display='flex';
  $('plan_convert_title').textContent=p.title;
  showSection('activity');setActivityEditMode(false);$('act_id').value='';
  $('act_start_date').value=p.proposedDate||getTodayJalali();$('act_end_date').value='';
  $('act_desc').value=p.title+(p.description?'\n\n'+p.description:'');
  setLocationFields(p.locationHint);
  $('act_importance').value=p.importanceId||(getImportanceLevels()[0]||{}).id;
  $('act_only_for_me').checked=false;updateCalculatedHours();
  showAlert('فرم پیش‌پر شد. پس از تکمیل (ساعت، شرکت‌کنندگان، موضوع) ذخیره کنید.','success');
}
function cancelPendingConversion(){
  _pendingPlanConvert=null;
  $('plan_convert_banner').classList.add('hidden');$('plan_convert_banner').style.display='none';
  showAlert('تبدیل لغو شد.','warning');
}
async function handlePendingPlanConversion(activityId){
  if(!_pendingPlanConvert)return;
  var planId=_pendingPlanConvert;_pendingPlanConvert=null;
  $('plan_convert_banner').classList.add('hidden');$('plan_convert_banner').style.display='none';
  var plans=getData(KEYS.planning),p=plans.find(x=>x.id===planId);if(!p)return;
  p.status='converted';p.convertedActivityId=activityId;p.convertedAt=Date.now();
  if(await setData(KEYS.planning,plans)){updatePlanningBadge();renderPlanning();showAlert('موضوع به «تبدیل‌شده» منتقل شد.','success')}
}

