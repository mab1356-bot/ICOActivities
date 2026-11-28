(function(){
'use strict';

const MIN_PASSWORD_LEN=6;
const MIN_USERNAME_LEN=5;
const PERSON_COLS='id,firstname,lastname,personnelid,username,role';

let dbClient=null;          
let activeServerName='';    
let _currentModalDate = null;

function $(id){return document.getElementById(id)}
function val(id){var e=$(id);return e?String(e.value).trim():''}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])}
function pad2(n){n=String(n);return n.length<2?'0'+n:n}
function fireChange(el){try{el.dispatchEvent(new Event('change',{bubbles:true}))}catch(e){}}
function debounce(fn,ms){var t;return function(){var a=arguments,c=this;clearTimeout(t);t=setTimeout(function(){fn.apply(c,a)},ms)}}
function toHex(bytes){return Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join('')}
function genId(prefix){var a=new Uint32Array(1);crypto.getRandomValues(a);return prefix+Date.now()+'_'+a[0].toString(36)}
function countBy(list,fn){var m={};list.forEach(x=>{var k=fn(x);if(k!=null)m[k]=(m[k]||0)+1});return m}

function getSession(){try{return JSON.parse(sessionStorage.getItem('actbk_session')||'null')}catch(e){return null}}
function setSession(s){sessionStorage.setItem('actbk_session',JSON.stringify(s))}
function clearSession(){sessionStorage.removeItem('actbk_session')}
function isPriv(){var s=getSession();return !!s&&(s.role==='admin'||s.role==='manager'||s.role==='superadmin')}
// فقط ادمین و سوپر ادمین مجاز به مشاهده وضعیت عدم حضور سایر کارکنان هستند.
function isAttendanceReportAdmin(){var s=getSession();return !!s&&(s.role==='admin'||s.role==='superadmin')}

const THEME_KEY='actbk_theme';
function initTheme(){var t=localStorage.getItem(THEME_KEY)||'light';document.documentElement.setAttribute('data-theme',t);var b=$('themeBtn');if(b)b.textContent=t==='dark'?'☀️':'🌙'}
function toggleTheme(){var c=document.documentElement.getAttribute('data-theme')||'light';var n=c==='dark'?'light':'dark';document.documentElement.setAttribute('data-theme',n);localStorage.setItem(THEME_KEY,n);var b=$('themeBtn');if(b)b.textContent=n==='dark'?'☀️':'🌙'}
function toggleNav(){$('main_nav').classList.toggle('active');$('navOverlay').classList.toggle('active')}

function div(a,b){return~~(a/b)}function mod(a,b){return a-~~(a/b)*b}
var BREAKS=[-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178];
function jalCal(jy){var bl=BREAKS.length,gy=jy+621,leapJ=-14,jp=BREAKS[0],jm,jump=0,leap,leapG,march,n,i;for(i=1;i<bl;i++){jm=BREAKS[i];jump=jm-jp;if(jy<jm)break;leapJ+=div(jump,33)*8+div(mod(jump,33),4);jp=jm}n=jy-jp;leapJ+=div(n,33)*8+div(mod(n,33)+3,4);if(mod(jump,33)===4&&jump-n===4)leapJ+=1;leapG=div(gy,4)-div((div(gy,100)+1)*3,4)-150;march=20+leapJ-leapG;if(jump-n<6)n=n-jump+div(jump+4,33)*33;leap=mod(mod(n+1,33)-1,4);if(leap===-1)leap=4;return{leap,gy,march}}
function g2d(gy,gm,gd){var d=div((gy+div(gm-8,6)+100100)*1461,4)+div(153*mod(gm+9,12)+2,5)+gd-34840408;return d-div(div(gy+100100+div(gm-8,6),100)*3,4)+752}
function d2g(jdn){var j=4*jdn+139361631;j+=div(div(4*jdn+183187720,146097)*3,4)*4-3908;var i=div(mod(j,1461),4)*5+308;var gd=div(mod(i,153),5)+1,gm=mod(div(i,153),12)+1,gy=div(j,1461)-100100+div(8-gm,6);return[gy,gm,gd]}
function jalaliToGregorian(jy,jm,jd){var r=jalCal(jy);return d2g(g2d(r.gy,3,r.march)+(jm-1)*31-div(jm,7)*(jm-7)+jd-1)}
function gregorianToJalali(gy,gm,gd){var jdn=g2d(gy,gm,gd),jy=d2g(jdn)[0]-621,r=jalCal(jy),k=jdn-g2d(jy+621,3,r.march);if(k>=0){if(k<=185)return[jy,1+div(k,31),mod(k,31)+1];k-=186}else{jy-=1;k+=179;if(r.leap===1)k+=1}return[jy,7+div(k,30),mod(k,30)+1]}
function isJalaliLeap(jy){return jalCal(jy).leap===0}
function jalaliMonthLength(jy,jm){if(jm<=6)return 31;if(jm<=11)return 30;return isJalaliLeap(jy)?30:29}
function getJalaliDayOfWeek(jy,jm,jd){var g=jalaliToGregorian(jy,jm,jd);return(new Date(g[0],g[1]-1,g[2]).getDay()+1)%7}
function isHolidayDow(d){return d===5||d===6}
function toEnglishDigits(str){if(str==null)return'';return String(str).replace(/[۰-۹]/g,c=>c.charCodeAt(0)-1776).replace(/[٠-٩]/g,c=>c.charCodeAt(0)-1632)}
function isValidJalaliDate(str){if(!str)return false;var p=toEnglishDigits(str).replace(/\s/g,'').split('/');if(p.length!==3)return false;var jy=parseInt(p[0],10),jm=parseInt(p[1],10),jd=parseInt(p[2],10);if(isNaN(jy)||isNaN(jm)||isNaN(jd))return false;if(jy<1300||jy>1500||jm<1||jm>12)return false;return jd>=1&&jd<=jalaliMonthLength(jy,jm)}
function parseJalali(str){var p=toEnglishDigits(str).replace(/\s/g,'').split('/');return{jy:parseInt(p[0],10),jm:parseInt(p[1],10),jd:parseInt(p[2],10)}}
function fmtJalali(jy,jm,jd){return jy+'/'+pad2(jm)+'/'+pad2(jd)}
function normJ(str){var p=parseJalali(str);return fmtJalali(p.jy,p.jm,p.jd)}
function getTodayJalali(){var t=new Date();return fmtJalali.apply(null,gregorianToJalali(t.getFullYear(),t.getMonth()+1,t.getDate()))}
function jalaliToTimestamp(str){if(!str)return 0;var p=parseJalali(str),g=jalaliToGregorian(p.jy,p.jm,p.jd);return new Date(g[0],g[1]-1,g[2]).getTime()}
function addDaysStr(dateStr,n){var p=parseJalali(dateStr);var g=jalaliToGregorian(p.jy,p.jm,p.jd);var d=new Date(g[0],g[1]-1,g[2]+n);var j=gregorianToJalali(d.getFullYear(),d.getMonth()+1,d.getDate());return fmtJalali(j[0],j[1],j[2])}
var DAY_NAMES=['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];
var MONTH_NAMES=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];

var KEYS={persons:'actbk_persons',topics:'actbk_topics',acts:'actbk_activities',holidays:'actbk_holidays',importance:'actbk_importance',planning:'actbk_planning',locations:'actbk_locations'};
const TABLE_MAP={'actbk_persons':'persons','actbk_topics':'topics','actbk_activities':'activities','actbk_holidays':'holidays','actbk_importance':'importance_levels','actbk_planning':'planning_topics','actbk_locations':'locations'};
const OPTIONAL_KEYS=[KEYS.locations];
const DEFAULT_IMPORTANCE=[{id:'current',name:'اقدام جاری',color:'#3498db',isKey:false},{id:'important',name:'مهم',color:'#f39c12',isKey:false},{id:'very_important',name:'خیلی مهم',color:'#e74c3c',isKey:true}];

const FIELD_MAP={};
FIELD_MAP[KEYS.persons]={firstName:'firstname',lastName:'lastname',personnelId:'personnelid'};
FIELD_MAP[KEYS.acts]={endDate:'enddate',startTime:'starttime',endTime:'endtime',topicId:'topicid',createdBy:'createdby',createdAt:'createdat',privateDescription:'privatedescription'};
FIELD_MAP[KEYS.importance]={isKey:'is_key'};
FIELD_MAP[KEYS.planning]={proposedDate:'proposeddate',importanceId:'importanceid',locationHint:'locationhint',createdBy:'createdby',createdAt:'createdat',convertedActivityId:'convertedactivityid',convertedAt:'convertedat',cancelReason:'cancelreason',updatedAt:'updatedat'};
FIELD_MAP[KEYS.locations]={sortOrder:'sort_order'};
FIELD_MAP[KEYS.topics]={sortOrder:'sorting'};
const INV_MAP={};
Object.keys(FIELD_MAP).forEach(k=>{INV_MAP[k]={};Object.keys(FIELD_MAP[k]).forEach(f=>{INV_MAP[k][FIELD_MAP[k][f]]=f})});

function mapKeys(obj,map){var out={};for(var k in obj){out[map[k]||k]=obj[k]}return out}
function toDB(key,item){
  var out=mapKeys(item,FIELD_MAP[key]||{});delete out.created_at;
  if(key===KEYS.topics){delete out.Sorting;out.sorting=Number(out.sorting)||0}
  if(key===KEYS.acts)out.onlyforme=item.onlyforme===true;   
  else if(key===KEYS.importance)out.is_key=item.isKey===true;
  return out;
}
function fromDB(key,item){
  var out=mapKeys(item,INV_MAP[key]||{});
  if(key===KEYS.acts){
    if(!Array.isArray(out.participants))out.participants=typeof out.participants==='string'?out.participants.split(',').filter(Boolean):[];
    out.onlyforme=out.onlyforme===true;out.location=out.location||'';out.privateDescription=out.privateDescription||'';
  }else if(key===KEYS.importance)out.isKey=out.isKey===true;
  else if(key===KEYS.locations||key===KEYS.topics)out.sortOrder=Number(out.sortOrder)||0;
  return out;
}

function getData(k){try{var v=JSON.parse(localStorage.getItem(k)||'[]');return Array.isArray(v)?v:[]}catch(e){return[]}}
var _ro={};
function readOnly(key){if(!_ro[key])_ro[key]={list:getData(key),map:null};return _ro[key]}
function idxGet(key,id){var c=readOnly(key);if(!c.map){c.map=new Map();c.list.forEach(x=>c.map.set(x.id,x))}return c.map.get(id)||null}
function writeLocal(key,data){localStorage.setItem(key,JSON.stringify(data));delete _ro[key]}

function sortPersonsById(persons){return persons.slice().sort((a,b)=>(Number(a.personnelId)||0)-(Number(b.personnelId)||0))}

async function pullTable(localKey){
  var table=TABLE_MAP[localKey];
  try{
    var r;
    if(localKey===KEYS.persons)r=await dbClient.from(table).select(PERSON_COLS);
    else r=await dbClient.from(table).select('*');
    
    if(r.error){console.warn('[Sync] '+table+':',r.error.message);return false}
    writeLocal(localKey,(r.data||[]).map(i=>fromDB(localKey,i)));
    return true;
  }catch(e){console.warn('[Sync] '+table+' failed:',e.message);return false}
}
async function getFresh(key){if(dbClient&&navigator.onLine)await pullTable(key);return getData(key)}

async function setData(key,data){
  var table=TABLE_MAP[key];
  if(!table||key===KEYS.persons){writeLocal(key,data);return true}
  if(!dbClient||!navigator.onLine){showAlert('اتصال به دیتابیس برقرار نیست.','error');return false}
  
  var prev=new Map(getData(key).map(x=>[x.id,JSON.stringify(x)]));
  var changed=data.filter(x=>prev.get(x.id)!==JSON.stringify(x));
  
  if(changed.length){
    try{
      var toInsert = changed.filter(x => !prev.has(x.id));
      var toUpdate = changed.filter(x => prev.has(x.id));

      if (toInsert.length > 0) {
        var r1 = await dbClient.from(table).insert(toInsert.map(x=>toDB(key,x))).select();
        if (r1.error) {
          showAlert('❌ خطا در ذخیره‌سازی اطلاعات جدید:\n' + r1.error.message, 'error');
          return false;
        }
        if(!Array.isArray(r1.data)||r1.data.length<toInsert.length){
          showAlert('⚠️ هشدار: برخی رکوردهای جدید ذخیره نشدند. دسترسی کافی وجود ندارد.','warning');
          return false;
        }
      }

      if (toUpdate.length > 0) {
        for (var i = 0; i < toUpdate.length; i++) {
          var item = toUpdate[i];
          var r2 = await dbClient.from(table).update(toDB(key, item)).eq('id', item.id).select();
          if (r2.error) {
            showAlert('❌ خطا در ویرایش اطلاعات:\n' + r2.error.message, 'error');
            return false;
          }
          if(!Array.isArray(r2.data)||r2.data.length===0){
            showAlert('⚠️ هشدار: برخی رکوردهای ویرایش‌شده ذخیره نشدند. دسترسی کافی وجود ندارد.','warning');
            return false;
          }
        }
      }
    }catch(e){showAlert('❌ خطا در ارتباط با سرور: '+e.message,'error');return false}
  }
  writeLocal(key,data);setConnectionStatus('online',activeServerName);return true;
}

async function deleteRemote(table,id){
  if(!dbClient||!navigator.onLine){showAlert('اتصال برقرار نیست.','error');return false}
  try{
    var r=await dbClient.from(table).delete().eq('id',id).select();
    if(r.error){showAlert('❌ خطا در حذف: '+r.error.message,'error');return false}
    if(!r.data||r.data.length===0){showAlert('❌ حذف انجام نشد (رکورد وجود ندارد یا دسترسی کافی نیست).','error');return false}
    return true;
  }catch(e){showAlert('❌ خطا در ارتباط: '+e.message,'error');return false}
}

async function syncFromCloud(showMessage){
  if(showMessage===undefined)showMessage=true;
  if(!dbClient||!navigator.onLine){setConnectionStatus('offline');if(showMessage)showAlert('اتصال برقرار نیست.','error');return{ok:false}}
  var btn=$('btn_sync_cloud');if(btn&&showMessage){btn.textContent='⏳...';btn.disabled=true}
  var keys=Object.keys(TABLE_MAP),results=[];
  try{results=await Promise.all(keys.map(pullTable))}catch(e){results=keys.map(()=>false)}
  var failed=keys.filter((k,i)=>!results[i]&&OPTIONAL_KEYS.indexOf(k)===-1);
  if(btn&&showMessage){btn.textContent='🔄 بروزرسانی';btn.disabled=false}
  if(!failed.length){
    setConnectionStatus('online',activeServerName);
    if(showMessage)showAlert('اطلاعات از سرور دریافت شد.','success');
    if($('main_app').style.display!=='none')renderAll();
    return{ok:true};
  }
  if(showMessage)showAlert('خطا در دریافت اطلاعات از سرور.','error');
  checkDbConnection();return{ok:false};
}
function renderAll(){
  try{refreshDropdowns();renderPersons();renderTopics();renderImportance();renderHolidays();renderLocations();renderCalendar();renderRecords();renderDayActs();renderPlanning();updatePlanningBadge()}
  catch(e){console.warn('[render]',e)}
}

function getImportanceLevels(){return getData(KEYS.importance)}
function getImpLabel(id){var l=idxGet(KEYS.importance,id);return l?l.name:(id||'-')}
function getImpColor(id){var l=idxGet(KEYS.importance,id);return l?(l.color||'#7f8c8d'):'#7f8c8d'}
function isKeyImp(id){var l=idxGet(KEYS.importance,id);return !!l&&l.isKey===true}
function getImpOrder(id){var l=readOnly(KEYS.importance).list;for(var i=0;i<l.length;i++)if(l[i].id===id)return i;return 999}
function impBadge(i){return '<span class="badge" style="background:'+esc(getImpColor(i))+'">'+esc(getImpLabel(i))+'</span>'}
function fmtHours(h){h=Number(h)||0;return(Math.round(h*100)/100)+' ساعت'}
function fmtPersonHours(h){h=Number(h)||0;return(Math.round(h*100)/100)+' نفر-ساعت'}
function findById(arr,id){for(var i=0;i<arr.length;i++)if(arr[i].id===id)return arr[i];return null}
function personName(id){var p=idxGet(KEYS.persons,id);return p?p.firstName+' '+p.lastName:'نامشخص'}
function topicName(id){var t=idxGet(KEYS.topics,id);return t?t.name:'نامشخص'}

function normText(s){return String(s||'').toLowerCase().replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[\u064B-\u0652\u0640]/g,'').replace(/[^\u0600-\u06FF0-9a-z\s]/g,' ').replace(/\s+/g,' ').trim()}
function simScore(a,b){var x=normText(a),y=normText(b);if(!x||!y)return 0;if(x===y)return 1;if(x.indexOf(y)>=0||y.indexOf(x)>=0)return .9;var tx=x.split(' '),ty=y.split(' '),sx={},sy={},k,uni=0,inter=0;tx.forEach(t=>{if(t)sx[t]=1});ty.forEach(t=>{if(t)sy[t]=1});for(k in sx){uni++;if(sy[k])inter++}for(k in sy){if(!sx[k])uni++}return uni?inter/uni:0}

function canSeeAct(a){if(!a.onlyforme)return true;var s=getSession();return !!s&&a.createdBy===s.personId}
function getVisibleActs(){return readOnly(KEYS.acts).list.filter(canSeeAct)}
function canEditAct(a,s){return isPriv()||a.createdBy===s.personId||(a.participants||[]).indexOf(s.personId)!==-1}

function getHolidayMap(){var m={};readOnly(KEYS.holidays).list.forEach(h=>{m[h.date]=h.title});return m}
function isOffDay(dateStr,holMap){var p=parseJalali(dateStr);return isHolidayDow(getJalaliDayOfWeek(p.jy,p.jm,p.jd))||!!(holMap&&holMap[dateStr])}

var alertTimer=null,loginAlertTimer=null;
function showAlert(msg,type){
  var lm=$('login_modal');
  var isLogin=!!(lm&&lm.style.display&&lm.style.display!=='none');
  var box=isLogin?$('login_alert_box'):$('alert-box');
  if(!box){alert(msg);return}
  box.className='alert alert-'+(type||'error');box.textContent=msg;box.style.display='block';
  if(isLogin){clearTimeout(loginAlertTimer);loginAlertTimer=setTimeout(()=>{box.style.display='none'},15000)}
  else{clearTimeout(alertTimer);alertTimer=setTimeout(()=>{box.style.display='none'},15000);window.scrollTo({top:0,behavior:'smooth'})}
}
function closePopups(){var p=document.querySelectorAll('.datepicker-popup');for(var i=0;i<p.length;i++)if(p[i].parentNode)p[i].parentNode.removeChild(p[i])}

function refreshDropdowns(){
  var persons=sortPersonsById(readOnly(KEYS.persons).list),i,j;
  var pd=document.querySelectorAll('.person-dropdown');
  for(i=0;i<pd.length;i++){
    var s=pd[i],cur=s.value,all=s.dataset.all==='1';
    var html='<option value="">'+(all?'همه':'انتخاب کنید...')+'</option>';
    for(j=0;j<persons.length;j++){var p=persons[j];html+='<option value="'+esc(p.id)+'">'+esc(p.firstName+' '+p.lastName+' - '+p.personnelId)+'</option>'}
    s.innerHTML=html;
    var ex=persons.some(x=>x.id===cur);
    if(cur&&ex)s.value=cur;else if(!all&&persons.length)s.value=persons[0].id;
  }
  var topics=readOnly(KEYS.topics).list.slice().sort(byOrder),td=document.querySelectorAll('.topic-dropdown');
  for(i=0;i<td.length;i++){
    var s2=td[i],c2=s2.value,a2=s2.dataset.all==='1';
    var h2='<option value="">'+(a2?'همه':'انتخاب کنید...')+'</option>';
    for(j=0;j<topics.length;j++)h2+='<option value="'+esc(topics[j].id)+'">'+esc(topics[j].name)+'</option>';
    s2.innerHTML=h2;
    if(c2&&topics.some(x=>x.id===c2))s2.value=c2;else if(!a2&&topics.length)s2.value=topics[0].id;
  }
  var imps=readOnly(KEYS.importance).list,ide=document.querySelectorAll('.imp-dropdown');
  for(i=0;i<ide.length;i++){
    var s3=ide[i],c3=s3.value,a3=s3.dataset.all==='1';
    var h3='<option value="">'+(a3?'همه':'انتخاب کنید...')+'</option>';
    for(j=0;j<imps.length;j++)h3+='<option value="'+esc(imps[j].id)+'">'+esc(imps[j].name)+'</option>';
    s3.innerHTML=h3;
    if(c3&&imps.some(x=>x.id===c3))s3.value=c3;else if(!a3&&imps.length)s3.value=imps[0].id;
  }
  fillLocationSelect();
}

function showSection(id){
  lastActivitySection=id;
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
  if(isJoined)html+='<button class="btn btn-warning" data-act="leave">↩️ حذف خود از اقدام</button>';
  html+='</div></div>';
  var overlay=document.createElement('div');overlay.className='modal-overlay';overlay.innerHTML=html;
  overlay.addEventListener('click',function(e){
    if(e.target===overlay||e.target.closest('[data-act="close"]')){overlay.remove();return}
    if(e.target.closest('[data-act="join"]')){overlay.remove();joinActivity(id);return}
    if(e.target.closest('[data-act="leave"]')){overlay.remove();leaveActivity(id);return}
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

// نگهداری مقدار ساعت در قالب استاندارد HH:mm؛ در دسکتاپ مقدار از نمونه Flatpickr نیز همگام می‌شود.
function setTimePickerValue(id, value) {
  var input = $(id);
  if (!input) return;
  var normalized = String(value || '').trim();
  normalized = /^([01]\d|2[0-3]):[0-5]\d$/.test(normalized) ? normalized : '';
  if (input._flatpickr) {
    if (normalized) input._flatpickr.setDate(normalized, false, 'H:i');
    else input._flatpickr.clear();
  } else {
    input.value = normalized;
  }
}

// تشخیص دستگاه لمسی برای حفظ انتخاب‌گر بومی محبوب موبایل؛ در دسکتاپ از رابط کلیکی Flatpickr استفاده می‌شود.
function isTouchTimePickerDevice() {
  try {
    var coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    var touchOnSmallScreen = Number(navigator.maxTouchPoints || 0) > 0 && window.matchMedia('(max-width: 900px)').matches;
    return coarsePointer || touchOnSmallScreen;
  } catch (e) {
    return (window.innerWidth || 1200) <= 900;
  }
}

// فعال‌سازی ساعت ۲۴ ساعته؛ موبایل از انتخاب‌گر سیستم‌عامل و دسکتاپ از پنجره انتخاب ساعت با کنترل‌های بالا/پایین استفاده می‌کند.
function initTimePickers() {
  var useNativePicker = isTouchTimePickerDevice();
  ['act_start_time', 'act_end_time'].forEach(function (id) {
    var input = $(id);
    if (!input) return;

    var initialized = false;
    if (!useNativePicker && typeof window.flatpickr === 'function') {
      // دسکتاپ: انتخاب‌گر دیداری ۲۴ ساعته با کنترل‌های افزایش و کاهش ساعت و دقیقه.
      try {
        input.type = 'text';
        input.classList.add('desktop-time-input');
        input.setAttribute('placeholder', 'برای انتخاب ساعت کلیک کنید');
        input.setAttribute('autocomplete', 'off');
        input.removeAttribute('step');
        window.flatpickr(input, {
          enableTime: true,
          noCalendar: true,
          dateFormat: 'H:i',
          time_24hr: true,
          enableSeconds: false,
          hourIncrement: 1,
          minuteIncrement: 1,
          allowInput: false,
          clickOpens: true,
          disableMobile: true,
          defaultDate: input.value || null,
          onChange: function (selectedDates, dateStr) {
            input.value = dateStr || '';
            updateCalculatedHours();
          }
        });
        initialized = !!input._flatpickr;
      } catch (pickerError) {
        console.warn('Desktop time picker initialization failed; using native picker.', pickerError);
        if (input._flatpickr && typeof input._flatpickr.destroy === 'function') {
          try { input._flatpickr.destroy(); } catch (destroyError) {}
        }
      }
    }

    if (!initialized) {
      // موبایل: انتخاب‌گر سیستم‌عامل؛ در صورت خطای بارگذاری کتابخانه نیز fallback بومی استفاده می‌شود.
      input.type = 'time';
      input.step = '60';
      input.classList.remove('desktop-time-input');
      input.addEventListener('input', updateCalculatedHours);
      input.addEventListener('change', updateCalculatedHours);
      input.addEventListener('blur', updateCalculatedHours);
    }
  });
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
  setTimePickerValue('act_start_time','');setTimePickerValue('act_end_time','');$('act_desc').value='';$('act_calc_hours').value='';$('act_private_desc').value='';
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
    if(await setData(KEYS.acts,acts)){afterSave('اقدام ویرایش شد.',obj);handlePendingPlanConversion(obj.id)}
    return;
  }
  var sims=findSimilar(obj,0.4);
  if(sims.length){showSimilarBlockModal(sims,obj);return}
  obj.createdAt=Date.now();obj.createdBy=session.personId;
  var all=getData(KEYS.acts);all.push(obj);
  if(await setData(KEYS.acts,all)){afterSave('اقدام با موفقیت ثبت شد.',obj);handlePendingPlanConversion(obj.id)}
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
function showSaveSuccessPopup(msg,activity){
  // نتیجه ذخیره را در پنجره مستقل نشان می‌دهد و سپس تقویم ماه اقدام را باز می‌کند.
  var old=document.getElementById('activity-save-success-overlay');
  if(old)old.remove();
  var date=(activity&&activity.date)||getTodayJalali();
  var overlay=document.createElement('div');
  overlay.className='modal-overlay';
  overlay.id='activity-save-success-overlay';
  overlay.innerHTML='<div class="modal" role="dialog" aria-modal="true" aria-labelledby="activity-save-success-title">'+
    '<h3 id="activity-save-success-title" style="color:var(--success)">✅ عملیات موفق</h3>'+
    '<div class="alert alert-success" style="display:block;margin:14px 0">'+esc(msg||'اقدام با موفقیت ذخیره شد.')+'</div>'+
    '<p>تاریخ اقدام: <b>'+esc(date)+'</b></p>'+
    '<p style="color:var(--text2)">اقدام در تقویم ماهانه نمایش داده خواهد شد.</p>'+
    '<div class="modal-actions"><button type="button" class="btn btn-success" id="activity-save-success-continue">مشاهده تقویم ماهانه</button></div></div>';
  document.body.appendChild(overlay);
  var continueButton=overlay.querySelector('#activity-save-success-continue');
  continueButton.addEventListener('click',function(){
    overlay.remove();
    var parts=date.split('/');
    if(parts.length===3&&$('cal_year')&&$('cal_month')){
      $('cal_year').value=parseInt(parts[0],10);
      $('cal_month').value=parseInt(parts[1],10);
    }
    // پس از ثبت، نمای ماهانه (نه نمای هفته) انتخاب می‌شود تا اقدام ثبت‌شده دیده شود.
    if($('cal_week_mode')){
      $('cal_week_mode').checked=false;
      onWeekModeChange();
    }
    showSection('calendar');
    renderCalendar();
  });
  continueButton.focus();
}
function afterSave(msg,activity){
  // پس از تأیید ذخیره در سرور، فرم پاک و پنجره نتیجه نمایش داده می‌شود.
  setActivityEditMode(false);
  $('act_id').value='';setTimePickerValue('act_start_time','');setTimePickerValue('act_end_time','');$('act_desc').value='';$('act_calc_hours').value='';$('act_end_date').value='';$('act_private_desc').value='';
  setLocationFields('');$('act_only_for_me').checked=false;
  var levels=getImportanceLevels();$('act_importance').value=levels.length?levels[0].id:'';
  populateParticipants();
  renderDayActs();
  renderCalendar();
  showSaveSuccessPopup(msg,activity);
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

async function leaveActivity(id){
  // کاربر فقط شناسه خودش را حذف می‌کند؛ محدودیت نهایی در تریگر Supabase نیز اعمال می‌شود.
  var session=getSession();if(!session)return;
  if(!navigator.onLine||!dbClient){showAlert('برای خروج از اقدام باید به اینترنت متصل باشید.','error');return}
  await getFresh(KEYS.acts);
  var acts=getData(KEYS.acts),a=acts.find(x=>x.id===id);
  if(!a||!canSeeAct(a)){showAlert('اقدام یافت نشد.','error');return}
  var participants=Array.isArray(a.participants)?a.participants:[];
  if(participants.indexOf(session.personId)===-1){showAlert('شما عضو این اقدام نیستید.','warning');return}
  a.participants=participants.filter(pid=>pid!==session.personId);
  if(await setData(KEYS.acts,acts)){
    showAlert('از فهرست شرکت‌کنندگان این اقدام خارج شدید.','success');
    renderDayActs();renderRecords();renderCalendar();
  }
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
  setTimePickerValue('act_start_time',a.startTime||'');setTimePickerValue('act_end_time',a.endTime||'');
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

function renderRecords(){
  var personId=val('rec_person'),topicId=val('rec_topic'),imp=val('rec_imp'),search=normText(val('rec_search'));
  // در صورت خالی بودن فیلترها، بازه ماه جاری به‌عنوان مقدار پیش‌فرض اعمال می‌شود.
  var todayParts=getTodayJalali().split('/'),currentYear=parseInt(todayParts[0],10),currentMonth=parseInt(todayParts[1],10);
  var defaultFrom=fmtJalali(currentYear,currentMonth,1);
  var defaultTo=fmtJalali(currentYear,currentMonth,jalaliMonthLength(currentYear,currentMonth));
  var from=val('rec_from')||defaultFrom,to=val('rec_to')||defaultTo;
  if(!$('rec_from').value)$('rec_from').value=from;
  if(!$('rec_to').value)$('rec_to').value=to;
  var vf=isValidJalaliDate(from),vt=isValidJalaliDate(to);
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
  // ترتیب سوابق: تاریخ صعودی، سپس ساعت شروع صعودی و در نهایت زمان ثبت.
  list.sort((x,y)=>(tsCache[x.id]-tsCache[y.id])||
    String(x.startTime||'00:00').localeCompare(String(y.startTime||'00:00'))||
    ((x.createdAt||0)-(y.createdAt||0)));
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

function gatherReportData(){
  var personId=val('rep_person'),topicId=val('rep_topic'),imp=val('rep_imp'),from=val('rep_from'),to=val('rep_to');
  if(!isValidJalaliDate(from)||!isValidJalaliDate(to))return null;
  var ta=jalaliToTimestamp(from),tb=jalaliToTimestamp(to);if(tb<ta)return null;
  
  var list=getData(KEYS.acts).filter(x=>{
    if(x.onlyforme) return false;
    if(personId&&(!x.participants||x.participants.indexOf(personId)===-1))return false;
    if(topicId&&x.topicId!==topicId)return false;
    if(imp&&x.importance!==imp)return false;
    var t=jalaliToTimestamp(x.date);var tEnd=x.endDate?jalaliToTimestamp(x.endDate):t;
    return(t>=ta&&t<=tb)||(tEnd>=ta&&tEnd<=tb)||(t<=ta&&tEnd>=tb);
  });
  
  if(!list.length)return null;
  var pFrom=parseJalali(from);var periodTitle=MONTH_NAMES[pFrom.jm-1]+' '+pFrom.jy;
  var totalPersonHours=list.reduce((s,x)=>s+(Number(x.hours)*x.participants.length),0);
  var topicsData={};getData(KEYS.topics).sort(byOrder).forEach(t=>{topicsData[t.id]={name:t.name,acts:[]}});
  list.forEach(x=>{if(!topicsData[x.topicId])topicsData[x.topicId]={name:topicName(x.topicId),acts:[]};topicsData[x.topicId].acts.push(x)});
  var topicStats=Object.keys(topicsData).filter(id=>topicsData[id].acts.length).map(id=>({name:topicsData[id].name,count:topicsData[id].acts.length}));
  return{list,from,to,periodTitle,totalActs:list.length,totalPersonHours,topicStats,topicsData};
}
function generateReport(){
  var data=gatherReportData();
  if(!data){$('report_area').innerHTML='<p style="padding:24px;text-align:center;color:var(--text3)">اقدامی یافت نشد یا بازه نامعتبر است.</p>';return false}
  var withDetails=$('rep_details').checked;
  var totalActs=data.totalActs,totalPersonHours=data.totalPersonHours,topicStats=data.topicStats,topicsData=data.topicsData,periodTitle=data.periodTitle;
  var colsHtml='';
  Object.keys(topicsData).forEach(tid=>{
    var td=topicsData[tid];var viActs=td.acts.filter(a=>isKeyImp(a.importance));if(viActs.length===0)return;
    var ul='';viActs.sort((a,b)=>jalaliToTimestamp(a.date)-jalaliToTimestamp(b.date));
    viActs.forEach(a=>{ul+='<li>'+esc(a.description)+(a.location?' <small style="color:var(--text3)">— '+esc(a.location)+'</small>':'')+'</li>'});
    colsHtml+='<div class="db-col"><div class="db-col-header"><span>'+esc(td.name)+' - اقدامات کلیدی</span></div><div class="db-col-body"><ul>'+ul+'</ul></div></div>';
  });
  if(!colsHtml)colsHtml='<div style="width:100%;text-align:center;padding:20px;color:var(--text2)">اقدام کلیدی ثبت نشده.</div>';
  var outcomesUl=data.list.filter(x=>isKeyImp(x.importance)).map(x=>'<li>'+esc(x.description)+'</li>').join('')||'<li>موردی ثبت نشده.</li>';
  var h='<div class="dashboard-report"><div class="db-header"><h1>عملکرد واحد کنترل و نظارت پروژه‌های سرمایه‌گذاری</h1><p>جمع‌بندی اقدامات در '+periodTitle+'</p></div>';
  h+='<div class="db-kpi-grid"><div class="db-kpi"><div class="db-kpi-val">'+totalActs+'</div><div class="db-kpi-title">فعالیت‌ها</div></div>'+topicStats.map(s=>'<div class="db-kpi"><div class="db-kpi-val">'+s.count+'</div><div class="db-kpi-title">'+esc(s.name)+'</div></div>').join('')+'<div class="db-kpi"><div class="db-kpi-val">'+fmtPersonHours(totalPersonHours)+'</div><div class="db-kpi-title">نفر-ساعت</div></div></div>';
  h+='<div class="db-section-bar">اقدامات کلیدی در '+periodTitle+'</div><div class="db-columns">'+colsHtml+'</div>';
  h+='<div class="db-bottom-section"><div class="db-box" style="border-color:#c9a227"><h3>خروجی شاخص</h3><ul>'+outcomesUl+'</ul></div>';
  if(!withDetails)h+='<div class="db-box"><h3>توضیحات</h3><p style="color:var(--text2)">(محل درج دستی)</p></div>';
  h+='</div>';
  if(withDetails){
    var trs=data.list.slice().sort((x,y)=>(jalaliToTimestamp(x.date)-jalaliToTimestamp(y.date))||String(x.startTime||'').localeCompare(String(y.startTime||''))).map(x=>'<tr><td>'+esc(x.date||'—')+'</td><td>'+esc(topicName(x.topicId))+'</td><td>'+esc(fmtHours(x.hours))+'</td><td>'+esc(x.description)+'</td><td>'+esc(x.location||'—')+'</td></tr>').join('');
    h+='<div class="db-details-page"><div class="db-box"><h3>ریز اقدامات</h3><div class="table-wrap"><table><tr><th>تاریخ</th><th>موضوع</th><th>مدت</th><th>شرح</th><th>محل</th></tr>'+trs+'</table></div></div></div>';
  }
  h+='</div>';
  $('report_area').innerHTML=h;return true;
}

function printReport(){var c=$('report_area');if(!c.querySelector('.dashboard-report')){showAlert('ابتدا گزارش را تولید کنید.');return}$('print_area').innerHTML=c.innerHTML;window.print()}
function printData(containerId,needTable){var c=$(containerId);if(!c.innerHTML.trim()||(needTable&&!c.querySelector('table'))){showAlert('موردی برای چاپ نیست.');return}var HEAD='<div style="text-align:center;border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:20px"><h2>واحد کنترل و نظارت پروژه‌های سرمایه‌گذاری</h2></div>';var SIGN='<div style="margin-top:50px;display:flex;justify-content:space-between"><div>امضای کاربر: ............................</div><div>امضای مسئول: ............................</div></div>';$('print_area').innerHTML=HEAD+'<div>'+c.innerHTML+'</div>'+SIGN;window.print()}

// مرتب‌سازی مشترک سوابق برای خروجی Word و PowerPoint؛ ترتیب تاریخ و سپس ساعت شروع.
function getReportSortedActivities(data) {
  return data.list.slice().sort(function (a, b) {
    return (jalaliToTimestamp(a.date) - jalaliToTimestamp(b.date)) ||
      String(a.startTime || '').localeCompare(String(b.startTime || ''));
  });
}

// استخراج اقدامات کلیدی بر اساس همان سطح اهمیتی که در تنظیمات موضوعات تعریف شده است.
function getReportKeyActivities(data) {
  return getReportSortedActivities(data).filter(function (activity) {
    return isKeyImp(activity.importance);
  });
}

// گروه‌بندی اقدامات کلیدی بر اساس موضوع واقعی ثبت‌شده؛ در صورت تعدد موضوعات، موارد بعدی زیر عنوان «سایر حوزه‌ها» قرار می‌گیرند.
// گروه‌بندی همه اقدامات کلیدی بر اساس موضوع برای صفحات تفصیلی Word و PowerPoint.
function getReportKeyGroupsByTopic(data) {
  return Object.keys(data.topicsData).map(function (topicId) {
    var topic = data.topicsData[topicId];
    var items = topic.acts.filter(function (activity) { return isKeyImp(activity.importance); })
      .sort(function (a, b) {
        return (jalaliToTimestamp(a.date) - jalaliToTimestamp(b.date)) ||
          String(a.startTime || '').localeCompare(String(b.startTime || ''));
      });
    return { name: topic.name, items: items };
  }).filter(function (group) { return group.items.length > 0; });
}

function getReportKeyGroups(data) {
  var groups = Object.keys(data.topicsData).map(function (topicId) {
    var topic = data.topicsData[topicId];
    var items = topic.acts.filter(function (activity) { return isKeyImp(activity.importance); })
      .sort(function (a, b) {
        return (jalaliToTimestamp(a.date) - jalaliToTimestamp(b.date)) ||
          String(a.startTime || '').localeCompare(String(b.startTime || ''));
      });
    return { name: topic.name, items: items };
  }).filter(function (group) { return group.items.length > 0; });

  groups.sort(function (a, b) {
    return (b.items.length - a.items.length) || a.name.localeCompare(b.name, 'fa');
  });
  if (groups.length <= 3) return groups;

  var mergedItems = [];
  groups.slice(2).forEach(function (group) {
    group.items.forEach(function (activity) {
      mergedItems.push({
        date: activity.date,
        description: activity.description,
        location: activity.location,
        topicName: group.name
      });
    });
  });
  return [groups[0], groups[1], { name: 'سایر حوزه‌های کلیدی', items: mergedItems }];
}

// تبدیل ارقام به شکل فارسی برای شاخص‌های مدیریتی؛ مقادیر تاریخ و مدت سوابق بدون دست‌کاری باقی می‌مانند.
function reportFaDigits(value) {
  return String(value == null ? '' : value).replace(/[0-9]/g, function (digit) {
    return '۰۱۲۳۴۵۶۷۸۹'[Number(digit)];
  });
}

// آماده‌سازی مجموعه شاخص‌ها با همان ترتیب دسته‌بندی‌های موجود در داده‌ها.
function getReportKpis(data) {
  return [{ value: reportFaDigits(data.totalActs), label: 'کل فعالیت‌ها', tone: 'orange' }]
    .concat(data.topicStats.map(function (item) {
      return { value: reportFaDigits(item.count), label: item.name, tone: 'teal' };
    }))
    .concat([{ value: reportFaDigits((Math.round(Number(data.totalPersonHours || 0) * 100) / 100).toFixed(2)), label: 'نفر-ساعت', tone: 'teal' }]);
}

function reportActivityDuration(activity) {
  var hours = Number(activity.hours) || 0;
  return String(Math.round(hours * 100) / 100);
}

// تولید محتوای Word در قالب سازگار با Word؛ فایل HTML با پسوند DOC برای باز شدن مستقیم در Word صادر می‌شود.
function buildWordReportHtml(data, withDetails) {
  var kpis = getReportKpis(data);
  var keyGroups = getReportKeyGroups(data);
  var keyActivities = getReportKeyActivities(data);
  var activities = getReportSortedActivities(data);
  var kpiRows = chunkArray(kpis, 11).map(function (row) {
    return '<tr>' + row.map(function (item) {
      var bg = item.tone === 'orange' ? '#fff0df' : '#eef5f7';
      var accent = item.tone === 'orange' ? '#e69a38' : '#0b8f91';
      return '<td style="width:' + (100 / row.length).toFixed(2) + '%;border:1px solid #d6e1e5;border-right:4px solid ' + accent + ';background:' + bg + ';padding:6px 3px;text-align:center;vertical-align:middle;">' +
        '<div style="font-family:Tahoma,Arial,sans-serif;font-size:15pt;font-weight:bold;color:#17364b;line-height:1.25;">' + esc(item.value) + '</div>' +
        '<div style="font-family:Tahoma,Arial,sans-serif;font-size:7.5pt;color:#465b66;line-height:1.35;margin-top:3px;">' + esc(item.label) + '</div></td>';
    }).join('') + '</tr>';
  }).join('');

  var colors = ['#0a8f91', '#3689b8', '#e39a2f'];
  var groupCells = keyGroups.map(function (group, index) {
    var previewItems = group.items.slice(0, 3).map(function (activity) {
      var shortText = String(activity && activity.description || '—');
      if (shortText.length > 108) shortText = shortText.slice(0, 105) + '…';
      return '<div style="margin:0 0 3px 0;">• ' + esc(shortText) + '</div>';
    }).join('');
    var remaining = Math.max(0, group.items.length - 3);
    var accent = colors[index % colors.length];
    return '<td width="' + (keyGroups.length === 3 ? 30 : 94) + '%" style="width:' +
      (keyGroups.length === 3 ? 30 : 94) + '%;vertical-align:top;padding:7px 8px;border:1px solid #d8e1e5;border-top:5px solid ' +
      accent + ';background:#f5f8f9;">' +
      '<div style="font:bold 10pt Tahoma,Arial,sans-serif;color:' + accent + ';margin-bottom:6px;">' + esc(group.name) + '</div>' +
      '<div style="font:7.6pt Tahoma,Arial,sans-serif;color:#273f50;line-height:1.28;">' + previewItems + '</div>' +
      (remaining ? '<div style="font:bold 7.5pt Tahoma,Arial,sans-serif;color:#647782;margin-top:4px;">' + reportFaDigits(remaining) + ' اقدام کلیدی دیگر</div>' : '') +
      '</td>';
  }).join('');
  if (!groupCells) groupCells = '<td style="text-align:center;padding:18px;border:1px solid #d8e1e5;">اقدام کلیدی ثبت نشده است.</td>';

  var summaryHtml = '<div class="report-page report-summary">' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:0 0 12px 0;"><tr><td bgcolor="#0b8f91" style="background:#0b8f91;height:7px;line-height:7px;font-size:1px;">&nbsp;</td></tr></table>' +
    '<table class="report-heading"><tr><td><h1>گزارش عملکرد ماهانه</h1><p>واحد کنترل و نظارت پروژه‌های توسعه</p></td><td class="period-cell">' + esc(data.periodTitle) + '</td></tr></table>' +
    '<p class="summary-caption">خلاصه شاخص‌های عملکرد و اقدامات اثرگذار در دوره گزارش</p>' +
    '<table class="kpi-table"><tbody>' + kpiRows + '</tbody></table>' +
    '<h2 class="section-title">اقدامات کلیدی ' + esc(data.periodTitle) + '</h2>' +
    '<p class="section-note">خلاصه اقدامات اثرگذار؛ شرح کامل اقدامات کلیدی و ریز سوابق در بخش‌های بعدی آمده است.</p>' +
    '<table class="key-groups" width="100%" style="width:100%;table-layout:fixed;border-collapse:collapse;margin-top:10px;"><tr>' + groupCells + '</tr></table>' +
    '<div class="report-footer">واحد کنترل و نظارت پروژه‌های توسعه <span>' + esc(data.periodTitle) + '</span></div>' +
    '</div>';

  // برای صفحه دوم، اقدامات کلیدی به تفکیک موضوع در ردیف‌های فشرده نمایش داده می‌شوند؛
  // این ساختار با صفحه «اقدامات کلیدی این ماه» در گزارش مرجع هم‌خوان است.
  var detailedKeyGroups = getReportKeyGroupsByTopic(data);

  var keyItemsHtml = detailedKeyGroups.map(function (group, index) {
    var leadDescription = String(group.items[0].description || '—');
    if (leadDescription.length > 155) leadDescription = leadDescription.slice(0, 152) + '…';
    var descriptions = '<span class="key-detail">' + esc(leadDescription) + '</span>' +
      (group.items.length > 1 ? '<span class="key-separator">؛ ' + reportFaDigits(group.items.length - 1) + ' اقدام مرتبط دیگر</span>' : '');
    return '<table class="key-action-item" width="100%" style="width:100%;border-collapse:collapse;background:' + (index % 2 ? '#f5f8f9' : '#ffffff') + '"><tr>' +
      '<td class="key-check" width="30" style="width:30px;padding:2px 5px;vertical-align:top;color:#0b8f91;font:bold 14pt Tahoma,Arial,sans-serif;">✓</td><td style="padding:3px 6px;vertical-align:top;">' + '<div class="key-meta" style="font:bold 9pt Tahoma,Arial,sans-serif;color:#17364b;margin-bottom:1px;">' + esc(group.name) + '</div>' +
      '<div class="key-description" style="font:8pt Tahoma,Arial,sans-serif;color:#273f50;line-height:1.25;">' + descriptions + '</div></td></tr></table>';
  }).join('') || '<p class="empty-note">در این بازه اقدام کلیدی ثبت نشده است.</p>';

  var keyPage = '<div class="report-page key-actions-page">' + '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:0 0 12px 0;"><tr><td bgcolor="#0b8f91" style="background:#0b8f91;height:7px;line-height:7px;font-size:1px;">&nbsp;</td></tr></table>' +
    '<h2 class="page-heading">اقدامات کلیدی این ماه</h2>' +
    '<p class="section-note">جمع‌بندی اقدامات اثرگذار به تفکیک موضوع</p>' +
    '<div class="key-actions-list">' + keyItemsHtml + '</div>' +
    '<div class="report-footer">واحد کنترل و نظارت پروژه‌های توسعه <span>' + esc(data.periodTitle) + '</span></div></div>';

  var detailsPage = '';
  if (withDetails) {
    var detailRows = activities.map(function (activity, index) {
      var bg = index % 2 ? '#eaf2f5' : '#ffffff';
      var cellBase = 'border:1px solid #91aab3;padding:1px 3px;vertical-align:middle;font:6.8pt Tahoma,Arial,sans-serif;line-height:1.05;mso-line-height-rule:exactly;';
      return '<tr style="background:' + bg + ';height:22pt;mso-height-rule:exactly;page-break-inside:avoid;">' +
        '<td class="col-date" style="' + cellBase + 'width:11%;text-align:center;white-space:nowrap;">' + esc(activity.date || '—') + '</td>' +
        '<td class="col-topic" style="' + cellBase + 'width:15%;text-align:center;">' + esc(topicName(activity.topicId)) + '</td>' +
        '<td class="col-hours" style="' + cellBase + 'width:8%;text-align:center;white-space:nowrap;">' + esc(reportActivityDuration(activity)) + '</td>' +
        '<td class="col-description" style="' + cellBase + 'width:52%;text-align:right;">' + esc(activity.description || '—') + '</td>' +
        '<td class="col-location" style="' + cellBase + 'width:14%;text-align:center;">' + esc(activity.location || '—') + '</td></tr>';
    }).join('');
    detailsPage = '<div class="report-page details-page" style="page-break-before:always;">' + '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:0 0 12px 0;"><tr><td bgcolor="#0b8f91" style="background:#0b8f91;height:7px;line-height:7px;font-size:1px;">&nbsp;</td></tr></table>' +
      '<h2 class="page-heading" style="page-break-before:always;mso-break-before:page;">ریز اقدامات</h2>' +
      '<p class="section-note">فهرست زمانی فعالیت‌های ثبت‌شده در ' + esc(data.periodTitle) + '</p>' +
      '<table class="details-table" width="100%" border="1" cellpadding="2" cellspacing="0" style="width:100%;table-layout:fixed;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">' +
      '<colgroup><col width="11%"><col width="15%"><col width="8%"><col width="52%"><col width="14%"></colgroup>' +
      '<thead><tr>' +
      '<th style="background:#4daabd;color:#fff;border:1px solid #8aabb6;padding:2px 3px;text-align:center;font: bold 7pt Tahoma,Arial,sans-serif;">تاریخ</th>' +
      '<th style="background:#4daabd;color:#fff;border:1px solid #8aabb6;padding:2px 3px;text-align:center;font: bold 7pt Tahoma,Arial,sans-serif;">موضوع</th>' +
      '<th style="background:#4daabd;color:#fff;border:1px solid #8aabb6;padding:2px 3px;text-align:center;font: bold 7pt Tahoma,Arial,sans-serif;">مدت (ساعت)</th>' +
      '<th style="background:#4daabd;color:#fff;border:1px solid #8aabb6;padding:2px 3px;text-align:center;font: bold 7pt Tahoma,Arial,sans-serif;">شرح</th>' +
      '<th style="background:#4daabd;color:#fff;border:1px solid #8aabb6;padding:2px 3px;text-align:center;font: bold 7pt Tahoma,Arial,sans-serif;">محل</th>' +
      '</tr></thead><tbody>' + detailRows + '</tbody></table>' +
      '<div class="report-footer">واحد کنترل و نظارت پروژه‌های توسعه <span>' + esc(data.periodTitle) + '</span></div></div>';
  }

  var style = '<style>' +
    '@page{size:A4 landscape;margin:1cm 1cm 1.05cm 1cm;}' +
    '@page Section1{size:A4 landscape;mso-page-orientation:landscape;margin:1cm 1cm 1.05cm 1cm;}' +
    'html,body{width:27cm;min-width:27cm;}' +
    '.Section1{width:27cm;min-width:27cm;}' +
    'div.Section1{page:Section1;}' +
    'body{font-family:Tahoma,Arial,sans-serif;direction:rtl;color:#1c3445;font-size:10pt;line-height:1.65;margin:0;}' +
    '.report-page{position:relative;width:100%;}' +
    '.report-summary{page-break-after:always;}' +
    '.key-actions-page{page-break-after:always;}' +
    '.top-rule{height:7px;background:#0b8f91;margin:0 0 15px 0;}' +
    '.report-heading{width:100%;border-collapse:collapse;margin-bottom:8px;}' +
    '.report-heading h1{font-size:21pt;color:#17364b;margin:0;font-weight:bold;}' +
    '.report-heading p{font-size:11pt;color:#4e6570;margin:2px 0 0 0;}' +
    '.period-cell{width:20%;text-align:left;vertical-align:middle;font-size:14pt;font-weight:bold;color:#0b8f91;}' +
    '.summary-caption,.section-note{color:#647782;font-size:9pt;margin:7px 0 10px 0;}' +
    '.kpi-table{width:100%;table-layout:fixed;border-collapse:separate;border-spacing:3px;margin:8px 0 18px 0;}' +
    '.section-title{font-size:16pt;color:#17364b;margin:15px 0 0 0;border-bottom:2px solid #0b8f91;padding-bottom:6px;}' +
    '.key-groups{width:100%;table-layout:fixed;border-collapse:collapse;margin-top:10px;}' +
    '.key-groups td{vertical-align:top;}' +
    '.key-groups ul{margin:0;padding-right:18px;}' +
    '.key-groups li{font-size:9pt;line-height:1.65;margin-bottom:5px;}' +
    '.page-heading{font-size:18pt;color:#17364b;margin:0 0 10px 0;border-bottom:2px solid #0b8f91;padding-bottom:7px;}' +
    '.key-action-item{width:100%;border-collapse:collapse;margin:0 0 5px 0;page-break-inside:avoid;border-bottom:1px solid #e0e8eb;}' +
    '.key-check{width:30px;color:#0b8f91;font-size:16pt;font-weight:bold;vertical-align:top;padding:4px 5px;}' +
    '.key-meta{font-size:9.5pt;font-weight:bold;color:#17364b;margin-bottom:1px;}' +
    '.key-description{font-size:8.8pt;color:#273f50;line-height:1.45;}' +
    '.key-location{font-size:8.5pt;color:#6c7f89;margin-top:2px;}' +
    '.empty-note{padding:18px;background:#eef5f7;border-right:4px solid #0b8f91;}' +
    '.details-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:7.6pt;mso-table-lspace:0pt;mso-table-rspace:0pt;}' +
    '.details-table thead{display:table-header-group;}' +
    '.details-table th{background:#4daabd;color:#fff;font-weight:bold;padding:4px 4px;border:1px solid #8aabb6;text-align:center;}' +
    '.details-table td{padding:3px 4px;border:1px solid #9aabb1;vertical-align:middle;line-height:1.22;}' +
    '.details-table .col-date{width:11%;text-align:center;white-space:nowrap;}' +
    '.details-table .col-topic{width:15%;text-align:center;}' +
    '.details-table .col-hours{width:8%;text-align:center;white-space:nowrap;}' +
    '.details-table .col-description{width:52%;text-align:right;}' +
    '.details-table .col-location{width:14%;text-align:center;}' +
    '.report-footer{border-top:1px solid #d5e0e4;margin-top:12px;padding-top:5px;color:#71838c;font-size:8pt;}' +
    '.report-footer span{float:left;}' +
    'tr{page-break-inside:avoid;}' +
    '</style>';
  return '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40" lang="fa" dir="rtl"><head><meta charset="UTF-8"><meta name="ProgId" content="Word.Document"><title>گزارش عملکرد ماهانه</title>' + style + '</head><body><div class="Section1">' + summaryHtml + keyPage + detailsPage + '</div></body></html>';
}

function exportWord() {
  var data = gatherReportData();
  if (!data) { showAlert('اقدامی یافت نشد یا بازه گزارش نامعتبر است.', 'warning'); return; }
  var withDetails = !!($('rep_details') && $('rep_details').checked);
  var html = buildWordReportHtml(data, withDetails);
  var blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'گزارش_عملکرد_' + data.periodTitle.replace(/\s+/g, '_') + '.doc';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  showAlert('گزارش Word با قالب مدیریتی دانلود شد.', 'success');
}

function chunkArray(arr, size) {
  var out = [];
  for (var i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// سربرگ و پابرگ یکپارچه برای تمام اسلایدها با نوار فیروزه‌ای گزارش مرجع.
function addReportPptxFrame(slide, pptx, data, pageNumber, totalPages, title) {
  slide.background = { color: 'FFFFFF' };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.09, fill: { color: '0B8F91' }, line: { color: '0B8F91', transparency: 100 } });
  slide.addText(title || 'گزارش عملکرد ماهانه', { x: 0.42, y: 0.20, w: 10.4, h: 0.42, fontFace: 'Tahoma', fontSize: 21, bold: true, color: '17364B', align: 'right', rtlMode: true, margin: 0.02, breakLine: false });
  slide.addText(data.periodTitle, { x: 10.9, y: 0.22, w: 2.0, h: 0.34, fontFace: 'Tahoma', fontSize: 13, bold: true, color: '0B8F91', align: 'left', rtlMode: true, margin: 0.02 });
  slide.addShape(pptx.ShapeType.rect, { x: 0.42, y: 7.16, w: 12.48, h: 0.012, fill: { color: 'D9E4E8' }, line: { color: 'D9E4E8', transparency: 100 } });
  slide.addText('واحد کنترل و نظارت پروژه‌های توسعه', { x: 0.42, y: 7.20, w: 8.5, h: 0.16, fontFace: 'Tahoma', fontSize: 7.5, color: '6A7D86', align: 'right', rtlMode: true, margin: 0 });
  slide.addText(reportFaDigits(pageNumber + ' / ' + totalPages), { x: 11.2, y: 7.20, w: 1.7, h: 0.16, fontFace: 'Tahoma', fontSize: 7.5, color: '6A7D86', align: 'left', margin: 0 });
}

// تولید بسته خروجی PowerPoint شامل داشبورد، اقدامات کلیدی و جدول سوابق با سرصفحه‌های تکرارشونده.
async function exportPPTX() {
  if (typeof PptxGenJS === 'undefined') { showAlert('کتابخانه PowerPoint بارگذاری نشده است.', 'error'); return; }
  var data = gatherReportData();
  if (!data) { showAlert('اقدامی یافت نشد یا بازه گزارش نامعتبر است.', 'warning'); return; }

  var withDetails = !!($('rep_details') && $('rep_details').checked);
  var kpis = getReportKpis(data);
  var keyGroups = getReportKeyGroups(data);
  var keyActivities = getReportKeyActivities(data);
  var detailChunks = withDetails ? chunkArray(getReportSortedActivities(data), 22) : [];
  var keyGroupChunks = getReportKeyGroupsByTopic(data).length ? chunkArray(getReportKeyGroupsByTopic(data), 9) : [];
  var totalPages = 1 + keyGroupChunks.length + detailChunks.length;
  var pageNumber = 0;
  var pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.rtlMode = true;
  pptx.author = 'واحد کنترل و نظارت پروژه‌های توسعه';
  pptx.subject = 'گزارش عملکرد ماهانه ' + data.periodTitle;
  pptx.title = 'گزارش عملکرد ماهانه - ' + data.periodTitle;
  pptx.company = 'واحد کنترل و نظارت پروژه‌های توسعه';
  var FONT = 'Tahoma';
  var roundRect = pptx.ShapeType.roundRect || pptx.ShapeType.rect;

  // اسلاید نخست: شاخص‌های مدیریتی در یک ردیف و سه کارت خلاصه اقدامات کلیدی.
  var slide = pptx.addSlide();
  pageNumber++;
  addReportPptxFrame(slide, pptx, data, pageNumber, totalPages, 'گزارش عملکرد ماهانه | واحد کنترل و نظارت پروژه‌های توسعه');

  var maxPerRow = 11;
  var kpiRows = chunkArray(kpis, maxPerRow);
  var kpiY = 0.82;
  var kpiH = kpiRows.length > 1 ? 0.62 : 0.88;
  kpiRows.forEach(function (row, rowIndex) {
    var gap = 0.065;
    var available = 12.48;
    var cardW = (available - gap * (row.length - 1)) / row.length;
    row.forEach(function (item, index) {
      // ترتیب کارت‌ها راست به چپ است تا شاخص کل در سمت راست و نفرساعت در انتها قرار گیرد.
      var x = 0.42 + (row.length - 1 - index) * (cardW + gap);
      var y = kpiY + rowIndex * (kpiH + 0.08);
      var fill = item.tone === 'orange' ? 'FFF0DF' : 'F0F6F8';
      var accent = item.tone === 'orange' ? 'E49A39' : '0B8F91';
      slide.addShape(roundRect, { x: x, y: y, w: cardW, h: kpiH, rectRadius: 0.07, fill: { color: fill }, line: { color: 'D6E2E6', width: 0.8 }, shadow: { type: 'outer', color: '7A8C93', opacity: 0.10, blur: 1, angle: 45, distance: 1 } });
      slide.addShape(pptx.ShapeType.rect, { x: x + cardW - 0.055, y: y + 0.07, w: 0.055, h: kpiH - 0.14, fill: { color: accent }, line: { color: accent, transparency: 100 } });
      slide.addText(item.value, { x: x + 0.03, y: y + 0.10, w: cardW - 0.12, h: kpiH * 0.52, fontFace: FONT, fontSize: kpis.length > 9 ? 15 : 18, bold: true, color: '17364B', align: 'center', valign: 'mid', margin: 0.01, fit: 'shrink' });
      slide.addText(item.label, { x: x + 0.035, y: y + kpiH * 0.58, w: cardW - 0.13, h: kpiH * 0.34, fontFace: FONT, fontSize: kpis.length > 9 ? 7 : 8.5, bold: true, color: '526A75', align: 'center', valign: 'mid', rtlMode: true, margin: 0.01, fit: 'shrink' });
    });
  });

  var summaryY = kpiY + kpiRows.length * (kpiH + 0.08) + 0.16;
  slide.addText('اقدامات کلیدی ' + data.periodTitle, { x: 0.45, y: summaryY, w: 12.35, h: 0.35, fontFace: FONT, fontSize: 17, bold: true, color: '17364B', align: 'right', rtlMode: true, margin: 0.01 });
  slide.addText('خلاصه اقدامات اثرگذار؛ جزئیات و پیگیری‌های مرتبط در اسلایدهای بعدی آمده است.', { x: 0.45, y: summaryY + 0.34, w: 12.35, h: 0.22, fontFace: FONT, fontSize: 8.5, color: '657984', align: 'right', rtlMode: true, margin: 0.01 });

  var cardY = summaryY + 0.68;
  var cardH = Math.min(2.55, Math.max(2.15, 6.86 - cardY));
  var cardGap = 0.13;
  var groupCount = Math.max(1, Math.min(3, keyGroups.length));
  var groupW = (12.48 - cardGap * (groupCount - 1)) / groupCount;
  var groupColors = ['0B8F91', '368AB7', 'E39A2F'];
  if (!keyGroups.length) {
    slide.addShape(roundRect, { x: 0.42, y: cardY, w: 12.48, h: cardH, fill: { color: 'F0F6F8' }, line: { color: 'D6E2E6', width: 1 } });
    slide.addText('در این دوره اقدام کلیدی ثبت نشده است.', { x: 0.65, y: cardY + 0.35, w: 12.0, h: 0.6, fontFace: FONT, fontSize: 16, color: '526A75', align: 'center', rtlMode: true, margin: 0.05 });
  } else {
    keyGroups.forEach(function (group, index) {
      var x = 0.42 + (groupCount - 1 - index) * (groupW + cardGap);
      var color = groupColors[index % groupColors.length];
      slide.addShape(roundRect, { x: x, y: cardY, w: groupW, h: cardH, fill: { color: 'F1F6F7' }, line: { color: 'D6E2E6', width: 0.9 }, shadow: { type: 'outer', color: '7A8C93', opacity: 0.08, blur: 1, angle: 45, distance: 1 } });
      slide.addShape(pptx.ShapeType.rect, { x: x + groupW - 0.07, y: cardY + 0.12, w: 0.07, h: cardH - 0.24, fill: { color: color }, line: { color: color, transparency: 100 } });
      slide.addText(group.name, { x: x + 0.16, y: cardY + 0.12, w: groupW - 0.34, h: 0.42, fontFace: FONT, fontSize: 13.2, bold: true, color: color, align: 'right', rtlMode: true, margin: 0.02 });
      slide.addShape(pptx.ShapeType.rect, { x: x + 0.16, y: cardY + 0.58, w: groupW - 0.34, h: 0.015, fill: { color: 'C9D8DE' }, line: { color: 'C9D8DE', transparency: 100 } });
      var previewItems = group.items.slice(0, 3).map(function (activity) {
        var prefix = activity.topicName ? activity.topicName + ' - ' : '';
        var shortText = String(activity.description || '—');
        if (shortText.length > 108) shortText = shortText.slice(0, 105) + '…';
        return '• ' + prefix + shortText;
      });
      if (group.items.length > 3) previewItems.push('… ' + reportFaDigits(group.items.length - 3) + ' اقدام مرتبط دیگر');
      slide.addText(previewItems.join('\n'), { x: x + 0.17, y: cardY + 0.69, w: groupW - 0.38, h: cardH - 0.83, fontFace: FONT, fontSize: 8.4, color: '263E4D', align: 'right', valign: 'top', rtlMode: true, breakLine: false, margin: 0.03, paraSpaceAfterPt: 3, fit: 'shrink' });
    });
  }

  // اسلاید اقدامات کلیدی: گروه‌بندی بر اساس موضوع مشابه صفحه دوم گزارش مرجع.
  keyGroupChunks.forEach(function (chunk) {
    slide = pptx.addSlide();
    pageNumber++;
    addReportPptxFrame(slide, pptx, data, pageNumber, totalPages, 'اقدامات کلیدی این ماه');
    var top = 0.86;
    var gap = 0.055;
    var cardHeight = Math.min(0.64, (6.10 - gap * (chunk.length - 1)) / chunk.length);
    chunk.forEach(function (group, itemIndex) {
      var y = top + itemIndex * (cardHeight + gap);
      slide.addShape(roundRect, { x: 0.45, y: y, w: 12.42, h: cardHeight, fill: { color: itemIndex % 2 ? 'F4F8FA' : 'EDF4F6' }, line: { color: 'D8E3E7', width: 0.7 } });
      slide.addShape(pptx.ShapeType.rect, { x: 12.78, y: y + 0.07, w: 0.055, h: cardHeight - 0.14, fill: { color: '0B8F91' }, line: { color: '0B8F91', transparency: 100 } });
      var groupText = String(group.items[0].description || '—');
      if (groupText.length > 180) groupText = groupText.slice(0, 177) + '…';
      if (group.items.length > 1) groupText += '؛ ' + reportFaDigits(group.items.length - 1) + ' اقدام مرتبط دیگر';
      slide.addText(group.name, { x: 0.68, y: y + 0.055, w: 11.92, h: 0.18, fontFace: FONT, fontSize: 9.2, bold: true, color: '17364B', align: 'right', rtlMode: true, margin: 0 });
      slide.addText(groupText, { x: 0.68, y: y + 0.245, w: 11.92, h: cardHeight - 0.28, fontFace: FONT, fontSize: 8.2, color: '2E4654', align: 'right', valign: 'mid', rtlMode: true, margin: 0.01, fit: 'shrink' });
    });
  });

  // جداول تفصیلی با ردیف‌های راه‌راه و سرستون آبی فیروزه‌ای، مشابه جدول PDF مرجع.
  detailChunks.forEach(function (chunk, chunkIndex) {
    slide = pptx.addSlide();
    pageNumber++;
    addReportPptxFrame(slide, pptx, data, pageNumber, totalPages, 'ریز اقدامات');
    slide.addText('فهرست زمانی فعالیت‌های ثبت‌شده در ' + data.periodTitle, { x: 0.45, y: 0.64, w: 12.4, h: 0.20, fontFace: FONT, fontSize: 8.5, color: '647985', align: 'right', rtlMode: true, margin: 0.01 });

    var headerFill = { color: '4DAABD' };
    var headerOptions = { fontFace: FONT, fontSize: 9, bold: true, color: 'FFFFFF', fill: headerFill, align: 'center', valign: 'mid', rtlMode: true, margin: 0.035 };
    var header = ['تاریخ', 'موضوع', 'مدت (ساعت)', 'شرح', 'محل'].map(function (label) {
      return { text: label, options: headerOptions };
    });
    var rows = chunk.map(function (activity, rowIndex) {
      var fill = { color: rowIndex % 2 ? 'EAF2F5' : 'FFFFFF' };
      var base = { fontFace: FONT, fontSize: 7.0, color: '203744', fill: fill, valign: 'mid', margin: 0.035, breakLine: false };
      return [
        { text: String(activity.date || '—'), options: Object.assign({}, base, { align: 'center' }) },
        { text: topicName(activity.topicId), options: Object.assign({}, base, { align: 'center', rtlMode: true }) },
        { text: reportActivityDuration(activity), options: Object.assign({}, base, { align: 'center' }) },
        { text: String(activity.description || '—'), options: Object.assign({}, base, { align: 'right', rtlMode: true }) },
        { text: String(activity.location || '—'), options: Object.assign({}, base, { align: 'center', rtlMode: true }) }
      ];
    });
    slide.addTable([header].concat(rows), {
      x: 0.42, y: 0.92, w: 12.48,
      colW: [1.18, 1.72, 0.88, 6.88, 1.82],
      rowH: 0.265,
      border: { type: 'solid', color: 'A6B8BF', pt: 0.65 },
      fontFace: FONT, fontSize: 7.0, color: '203744',
      margin: 0.035, valign: 'mid', rtlMode: true,
      autoFit: false,
      breakLine: false
    });
  });

  try {
    await pptx.writeFile({ fileName: 'گزارش_عملکرد_' + data.periodTitle.replace(/\s+/g, '_') + '.pptx' });
    showAlert('گزارش PowerPoint با قالب مدیریتی دانلود شد.', 'success');
  } catch (error) {
    showAlert('خطا در ساخت فایل PowerPoint: ' + (error && error.message ? error.message : 'خطای ناشناخته'), 'error');
  }
}

function exportJSON(){
  var s=getSession();if(!s||s.role!=='superadmin'){showAlert('فقط سوپر ادمین مجاز است.');return}
  var data={version:'13.0',export_date:getTodayJalali(),persons:getData(KEYS.persons),topics:getData(KEYS.topics),acts:getData(KEYS.acts),holidays:getData(KEYS.holidays),importance:getData(KEYS.importance),planning:getData(KEYS.planning),locations:getData(KEYS.locations)};
  var url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  var a=document.createElement('a');a.href=url;a.download='backup_'+getTodayJalali().replace(/\//g,'-')+'.json';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}
async function importJSON(){
  var s=getSession();
  if(!s||s.role!=='superadmin'){showAlert('بازیابی فقط برای سوپر ادمین مجاز است.');return}
  var fi=$('import_file');if(!fi.files.length){showAlert('فایلی انتخاب نشده.');return}
  var reader=new FileReader();
  reader.onload=async function(ev){
    var data;
    try{data=JSON.parse(ev.target.result);if(!data||!Array.isArray(data.acts))throw 1}catch(err){showAlert('فایل نامعتبر.');return}
    if(!confirm('اطلاعات با داده‌های فعلی سرور ادغام می‌شود (رکوردهای موجود تغییر نمی‌کنند). ادامه؟'))return;
    await syncFromCloud(false);
    var clean=(arr,test)=>(Array.isArray(arr)?arr:[]).filter(x=>x&&typeof x==='object'&&typeof x.id==='string'&&x.id&&(!test||test(x)));
    var mergeById=async function(key,incoming,test){var cur=getData(key),m={};cur.forEach(x=>{m[x.id]=1});clean(incoming,test).forEach(x=>{if(!m[x.id]){m[x.id]=1;cur.push(x)}});return setData(key,cur)};
    var ok=true;
    ok=ok&&await mergeById(KEYS.topics,data.topics,x=>typeof x.name==='string');
    ok=ok&&await mergeById(KEYS.importance,data.importance,x=>typeof x.name==='string');
    ok=ok&&await mergeById(KEYS.locations,data.locations,x=>typeof x.name==='string');
    var curH=getData(KEYS.holidays),hm={};curH.forEach(h=>{hm[h.date]=1});
    clean(data.holidays,h=>isValidJalaliDate(h.date)).forEach(h=>{var d=normJ(h.date);if(!hm[d]){hm[d]=1;curH.push({id:h.id,date:d,title:String(h.title||'')})}});
    ok=ok&&await setData(KEYS.holidays,curH);
    ok=ok&&await mergeById(KEYS.planning,data.planning,x=>typeof x.title==='string');
    var curA=getData(KEYS.acts),aMap={};curA.forEach(a=>{aMap[a.id]=a});
    clean(data.acts,a=>isValidJalaliDate(a.date)&&Array.isArray(a.participants)).forEach(inc=>{
      if(aMap[inc.id]){inc.participants.forEach(pid=>{if(aMap[inc.id].participants.indexOf(pid)===-1)aMap[inc.id].participants.push(pid)})}
      else{curA.push(inc);aMap[inc.id]=inc}
    });
    ok=ok&&await setData(KEYS.acts,curA);
    fi.value='';renderAll();
    showAlert(ok?'ادغام شد.':'ادغام با خطا متوقف شد.',ok?'success':'error');
  };
  reader.readAsText(fi.files[0]);
}

function initDatepickers(){document.querySelectorAll('.date-picker').forEach(el=>el.addEventListener('click',openDatepicker))}
function openDatepicker(e){
  e.stopPropagation();var input=this;closePopups();
  var popup=document.createElement('div');popup.className='datepicker-popup';input.parentNode.appendChild(popup);
  var v=isValidJalaliDate(input.value)?parseJalali(input.value):parseJalali(getTodayJalali());
  popup.addEventListener('click',function(ev){
    ev.stopPropagation();
    var day=ev.target.closest('.dp-day'),nav=ev.target.closest('.dp-nav-btn');
    if(day&&!day.classList.contains('empty')){input.value=day.dataset.date;closePopups();fireChange(input)}
    else if(nav){var m=parseInt(popup.querySelector('#dp_month').value,10)+parseInt(nav.dataset.dir,10);var y=parseInt(popup.querySelector('#dp_year').value,10)||v.jy;if(m>12){m=1;y++}if(m<1){m=12;y--}renderDatepickerPopup(popup,y,m,input)}
  });
  renderDatepickerPopup(popup,v.jy,v.jm,input);
}
function renderDatepickerPopup(popup,year,month,input){
  year=Math.min(1500,Math.max(1300,year));
  var days=jalaliMonthLength(year,month),first=getJalaliDayOfWeek(year,month,1);
  var h='<div class="dp-nav"><button type="button" class="dp-nav-btn" data-dir="-1">«</button><select id="dp_month">';
  for(var m=1;m<=12;m++)h+='<option value="'+m+'"'+(m===month?' selected':'')+'>'+MONTH_NAMES[m-1]+'</option>';
  h+='</select><input type="number" id="dp_year" value="'+year+'"><button type="button" class="dp-nav-btn" data-dir="1">»</button></div><div class="dp-grid">';
  ['ش','ی','د','س','چ','پ','ج'].forEach(n=>{h+='<div class="dp-day-name">'+n+'</div>'});
  for(var i=0;i<first;i++)h+='<div class="dp-day empty"></div>';
  var sel=isValidJalaliDate(input.value)?normJ(input.value):'';
  for(var d=1;d<=days;d++){var ds=fmtJalali(year,month,d);h+='<div class="dp-day'+(isHolidayDow((first+d-1)%7)?' holiday':'')+(ds===sel?' selected':'')+'" data-date="'+ds+'">'+d+'</div>'}
  popup.innerHTML=h+'</div>';
  popup.querySelector('#dp_month').onchange=function(){renderDatepickerPopup(popup,parseInt(popup.querySelector('#dp_year').value,10)||year,parseInt(this.value,10),input)};
  popup.querySelector('#dp_year').onchange=function(){renderDatepickerPopup(popup,parseInt(this.value,10)||year,parseInt(popup.querySelector('#dp_month').value,10),input)};
}

async function forceLogout(msg){
  try {
    if (dbClient && dbClient.auth) {
      await Promise.race([
        dbClient.auth.signOut(),
        new Promise(resolve => setTimeout(resolve, 1000))
      ]);
    }
  } catch(e) {
    console.warn('SignOut error:', e);
  }
  
  try {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        localStorage.removeItem(key);
      }
    });
  } catch(e) {}
  
  clearSession();
  if(msg) sessionStorage.setItem('actbk_flash',msg);
  location.reload();
}

var _idleStarted=false,_lastActivity=Date.now();
function startIdleWatch(){
  if(_idleStarted)return;_idleStarted=true;
  ['click','keydown','touchstart'].forEach(ev=>document.addEventListener(ev,()=>{_lastActivity=Date.now()},{passive:true}));
  setInterval(()=>{if(getSession()&&Date.now()-_lastActivity>3600000)forceLogout('به دلیل عدم فعالیت طولانی از حساب خارج شدید.')},60000);
}

function showForcePasswordChange(userId) {
  $('login_modal').style.display = 'none';
  $('modal_force_change_password').classList.remove('hidden');
  
  $('btn_force_logout').onclick = () => {
    forceLogout('از حساب خارج شدید. لطفاً مجدداً وارد شوید.');
  };

  $('btn_submit_force_pass').onclick = async () => {
    const newPass = $('force_new_pass').value, confirmPass = $('force_confirm_pass').value, errBox = $('force_pass_error');
    errBox.style.display = 'none';
    if (!newPass || newPass.length < 6) { errBox.textContent = 'رمز جدید حداقل ۶ کاراکتر باشد.'; errBox.style.display = 'block'; return; }
    if (newPass !== confirmPass) { errBox.textContent = 'تکرار رمز یکسان نیست.'; errBox.style.display = 'block'; return; }

    const { error } = await dbClient.auth.updateUser({ password: newPass });
    if (error) { errBox.textContent = 'خطا: ' + error.message; errBox.style.display = 'block'; return; }

    await dbClient.rpc('app_mark_password_changed');
    $('modal_force_change_password').classList.add('hidden');
    showAlert('✅ رمز عبور با موفقیت تغییر کرد.', 'success');
    
    location.reload();
  };
}

async function handleLogin(){
  var username=val('login_username'),password=$('login_password').value;
  if(!username||!password){showAlert('نام کاربری و رمز الزامی است.','warning');return}
  if(!dbClient||!navigator.onLine){showAlert('برای ورود باید به اینترنت متصل باشید.','error');return}
  
  showAlert('⏳ در حال بررسی...','info');
  const { data, error } = await dbClient.auth.signInWithPassword({ email: username + '@app.com', password });

  if (error) {
    showAlert(error.message.includes('Invalid login credentials') ? '❌ نام کاربری یا کلمه عبور نادرست است.' : '❌ خطا: ' + error.message, 'error');
    return;
  }

  const { data: person, error: personError } = await dbClient.from('persons').select('*').eq('user_id', data.user.id).single();
  
  if (personError || !person) { 
    showAlert('❌ اطلاعات پروفایل یافت نشد.\nدلیل: ' + (personError ? personError.message : 'رکوردی یافت نشد'), 'error'); 
    await dbClient.auth.signOut(); 
    return; 
  }

  setSession({ personId: person.id, username: person.username, role: person.role, name: person.firstname + ' ' + person.lastname });
  $('login_password').value = '';
  
  if (person.must_change_password) { 
    location.reload(); 
  } else {
    await loadModuleCatalog();await loadModuleAccess();
    var initialSync=await syncFromCloud(false);
    if(!initialSync.ok){
      await dbClient.auth.signOut();clearSession();
      await showLogin();
      showAlert('ورود انجام شد، اما دریافت اطلاعات از سرور ناموفق بود. اتصال اینترنت را بررسی و دوباره تلاش کنید.','error');
      return;
    }
    $('login_modal').style.display = 'none';
    await startApp();
  }
}

async function handleSetup(){
  if(!navigator.onLine||!dbClient){showAlert('برای ایجاد حساب باید به اینترنت متصل باشید.','error');return}
  var first=val('setup_first'),last=val('setup_last'),pid=val('setup_pid'),username=val('setup_username'),password=$('setup_password').value;
  if(!first||!last||!pid||!username||!password){showAlert('همه فیلدها الزامی.');return}
  if(!/^\d{1,6}$/.test(pid)){showAlert('شماره پرسنلی معتبر نیست.');return}
  if(password.length<MIN_PASSWORD_LEN){showAlert('رمز حداقل '+MIN_PASSWORD_LEN+' کاراکتر.');return}

  showAlert('⏳ در حال ایجاد حساب...','info');

  try {
    const { data, error } = await dbClient.functions.invoke('setup-admin', {
      body: { username, firstname: first, lastname: last, personnelid: pid, password }
    });

    if (error) {
      console.error("Edge Function Error:", error);
      showAlert('❌ خطای ارتباط با تابع: ' + error.message, 'error');
      return;
    }
    
    if (data && data.error) {
      showAlert('❌ خطای سرور: ' + data.error, 'error');
      return;
    }

    $('login_username').value = username;
    $('login_password').value = password;
    await handleLogin(); 

  } catch (err) {
    console.error("Catch Error:", err);
    showAlert('❌ خطای پیش‌بینی نشده: ' + err.message, 'error');
  }
}

function handleLogout(){if(!confirm('از حساب خارج می‌شوید؟'))return;forceLogout()}

async function showLogin(){
  $('login_modal').style.display='flex';$('main_app').style.display='none';$('user_info').style.display='none';
  var lb=$('login_alert_box');if(lb){lb.style.display='none';lb.textContent='';lb.className='alert'}
  $('btn_login').disabled=false;
  var flash=sessionStorage.getItem('actbk_flash');
  
  if(dbClient&&navigator.onLine){
    const { data: hasUsers, error } = await dbClient.rpc('check_has_users');
    if(error){
      $('login_msg').innerHTML='<div class="alert alert-error" style="display:block;margin-bottom:12px"><b>⚠️ خطا:</b><br>'+esc(error.message)+'</div>';
      $('login_form').classList.add('hidden');$('setup_form').classList.add('hidden');$('login_title').textContent='خطای دیتابیس';
    }else if(!hasUsers){
      $('login_form').classList.add('hidden');$('setup_form').classList.remove('hidden');
      $('login_title').textContent='ایجاد حساب مدیر اصلی';$('login_msg').innerHTML='👋 به برنامه خوش آمدید.<br>لطفاً اولین حساب را ایجاد کنید.';
    }else{
      $('login_form').classList.remove('hidden');$('setup_form').classList.add('hidden');
      $('login_title').textContent='ورود به سیستم';$('login_msg').textContent='لطفاً نام کاربری و کلمه عبور خود را وارد کنید.';
    }
  }else{
    $('login_form').classList.remove('hidden');$('setup_form').classList.add('hidden');
    $('login_title').textContent='عدم اتصال';
    $('login_msg').innerHTML='<div class="alert alert-warning" style="display:block;margin-bottom:12px">'+esc(window.dbInitError||'اتصال به دیتابیس برقرار نیست.')+'<br>برای ورود باید به اینترنت متصل باشید.</div>';
  }
  if(flash){sessionStorage.removeItem('actbk_flash');showAlert(flash,'error')}
}

function openChangePasswordModal(){
  $('chg_new_pass').value='';$('chg_confirm_pass').value='';
  $('chg_error').style.display='none';$('modal_change_password').classList.remove('hidden');
}
async function submitChangePassword(){
  var newPass=$('chg_new_pass').value, confirmPass=$('chg_confirm_pass').value, errBox=$('chg_error');
  errBox.style.display='none';
  if(!newPass||newPass.length<MIN_PASSWORD_LEN){errBox.textContent='رمز جدید باید حداقل '+MIN_PASSWORD_LEN+' کاراکتر باشد.';errBox.style.display='block';return}
  if(newPass!==confirmPass){errBox.textContent='تکرار رمز یکسان نیست.';errBox.style.display='block';return}

  const { error } = await dbClient.auth.updateUser({ password: newPass });
  if (error) { errBox.textContent = 'خطا: ' + error.message; errBox.style.display = 'block'; return; }

  $('modal_change_password').classList.add('hidden');
  showAlert('✅ رمز عبور تغییر کرد.', 'success');
}

async function initDbClient(){
  if(!window.supabase){window.dbInitError='کتابخانه اتصال لود نشد.';return false}
  let cfg=null;
  if(window.APP_CONFIG){
    if(window.APP_CONFIG.SERVERS&&window.APP_CONFIG.SERVERS.length>0){
      cfg=window.APP_CONFIG.SERVERS.find(s=>s.type!=='nhost')||window.APP_CONFIG.SERVERS[0];
    }else if(window.APP_CONFIG.DB_URL||window.APP_CONFIG.SUPABASE_URL){
      cfg={url:window.APP_CONFIG.DB_URL||window.APP_CONFIG.SUPABASE_URL,key:window.APP_CONFIG.DB_ANON_KEY||window.APP_CONFIG.SUPABASE_ANON_KEY};
    }
  }
  if(!cfg||!cfg.url||!cfg.key||String(cfg.url).includes('YOUR_')){window.dbInitError='پیکربندی اتصال در Activity.html ناقص است.';return false}
  try{
    dbClient=window.supabase.createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    activeServerName=cfg.name||'';
    return true;
  }catch(e){console.error('[DB] init failed:',e);window.dbInitError='خطا در راه‌اندازی اتصال.';return false}
}

function loadAppVersion() {
  var el = $('app_version_display');
  if (!el) return;
  
  var done = false;
  var timer = setTimeout(function() {
    if (done) return;
    done = true;
    if (window.caches && caches.keys) {
      caches.keys().then(keys => {
        var k = keys.filter(x => x.indexOf('actbk-cache-') === 0).sort().pop();
        if (k) el.textContent = k.replace('actbk-cache-', '');
        else el.textContent = 'نامشخص';
      }).catch(() => { el.textContent = 'نامشخص'; });
    } else {
      el.textContent = 'نامشخص';
    }
  }, 3000);

  fetch('./sw.js?t=' + Date.now(), { cache: 'no-store' })
    .then(res => {
      if (!res.ok) throw new Error('Network error');
      return res.text();
    })
    .then(text => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      var match = text.match(/CACHE_VERSION\s*=\s*['"]([^'"]+)['"]/);
      if (match && match[1]) el.textContent = match[1];
      else el.textContent = 'نامشخص';
    })
    .catch(err => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      console.warn('Version fetch failed:', err);
      if (window.caches && caches.keys) {
        caches.keys().then(keys => {
          var k = keys.filter(x => x.indexOf('actbk-cache-') === 0).sort().pop();
          if (k) el.textContent = k.replace('actbk-cache-', '');
          else el.textContent = 'نامشخص';
        }).catch(() => { el.textContent = 'نامشخص'; });
      } else {
        el.textContent = 'نامشخص';
      }
    });
}

function setConnectionStatus(status,serverName){
  var dot=$('onlineDot');
  if(dot){
    dot.classList.remove('online','partial','offline','checking');dot.classList.add(status);
    dot.title=status==='online'?('آنلاین'+(serverName?' — '+serverName:'')):status==='offline'?'آفلاین — اتصال به دیتابیس برقرار نیست':'در حال بررسی اتصال...';
  }
  var box=$('login_conn_box'),text=$('login_conn_text');
  if(box){box.classList.remove('online','partial','offline','checking');box.classList.add(status)}
  if(text){
    text.textContent=status==='online'?'✅ اتصال به دیتابیس برقرار است'+(serverName?' ('+serverName+')':''):status==='offline'?'⛔ اتصال به دیتابیس برقرار نیست':'⏳ در حال بررسی اتصال...';
  }
}

let _connBusy=null,_connFails=0,_connTimer=null;
async function checkDbConnection(){
  if(_connBusy)return _connBusy;
  _connBusy=(async function(){
    if(!dbClient||!navigator.onLine){setConnectionStatus('offline');return false}
    setConnectionStatus('checking');
    try{
      const {error}=await dbClient.rpc('check_has_users');
      if(!error){setConnectionStatus('online',activeServerName);return true}
    }catch(e){console.warn('[Conn] check failed:',e.message)}
    setConnectionStatus('offline');return false;
  })();
  try{return await _connBusy}finally{_connBusy=null}
}

async function connectionTick(){
  var ok=await checkDbConnection();
  var s=getSession();if(!s)return;
  if(!ok){
    _connFails++;
    if(_connFails>=2){forceLogout('ارتباط با سرور قطع شد. لطفاً مجدداً وارد شوید.')}
  }else{
    _connFails=0;
  }
}

function startConnectionMonitor(){
  if(_connTimer)clearInterval(_connTimer);
  _connTimer=setInterval(()=>{if(document.visibilityState==='visible')connectionTick()},60000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')connectionTick()});
  window.addEventListener('online',()=>connectionTick());
  window.addEventListener('offline',()=>{setConnectionStatus('offline');if(getSession())forceLogout('اتصال اینترنت قطع شد.')});
}

function on(id,ev,fn){var e=$(id);if(e)e.addEventListener(ev,fn)}
function delegate(id,fn){var e=$(id);if(!e)return;e.addEventListener('click',ev=>{var b=ev.target.closest('button');if(b&&b.dataset.action)fn(b.dataset.action,b.dataset.id)})}

async function startApp(){
  $('login_modal').style.display='none';
  $('main_app').style.display='block';
  
  if(getVisibleModules().some(m=>m.id==='activities'))await seedImportance();
  refreshDropdowns();applyPermissions();
  var today=getTodayJalali().split('/');
  $('cal_year').value=parseInt(today[0],10);$('cal_month').value=parseInt(today[1],10);$('h_default_year').value=parseInt(today[0],10);
  if(!$('act_start_date').value)$('act_start_date').value=getTodayJalali();
  var tp=today.map(n=>parseInt(n,10));
  // فیلتر پیش‌فرض سوابق روی بازه کامل ماه جاری تنظیم می‌شود.
  if(!$('rec_from').value)$('rec_from').value=fmtJalali(tp[0],tp[1],1);
  if(!$('rec_to').value)$('rec_to').value=fmtJalali(tp[0],tp[1],jalaliMonthLength(tp[0],tp[1]));
  if(!$('rep_from').value)$('rep_from').value=fmtJalali(tp[0],tp[1],1);
  if(!$('rep_to').value)$('rep_to').value=fmtJalali(tp[0],tp[1],jalaliMonthLength(tp[0],tp[1]));
  if($('att_report_from'))$('att_report_from').value=fmtJalali(tp[0],tp[1],1);
  if($('att_report_to'))$('att_report_to').value=fmtJalali(tp[0],tp[1],jalaliMonthLength(tp[0],tp[1]));
  
  populateParticipants();renderPersons();renderImportance();renderLocations();
  
  if ($('cal_week_mode')) {
    $('cal_week_mode').checked = true;
    $('cal_month_group').style.display = 'none';
    $('cal_year_group').style.display = 'none';
    $('monthly_summary').style.display = 'none';
  }
  
  renderCalendar(); updateCalculatedHours(); updatePlanningBadge();
  startIdleWatch();
  updateModuleLabels();await showModuleHome();
}
async function seedImportance(){
  if(localStorage.getItem('actbk_importance_seeded'))return;
  if(!getData(KEYS.importance).length){if(!(await setData(KEYS.importance,DEFAULT_IMPORTANCE.slice())))return}
  localStorage.setItem('actbk_importance_seeded','1');
}


/* ================================================================
   نسخه ۵ — درگاه مرکزی، مدیریت ماژول‌ها و ماژول ثبت عدم حضور
   ================================================================ */
const MODULE_DEFAULTS=[
  {id:'activities',title:'ثبت فعالیت',description:'ثبت، پیگیری و گزارش فعالیت‌های ماهانه',icon:'📋',route:'activities'},
  {id:'attendance',title:'ثبت عدم حضور',description:'مرخصی، مأموریت، دوره آموزشی و سایر رویدادها',icon:'📅',route:'attendance'}
];
const ATT_TYPES={
  leave_daily:'مرخصی روزانه',leave_hourly:'مرخصی ساعتی',mission_in:'مأموریت داخل استان',
  mission_out:'مأموریت خارج استان',training:'دوره آموزشی',other:'سایر موارد'
};
let moduleCatalog=MODULE_DEFAULTS.map(x=>Object.assign({},x));
let moduleAccessRows=[];
let moduleAccessLoaded=false;
let activityCacheCleared=false;
let attendanceCache=[];
let attendanceReportRows=[];
let attendanceReportMeta=null;
let attendanceActiveTab='form';
let attendanceInitialized=false;
let lastActivitySection='calendar';
let activeModuleId='';

// نام‌های نمایشی را از جدول مرکزی می‌خواند؛ در نبود مهاجرت، نام‌های پیش‌فرض حفظ می‌شوند.
async function loadModuleCatalog(){
  if(!dbClient||!navigator.onLine)return;
  try{
    const {data,error}=await dbClient.from('app_modules').select('id,display_name,description,icon,sort_order,is_enabled').eq('is_enabled',true).order('sort_order',{ascending:true});
    if(error){console.warn('[Modules] catalog:',error.message);return}
    (data||[]).forEach(row=>{var m=moduleCatalog.find(x=>x.id===row.id);if(!m){m={id:row.id,title:row.display_name||row.id,description:row.description||'ماژول سامانه',icon:row.icon||'🧩',route:row.id};moduleCatalog.push(m)}else{if(row.display_name)m.title=row.display_name;if(row.description)m.description=row.description;if(row.icon)m.icon=row.icon}});
    moduleCatalog=moduleCatalog.filter(m=>(data||[]).some(row=>row.id===m.id)).sort((a,b)=>{var x=(data||[]).find(r=>r.id===a.id),y=(data||[]).find(r=>r.id===b.id);return (x?x.sort_order:100)-(y?y.sort_order:100)});
  }catch(e){console.warn('[Modules] catalog unavailable:',e.message)}
}

// نبود رکورد دسترسی به معنی فعال بودن ماژول است؛ سوپر ادمین همیشه دسترسی کامل دارد.
async function loadModuleAccess(){
  if(!dbClient||!navigator.onLine)return
  try{var {data,error}=await dbClient.from('person_module_access').select('person_id,module_id,enabled');if(error)throw error;moduleAccessRows=data||[];moduleAccessLoaded=true;var s=getSession();if(s&&!getVisibleModules().some(m=>m.id==='activities')){[KEYS.acts,KEYS.topics,KEYS.importance,KEYS.planning,KEYS.locations].forEach(k=>localStorage.removeItem(k));activityCacheCleared=true}if(s&&!getVisibleModules().some(m=>m.id==='attendance'))attendanceCache=[]}
  catch(e){moduleAccessRows=[];moduleAccessLoaded=false;console.warn('[Modules] access list:',e.message)}
}
function hasModuleAccess(personId,moduleId){var row=moduleAccessRows.find(x=>x.person_id===personId&&x.module_id===moduleId);return row?row.enabled!==false:true}
function getVisibleModules(){var s=getSession();if(!s)return[];if(s.role==='superadmin')return moduleCatalog;if(!moduleAccessLoaded)return[];return moduleCatalog.filter(m=>hasModuleAccess(s.personId,m.id))}

// صفحه درگاه مرکزی را متناسب با مجوز کاربر می‌سازد.
function renderModuleHome(){
  var s=getSession();if(!s)return;
  var user=$('module_home_user');if(user)user.textContent=s.name;
  var q=val('module_search').toLocaleLowerCase('fa');
  var c=$('module_cards');if(!c)return;
  var visibleModules=getVisibleModules(),visibleIds=visibleModules.map(m=>m.id);
  var favorites=readModuleList('actbk_module_favorites').filter(id=>visibleIds.includes(id)),recent=readModuleList('actbk_module_recent').filter(id=>visibleIds.includes(id));
  var shortcutHtml='';
  if(favorites.length)shortcutHtml+='<div class="module-shortcut-group"><b>علاقه‌مندی‌ها</b>'+favorites.map(id=>visibleModules.find(x=>x.id===id)).filter(Boolean).map(m=>'<button data-open-module="'+esc(m.id)+'">'+esc(m.icon)+' '+esc(m.title)+'</button>').join('')+'</div>';
  if(recent.length)shortcutHtml+='<div class="module-shortcut-group"><b>ماژول‌های اخیر</b>'+recent.map(id=>visibleModules.find(x=>x.id===id)).filter(Boolean).map(m=>'<button data-open-module="'+esc(m.id)+'">'+esc(m.icon)+' '+esc(m.title)+'</button>').join('')+'</div>';
  $('module_shortcuts').innerHTML=shortcutHtml;
  c.innerHTML=visibleModules.filter(m=>(m.title+' '+m.description).toLocaleLowerCase('fa').includes(q)).map(m=>
    '<div class="module-card" role="button" tabindex="0" data-open-module="'+esc(m.id)+'"><button type="button" class="module-favorite '+(favorites.includes(m.id)?'is-favorite':'')+'" data-fav-module="'+esc(m.id)+'" aria-label="افزودن به علاقه‌مندی‌ها">'+(favorites.includes(m.id)?'★':'☆')+'</button><span class="module-card-icon">'+esc(m.icon)+'</span><strong>'+esc(m.title)+'</strong><small>'+esc(m.description)+'</small><span class="module-open-label">ورود به ماژول ←</span></div>'
  ).join('')||(visibleModules.length?'<p class="hint">ماژولی با این عبارت پیدا نشد.</p>':'<p class="hint">برای حساب کاربری شما هنوز ماژولی فعال نشده است. با مدیر سامانه تماس بگیرید.</p>');
  var admin=$('module_admin_panel');if(admin)admin.classList.toggle('hidden',s.role!=='superadmin');
  if(s.role==='superadmin'){renderModuleAdminList();renderModuleAccessAdminList();if(!moduleAccessLoaded)moduleNotify('برای فعال شدن مدیریت دسترسی ماژول‌ها، ابتدا مهاجرت SQL نسخه ۵ را اجرا کنید.','error')}
  else if(!moduleAccessLoaded)moduleNotify('دریافت مجوزهای ماژول ناموفق است؛ با مدیر سامانه تماس بگیرید.','error');
}

// فهرست ویرایش عنوان ماژول‌ها را فقط برای سوپر ادمین نمایش می‌دهد.
function renderModuleAdminList(){
  var c=$('module_admin_list');if(!c)return;
  c.innerHTML=moduleCatalog.map(m=>'<div class="module-admin-row"><strong>'+esc(m.title)+'</strong><input type="text" maxlength="60" data-module-title="'+esc(m.id)+'" value="'+esc(m.title)+'"><button class="btn btn-success btn-sm" data-save-module-title="'+esc(m.id)+'">ذخیره عنوان</button></div>').join('');
}

// ماتریس دسترسی کارکنان را فقط برای سوپر ادمین نمایش می‌دهد.
function renderModuleAccessAdminList(){
  var c=$('module_access_admin_list');if(!c)return;
  if(!moduleAccessLoaded){c.innerHTML='<p class="hint">جدول دسترسی ماژول‌ها در دسترس نیست؛ مهاجرت SQL نسخه ۵ را اجرا یا اتصال را بررسی کنید.</p>';return}
  var persons=sortPersonsById(getData(KEYS.persons)),s=getSession();
  if(!persons.length){c.innerHTML='<p class="hint">کاربری برای نمایش وجود ندارد.</p>';return}
  var html='<table><thead><tr><th>کارمند</th>'+moduleCatalog.map(m=>'<th>'+esc(m.title)+'</th>').join('')+'</tr></thead><tbody>';
  persons.forEach(p=>{html+='<tr><td>'+esc(p.firstName+' '+p.lastName)+'</td>'+moduleCatalog.map(m=>'<td><label class="module-access-check"><input type="checkbox" data-module-access-person="'+esc(p.id)+'" data-module-access-id="'+esc(m.id)+'" '+((p.role==='superadmin'||hasModuleAccess(p.id,m.id))?'checked':'')+' '+(p.role==='superadmin'?'disabled':'')+'><span>'+((p.role==='superadmin'||hasModuleAccess(p.id,m.id))?'فعال':'غیرفعال')+'</span></label></td>').join('')+'</tr>'});
  c.innerHTML=html+'</tbody></table>';
}

// ذخیره تغییر دسترسی در دیتابیس؛ RLS فقط به سوپر ادمین اجازه مدیریت می‌دهد.
async function savePersonModuleAccess(personId,moduleId,enabled){
  var s=getSession();if(!s||s.role!=='superadmin'){renderModuleAccessAdminList();return}
  var person=getData(KEYS.persons).find(p=>p.id===personId);if(!person||person.role==='superadmin'){renderModuleAccessAdminList();return}
  var {error}=await dbClient.from('person_module_access').upsert({person_id:personId,module_id:moduleId,enabled:enabled,updated_at:new Date().toISOString()},{onConflict:'person_id,module_id'});
  if(error){moduleNotify('ذخیره دسترسی ناموفق بود. مهاجرت SQL نسخه ۵ را بررسی کنید.','error');console.error(error);renderModuleAccessAdminList();return}
  var old=moduleAccessRows.find(x=>x.person_id===personId&&x.module_id===moduleId);
  if(old)old.enabled=enabled;else moduleAccessRows.push({person_id:personId,module_id:moduleId,enabled:enabled});
  renderModuleAccessAdminList();moduleNotify('دسترسی ماژول به‌روزرسانی شد.','success');
}

// تغییر عنوان ماژول را با کنترل دسترسی سمت سرور در جدول app_modules ذخیره می‌کند.
async function saveModuleTitle(id){
  var s=getSession();if(!s||s.role!=='superadmin'){moduleNotify('فقط سوپر ادمین مجاز است.','error');return}
  var input=document.querySelector('[data-module-title="'+id+'"]'),title=input?input.value.trim():'';
  if(!title||title.length>60){moduleNotify('عنوان باید بین ۱ تا ۶۰ نویسه باشد.','error');return}
  var {error}=await dbClient.from('app_modules').update({display_name:title}).eq('id',id);
  if(error){moduleNotify('ذخیره عنوان ناموفق بود. ابتدا مهاجرت SQL نسخه ۵ را اجرا کنید.','error');console.error(error);return}
  var m=moduleCatalog.find(x=>x.id===id);if(m)m.title=title;
  renderModuleHome();updateModuleLabels();moduleNotify('عنوان ماژول ذخیره شد.','success');
}

// عنوان ماژول انتخاب‌شده را در سربرگ و کارت‌ها همگام می‌کند.
function moduleNotify(message,type){var box=$('module_home_message');if(box){box.textContent=message;box.className='alert '+(type==='error'?'alert-error':'alert-success');box.style.display='block'}}
function updateModuleLabels(){var m=moduleCatalog.find(x=>x.id==='attendance');if(m&&$('attendance_module_title'))$('attendance_module_title').textContent=m.title}

// بین درگاه مرکزی و ماژول‌ها جابه‌جا می‌شود؛ نشست کاربر دست‌نخورده باقی می‌ماند.
function readModuleList(key){try{var a=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(a)?a:[]}catch(e){return[]}}
function toggleModuleFavorite(id){var a=readModuleList('actbk_module_favorites'),i=a.indexOf(id);if(i>=0)a.splice(i,1);else a.unshift(id);localStorage.setItem('actbk_module_favorites',JSON.stringify(a));renderModuleHome()}
function rememberModule(id){var a=readModuleList('actbk_module_recent').filter(x=>x!==id);a.unshift(id);localStorage.setItem('actbk_module_recent',JSON.stringify(a.slice(0,5)))}

// پنل جابه‌جایی سریع را از هر ماژول، بدون بازگشت اجباری به صفحه اصلی، باز و بسته می‌کند.
function closeModuleSwitcher(){var panel=$('module_switcher_panel');if(panel)panel.classList.add('hidden')}
async function toggleModuleSwitcher(){
  var panel=$('module_switcher_panel');if(!panel)return;
  await loadModuleCatalog();await loadModuleAccess();updateModuleLabels();
  if(activeModuleId&&!getVisibleModules().some(m=>m.id===activeModuleId)){attendanceCache=[];await showModuleHome();return}
  if(!panel.classList.contains('hidden')){closeModuleSwitcher();return}
  var modules=getVisibleModules(),favorites=readModuleList('actbk_module_favorites'),recent=readModuleList('actbk_module_recent');
  var quick=[];favorites.concat(recent).forEach(id=>{if(id!==activeModuleId&&!quick.includes(id)&&modules.some(m=>m.id===id))quick.push(id)});
  if(!quick.length)quick=modules.filter(m=>m.id!==activeModuleId).map(m=>m.id).slice(0,6);
  quick=quick.slice(0,6);
  panel.innerHTML='<div class="module-switcher-heading"><strong>جابه‌جایی سریع</strong><button type="button" class="btn-icon" data-close-module-switcher aria-label="بستن">×</button></div>'+(quick.length?quick.map(id=>{var m=modules.find(x=>x.id===id);return '<button type="button" class="module-switcher-item" data-switch-to-module="'+esc(m.id)+'">'+esc(m.icon)+' <span>'+esc(m.title)+'</span><small>ورود</small></button>'}).join(''):'<p class="hint">ماژول دیگری برای جابه‌جایی وجود ندارد.</p>')+'<button type="button" class="module-switcher-all" data-open-module-home>مشاهده همه ماژول‌ها و جستجو ←</button>';
  panel.classList.remove('hidden');
}

async function showModuleHome(){
  await loadModuleCatalog();await loadModuleAccess();updateModuleLabels();
  closeModuleSwitcher();activeModuleId='';
  if($('att_module_message'))$('att_module_message').style.display='none';
  $('module_home').classList.remove('hidden');$('attendance_module').classList.add('hidden');$('activity_module_shell').style.display='none';
  renderModuleHome();window.scrollTo({top:0,behavior:'smooth'});
}
async function openModule(id){
  closeModuleSwitcher();
  if($('module_home_message'))$('module_home_message').style.display='none';
  if(!getVisibleModules().some(m=>m.id===id)){moduleNotify('شما به این ماژول دسترسی ندارید.','error');return}
  if(id!=='activities'&&id!=='attendance'){moduleNotify('این ماژول در فهرست سامانه ثبت شده، اما مسیر اجرایی آن هنوز به برنامه اضافه نشده است.','error');return}
  rememberModule(id);activeModuleId=id;
  if(id==='activities'){
    $('module_home').classList.add('hidden');$('attendance_module').classList.add('hidden');$('activity_module_shell').style.display='';
    if(activityCacheCleared){var refresh=await syncFromCloud(false);if(refresh.ok)activityCacheCleared=false;else showAlert('همگام‌سازی ماژول ثبت فعالیت ناموفق بود.','error')}
    showSection(lastActivitySection||'calendar');
  }else if(id==='attendance'){
    $('module_home').classList.add('hidden');$('activity_module_shell').style.display='none';$('attendance_module').classList.remove('hidden');
    var s=getSession();$('attendance_user_name').textContent=s?s.name:'';
    $('att_report_tab').classList.toggle('hidden',!isAttendanceReportAdmin());
    updateModuleLabels();if(!attendanceInitialized){resetAttendanceForm();attendanceInitialized=true}
    loadAttendanceEvents().then(()=>{renderAttendanceHistory();if(isAttendanceReportAdmin())populateAttendanceReportPeople()});
    setAttendanceTab(attendanceActiveTab||'form');window.scrollTo({top:0,behavior:'smooth'});
  }
}

// تب‌های داخلی ماژول عدم حضور را جابه‌جا می‌کند.
function setAttendanceTab(tab){
  if(tab==='report'&&!isAttendanceReportAdmin()){attendanceMessage('دسترسی گزارش مدیریتی ندارید.','error');return}
  attendanceActiveTab=tab;
  ['form','history','report'].forEach(k=>{var panel=$('att_panel_'+k),button=document.querySelector('[data-att-tab="'+k+'"]');if(panel)panel.classList.toggle('hidden',k!==tab);if(button)button.classList.toggle('active',k===tab)});
  if(tab==='history')loadAttendanceEvents().then(renderAttendanceHistory);
  if(tab==='report'&&isAttendanceReportAdmin())populateAttendanceReportPeople();
}

function showAttendanceTypeFields(){
  var hourly=val('att_type')==='leave_hourly';
  $('att_time_row').style.display=hourly?'':'none';$('att_end_date_group').style.display=hourly?'none':'';
  if(hourly)$('att_end_date').value=val('att_start_date');
}
function resetAttendanceForm(){
  ['att_event_id','att_description','att_start_time','att_end_time'].forEach(id=>{if($(id))$(id).value=''});
  $('att_type').value='leave_daily';$('att_start_date').value=getTodayJalali();$('att_end_date').value=getTodayJalali();
  $('btn_att_save').textContent='ثبت رویداد';$('att_form_message').style.display='none';showAttendanceTypeFields();
}
function attendanceMessage(message,type){var box=$('att_module_message');if(!box)return;box.textContent=message;box.className='alert '+(type==='error'?'alert-error':'alert-success');box.style.display='block'}

// رویدادهای مجاز را از Supabase می‌خواند؛ RLS تعیین می‌کند کاربر چه ردیف‌هایی ببیند.
async function loadAttendanceEvents(){
  if(!dbClient||!navigator.onLine){attendanceMessage('برای دریافت اطلاعات به اتصال اینترنت نیاز است.','error');return false}
  try{
    var {data,error}=await dbClient.from('attendance_events').select('*').order('start_date',{ascending:false});
    if(error)throw error;attendanceCache=data||[];return true;
  }catch(e){console.error('[Attendance] load:',e);attendanceMessage('دریافت رویدادها ناموفق بود. مهاجرت SQL نسخه ۵ و سیاست‌های دسترسی را بررسی کنید.','error');return false}
}

// تاریخ‌های جلالی و قواعد نوع رویداد را پیش از ارسال به دیتابیس اعتبارسنجی می‌کند.
function validateAttendanceForm(){
  var type=val('att_type'),start=val('att_start_date'),end=type==='leave_hourly'?start:val('att_end_date');
  if(!Object.prototype.hasOwnProperty.call(ATT_TYPES,type)){attendanceMessage('نوع رویداد معتبر نیست.','error');return null}
  if(!isValidJalaliDate(start)||!isValidJalaliDate(end)){attendanceMessage('تاریخ شروع یا پایان معتبر نیست.','error');return null}
  if(jalaliToTimestamp(end)<jalaliToTimestamp(start)){attendanceMessage('تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد.','error');return null}
  var st=null,et=null;
  if(type==='leave_hourly'){
    st=val('att_start_time');et=val('att_end_time');
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(st)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(et)||et<=st){attendanceMessage('برای مرخصی ساعتی، ساعت شروع و پایان معتبر و پایان بعد از شروع الزامی است.','error');return null}
  }
  var normalized={event_type:type,start_date:normJ(start),end_date:normJ(end),start_time:st,end_time:et,description:val('att_description')};
  var editing=val('att_event_id'),self=getSession().personId;
  var conflict=attendanceCache.find(function(old){
    if(old.person_id!==self||old.id===editing)return false;
    var overlap=jalaliToTimestamp(normalized.start_date)<=jalaliToTimestamp(old.end_date)&&jalaliToTimestamp(normalized.end_date)>=jalaliToTimestamp(old.start_date);
    if(!overlap)return false;
    if(normalized.event_type==='leave_hourly'&&old.event_type==='leave_hourly')return !(timeToMinutes(normalized.end_time)<=timeToMinutes(old.start_time)||timeToMinutes(normalized.start_time)>=timeToMinutes(old.end_time));
    return true;
  });
  if(conflict){attendanceMessage('برای این بازه رویداد دیگری ثبت شده است. ابتدا سوابق را بررسی کنید.','error');return null}
  return normalized;
}

// رویداد را فقط با شناسه پرسنلی نشست جاری ثبت یا ویرایش می‌کند؛ انتخاب شخص دیگر در فرم وجود ندارد.
async function saveAttendanceEvent(){
  var session=getSession();if(!session)return;
  if(!dbClient||!navigator.onLine){attendanceMessage('اتصال به سرور برقرار نیست.','error');return}
  if(!(await loadAttendanceEvents()))return;
  var payload=validateAttendanceForm();if(!payload)return;
  var id=val('att_event_id'),result;
  if(id)result=await dbClient.from('attendance_events').update(payload).eq('id',id);
  else result=await dbClient.from('attendance_events').insert(Object.assign({id:genId('att_'),person_id:session.personId},payload));
  if(result.error){console.error('[Attendance] save:',result.error);attendanceMessage('ثبت رویداد ناموفق بود: '+result.error.message,'error');return}
  resetAttendanceForm();await loadAttendanceEvents();renderAttendanceHistory();attendanceMessage(id?'رویداد ویرایش شد.':'رویداد با موفقیت ثبت شد.','success');
}

// فرم را با اطلاعات رویداد متعلق به خود کاربر برای ویرایش پر می‌کند.
function editAttendanceEvent(id){
  var row=attendanceCache.find(x=>x.id===id);if(!row||row.person_id!==getSession().personId){attendanceMessage('فقط رویدادهای خودتان قابل ویرایش است.','error');return}
  $('att_event_id').value=row.id;$('att_type').value=row.event_type;$('att_start_date').value=row.start_date;$('att_end_date').value=row.end_date;
  $('att_start_time').value=normalizeTime(row.start_time);$('att_end_time').value=normalizeTime(row.end_time);$('att_description').value=row.description||'';
  $('btn_att_save').textContent='ذخیره تغییرات';showAttendanceTypeFields();setAttendanceTab('form');window.scrollTo({top:0,behavior:'smooth'});
}

// حذف رویداد متعلق به کاربر جاری را درخواست می‌کند؛ RLS محدودیت نهایی را اعمال می‌کند.
async function deleteAttendanceEvent(id){
  var row=attendanceCache.find(x=>x.id===id);if(!row||row.person_id!==getSession().personId)return;
  if(!confirm('رویداد انتخاب‌شده حذف شود؟'))return;
  var {error}=await dbClient.from('attendance_events').delete().eq('id',id);
  if(error){attendanceMessage('حذف رویداد ناموفق بود: '+error.message,'error');return}
  await loadAttendanceEvents();renderAttendanceHistory();attendanceMessage('رویداد حذف شد.','success');
}

function renderAttendanceHistory(){
  var c=$('att_my_events');if(!c)return;var self=getSession().personId;
  var rows=attendanceCache.filter(x=>x.person_id===self).sort((a,b)=>jalaliToTimestamp(b.start_date)-jalaliToTimestamp(a.start_date));
  if(!rows.length){c.innerHTML='<p class="hint">هنوز رویدادی ثبت نکرده‌اید.</p>';return}
  c.innerHTML='<table><thead><tr><th>نوع رویداد</th><th>از تاریخ</th><th>تا تاریخ</th><th>ساعت</th><th>شرح</th><th>عملیات</th></tr></thead><tbody>'+rows.map(x=>'<tr><td>'+esc(ATT_TYPES[x.event_type]||x.event_type)+'</td><td>'+esc(x.start_date)+'</td><td>'+esc(x.end_date)+'</td><td>'+esc(x.start_time?normalizeTime(x.start_time)+' تا '+normalizeTime(x.end_time):'—')+'</td><td>'+esc(x.description||'—')+'</td><td><div class="att-event-actions"><button class="btn btn-warning btn-sm" data-att-edit="'+esc(x.id)+'">ویرایش</button><button class="btn btn-danger btn-sm" data-att-delete="'+esc(x.id)+'">حذف</button></div></td></tr>').join('')+'</tbody></table>';
}

// فهرست کارکنان را برای فیلتر گزارش مدیر از داده‌های همگام‌شده سامانه پر می‌کند.
function populateAttendanceReportPeople(){
  if(!isAttendanceReportAdmin())return;
  var el=$('att_report_person');if(!el)return;var old=el.value;
  el.innerHTML='<option value="">همه کارکنان</option>'+sortPersonsById(getData(KEYS.persons)).map(p=>'<option value="'+esc(p.id)+'">'+esc(p.firstName+' '+p.lastName)+'</option>').join('');
  if(old&&Array.from(el.options).some(o=>o.value===old))el.value=old;
}
function countAttendanceWorkdays(from,to){
  var count=0,holidays=new Set(getData(KEYS.holidays).map(x=>x.date));
  for(var d=from,guard=0;jalaliToTimestamp(d)<=jalaliToTimestamp(to)&&guard<4000;d=addDaysStr(d,1),guard++){
    var p=parseJalali(d),dow=getJalaliDayOfWeek(p.jy,p.jm,p.jd);if(dow>=0&&dow<=4&&!holidays.has(d))count++;
  }return count;
}
function eventWorkdays(row,from,to){
  var start=jalaliToTimestamp(row.start_date),end=jalaliToTimestamp(row.end_date),lo=jalaliToTimestamp(from),hi=jalaliToTimestamp(to);
  if(end<lo||start>hi||row.event_type==='leave_hourly')return 0;
  var a=start<lo?from:row.start_date,b=end>hi?to:row.end_date,count=0,holidays=new Set(getData(KEYS.holidays).map(x=>x.date));
  for(var d=a,guard=0;jalaliToTimestamp(d)<=jalaliToTimestamp(b)&&guard<4000;d=addDaysStr(d,1),guard++){
    var p=parseJalali(d),dow=getJalaliDayOfWeek(p.jy,p.jm,p.jd);if(dow<=4&&!holidays.has(d))count++;
  }return count;
}
// زمان‌های PostgreSQL ممکن است به‌شکل HH:mm:ss برگردند؛ محاسبه را بر مبنای HH:mm انجام می‌دهیم.
function timeToMinutes(value){var p=String(value||'').slice(0,5).split(':').map(Number);return p.length===2&&p.every(Number.isFinite)?p[0]*60+p[1]:0}
function normalizeTime(value){return value?String(value).slice(0,5):''}
function hoursBetween(start,end){return (timeToMinutes(end)-timeToMinutes(start))/60}

// داشبورد عدم حضور را فقط برای ادمین و سوپر ادمین، در سه سطح کل، افراد و جزئیات تاریخ‌دار می‌سازد.
async function generateAttendanceReport(){
  if(!isAttendanceReportAdmin()){attendanceMessage('مشاهده گزارش عدم حضور سایر کارکنان فقط برای ادمین و سوپر ادمین مجاز است.','error');return}
  var from=val('att_report_from'),to=val('att_report_to'),person=val('att_report_person');
  if(!isValidJalaliDate(from)||!isValidJalaliDate(to)||jalaliToTimestamp(to)<jalaliToTimestamp(from)){attendanceMessage('بازه گزارش معتبر نیست.','error');return}
  if(!(await loadAttendanceEvents()))return;
  var persons=getData(KEYS.persons).filter(p=>!person||p.id===person),personIds=new Set(persons.map(p=>p.id));
  var rows=attendanceCache.filter(e=>personIds.has(e.person_id)&&jalaliToTimestamp(e.start_date)<=jalaliToTimestamp(to)&&jalaliToTimestamp(e.end_date)>=jalaliToTimestamp(from));
  var workingPerPerson=countAttendanceWorkdays(from,to),summary={leave_daily:0,leave_hourly:0,mission_in:0,mission_out:0,training:0,other:0,presence:0};
  rows.forEach(e=>{if(e.event_type==='leave_hourly')summary.leave_hourly+=hoursBetween(e.start_time,e.end_time);else summary[e.event_type]=(summary[e.event_type]||0)+eventWorkdays(e,from,to)});
  var totalsByPerson=persons.map(p=>{
    var pr=rows.filter(e=>e.person_id===p.id),o={person:p,leave_daily:0,leave_hourly:0,mission_in:0,mission_out:0,training:0,other:0};
    pr.forEach(e=>{if(e.event_type==='leave_hourly')o.leave_hourly+=hoursBetween(e.start_time,e.end_time);else o[e.event_type]=(o[e.event_type]||0)+eventWorkdays(e,from,to)});
    var nonPresence=o.leave_daily+o.mission_in+o.mission_out+o.training+o.other;
    o.presence=Math.max(0,workingPerPerson-nonPresence);o.events=pr.sort((a,b)=>jalaliToTimestamp(a.start_date)-jalaliToTimestamp(b.start_date));
    o.nonPresence=nonPresence;return o;
  });
  attendanceReportRows=totalsByPerson;
  summary.presence=totalsByPerson.reduce((sum,o)=>sum+o.presence,0);
  var sumDays=key=>totalsByPerson.reduce((sum,o)=>sum+(o[key]||0),0);
  var totalWorking=workingPerPerson*persons.length;
  var totalNonPresence=sumDays('leave_daily')+sumDays('mission_in')+sumDays('mission_out')+sumDays('training')+sumDays('other');
  var missionDays=sumDays('mission_in')+sumDays('mission_out');
  var summaryItems=[
    ['تعداد افراد',persons.length+' نفر'],['روزهای کاری دوره',totalWorking+' روز'],['حضور عادی',summary.presence+' روز'],
    ['کل روزهای عدم حضور/ماموریت/آموزش',totalNonPresence+' روز'],['مرخصی روزانه',sumDays('leave_daily')+' روز'],
    ['مرخصی ساعتی',sumDays('leave_hourly').toFixed(2)+' ساعت'],['مأموریت داخل و خارج استان',missionDays+' روز'],
    ['دوره آموزشی',sumDays('training')+' روز'],['سایر موارد',sumDays('other')+' روز'],['رویدادهای ثبت‌شده',rows.length+' مورد']
  ];
  $('att_report_summary').innerHTML='<div class="att-dashboard-heading"><strong>نمای کلی وضعیت عدم حضور</strong><span>'+esc(from)+' تا '+esc(to)+'</span></div>'+summaryItems.map((x,i)=>'<div class="att-summary-item '+(i===3?'att-summary-total':'')+'"><strong>'+esc(x[1])+'</strong><span>'+esc(x[0])+'</span></div>').join('');
  var peopleHtml=totalsByPerson.map(o=>{
    var name=o.person.firstName+' '+o.person.lastName;
    var eventRows=o.events.map(e=>{
      var clippedStart=jalaliToTimestamp(e.start_date)<jalaliToTimestamp(from)?from:e.start_date;
      var clippedEnd=jalaliToTimestamp(e.end_date)>jalaliToTimestamp(to)?to:e.end_date;
      var duration=e.event_type==='leave_hourly'?hoursBetween(e.start_time,e.end_time).toFixed(2)+' ساعت':eventWorkdays(e,from,to)+' روز کاری';
      return '<tr><td>'+esc(ATT_TYPES[e.event_type]||e.event_type)+'</td><td>'+esc(clippedStart)+'</td><td>'+esc(clippedEnd)+'</td><td>'+esc(e.start_time?normalizeTime(e.start_time)+' تا '+normalizeTime(e.end_time):'—')+'</td><td>'+esc(duration)+'</td><td>'+esc(e.description||'—')+'</td></tr>';
    }).join('');
    return '<details class="att-person-detail"><summary><span class="att-person-name">'+esc(name)+'</span><span class="att-person-metric">حضور '+o.presence+' روز</span><span class="att-person-metric">مرخصی '+o.leave_daily+' روز</span><span class="att-person-metric">ماموریت '+(o.mission_in+o.mission_out)+' روز</span><span class="att-person-event-count">'+o.events.length+' رویداد</span></summary><div class="att-person-detail-body"><div class="att-person-kpis"><span>مرخصی ساعتی: <b>'+o.leave_hourly.toFixed(2)+' ساعت</b></span><span>آموزش: <b>'+o.training+' روز</b></span><span>سایر: <b>'+o.other+' روز</b></span></div>'+(eventRows?'<div class="table-wrap"><table><thead><tr><th>نوع رویداد</th><th>از تاریخ</th><th>تا تاریخ</th><th>ساعت</th><th>مدت</th><th>شرح</th></tr></thead><tbody>'+eventRows+'</tbody></table></div>':'<p class="hint">برای این فرد در بازه انتخابی رویدادی ثبت نشده است.</p>')+'</div></details>';
  }).join('');
  $('att_report_results').innerHTML='<div class="att-dashboard-heading"><strong>وضعیت افراد و جزئیات رویدادها</strong><span>'+totalsByPerson.length+' نفر</span></div>'+
    '<div class="table-wrap"><table class="att-people-summary"><thead><tr><th>کارمند</th><th>حضور عادی</th><th>مرخصی روزانه</th><th>مرخصی ساعتی</th><th>ماموریت داخل</th><th>ماموریت خارج</th><th>آموزش</th><th>سایر</th><th>رویداد</th></tr></thead><tbody>'+
    (totalsByPerson.map(o=>'<tr><td>'+esc(o.person.firstName+' '+o.person.lastName)+'</td><td>'+o.presence+'</td><td>'+o.leave_daily+'</td><td>'+o.leave_hourly.toFixed(2)+'</td><td>'+o.mission_in+'</td><td>'+o.mission_out+'</td><td>'+o.training+'</td><td>'+o.other+'</td><td>'+o.events.length+'</td></tr>').join('')||'<tr><td colspan="9">فردی برای نمایش یافت نشد.</td></tr>')+
    '</tbody></table></div><div class="att-person-details-list">'+(peopleHtml||'<p class="hint">اطلاعاتی برای این بازه وجود ندارد.</p>')+'</div>';
  attendanceReportMeta={from:from,to:to,peopleCount:persons.length,totals:{working:totalWorking,presence:summary.presence,nonPresence:totalNonPresence,leaveDaily:sumDays('leave_daily'),leaveHourly:sumDays('leave_hourly'),missionIn:sumDays('mission_in'),missionOut:sumDays('mission_out'),training:sumDays('training'),other:sumDays('other'),eventCount:rows.length}};
}
function csvCell(value){return '"'+String(value==null?'':value).replace(/"/g,'""')+'"'}
// خروجی CSV شامل خلاصه کلی، خلاصه هر فرد و ریز رویدادهای تاریخ‌دار است.
function exportAttendanceCsv(){
  if(!isAttendanceReportAdmin()){attendanceMessage('دریافت گزارش عدم حضور دیگران فقط برای ادمین و سوپر ادمین مجاز است.','error');return}
  if(!attendanceReportRows.length){attendanceMessage('ابتدا گزارش را تهیه کنید.','error');return}
  var meta=attendanceReportMeta||{},totals=meta.totals||{};
  var lines=[['گزارش عدم حضور','بازه',(meta.from||'')+' تا '+(meta.to||'')].map(csvCell).join(',')];
  lines.push(['خلاصه کلی','تعداد افراد','روزهای کاری','حضور عادی (روز)','کل روزهای عدم حضور/ماموریت/آموزش','مرخصی روزانه (روز)','مرخصی ساعتی (ساعت)','ماموریت داخل استان (روز)','ماموریت خارج استان (روز)','آموزش (روز)','سایر (روز)','تعداد رویداد'].map(csvCell).join(','));
  lines.push(['کل',meta.peopleCount||0,totals.working||0,totals.presence||0,totals.nonPresence||0,totals.leaveDaily||0,Number(totals.leaveHourly||0).toFixed(2),totals.missionIn||0,totals.missionOut||0,totals.training||0,totals.other||0,totals.eventCount||0].map(csvCell).join(','));
  lines.push('');lines.push(['خلاصه افراد','کارمند','حضور عادی (روز)','مرخصی روزانه (روز)','مرخصی ساعتی (ساعت)','مأموریت داخل استان (روز)','مأموریت خارج استان (روز)','دوره آموزشی (روز)','سایر (روز)','تعداد رویداد'].map(csvCell).join(','));
  attendanceReportRows.forEach(o=>lines.push(['خلاصه',o.person.firstName+' '+o.person.lastName,o.presence,o.leave_daily,o.leave_hourly.toFixed(2),o.mission_in,o.mission_out,o.training,o.other,(o.events||[]).length].map(csvCell).join(',')));
  lines.push('');lines.push(['جزئیات رویدادها','کارمند','نوع رویداد','از تاریخ','تا تاریخ','ساعت شروع','ساعت پایان','مدت در بازه گزارش','شرح'].map(csvCell).join(','));
  attendanceReportRows.forEach(o=>(o.events||[]).forEach(e=>{
    var from=(attendanceReportMeta||{}).from||val('att_report_from'),to=(attendanceReportMeta||{}).to||val('att_report_to');
    var a=jalaliToTimestamp(e.start_date)<jalaliToTimestamp(from)?from:e.start_date,b=jalaliToTimestamp(e.end_date)>jalaliToTimestamp(to)?to:e.end_date;
    lines.push(['جزئیات',o.person.firstName+' '+o.person.lastName,ATT_TYPES[e.event_type]||e.event_type,a,b,normalizeTime(e.start_time),normalizeTime(e.end_time),e.event_type==='leave_hourly'?hoursBetween(e.start_time,e.end_time).toFixed(2)+' ساعت':eventWorkdays(e,from,to)+' روز کاری',e.description||''].map(csvCell).join(','));
  }));
  var blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='attendance-dashboard-'+getTodayJalali().replaceAll('/','-')+'.csv';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}


function bindEvents(){
  document.querySelectorAll('[data-toggle-module-switcher]').forEach(b=>b.addEventListener('click',toggleModuleSwitcher));
  document.addEventListener('click',e=>{if(!e.target.closest('#module_switcher_panel,[data-toggle-module-switcher]'))closeModuleSwitcher()});
  on('module_switcher_panel','click',e=>{var close=e.target.closest('[data-close-module-switcher]');if(close){closeModuleSwitcher();return}var home=e.target.closest('[data-open-module-home]');if(home){showModuleHome();return}var target=e.target.closest('[data-switch-to-module]');if(target)openModule(target.dataset.switchToModule)});
  on('btn_attendance_theme','click',toggleTheme);
  on('btn_home_logout','click',handleLogout);
  on('btn_home_password','click',openChangePasswordModal);
  on('btn_attendance_logout','click',handleLogout);
  on('btn_attendance_password','click',openChangePasswordModal);
  on('module_search','input',renderModuleHome);
  on('module_cards','click',e=>{var fav=e.target.closest('[data-fav-module]');if(fav){e.stopPropagation();toggleModuleFavorite(fav.dataset.favModule);return}var b=e.target.closest('[data-open-module]');if(b)openModule(b.dataset.openModule)});
  on('module_cards','keydown',e=>{if(e.key==='Enter'||e.key===' '){var b=e.target.closest('[data-open-module]');if(b&&!e.target.closest('[data-fav-module]')){e.preventDefault();openModule(b.dataset.openModule)}}});
  on('module_shortcuts','click',e=>{var b=e.target.closest('[data-open-module]');if(b)openModule(b.dataset.openModule)});
  on('module_admin_list','click',e=>{var b=e.target.closest('[data-save-module-title]');if(b)saveModuleTitle(b.dataset.saveModuleTitle)});
  on('module_access_admin_list','change',e=>{var cb=e.target.closest('[data-module-access-person]');if(cb)savePersonModuleAccess(cb.dataset.moduleAccessPerson,cb.dataset.moduleAccessId,cb.checked)});
  on('att_type','change',showAttendanceTypeFields);
  on('att_start_date','change',()=>{if(val('att_type')==='leave_hourly')$('att_end_date').value=val('att_start_date')});
  on('btn_att_save','click',saveAttendanceEvent);
  on('btn_att_reset','click',resetAttendanceForm);
  on('btn_att_refresh','click',()=>loadAttendanceEvents().then(renderAttendanceHistory));
  on('att_my_events','click',e=>{var ed=e.target.closest('[data-att-edit]'),del=e.target.closest('[data-att-delete]');if(ed)editAttendanceEvent(ed.dataset.attEdit);if(del)deleteAttendanceEvent(del.dataset.attDelete)});
  document.querySelectorAll('[data-att-tab]').forEach(b=>b.addEventListener('click',()=>setAttendanceTab(b.dataset.attTab)));
  on('btn_att_report','click',generateAttendanceReport);
  on('btn_att_report_csv','click',exportAttendanceCsv);
  on('btn_att_report_print','click',()=>{if(!isAttendanceReportAdmin()){attendanceMessage('چاپ گزارش عدم حضور دیگران فقط برای ادمین و سوپر ادمین مجاز است.','error');return}if(!attendanceReportRows.length){attendanceMessage('ابتدا گزارش را تهیه کنید.','error');return}window.print()});
  on('main_nav','click',e=>{var b=e.target.closest('button');if(b&&b.dataset.target)showSection(b.dataset.target)});
  on('btn_sync_cloud','click',()=>syncFromCloud(true));
  on('btn_logout','click',handleLogout);
  on('btn_change_password','click',openChangePasswordModal);
  on('btn_submit_change_pass','click',submitChangePassword);
  on('btn_cancel_change_pass','click',()=>$('modal_change_password').classList.add('hidden'));
  on('btn_login','click',handleLogin);
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
  ['act_end_date'].forEach(k=>on(k,'change',updateCalculatedHours));
  on('act_start_date','change',()=>{updateCalculatedHours();renderDayActs()});
  delegate('day_acts_container',(a,id)=>{if(a==='edit')editAct(id);else if(a==='delete')deleteAct(id);else if(a==='join')joinActivity(id)});

  ['rec_person','rec_topic','rec_imp','rec_from','rec_to'].forEach(k=>on(k,'change',renderRecords));
  on('rec_search','input',debounce(renderRecords,250));
  on('btn_clear_rec','click',()=>{
    $('rec_person').value='';$('rec_topic').value='';$('rec_imp').value='';$('rec_search').value='';
    // پاک‌سازی فیلترها، بازه پیش‌فرض ماه جاری را حفظ می‌کند.
    var p=getTodayJalali().split('/'),y=parseInt(p[0],10),m=parseInt(p[1],10);
    $('rec_from').value=fmtJalali(y,m,1);
    $('rec_to').value=fmtJalali(y,m,jalaliMonthLength(y,m));
    renderRecords();
  });
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
  initTheme();
  document.addEventListener('click',closePopups);
  loadAppVersion();
  bindEvents();
  initDatepickers();
  initTimePickers();
  
  var dbReady=await initDbClient();
  if(dbReady)startConnectionMonitor();else setConnectionStatus('offline');

  if(!dbReady||!navigator.onLine){ await showLogin(); return; }

  const { data: { session } } = await dbClient.auth.getSession();
  if(!session){ await showLogin(); return; }

  const { data: person, error } = await dbClient.from('persons').select('*').eq('user_id', session.user.id).single();
  if (error || !person) { await dbClient.auth.signOut(); await showLogin(); return; }

  setSession({ personId: person.id, username: person.username, role: person.role, name: person.firstname + ' ' + person.lastname });
  
  if (person.must_change_password) { showForcePasswordChange(session.user.id); return; }
  
  if(!navigator.onLine){await dbClient.auth.signOut();clearSession();await showLogin();return}
  await loadModuleCatalog();await loadModuleAccess();
  var initialSync=await syncFromCloud(false);
  if(!initialSync.ok){
    await dbClient.auth.signOut();clearSession();
    await showLogin();
    showAlert('برای اجرای برنامه اتصال پایدار به سرور لازم است.','error');
    return;
  }
  await startApp();
}

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

})();
