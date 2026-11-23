'use strict';
/* Extracted from the original 4.3.3 application without changing business logic. */
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

