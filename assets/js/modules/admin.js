'use strict';
/* Extracted from the original 4.3.3 application without changing business logic. */
function showSection(id){
  closePopups();
  var cards=document.querySelectorAll('.content > div.card'),i;
  for(i=0;i<cards.length;i++)cards[i].classList.add('hidden');
  var sec=$('section-'+id);if(sec)sec.classList.remove('hidden');
  var btns=document.querySelectorAll('#main_nav button');
  for(i=0;i<btns.length;i++)btns[i].classList.toggle('active',btns[i].dataset.target===id);
  refreshDropdowns();
  if(id==='persons')renderPersons();
  else if(id==='topics')renderTopics();
  else if(id==='importance')renderImportance();
  else if(id==='holidays')renderHolidays();
  else if(id==='locations')renderLocations();
  else if(id==='calendar')renderCalendar();
  else if(id==='planning'){renderPlanning();updatePlanningBadge()}
  else if(id==='activity'){populateParticipants();renderDayActs()}
  else if(id==='records')renderRecords();
  if(window.innerWidth<900){$('main_nav').classList.remove('active');$('navOverlay').classList.remove('active')}
  window.scrollTo({top:0,behavior:'smooth'});
}

function populateParticipants(preselected){
  var container=$('participants_checkboxes');if(!container)return;
  var persons=sortPersonsById(readOnly(KEYS.persons).list);
  var session=getSession();if(!session)return;
  var privileged=isPriv(),selfId=session.personId;
  if(!preselected||!preselected.length)preselected=[selfId];
  if(!persons.length){container.innerHTML='<p style="padding:10px;color:#999">هنوز کاربری ثبت نشده است.</p>';return}
  var html='';
  persons.forEach(function(p){
    var isSelf=(p.id===selfId)&&!privileged;
    var checked=isSelf||(preselected.indexOf(p.id)!==-1);
    html+='<label class="'+(isSelf?'participant-item self-item':'participant-item')+'"><input type="checkbox" value="'+esc(p.id)+'" '+(checked?'checked':'')+' '+(isSelf?'disabled':'')+'><span>'+esc(p.firstName+' '+p.lastName)+' <small style="color:#888">('+esc(p.personnelId)+')</small>'+(isSelf?' — شما':'')+'</span></label>';
  });
  container.innerHTML=html;
}
function getSelectedParticipants(){var arr=[];document.querySelectorAll('#participants_checkboxes input[type=checkbox]').forEach(cb=>{if(cb.checked)arr.push(cb.value)});return arr}

function applyPermissions(){
  var s=getSession();if(!s)return;
  var isSuper=s.role==='superadmin',admin=s.role==='admin'||isSuper,priv=admin||s.role==='manager';
  document.querySelectorAll('[data-superadmin-only]').forEach(el=>{el.style.display=isSuper?'':'none'});
  document.querySelectorAll('[data-admin-only]').forEach(el=>{el.style.display=admin?'':'none'});
  document.querySelectorAll('[data-manager-only]').forEach(el=>{el.style.display=priv?'':'none'});
  var roleSel=$('p_role');
  if(roleSel)Array.prototype.forEach.call(roleSel.options,o=>{if(o.value==='superadmin'){o.hidden=!isSuper;o.disabled=!isSuper}});
  $('btn_sync_cloud').style.display='';
  var roleLabel=isSuper?'سوپر ادمین':(admin?'ادمین':(s.role==='manager'?'مدیر':'کاربر'));
  $('current_user').textContent=s.name+' — '+roleLabel;$('user_info').style.display='';
  if(!priv){
    ['rec_person','rep_person'].forEach(id=>{var el=$(id);if(el){el.value=s.personId;el.disabled=true}});
    var calEl=$('cal_person');if(calEl){calEl.value='';calEl.disabled=false}
  }
}

async function savePerson(){
  var s=getSession();if(!s)return;
  var id=val('p_id'),first=val('p_first_name'),last=val('p_last_name'),pid=val('p_personnel_id');
  var username=val('p_username'),password=$('p_password').value,role=val('p_role');
  
  if(!first||!last||!pid){showAlert('نام، نام خانوادگی و شماره پرسنلی الزامی است.');return}
  if(!/^\d{1,6}$/.test(pid)){showAlert('شماره پرسنلی باید یک عدد حداکثر ۶ رقمی باشد.');return}
  if(!username){showAlert('نام کاربری الزامی است.');return}
  if(username.length < MIN_USERNAME_LEN){showAlert('نام کاربری باید حداقل '+MIN_USERNAME_LEN+' کاراکتر باشد.');return}
  
  var persons=getData(KEYS.persons);
  if(persons.some(p=>p.username===username&&p.id!==id)){showAlert('این نام کاربری قبلاً ثبت شده.');return}
  if(persons.some(p=>p.personnelId===pid&&p.id!==id)){showAlert('شماره پرسنلی تکراری.');return}
  
  if(id){
    var old=persons.find(x=>x.id===id);
    if(!old){showAlert('یافت نشد.');return}
    if(password&&password.length<MIN_PASSWORD_LEN){showAlert('کلمه عبور حداقل '+MIN_PASSWORD_LEN+' کاراکتر باشد.');return}
    
    var ar=await callAccountFn('update_account',{
       id: id,
       firstname: first,
       lastname: last,
       personnelid: pid,
       role: role,
       username: (username !== old.username) ? username : undefined,
       password: password || undefined
    });
    
    if(!ar.ok){showAlert('❌ '+(ar.error||'خطا'),'error');return}
    
    var pullOk = await pullTable(KEYS.persons); 
    
    renderPersons(); resetPersonForm(); refreshDropdowns(); populateParticipants();
    showAlert('✅ '+(ar.message||'ویرایش شد.'), 'success');

    if(!pullOk) {
      showAlert('✅ تغییرات در سرور ذخیره شد، اما دریافت اطلاعات جدید با خطا مواجه شد. لطفاً صفحه را رفرش کنید.', 'warning');
    } else if (username !== old.username && id === s.personId) {
      showAlert('نام کاربری شما تغییر کرد. صفحه رفرش می‌شود...', 'success');
      setTimeout(() => location.reload(), 1500);
    }
  } else {
    if(!password){showAlert('کلمه عبور الزامی است.');return}
    
    const { data: { session } } = await dbClient.auth.getSession();
    const { data: funcData, error: funcError } = await dbClient.functions.invoke('create-user', {
      body: { username, firstname: first, lastname: last, personnelid: pid, role },
      headers: { Authorization: `Bearer ${session.access_token}` }
    });

    if (funcError || (funcData && funcData.error)) {
      showAlert('❌ خطا: ' + (funcError?.message || funcData?.error), 'error'); return;
    }

    await pullTable(KEYS.persons); renderPersons(); resetPersonForm(); 
    showAlert('کاربر ایجاد شد. رمز پیش‌فرض: ' + username, 'success');
  }
}
function resetPersonForm(){$('p_id').value='';$('p_first_name').value='';$('p_last_name').value='';$('p_personnel_id').value='';$('p_username').value='';$('p_password').value='';$('p_password').placeholder='';$('p_role').value='user';$('btn_save_person').textContent='افزودن پرسنل';$('btn_cancel_person').style.display='none'}
function editPerson(id){
  var p=getData(KEYS.persons).find(x=>x.id===id);if(!p)return;
  $('p_id').value=p.id;$('p_first_name').value=p.firstName;$('p_last_name').value=p.lastName;
  $('p_personnel_id').value=p.personnelId;$('p_username').value=p.username||'';
  $('p_password').value='';$('p_password').placeholder='برای عدم تغییر، خالی بگذارید';
  $('p_role').value=p.role||'user';$('btn_save_person').textContent='ذخیره تغییرات';$('btn_cancel_person').style.display='';
  window.scrollTo({top:0,behavior:'smooth'});
}
function renderPersons(){
  var persons=sortPersonsById(readOnly(KEYS.persons).list),c=$('person_list_container');
  if(!persons.length){c.innerHTML='<p style="padding:24px;text-align:center;color:var(--text3)">هنوز کاربری ثبت نشده.</p>';return}
  var s=getSession()||{},isSuper=s.role==='superadmin';
  var cnt={};getVisibleActs().forEach(a=>{(a.participants||[]).forEach(pid=>{cnt[pid]=(cnt[pid]||0)+1})});
  var h='<table><tr><th>نام</th><th>نام خانوادگی</th><th>شماره پرسنلی</th><th>نام کاربری</th><th>نقش</th><th>تعداد اقدام</th><th>عملیات</th></tr>';
  persons.forEach(p=>{
    var rb='<span class="badge badge-role-user">کاربر</span>';
    if(p.role==='admin')rb='<span class="badge badge-role-admin">ادمین</span>';
    else if(p.role==='manager')rb='<span class="badge badge-role-manager">مدیر</span>';
    else if(p.role==='superadmin')rb='<span class="badge badge-role-superadmin">سوپر ادمین</span>';
    var locked=p.role==='superadmin'&&!isSuper;
    var btns=locked?'<span style="color:var(--text3)">—</span>':'<button class="btn btn-warning btn-sm" data-action="edit" data-id="'+esc(p.id)+'">ویرایش</button><button class="btn btn-danger btn-sm" data-action="delete" data-id="'+esc(p.id)+'">حذف</button><button class="btn btn-secondary btn-sm" data-action="pwd" data-id="'+esc(p.id)+'" title="تعیین رمز جدید">🔑</button>';
    h+='<tr><td data-label="نام">'+esc(p.firstName)+'</td><td data-label="نام خانوادگی">'+esc(p.lastName)+'</td><td data-label="شماره پرسنلی">'+esc(p.personnelId)+'</td><td data-label="نام کاربری">'+esc(p.username||'-')+'</td><td data-label="نقش">'+rb+'</td><td data-label="تعداد">'+(cnt[p.id]||0)+'</td><td data-label="عملیات" style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">'+btns+'</td></tr>';
  });
  c.innerHTML=h+'</table>';
}
async function callAccountFn(action,payload){
  if(!dbClient||!navigator.onLine)return{ok:false,error:'اتصال به دیتابیس برقرار نیست.'};
  try{
    var r=await dbClient.functions.invoke('account-admin',{body:Object.assign({action:action},payload||{})});
    if(r.error){
      var m=r.error.message||'خطا';
      try{if(r.error.context&&typeof r.error.context.json==='function'){var j=await r.error.context.json();if(j&&(j.error||j.message))m=j.error||j.message}}catch(e){}
      if(/Failed to send a request|NOT_FOUND|not found/i.test(m))m='Edge Function «account-admin» مستقر نشده است.';
      return{ok:false,error:m};
    }
    return r.data||{ok:false,error:'پاسخ نامعتبر از سرور.'};
  }catch(e){return{ok:false,error:e.message}}
}
async function changePersonPassword(id){
  var p=getData(KEYS.persons).find(x=>x.id===id);if(!p)return;
  var pw=prompt('رمز جدید برای «'+p.firstName+' '+p.lastName+'» (حداقل '+MIN_PASSWORD_LEN+' کاراکتر):');
  if(pw===null)return;
  if(pw.length<MIN_PASSWORD_LEN){showAlert('رمز باید حداقل '+MIN_PASSWORD_LEN+' کاراکتر باشد.');return}
  var r=await callAccountFn('update_account',{id:id,password:pw});
  if(!r.ok){showAlert('❌ '+(r.error||'خطا'),'error');return}
  await pullTable(KEYS.persons);renderPersons();
  showAlert('✅ '+(r.message||'رمز تغییر کرد.'),'success');
}
async function repairLoginEmails(){
  if(!confirm('ایمیل ورود همهٔ کاربران با نام کاربری فعلی‌شان هماهنگ شود؟'))return;
  var r=await callAccountFn('repair_all',{});
  if(!r.ok){showAlert('❌ '+(r.error||'خطا'),'error');return}
  showAlert('✅ اصلاح‌شده: '+((r.fixed||[]).length?(r.fixed||[]).join('، '):'موردی نبود')+((r.skipped||[]).length?'\nرد شده: '+(r.skipped||[]).join('، '):''),'success');
}
async function deletePerson(id){
  var s=getSession();if(!s)return;
  if(id===s.personId){showAlert('نمی‌توانید حساب خودتان را حذف کنید.','error');return}
  if(!confirm('حذف کاربر باعث حذف حساب ورود او می‌شود. مطمئن؟'))return;
  var r=await callAccountFn('delete_account',{id:id});
  if(!r.ok){showAlert('❌ '+(r.error||'خطا'),'error');return}
  await syncFromCloud(false);
  renderPersons();refreshDropdowns();populateParticipants();showAlert(r.warning?('حذف شد. '+r.warning):'حذف شد.','success');
}

async function saveTopic(){
  var name=val('t_name');if(!name){showAlert('نام موضوع الزامی.');return}
  var topics=getData(KEYS.topics);
  for(var i=0;i<topics.length;i++)if(normText(topics[i].name)===normText(name)){showAlert('قبلاً ثبت شده.');return}
  topics.push({id:genId('t'),name:name,sortOrder:nextTopicOrder()});
  if(!(await setData(KEYS.topics,topics)))return;
  $('t_name').value='';renderTopics();refreshDropdowns();showAlert('افزوده شد.','success');
}
function nextTopicOrder(){var l=readOnly(KEYS.topics).list;return l.length?Math.max.apply(null,l.map(x=>x.sortOrder||0))+1:1}
async function moveTopic(id,dir){
  var list=getData(KEYS.topics).sort(byOrder),i=list.findIndex(x=>x.id===id),j=i+dir;
  if(i<0||j<0||j>=list.length)return;
  var t=list[i];list[i]=list[j];list[j]=t;
  list.forEach((x,k)=>{x.sortOrder=k+1});
  if(await setData(KEYS.topics,list)){renderTopics();refreshDropdowns()}
}
function renderTopics(){
  var topics=readOnly(KEYS.topics).list.slice().sort(byOrder),c=$('topic_list_container');
  if(!topics.length){c.innerHTML='<p style="padding:24px;text-align:center;color:var(--text3)">هنوز موضوعی تعریف نشده.</p>';return}
  var cnt=countBy(readOnly(KEYS.acts).list,a=>a.topicId);
  var h='<table><tr><th>ترتیب</th><th>نام</th><th>تعداد اقدام</th><th>عملیات</th></tr>';
  topics.forEach(t=>{h+='<tr><td data-label="ترتیب">'+(t.sortOrder||0)+'</td><td data-label="نام">'+esc(t.name)+'</td><td data-label="تعداد">'+(cnt[t.id]||0)+'</td><td data-label="عملیات" style="display:flex;gap:4px;justify-content:flex-end"><button class="btn btn-secondary btn-sm" data-action="up" data-id="'+esc(t.id)+'" title="بالا">▲</button><button class="btn btn-secondary btn-sm" data-action="down" data-id="'+esc(t.id)+'" title="پایین">▼</button><button class="btn btn-danger btn-sm" data-action="delete" data-id="'+esc(t.id)+'">حذف</button></td></tr>'});
  c.innerHTML=h+'</table>';
}
async function deleteTopic(id){
  var used=getData(KEYS.acts).filter(a=>a.topicId===id).length;
  if(used>0){showAlert('در '+used+' اقدام استفاده شده و قابل حذف نیست.');return}
  if(!confirm('از حذف مطمئن هستید؟'))return;
  if(!(await deleteRemote('topics',id)))return;
  writeLocal(KEYS.topics,getData(KEYS.topics).filter(t=>t.id!==id));
  renderTopics();refreshDropdowns();showAlert('حذف شد.','success');
}

function resetImportanceForm(){$('imp_id').value='';$('imp_name').value='';$('imp_color').value='#3498db';$('imp_is_key').checked=false;$('btn_save_imp').textContent='افزودن';$('btn_cancel_imp_wrap').style.display='none'}
function editImportance(id){
  var lv=getImportanceLevels().find(x=>x.id===id);if(!lv)return;
  $('imp_id').value=lv.id;$('imp_name').value=lv.name;$('imp_color').value=lv.color||'#3498db';$('imp_is_key').checked=lv.isKey===true;
  $('btn_save_imp').textContent='ذخیره';$('btn_cancel_imp_wrap').style.display='';
  window.scrollTo({top:0,behavior:'smooth'});
}
async function saveImportance(){
  var id=val('imp_id'),name=val('imp_name'),color=val('imp_color')||'#3498db',isKey=$('imp_is_key').checked;
  if(!name){showAlert('نام الزامی.');return}
  if(!/^#[0-9a-fA-F]{6}$/.test(color))color='#3498db';
  var levels=getImportanceLevels();
  if(id){
    var lv=levels.find(x=>x.id===id);if(!lv){showAlert('یافت نشد.','error');return}
    if(levels.some(x=>x.id!==id&&normText(x.name)===normText(name))){showAlert('نام تکراری.','error');return}
    lv.name=name;lv.color=color;lv.isKey=isKey;
    if(await setData(KEYS.importance,levels)){renderImportance();refreshDropdowns();resetImportanceForm();showAlert('ویرایش شد.','success')}
  }else{
    if(levels.some(x=>normText(x.name)===normText(name))){showAlert('قبلاً ثبت شده.','error');return}
    levels.push({id:genId('imp_'),name:name,color:color,isKey:isKey});
    if(await setData(KEYS.importance,levels)){renderImportance();refreshDropdowns();resetImportanceForm();showAlert('افزوده شد.','success')}
  }
}
async function deleteImportance(id){
  var levels=getImportanceLevels(),lv=levels.find(x=>x.id===id);if(!lv)return;
  if(levels.length<=1){showAlert('حداقل یک درجه لازم است.','error');return}
  var used=getData(KEYS.acts).filter(a=>a.importance===id).length;
  if(used>0){showAlert('در '+used+' اقدام استفاده شده.','error');return}
  if(!confirm('از حذف «'+lv.name+'» مطمئن هستید؟'))return;
  if(!(await deleteRemote('importance_levels',id)))return;
  writeLocal(KEYS.importance,levels.filter(x=>x.id!==id));
  renderImportance();refreshDropdowns();showAlert('حذف شد.','success');
}
function renderImportance(){
  var levels=readOnly(KEYS.importance).list,c=$('imp_list_container');
  if(!levels.length){c.innerHTML='<p style="padding:24px;text-align:center;color:var(--text3)">درجه‌ای ثبت نشده.</p>';return}
  var cnt=countBy(readOnly(KEYS.acts).list,a=>a.importance);
  var h='<table><tr><th>رنگ</th><th>نام</th><th>اقدام کلیدی</th><th>تعداد</th><th>عملیات</th></tr>';
  levels.forEach(lv=>{
    var kb=lv.isKey?'<span class="badge" style="background:#c9a227">✔ کلیدی</span>':'<span style="color:var(--text3)">—</span>';
    h+='<tr><td data-label="رنگ"><span style="display:inline-block;width:18px;height:18px;border-radius:4px;background:'+esc(lv.color||'#3498db')+';border:1px solid var(--border);vertical-align:middle;margin-left:6px"></span><small>'+esc(lv.color||'')+'</small></td><td data-label="نام">'+esc(lv.name)+'</td><td data-label="کلیدی">'+kb+'</td><td data-label="تعداد">'+(cnt[lv.id]||0)+'</td><td data-label="عملیات" style="display:flex;gap:4px;justify-content:flex-end"><button class="btn btn-warning btn-sm" data-action="edit" data-id="'+esc(lv.id)+'">ویرایش</button><button class="btn btn-danger btn-sm" data-action="delete" data-id="'+esc(lv.id)+'">حذف</button></td></tr>';
  });
  c.innerHTML=h+'</table>';
}

async function saveHoliday(){
  var dateStr=val('h_date'),title=val('h_title');
  if(!isValidJalaliDate(dateStr)){showAlert('تاریخ نامعتبر.');return}
  if(!title){showAlert('عنوان الزامی.');return}
  var date=normJ(dateStr),holidays=getData(KEYS.holidays);
  if(holidays.some(h=>h.date===date)){showAlert('قبلاً ثبت شده.');return}
  holidays.push({id:genId('h'),date:date,title:title});
  if(!(await setData(KEYS.holidays,holidays)))return;
  $('h_title').value='';renderHolidays();renderCalendar();showAlert('ثبت شد.','success');
}
async function deleteHoliday(id){
  if(!confirm('از حذف مطمئن هستید؟'))return;
  if(!(await deleteRemote('holidays',id)))return;
  writeLocal(KEYS.holidays,getData(KEYS.holidays).filter(h=>h.id!==id));
  renderHolidays();renderCalendar();showAlert('حذف شد.','success');
}
function renderHolidays(){
  var holidays=readOnly(KEYS.holidays).list.slice().sort((a,b)=>jalaliToTimestamp(a.date)-jalaliToTimestamp(b.date));
  var c=$('holiday_list_container');
  if(!holidays.length){c.innerHTML='<p style="padding:24px;text-align:center;color:var(--text3)">تعطیلی ثبت نشده.</p>';return}
  var h='<table><tr><th>تاریخ</th><th>عنوان</th><th>عملیات</th></tr>';
  holidays.forEach(x=>{h+='<tr><td data-label="تاریخ">'+esc(x.date)+'</td><td data-label="عنوان">'+esc(x.title)+'</td><td data-label="عملیات"><button class="btn btn-danger btn-sm" data-action="delete" data-id="'+esc(x.id)+'">حذف</button></td></tr>'});
  c.innerHTML=h+'</table>';
}
async function loadDefaultHolidays(){
  var year=parseInt(val('h_default_year'),10);
  if(isNaN(year)||year<1300||year>1500){showAlert('سال معتبر.');return}
  var defaults=[{m:1,d:1,t:'عید نوروز'},{m:1,d:2,t:'عید نوروز'},{m:1,d:3,t:'عید نوروز'},{m:1,d:4,t:'عید نوروز'},{m:1,d:12,t:'روز جمهوری اسلامی'},{m:1,d:13,t:'سیزده بدر'},{m:3,d:14,t:'رحلت امام خمینی'},{m:3,d:15,t:'قیام ۱۵ خرداد'},{m:11,d:22,t:'پیروزی انقلاب اسلامی'},{m:12,d:29,t:'ملی شدن صنعت نفت'}];
  var holidays=getData(KEYS.holidays),added=0;
  defaults.forEach(item=>{var date=fmtJalali(year,item.m,item.d);if(!holidays.some(h=>h.date===date)){holidays.push({id:genId('h'),date:date,title:item.t});added++}});
  if(added>0){if(await setData(KEYS.holidays,holidays)){renderHolidays();renderCalendar();showAlert(added+' تعطیلی اضافه شد.','success')}}
  else showAlert('قبلاً ثبت شده‌اند.','warning');
}

function byOrder(a,b){return(a.sortOrder||0)-(b.sortOrder||0)||String(a.name).localeCompare(String(b.name),'fa')}
function getLocationNames(){return readOnly(KEYS.locations).list.slice().sort(byOrder).map(l=>l.name)}
function fillLocationSelect(){
  var sel=$('act_location_select');if(!sel)return;
  var cur=sel.value,names=getLocationNames();
  sel.innerHTML=names.map(n=>'<option value="'+esc(n)+'">'+esc(n)+'</option>').join('')+'<option value="سایر">سایر</option>';
  sel.value=(cur&&(names.indexOf(cur)!==-1||cur==='سایر'))?cur:(names.length?names[0]:'سایر');
  toggleOtherLocation(false);
}
function toggleOtherLocation(focus){
  var other=$('act_location_other');if(!other)return;
  if($('act_location_select').value==='سایر'){other.classList.remove('hidden');if(focus)other.focus()}
  else{other.classList.add('hidden');other.value=''}
}
function onLocationChange(){toggleOtherLocation(true)}
function setLocationFields(loc){
  var names=getLocationNames(),sel=$('act_location_select'),oth=$('act_location_other');
  if(loc&&names.indexOf(loc)!==-1){sel.value=loc;oth.value=''}
  else if(loc){sel.value='سایر';oth.value=loc}
  else{sel.value=names.length?names[0]:'سایر';oth.value=''}
  toggleOtherLocation(false);
}
function readLocation(){var l=val('act_location_select');if(l==='سایر')l=val('act_location_other')||'سایر';return l}

function nextLocOrder(){var l=readOnly(KEYS.locations).list;return l.length?Math.max.apply(null,l.map(x=>x.sortOrder||0))+1:1}
function resetLocationForm(){$('loc_id').value='';$('loc_name').value='';$('loc_order').value=nextLocOrder();$('btn_save_loc').textContent='افزودن';$('btn_cancel_loc_wrap').style.display='none'}
function editLocation(id){
  var l=getData(KEYS.locations).find(x=>x.id===id);if(!l)return;
  $('loc_id').value=l.id;$('loc_name').value=l.name;$('loc_order').value=l.sortOrder||0;
  $('btn_save_loc').textContent='ذخیره';$('btn_cancel_loc_wrap').style.display='';
  window.scrollTo({top:0,behavior:'smooth'});
}
async function saveLocation(){
  var s=getSession();if(!s||s.role!=='superadmin'){showAlert('فقط سوپر ادمین مجاز است.');return}
  var id=val('loc_id'),name=val('loc_name'),order=parseInt(val('loc_order'),10);
  if(!name){showAlert('نام محل الزامی.');return}
  if(name==='سایر'){showAlert('نام «سایر» رزرو شده است.');return}
  if(isNaN(order))order=nextLocOrder();
  var list=getData(KEYS.locations);
  if(list.some(x=>x.id!==id&&normText(x.name)===normText(name))){showAlert('نام تکراری.');return}
  if(id){
    var l=list.find(x=>x.id===id);if(!l){showAlert('یافت نشد.','error');return}
    l.name=name;l.sortOrder=order;
  }else list.push({id:genId('loc_'),name:name,sortOrder:order});
  if(await setData(KEYS.locations,list)){renderLocations();fillLocationSelect();resetLocationForm();showAlert(id?'ویرایش شد. (اقدامات قبلی با نام قدیمی باقی می‌مانند)':'افزوده شد.','success')}
}
async function moveLocation(id,dir){
  var list=getData(KEYS.locations).sort(byOrder),i=list.findIndex(x=>x.id===id),j=i+dir;
  if(i<0||j<0||j>=list.length)return;
  var t=list[i];list[i]=list[j];list[j]=t;
  list.forEach((x,k)=>{x.sortOrder=k+1});
  if(await setData(KEYS.locations,list)){renderLocations();fillLocationSelect()}
}
async function deleteLocation(id){
  var l=getData(KEYS.locations).find(x=>x.id===id);if(!l)return;
  var used=getData(KEYS.acts).filter(a=>a.location===l.name).length;
  if(!confirm('حذف «'+l.name+'»؟'+(used?'\n'+used+' اقدام ثبت‌شده با این محل، متن محل خود را حفظ می‌کنند.':'')))return;
  if(!(await deleteRemote('locations',id)))return;
  writeLocal(KEYS.locations,getData(KEYS.locations).filter(x=>x.id!==id));
  renderLocations();fillLocationSelect();showAlert('حذف شد.','success');
}
function renderLocations(){
  var c=$('loc_list_container');if(!c)return;
  var list=readOnly(KEYS.locations).list.slice().sort(byOrder);
  if(!$('loc_id').value&&!$('loc_order').value)$('loc_order').value=nextLocOrder();
  if(!list.length){c.innerHTML='<p style="padding:24px;text-align:center;color:var(--text3)">محلی ثبت نشده (یا اسکریپت SQL جدول locations اجرا نشده است).</p>';return}
  var cnt=countBy(readOnly(KEYS.acts).list,a=>a.location);
  var h='<table><tr><th>ترتیب</th><th>نام محل</th><th>تعداد اقدام</th><th>عملیات</th></tr>';
  list.forEach(l=>{
    h+='<tr><td data-label="ترتیب">'+(l.sortOrder||0)+'</td><td data-label="نام">'+esc(l.name)+'</td><td data-label="تعداد">'+(cnt[l.name]||0)+'</td><td data-label="عملیات" style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end"><button class="btn btn-secondary btn-sm" data-action="up" data-id="'+esc(l.id)+'" title="بالا">▲</button><button class="btn btn-secondary btn-sm" data-action="down" data-id="'+esc(l.id)+'" title="پایین">▼</button><button class="btn btn-warning btn-sm" data-action="edit" data-id="'+esc(l.id)+'">ویرایش</button><button class="btn btn-danger btn-sm" data-action="delete" data-id="'+esc(l.id)+'">حذف</button></td></tr>';
  });
  c.innerHTML=h+'</table>';
}

var _weekStart=null;
