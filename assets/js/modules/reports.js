'use strict';
/* Extracted from the original 4.3.3 application without changing business logic. */
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
    var trs=data.list.slice().sort((x,y)=>jalaliToTimestamp(x.date)-jalaliToTimestamp(y.date)).map(x=>'<tr><td>'+esc(topicName(x.topicId))+'</td><td>'+esc(fmtHours(x.hours))+'</td><td>'+esc(x.description)+'</td><td>'+esc(x.location||'—')+'</td></tr>').join('');
    h+='<div class="db-details-page"><div class="db-box"><h3>ریز اقدامات</h3><div class="table-wrap"><table><tr><th>موضوع</th><th>مدت</th><th>شرح</th><th>محل</th></tr>'+trs+'</table></div></div></div>';
  }
  h+='</div>';
  $('report_area').innerHTML=h;return true;
}

function printReport(){var c=$('report_area');if(!c.querySelector('.dashboard-report')){showAlert('ابتدا گزارش را تولید کنید.');return}$('print_area').innerHTML=c.innerHTML;window.print()}
function printData(containerId,needTable){var c=$(containerId);if(!c.innerHTML.trim()||(needTable&&!c.querySelector('table'))){showAlert('موردی برای چاپ نیست.');return}var HEAD='<div style="text-align:center;border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:20px"><h2>واحد کنترل و نظارت پروژه‌های سرمایه‌گذاری</h2></div>';var SIGN='<div style="margin-top:50px;display:flex;justify-content:space-between"><div>امضای کاربر: ............................</div><div>امضای مسئول: ............................</div></div>';$('print_area').innerHTML=HEAD+'<div>'+c.innerHTML+'</div>'+SIGN;window.print()}

function exportWord(){
  if(!generateReport())return;
  var c=$('report_area');var content=c.innerHTML;
  var style='<style>@page{size:A4 landscape;margin:1cm}body{font-family:"Vazirmatn",Tahoma,sans-serif;direction:rtl;font-size:12pt;color:#222}.db-header{text-align:center;border-bottom:3px solid #c9a227;padding-bottom:10px;margin-bottom:20px}.db-header h1{font-size:20pt;margin:0 0 6pt 0;color:#1a2530}.db-header p{font-size:11pt;color:#555;margin:0}.db-kpi-grid{display:block;margin-bottom:20px;text-align:center}.db-kpi{display:inline-block;width:22%;margin:0 1% 10px 1%;padding:10px;border:1px solid #ddd;text-align:center;vertical-align:top}.db-kpi-val{font-size:18pt;color:#1a2530;margin-bottom:4pt}.db-kpi-title{font-size:10pt;color:#555}.db-section-bar{background:#1a2530;color:white;padding:8px;text-align:center;margin-bottom:15px;font-size:14pt}.db-columns{display:block}.db-col{display:inline-block;width:45%;margin:5px 2% 15px 2%;border:1px solid #ccc;vertical-align:top;page-break-inside:avoid}.db-col-header{background:#2980b9;color:white;padding:6px;text-align:center;font-size:12pt}.db-col-body{padding:8px}.db-box{border:1px solid #ccc;padding:10px;margin-bottom:15px;page-break-inside:avoid}.db-box h3{font-size:13pt;margin:0 0 8px 0;border-bottom:2px solid #eee;padding-bottom:4px}.db-details-page{page-break-before:always}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:4pt;text-align:right}th{background:#eee;font-size:11pt}ul{margin:0;padding-right:18pt}li{margin-bottom:4pt;font-size:11pt}</style>';
  var html='<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><title>گزارش عملکرد</title>'+style+'</head><body>'+content+'</body></html>';
  var blob=new Blob(['\ufeff',html],{type:'application/msword'});
  var url=URL.createObjectURL(blob);var a=document.createElement('a');
  a.href=url;a.download='report_'+getTodayJalali().replace(/\//g,'-')+'.doc';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  showAlert('فایل Word دانلود شد.','success');
}
function chunkArray(arr,size){var out=[];for(var i=0;i<arr.length;i+=size)out.push(arr.slice(i,i+size));return out}
async function exportPPTX(){
  if(typeof PptxGenJS==='undefined'){showAlert('کتابخانه PowerPoint لود نشده.','error');return}
  var data=gatherReportData();if(!data){showAlert('ابتدا بازه را انتخاب کنید.','error');return}
  var pptx=new PptxGenJS();pptx.rtlMode=true;pptx.layout='LAYOUT_WIDE';var FONT='Vazirmatn';
  var slide=pptx.addSlide();slide.background={color:'1a2530'};
  slide.addText('عملکرد واحد کنترل و نظارت',{x:.5,y:2.2,w:12.3,h:1.5,fontSize:32,bold:true,color:'FFFFFF',align:'center',fontFace:FONT,rtlMode:true});
  slide.addText('دوره: '+data.periodTitle,{x:.5,y:3.9,w:12.3,h:1,fontSize:20,color:'c9a227',align:'center',fontFace:FONT,rtlMode:true});
  slide=pptx.addSlide();
  slide.addText('شاخص‌های کلیدی',{x:.5,y:.2,w:12.3,h:.7,fontSize:26,bold:true,color:'1a2530',align:'center',fontFace:FONT,rtlMode:true});
  var pal=['3498db','2c3e50','16a085','f39c12','9b59b6','e74c3c'];
  var kpis=[{val:String(data.totalActs),title:'فعالیت‌ها',color:'8e6c3e'}].concat(data.topicStats.map((s,i)=>({val:String(s.count),title:s.name,color:pal[i%pal.length]})),[{val:fmtPersonHours(data.totalPersonHours),title:'نفر-ساعت',color:'27ae60'}]);
  var kw=Math.min(3,12.4/kpis.length-.2);
  kpis.forEach((kpi,i)=>{
    var x=.3+i*(kw+.2);
    slide.addShape(pptx.ShapeType.rect,{x,y:1.3,w:kw,h:2.6,fill:{color:'FFFFFF'},line:{color:'DDDDDD',width:1}});
    slide.addShape(pptx.ShapeType.rect,{x,y:1.3,w:.12,h:2.6,fill:{color:kpi.color}});
    slide.addText(kpi.val,{x,y:1.7,w:kw,h:1.2,fontSize:30,bold:true,color:'1a2530',align:'center',fontFace:FONT});
    slide.addText(kpi.title,{x,y:3,w:kw,h:.7,fontSize:13,color:'555',align:'center',fontFace:FONT,rtlMode:true});
  });
  var keyTopics=Object.keys(data.topicsData).filter(tid=>data.topicsData[tid].acts.some(a=>isKeyImp(a.importance)));
  var topicColors=['2980b9','16a085','f39c12','27ae60','2c3e50'];
  for(var i=0;i<keyTopics.length;i+=2){
    slide=pptx.addSlide();
    slide.addText('اقدامات کلیدی — '+data.periodTitle,{x:.5,y:.15,w:12.3,h:.6,fontSize:20,bold:true,color:'1a2530',align:'center',fontFace:FONT,rtlMode:true});
    for(var j=0;j<2&&i+j<keyTopics.length;j++){
      var tid=keyTopics[i+j];var topic=data.topicsData[tid];var viActs=topic.acts.filter(a=>isKeyImp(a.importance));
      var x=.3+j*6.4;var color=topicColors[(i+j)%topicColors.length];
      slide.addShape(pptx.ShapeType.rect,{x,y:.85,w:6.2,h:6.2,fill:{color},line:{color}});
      slide.addText(topic.name+' ('+viActs.length+')',{x,y:.85,w:6.2,h:.55,fontSize:16,bold:true,color:'FFFFFF',align:'center',fontFace:FONT,rtlMode:true});
      var text=viActs.map(a=>'• '+a.description+(a.location?' — '+a.location:'')).join('\n');
      slide.addText(text,{x:x+.12,y:1.45,w:5.96,h:5.5,fontSize:11,color:'FFFFFF',align:'right',fontFace:FONT,valign:'top',rtlMode:true});
    }
  }
  if($('rep_details').checked){
    var chunks=chunkArray(data.list.slice().sort((x,y)=>jalaliToTimestamp(x.date)-jalaliToTimestamp(y.date)),12);
    chunks.forEach((chunk,ci)=>{
      slide=pptx.addSlide();
      slide.addText('ریز اقدامات ('+(ci+1)+'/'+chunks.length+')',{x:.5,y:.15,w:12.3,h:.55,fontSize:18,bold:true,color:'1a2530',align:'center',fontFace:FONT,rtlMode:true});
      var rows=chunk.map(a=>[{text:a.date,options:{fontSize:9,align:'center',fontFace:FONT}},{text:topicName(a.topicId),options:{fontSize:9,align:'right',fontFace:FONT,rtlMode:true}},{text:String(a.hours),options:{fontSize:9,align:'center',fontFace:FONT}},{text:a.description,options:{fontSize:9,align:'right',fontFace:FONT,rtlMode:true}},{text:a.location||'—',options:{fontSize:9,align:'right',fontFace:FONT,rtlMode:true}}]);
      var header=[{text:'تاریخ',options:{fontSize:10,bold:true,fill:{color:'2c3e50'},color:'FFFFFF',align:'center',fontFace:FONT}},{text:'موضوع',options:{fontSize:10,bold:true,fill:{color:'2c3e50'},color:'FFFFFF',align:'center',fontFace:FONT}},{text:'مدت',options:{fontSize:10,bold:true,fill:{color:'2c3e50'},color:'FFFFFF',align:'center',fontFace:FONT}},{text:'شرح',options:{fontSize:10,bold:true,fill:{color:'2c3e50'},color:'FFFFFF',align:'center',fontFace:FONT}},{text:'محل',options:{fontSize:10,bold:true,fill:{color:'2c3e50'},color:'FFFFFF',align:'center',fontFace:FONT}}];
      slide.addTable([header].concat(rows),{x:.3,y:.8,w:12.7,border:{type:'solid',color:'CCCCCC',pt:1},colW:[1.2,1.8,.8,6.9,2]});
    });
  }
  try{await pptx.writeFile({fileName:'report_'+getTodayJalali().replace(/\//g,'-')+'.pptx'});showAlert('فایل PowerPoint دانلود شد.','success')}
  catch(e){showAlert('خطا: '+e.message,'error')}
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

