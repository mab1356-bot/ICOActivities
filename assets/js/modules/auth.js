'use strict';
/* Extracted from the original 4.3.3 application without changing business logic. */

/**
 * محدود کردن زمان انتظار درخواست‌های شبکه؛ درخواست اصلی در پس‌زمینه متوقف نمی‌شود،
 * اما رابط کاربری پس از پایان مهلت می‌تواند خطا را مدیریت کند.
 */
function withTimeout(task, timeoutMs, label) {
  var timer;
  var work = Promise.resolve().then(function () {
    return typeof task === 'function' ? task() : task;
  });
  var timeout = new Promise(function (_, reject) {
    timer = setTimeout(function () {
      var err = new Error((label || 'درخواست') + ' بیش از زمان مجاز طول کشید.');
      err.name = 'TimeoutError';
      reject(err);
    }, timeoutMs);
  });
  return Promise.race([work, timeout]).finally(function () {
    clearTimeout(timer);
  });
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
  if(!dbClient){showAlert((window.dbInitError||'اتصال به پایگاه داده آماده نیست.')+'؛ تنظیمات اتصال و بارگذاری کتابخانه Supabase را بررسی کنید.','error');return}
  if(!navigator.onLine){showAlert('برای ورود باید به اینترنت متصل باشید.','error');return}

  var btn=$('btn_login');
  if(btn && btn.dataset.busy==='1')return;
  if(btn){btn.dataset.busy='1';btn.disabled=true;btn.textContent='در حال بررسی...'}
  showAlert('⏳ در حال بررسی...','info');

  try {
    const result = await withTimeout(
      () => dbClient.auth.signInWithPassword({ email: username + '@app.com', password }),
      15000,
      'ورود به سامانه'
    );
    const data=result.data,error=result.error;

    if (error) {
      showAlert(error.message.includes('Invalid login credentials') ? '❌ نام کاربری یا کلمه عبور نادرست است.' : '❌ خطا: ' + error.message, 'error');
      return;
    }

    const profileResult = await withTimeout(
      () => dbClient.from('persons').select('*').eq('user_id', data.user.id).single(),
      12000,
      'دریافت پروفایل کاربر'
    );
    const person=profileResult.data,personError=profileResult.error;

    if (personError || !person) {
      showAlert('❌ اطلاعات پروفایل یافت نشد.\nدلیل: ' + (personError ? personError.message : 'رکوردی یافت نشد'), 'error');
      await withTimeout(() => dbClient.auth.signOut(), 5000, 'خروج از حساب').catch(()=>{});
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
  } catch (err) {
    console.error('[Auth] Login failed:', err);
    showAlert(err.name==='TimeoutError'
      ? '⏱️ پاسخ سرور در زمان مقرر دریافت نشد. اتصال اینترنت و تنظیمات Supabase را بررسی و دوباره تلاش کنید.'
      : '❌ خطا در ورود: ' + (err.message || 'خطای نامشخص'), 'error');
  } finally {
    if(btn){btn.dataset.busy='0';btn.disabled=false;btn.textContent='ورود'}
  }
}

// انتشار handler در سطح window برای فراخوانی مستقیم HTML و اتصال مستقل از App.js.
window.handleLogin = handleLogin;

// اتصال مستقیم در ماژول احراز هویت؛ حتی اگر App.js به هر دلیل اجرا نشود.
(function bindLoginButtonFromAuthModule(){
  var button = document.getElementById('btn_login');
  if (!button || button.dataset.authBound === '1') return;
  button.dataset.authBound = '1';
  button.addEventListener('click', function(event){
    event.preventDefault();
    if (button.dataset.busy === '1') return;
    Promise.resolve().then(function(){ return handleLogin(); }).catch(function(error){
      console.error('[Auth] Login button handler failed:', error);
      button.dataset.busy = '0';
      button.disabled = false;
      button.textContent = 'ورود';
      showAlert('اجرای عملیات ورود با خطا مواجه شد: ' + (error && error.message ? error.message : 'خطای نامشخص'), 'error');
    });
  }, true);
})();

async function handleSetup(){
  if(!navigator.onLine||!dbClient){showAlert('برای ایجاد حساب باید به اینترنت متصل باشید.','error');return}
  var first=val('setup_first'),last=val('setup_last'),pid=val('setup_pid'),username=val('setup_username'),password=$('setup_password').value;
  if(!first||!last||!pid||!username||!password){showAlert('همه فیلدها الزامی.');return}
  if(!/^\d{1,6}$/.test(pid)){showAlert('شماره پرسنلی معتبر نیست.');return}
  if(password.length<MIN_PASSWORD_LEN){showAlert('رمز حداقل '+MIN_PASSWORD_LEN+' کاراکتر.');return}

  showAlert('⏳ در حال ایجاد حساب...','info');

  try {
    const { data, error } = await withTimeout(
      () => dbClient.functions.invoke('setup-admin', {
        body: { username, firstname: first, lastname: last, personnelid: pid, password }
      }),
      20000,
      'ایجاد حساب مدیر اصلی'
    );

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
  $('login_modal').style.display='flex';
  $('main_app').style.display='none';
  $('user_info').style.display='none';
  var lb=$('login_alert_box');
  if(lb){lb.style.display='none';lb.textContent='';lb.className='alert'}
  $('btn_login').disabled=false;

  var flash=sessionStorage.getItem('actbk_flash');
  var loginForm=$('login_form'),setupForm=$('setup_form'),title=$('login_title'),msg=$('login_msg');

  // فرم ورود همیشه در دسترس می‌ماند؛ خطای RPC نباید کل فرم را مخفی کند.
  if(loginForm)loginForm.classList.remove('hidden');
  if(setupForm)setupForm.classList.add('hidden');
  if(title)title.textContent='ورود به سیستم';
  if(msg)msg.textContent='لطفاً نام کاربری و کلمه عبور خود را وارد کنید.';

  if(!dbClient||!navigator.onLine){
    setConnectionStatus('offline');
    if(title)title.textContent='عدم اتصال';
    if(msg)msg.textContent=(window.dbInitError||'اتصال به دیتابیس برقرار نیست.')+' برای ورود باید به اینترنت متصل باشید.';
  }else{
    setConnectionStatus('checking');
    try {
      const result = await withTimeout(
        () => dbClient.rpc('check_has_users'),
        10000,
        'بررسی کاربران سامانه'
      );
      const hasUsers=result.data,error=result.error;

      if(error){
        console.warn('[Auth] check_has_users failed:',error.message);
        setConnectionStatus('offline');
        if(title)title.textContent='عدم امکان بررسی کاربران';
        if(msg)msg.textContent='ارتباط با پایگاه داده برقرار نشد یا تابع بررسی کاربران پاسخ معتبر نداد. می‌توانید دوباره تلاش کنید یا اطلاعات ورود را وارد کنید.';
      }else if(!hasUsers){
        if(loginForm)loginForm.classList.add('hidden');
        if(setupForm)setupForm.classList.remove('hidden');
        if(title)title.textContent='ایجاد حساب مدیر اصلی';
        if(msg)msg.innerHTML='👋 به برنامه خوش آمدید.<br>لطفاً اولین حساب را ایجاد کنید.';
        setConnectionStatus('online',activeServerName);
      }else{
        if(loginForm)loginForm.classList.remove('hidden');
        if(setupForm)setupForm.classList.add('hidden');
        if(title)title.textContent='ورود به سیستم';
        if(msg)msg.textContent='لطفاً نام کاربری و کلمه عبور خود را وارد کنید.';
        setConnectionStatus('online',activeServerName);
      }
    } catch(err) {
      console.warn('[Auth] User check unavailable:',err);
      setConnectionStatus('offline');
      if(title)title.textContent='عدم پاسخ‌گویی سرور';
      if(msg)msg.textContent=err.name==='TimeoutError'
        ? 'سرور در زمان مقرر پاسخ نداد. تنظیمات اتصال و اینترنت را بررسی کنید؛ سپس «تلاش مجدد» را بزنید. در صورت معتبر بودن اطلاعات ورود، امکان تلاش برای ورود نیز وجود دارد.'
        : 'بررسی وضعیت کاربران با خطا مواجه شد. می‌توانید دوباره تلاش کنید.';
    }
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
  if(!cfg||!cfg.url||!cfg.key||String(cfg.url).includes('YOUR_')||/^(my key is hear|your[_ -].*|replace[_ -].*)$/i.test(String(cfg.key).trim())){
    window.dbInitError='پیکربندی Supabase در config.js ناقص است؛ آدرس پروژه و کلید عمومی معتبر را وارد کنید.';
    return false;
  }
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
      const result=await withTimeout(
        () => dbClient.rpc('check_has_users'),
        8000,
        'بررسی اتصال پایگاه داده'
      );
      if(!result.error){setConnectionStatus('online',activeServerName);return true}
      console.warn('[Conn] check failed:',result.error.message);
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

var _connListenersBound=false;
function startConnectionMonitor(){
  if(_connTimer)clearInterval(_connTimer);
  // بررسی اولیه بلافاصله اجرا می‌شود؛ منتظر چرخه ۶۰ ثانیه‌ای نمی‌مانیم.
  checkDbConnection();
  _connTimer=setInterval(()=>{if(document.visibilityState==='visible')connectionTick()},60000);
  if(!_connListenersBound){
    _connListenersBound=true;
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')connectionTick()});
    window.addEventListener('online',()=>checkDbConnection());
    window.addEventListener('offline',()=>{setConnectionStatus('offline');if(getSession())forceLogout('اتصال اینترنت قطع شد.')});
  }
}

