'use strict';
/* Extracted from the original 4.3.3 application without changing business logic. */
function getWeekStart(dateStr){var p=parseJalali(dateStr);return addDaysStr(dateStr,-getJalaliDayOfWeek(p.jy,p.jm,p.jd))}
function onWeekModeChange(){
  var w=$('cal_week_mode').checked;
  $('cal_month_group').style.display=w?'none':'';$('cal_year_group').style.display=w?'none':'';$('monthly_summary').style.display=w?'none':'';
  renderCalendar();
}
function weekShift(n){if(!_weekStart)_weekStart=getWeekStart(getTodayJalali());_weekStart=addDaysStr(_weekStart,n*7);renderWeekView()}
function weekGoToday(){_weekStart=getWeekStart(getTodayJalali());renderWeekView()}

function renderCalendar(){
  var weekMode=$('cal_week_mode')&&$('cal_week_mode').checked;
  if(weekMode){$('calendar_container').classList.add('hidden');$('calendar_week_view').classList.remove('hidden');renderWeekView();return}
  $('calendar_container').classList.remove('hidden');$('calendar_week_view').classList.add('hidden');
  var c=$('calendar_container'),personId=val('cal_person'),month=parseInt(val('cal_month'),10),year=parseInt(val('cal_year'),10);
  if(isNaN(year)||isNaN(month)){var today=getTodayJalali().split('/');year=parseInt(today[0],10);month=parseInt(today[1],10)}
  var days=jalaliMonthLength(year,month),first=getJalaliDayOfWeek(year,month,1);
  var holMap=getHolidayMap(),session=getSession()||{};
  // ایندکس‌گذاری اقدامات بر اساس روز؛ به‌جای پیمایش همه اقدامات برای تک‌تک روزها
  // فقط روزهایی پیمایش می‌شوند که هر اقدام واقعاً در آن‌ها جریان دارد.
  var actsByDate=Object.create(null);
  var monthStart=fmtJalali(year,month,1);
  var monthEnd=fmtJalali(year,month,days);
  var monthStartTs=jalaliToTimestamp(monthStart);
  var monthEndTs=jalaliToTimestamp(monthEnd);
  for(var di=1;di<=days;di++)actsByDate[fmtJalali(year,month,di)]=[];
  getVisibleActs().forEach(a=>{
    if(personId&&(!a.participants||a.participants.indexOf(personId)===-1))return;
    var startTs=jalaliToTimestamp(a.date);
    var endTs=a.endDate?jalaliToTimestamp(a.endDate):startTs;
    if(endTs<monthStartTs||startTs>monthEndTs)return;
    var cursor=startTs<monthStartTs?monthStart:a.date;
    var stop=endTs>monthEndTs?monthEnd:a.endDate||a.date;
    while(jalaliToTimestamp(cursor)<=jalaliToTimestamp(stop)){
      actsByDate[cursor].push(a);
      cursor=addDaysStr(cursor,1);
    }
  });
  var h='<table class="calendar-table"><thead><tr>';
  DAY_NAMES.forEach(d=>{h+='<th>'+d+'</th>'});
  h+='</tr></thead><tbody><tr>';
  for(var i=0;i<first;i++)h+='<td></td>';
  var monthHours=0,monthCount=0;
  for(var day=1;day<=days;day++){
    var ds=fmtJalali(year,month,day),dow=(first+day-1)%7,da=actsByDate[ds]||[];
    var isHol=isHolidayDow(dow)||!!holMap[ds],hrs=0;
    da.forEach(a=>{
      if(a.date===ds&&(!a.endDate||a.endDate===a.date))hrs+=Number(a.hours)||0;
      else if(!isHol)hrs+=8;
    });
    monthHours+=hrs;monthCount+=da.filter(a=>a.date===ds).length;
    var holTitle=holMap[ds]?'<div class="holiday-title">'+esc(holMap[ds])+'</div>':'';
    var dayStatus=da.length>0?'<div class="day-status">'+da.length+' اقدام'+(hrs>0?'<br>'+fmtHours(hrs):'')+'</div>':'';
    var cls='day-cell';
    if(isHol)cls+=' holiday';
    else if(da.some(a=>a.onlyforme))cls+=' has-private';
    else if(da.some(a=>a.participants&&a.participants.indexOf(session.personId)!==-1))cls+=' has-participation';
    else if(da.length>0)cls+=' has-log';
    h+='<td class="'+cls+'" data-date="'+ds+'"><div class="day-number">'+day+'</div>'+holTitle+dayStatus+'</td>';
    if((first+day)%7===0&&day!==days)h+='</tr><tr>';
  }
  var rem=(7-((first+days)%7))%7;for(var k=0;k<rem;k++)h+='<td></td>';
  c.innerHTML=h+'</tr></tbody></table>';
  $('monthly_summary').innerHTML='<b>خلاصه '+MONTH_NAMES[month-1]+' '+year+':</b> '+monthCount+' اقدام ثبت‌شده • مجموع ساعات: '+fmtHours(monthHours);
}

function renderWeekView(){
  if(!_weekStart)_weekStart=getWeekStart(getTodayJalali());
  var container=$('week_grid');if(!container)return;
  var days=[],i;for(i=0;i<7;i++)days.push(addDaysStr(_weekStart,i));
  $('week_label').textContent=days[0]+' تا '+days[6];
  var personId=val('cal_person'),holMap=getHolidayMap(),selfId=(getSession()||{}).personId;
  var hours=[7,8,9,10,11,12,13,14,15,16,17,18,19,20];
  var dayTs=days.map(jalaliToTimestamp),grid={};
  getVisibleActs().forEach(a=>{
    if(personId&&(!a.participants||a.participants.indexOf(personId)===-1))return;
    if(!a.startTime)return;
    var hr=parseInt(a.startTime.split(':')[0],10);if(isNaN(hr))return;
    var s=jalaliToTimestamp(a.date),e=a.endDate?jalaliToTimestamp(a.endDate):s;
    for(var di=0;di<7;di++)if(dayTs[di]>=s&&dayTs[di]<=e){var k=di+'_'+hr;(grid[k]=grid[k]||[]).push(a)}
  });
  var html='<table class="week-grid-table"><thead><tr><th>ساعت</th>';
  days.forEach(ds=>{
    var p=parseJalali(ds),dow=getJalaliDayOfWeek(p.jy,p.jm,p.jd),isHol=isHolidayDow(dow)||holMap[ds];
    html+='<th'+(isHol?' style="background:var(--dangerS);color:var(--dangerI)"':'')+'><div>'+DAY_NAMES[dow]+'</div><small>'+p.jd+' '+MONTH_NAMES[p.jm-1]+'</small><button class="btn-add-week" data-date="'+esc(ds)+'" title="افزودن اقدام">➕</button></th>';
  });
  html+='</tr></thead><tbody>';
  hours.forEach(hr=>{
    html+='<tr><td class="hour-cell">'+pad2(hr)+':00</td>';
    for(var di=0;di<7;di++){
      html+='<td class="slot-cell">';
      (grid[di+'_'+hr]||[]).forEach(a=>{
        var canEdit=isPriv()||a.createdBy===selfId;
        var isJoined = selfId && (a.participants||[]).indexOf(selfId) !== -1;
        var joinIcon = isJoined ? '<span title="شما در این اقدام شرکت کرده‌اید" style="font-size:10px;margin-left:2px;">🤝</span> ' : '';
        html+='<div class="slot-act" data-id="'+esc(a.id)+'" style="border-right-color:'+esc(getImpColor(a.importance))+';'+(a.onlyforme?'background:var(--warningS);':'')+'">';
        if(canEdit)html+='<button class="btn-edit-week" data-id="'+esc(a.id)+'" title="ویرایش">✏️</button>';
        html+='<div class="slot-act-desc">'+joinIcon+esc(a.description)+'</div></div>';
      });
      html+='</td>';
    }
    html+='</tr>';
  });
  container.innerHTML=html+'</tbody></table>';
}

function openDayActivitiesModal(dateStr){
  _currentModalDate = dateStr;
  $('day_modal_title').textContent = 'اقدامات روز ' + dateStr;
  renderDayActivitiesModal();
  $('modal_day_activities').classList.remove('hidden');
}

function renderDayActivitiesModal(){
  if (!_currentModalDate) return;
  var list = $('day_modal_list');
  var acts = getVisibleActs().filter(a =>
    a.date === _currentModalDate ||
    (a.endDate && _currentModalDate >= a.date && _currentModalDate <= a.endDate)
  );
  acts.sort((a,b) => (a.startTime || '').localeCompare(b.startTime || ''));

  if (!acts.length) {
    list.innerHTML = '<p class="empty-state">اقدامی برای این روز ثبت نشده است.</p>';
    return;
  }

  var session = getSession();
  list.innerHTML = acts.map(function(a){
    var isJoined = session && (a.participants || []).indexOf(session.personId) !== -1;
    var participants = (a.participants || []).map(personName).join('، ') || '—';
    var dateText = a.endDate && a.endDate !== a.date
      ? esc(a.date) + ' تا ' + esc(a.endDate) : esc(a.date || '—');
    var timeText = a.startTime
      ? esc(a.startTime) + (a.endTime ? ' تا ' + esc(a.endTime) : '') : '';
    var locationText = a.location ? '📍 ' + esc(a.location) : '';
    var participantsText = '👥 ' + esc(participants);
    var actionButton = '';
    if (a.onlyforme) {
      actionButton = '<span class="badge badge-warning">👤 فقط من</span>';
    } else if (isJoined) {
      actionButton = '<span class="badge activity-joined">✅ عضو هستید</span>';
    } else {
      actionButton = '<button type="button" class="btn btn-sm btn-success" data-join-activity="' + esc(a.id) + '">🤝 پیوستن</button>';
    }

    return '<article class="day-activity-card">' +
      '<div class="day-activity-card__header">' +
        '<h3>' + esc(topicName(a.topicId)) + '</h3>' +
        '<button type="button" class="btn btn-sm btn-secondary" data-details-activity="' + esc(a.id) + '">جزئیات</button>' +
      '</div>' +
      '<div class="activity-summary">' +
        '<div class="activity-summary__meta">' + dateText + (timeText ? ' · ' + timeText : '') + (locationText ? ' · ' + locationText : '') + '</div>' +
        '<div class="activity-summary__body">' + esc(a.description || '—') + '</div>' +
        (participantsText ? '<div class="activity-summary__participants">' + participantsText + '</div>' : '') +
        '<div class="activity-summary__body">' + esc(a.privateDescription || '—') + '</div>' +
      '</div>' +
      '<div class="day-activity-card__actions">' + actionButton + '</div>' +
    '</article>';
  }).join('');
}
function showActivityDetails(id){
  var a=idxGet(KEYS.acts,id);if(!a||!canSeeAct(a))return;
  var pNames=(a.participants||[]).map(personName).join('، ');
  var session=getSession(),isJoined=session&&(a.participants||[]).indexOf(session.personId)!==-1;
  var html='<div class="modal activity-detail-modal"><h3>'+esc(topicName(a.topicId))+'</h3>';
  var dStr=(a.endDate&&a.endDate!==a.date)?esc(a.date)+' تا '+esc(a.endDate):esc(a.date);
  var timeStr=(a.startTime||'')+(a.endTime?' تا '+a.endTime:'');
  html+='<div class="activity-summary">';
  html+='<div class="activity-summary__meta">'+dStr+(timeStr?' · '+esc(timeStr):'')+(a.hours?' · '+esc(fmtHours(a.hours)):'')+(a.location?' · 📍 '+esc(a.location):'')+'</div>';
  html+='<div class="activity-summary__body">'+esc(a.description||'—')+'</div>';
  html+='<div class="activity-summary__participants">👥 '+esc(pNames||'—')+'</div>';
  html+='<div class="activity-summary__body">'+esc(a.privateDescription||'—')+'</div>';
  html+='</div>';
  if(a.onlyforme)html+='<div class="alert alert-warning" style="display:block;margin-top:10px;">👤 این اقدام فقط برای شما ثبت شده است.</div>';
  html+='<div class="modal-actions" style="margin-top:20px;"><button class="btn btn-secondary" data-act="close">بستن</button>';
  if(!isJoined&&!a.onlyforme)html+='<button class="btn btn-success" data-act="join">🤝 پیوستن به اقدام</button>';
  html+='</div></div>';
  var overlay=document.createElement('div');overlay.className='modal-overlay';overlay.innerHTML=html;
  overlay.addEventListener('click',function(e){
    if(e.target===overlay||e.target.closest('[data-act="close"]')){overlay.remove();return}
    if(e.target.closest('[data-act="join"]')){overlay.remove();joinActivity(id)}
  });
  document.body.appendChild(overlay);
}
function openNewActivityForDate(dateStr){showSection('activity');$('act_start_date').value=dateStr;resetActivityForm(true)}

function calcDurationHours(startDate,startTime,endDate,endTime){
  if(!isValidJalaliDate(startDate)||!isValidJalaliDate(endDate))return 0;
  if(!startTime||!endTime)return 0;
  if(startDate===endDate){
    var st=startTime.split(':'),et=endTime.split(':');
    var raw=((parseInt(et[0],10)*60+parseInt(et[1],10))-(parseInt(st[0],10)*60+parseInt(st[1],10)))/60;
    return raw>0?Math.round(raw*100)/100:0;
  }
  var holMap=getHolidayMap(),total=0,curr=normJ(startDate),endTs=jalaliToTimestamp(endDate);
  while(jalaliToTimestamp(curr)<=endTs){if(!isOffDay(curr,holMap))total+=8;curr=addDaysStr(curr,1)}
  return total;
}
function updateCalculatedHours(){
  var sd=val('act_start_date'),st=val('act_start_time'),ed=val('act_end_date'),et=val('act_end_time'),el=$('act_calc_hours');if(!el)return;
  if(!isValidJalaliDate(sd)||!st||!et){el.value='';return}
  if(!ed)ed=sd;
  if(!isValidJalaliDate(ed)){el.value='';return}
  var h=calcDurationHours(sd,st,ed,et);el.value=h>0?h+' ساعت':'نامعتبر';
}
function setActivityEditMode(isEdit){
  var hdr=$('activity_form_header');if(hdr)hdr.classList.toggle('hidden',isEdit);
  var sb=$('btn_save_act');if(sb)sb.textContent=isEdit?'💾 ذخیره تغییرات':'ثبت اقدام';
  var cb=$('btn_cancel_edit_act');if(cb)cb.style.display=isEdit?'':'none';
}
function resetActivityForm(keepDate){
  $('act_id').value='';setActivityEditMode(false);
  var levels=getImportanceLevels();$('act_importance').value=levels.length?levels[0].id:'';
  $('act_start_time').value='';$('act_end_time').value='';$('act_desc').value='';$('act_calc_hours').value='';$('act_private_desc').value='';
  setLocationFields('');$('act_only_for_me').checked=false;
  if(!keepDate){$('act_start_date').value=getTodayJalali();$('act_end_date').value=''}
  populateParticipants();updateCalculatedHours();renderDayActs();
}
function cancelEditAct(){resetActivityForm(true);showAlert('ویرایش لغو شد.','info')}

async function saveActivity(){
  var id=$('act_id').value,sd=val('act_start_date'),st=val('act_start_time');
  var ed=val('act_end_date')||sd,et=val('act_end_time');
  var topicId=val('act_topic'),imp=val('act_importance'),desc=val('act_desc');
  var location=readLocation(),onlyforme=$('act_only_for_me').checked,privateDescription=val('act_private_desc');
  var participants=getSelectedParticipants(),session=getSession();
  if(!session){showAlert('دوباره وارد شوید.');return}
  if(participants.length===0){showAlert('حداقل یک شرکت‌کننده.');return}
  if(!isValidJalaliDate(sd)){showAlert('تاریخ شروع نامعتبر.');return}
  if(!isValidJalaliDate(ed)){showAlert('تاریخ پایان نامعتبر.');return}
  if(!st||!et){showAlert('ساعت شروع و پایان الزامی.');return}
  if(!topicId){showAlert('موضوع را انتخاب کنید.');return}
  if(!imp){showAlert('درجه اهمیت را انتخاب کنید.');return}
  if(jalaliToTimestamp(ed)<jalaliToTimestamp(sd)){showAlert('تاریخ پایان قبل از شروع نباشد.');return}
  if(sd===ed&&st>=et){showAlert('ساعت شروع قبل از پایان باشد.','error');return}
  if(!desc){showAlert('شرح اقدام الزامی.');return}
  if(!navigator.onLine||!dbClient){showAlert('اتصال به دیتابیس برقرار نیست.','error');return}
  var hours=calcDurationHours(sd,st,ed,et);
  if(hours<=0){showAlert('مدت محاسبه‌شده نامعتبر.');return}
  await getFresh(KEYS.acts);
  var obj={id:id||genId('a'),date:normJ(sd),endDate:normJ(ed),startTime:st,endTime:et,topicId:topicId,importance:imp,description:desc,location:location,privateDescription:privateDescription,hours:hours,participants:participants,onlyforme:onlyforme};
  if(id){
    var acts=getData(KEYS.acts),idx=acts.findIndex(x=>x.id===id);
    if(idx!==-1){
      if(!canEditAct(acts[idx],session)){showAlert('اجازه ویرایش ندارید.','error');return}
      obj.createdAt=acts[idx].createdAt;obj.createdBy=acts[idx].createdBy||session.personId;acts[idx]=obj;
    }else{obj.createdAt=Date.now();obj.createdBy=session.personId;acts.push(obj)}
    if(await setData(KEYS.acts,acts)){afterSave('اقدام ویرایش شد.');handlePendingPlanConversion(obj.id)}
    return;
  }
  var sims=findSimilar(obj,0.4);
  if(sims.length){showSimilarBlockModal(sims,obj);return}
  obj.createdAt=Date.now();obj.createdBy=session.personId;
  var all=getData(KEYS.acts);all.push(obj);
  if(await setData(KEYS.acts,all)){afterSave('اقدام با موفقیت ثبت شد.');handlePendingPlanConversion(obj.id)}
}
function findSimilar(obj,threshold){
  threshold=threshold||0.4;
  var nd=normText(obj.description),res=[];
  getVisibleActs().forEach(a=>{
    if(a.topicId!==obj.topicId||a.date!==obj.date)return;
    var s=simScore(nd,normText(a.description));
    if(s>=threshold)res.push({a:a,s:s});
  });
  res.sort((x,y)=>y.s-x.s);return res;
}
function showSimilarBlockModal(sims,obj){
  var old=$('sim_block_overlay');if(old&&old.parentNode)old.parentNode.removeChild(old);
  var overlay=document.createElement('div');overlay.className='modal-overlay';overlay.id='sim_block_overlay';
  var similar=sims[0].a,pNames=(similar.participants||[]).map(personName).join('، '),simPct=Math.round(sims[0].s*100);
  var html='<div class="modal"><h3 style="color:var(--danger)">🚫 اقدام مشابه یافت شد</h3>';
  html+='<div class="alert alert-error" style="display:block;margin:12px 0">در تاریخ <b>'+esc(obj.date)+'</b> اقدامی با شباهت <b>'+simPct+'%</b> ثبت شده است. ثبت اقدام جدید مجاز نیست.</div>';
  html+='<div style="background:var(--surface2);padding:12px;border-radius:var(--r-md);margin-bottom:12px;font-size:var(--fmd)">';
  html+='<div style="margin-bottom:6px"><b>موضوع:</b> '+esc(topicName(similar.topicId))+'</div><div style="margin-bottom:6px"><b>شرح:</b> '+esc(similar.description)+'</div><div style="margin-bottom:6px"><b>شرکت‌کنندگان:</b> '+esc(pNames)+'</div>';
  html+='<div><b>مدت:</b> '+esc(fmtHours(similar.hours))+(similar.location?' • <b>محل:</b> '+esc(similar.location):'')+'</div></div>';
  html+='<div class="alert alert-info" style="display:block"><b>راه‌حل:</b><br>• اگر همان اقدام است، با دکمهٔ زیر به آن بپیوندید.<br>• اگر واقعاً متفاوت است، شرح را با جزئیات متمایز کنید.</div>';
  html+='<div class="modal-actions"><button type="button" class="btn btn-success" data-act="join">🤝 پیوستن به اقدام موجود</button><button type="button" class="btn btn-secondary" data-act="close">بستن</button></div></div>';
  overlay.innerHTML=html;document.body.appendChild(overlay);
  overlay.addEventListener('click',function(e){
    if(e.target===overlay){overlay.remove();return}
    if(e.target.closest('[data-act="join"]')){overlay.remove();joinActivity(similar.id);return}
    if(e.target.closest('[data-act="close"]'))overlay.remove();
  });
}
function afterSave(msg){
  if(msg)showAlert(msg,'success');
  setActivityEditMode(false);
  $('act_id').value='';$('act_start_time').value='';$('act_end_time').value='';$('act_desc').value='';$('act_calc_hours').value='';$('act_end_date').value='';$('act_private_desc').value='';
  setLocationFields('');$('act_only_for_me').checked=false;
  var levels=getImportanceLevels();$('act_importance').value=levels.length?levels[0].id:'';
  populateParticipants();renderDayActs();renderCalendar();
}
async function joinActivity(id){
  var session=getSession();if(!session)return;
  await getFresh(KEYS.acts);
  var acts=getData(KEYS.acts),a=acts.find(x=>x.id===id);
  if(!a||!canSeeAct(a)){showAlert('اقدام یافت نشد.','error');return}
  if(!Array.isArray(a.participants))a.participants=[];
  if(a.participants.indexOf(session.personId)!==-1){showAlert('از قبل در این اقدام هستید.','warning');return}
  a.participants.push(session.personId);
  if(await setData(KEYS.acts,acts)){showAlert('به شرکت‌کنندگان اضافه شدید.','success');renderDayActs();renderRecords();renderCalendar()}
}

function actButtons(a,session,isRecords){
  var priv=isPriv(),parts=a.participants||[],joined=parts.indexOf(session.personId)!==-1,id=esc(a.id);
  var edit='<button class="btn-icon-sm btn-warning" data-action="edit" data-id="'+id+'" title="ویرایش">✏️</button> ';
  var del='<button class="btn-icon-sm btn-danger" data-action="delete" data-id="'+id+'" title="حذف">🗑️</button>';
  var join=' <button class="btn-icon-sm btn-success" data-action="join" data-id="'+id+'" title="پیوستن">🤝</button>';
  if(priv)return edit+del+(joined?'':join);
  if(!joined)return join.trim();
  if(isRecords)return edit.trim();
  var b='';
  if(a.createdBy===session.personId){b+=edit;if(parts.length<=1)b+=del}
  return b;
}
function actRowHtml(a,session,withCreator){
  var dStr=(a.endDate&&a.endDate!==a.date)?esc(a.date)+' تا '+esc(a.endDate):esc(a.date);
  if(a.startTime)dStr+=' ('+esc(a.startTime)+' تا '+esc(a.endTime)+')';
  var parts=(a.participants||[]).map(personName).join('، ');
  var title=esc(a.description);
  if(a.onlyforme)title+=' <span class="badge badge-warning" style="font-size:10px">👤 فقط من</span>';
  var h='<tr><td>'+dStr+'</td><td>'+esc(topicName(a.topicId))+'</td><td>'+esc(a.location||'—')+'</td><td>'+esc(fmtHours(a.hours))+'</td><td>'+impBadge(a.importance)+'</td><td style="text-align:right">'+title+'</td>';
  h+='<td style="text-align:right">'+(a.privateDescription?esc(a.privateDescription):'<span style="color:var(--text3)">—</span>')+'</td><td><span class="chip">'+esc(parts)+'</span></td>';
  if(withCreator)h+='<td>'+esc(a.createdBy?personName(a.createdBy):'-')+'</td>';
  return h+'<td>'+actButtons(a,session,withCreator)+'</td></tr>';
}
function renderDayActs(){
  var c=$('day_acts_container'),dateStr=val('act_start_date'),session=getSession();if(!session)return;
  if(!isValidJalaliDate(dateStr)){c.innerHTML='<p style="padding:20px;text-align:center;color:var(--text3)">تاریخ را انتخاب کنید.</p>';return}
  var date=normJ(dateStr),ts=jalaliToTimestamp(date);
  var acts=getVisibleActs().filter(a=>a.date===date||(a.endDate&&ts>=jalaliToTimestamp(a.date)&&ts<=jalaliToTimestamp(a.endDate)));
  acts.sort((a,b)=>(getImpOrder(b.importance)-getImpOrder(a.importance))||((a.createdAt||0)-(b.createdAt||0)));
  if(!acts.length){c.innerHTML='<p style="padding:20px;text-align:center;color:var(--text3)">برای این روز اقدامی ثبت نشده.</p>';return}
  var h='<table class="records-table"><thead><tr><th style="width:6%;">تاریخ</th><th style="width:8%;">موضوع</th><th style="width:8%;">محل</th><th style="width:5%;">مدت</th><th style="width:7%;">اهمیت</th><th style="width:20%;">شرح</th><th style="width:15%;">📝 توضیحات تکمیلی</th><th style="width:12%;">شرکت‌کنندگان</th><th style="width:7%;">عملیات</th></tr></thead><tbody>';
  acts.forEach(a=>{h+=actRowHtml(a,session,false)});
  c.innerHTML=h+'</tbody></table>';
}
function editAct(id){
  var a=idxGet(KEYS.acts,id),session=getSession();if(!a||!session||!canSeeAct(a))return;
  if(!canEditAct(a,session)){showAlert('اجازه ویرایش ندارید.','error');return}
  showSection('activity');setActivityEditMode(true);
  $('act_id').value=a.id;$('act_start_date').value=a.date;$('act_end_date').value=a.endDate||'';
  $('act_start_time').value=a.startTime||'';$('act_end_time').value=a.endTime||'';
  $('act_topic').value=a.topicId;$('act_importance').value=a.importance;$('act_desc').value=a.description;
  setLocationFields(a.location);
  $('act_only_for_me').checked=a.onlyforme===true;$('act_private_desc').value=a.privateDescription||'';
  var parts=a.participants;if(!parts||!parts.length)parts=[a.createdBy||session.personId];
  populateParticipants(parts);updateCalculatedHours();renderDayActs();
  window.scrollTo({top:0,behavior:'smooth'});
}
async function deleteAct(id){
  var a=findById(getData(KEYS.acts),id),session=getSession();if(!a||!session||!canSeeAct(a))return;
  if(!isPriv()){
    if(a.createdBy!==session.personId){showAlert('اجازه حذف ندارید.','error');return}
    if((a.participants||[]).length>1){showAlert('شرکت‌کنندهٔ دیگر دارد.','error');return}
  }
  if(!confirm('از حذف مطمئن هستید؟'))return;
  if(!(await deleteRemote('activities',id)))return;
  writeLocal(KEYS.acts,getData(KEYS.acts).filter(x=>x.id!==id));
  if($('act_id').value===id)resetActivityForm(true);
  renderDayActs();renderRecords();renderCalendar();showAlert('اقدام با موفقیت حذف شد.','success');
}

