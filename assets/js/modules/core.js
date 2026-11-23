'use strict';
/* Extracted from the original 4.3.3 application without changing business logic. */
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

