
var firebaseConfig = {
  apiKey: "AIzaSyCcBgBlItDHOZsniGNX_axdbcZBgZoNxjI",
  authDomain: "asistencia-gm.firebaseapp.com",
  projectId: "asistencia-gm",
  storageBucket: "asistencia-gm.firebasestorage.app",
  messagingSenderId: "611811626340",
  appId: "1:611811626340:web:d68b2a3c57d06ce64e7e71"
};
firebase.initializeApp(firebaseConfig);
var db = firebase.firestore();

var MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
var DIAS = ['Lun','Mar','Mie','Jue','Vie','Sab','Dom'];

var state = {
  tab:'calendar', view:'calendar',
  year:new Date().getFullYear(), month:new Date().getMonth(),
  selectedDate:null, data:{},
  form:{name:'',acts:'',obs:''},
  search:{query:'',from:'',to:'',patient:null}
};

function showToast(msg){
  var t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  setTimeout(function(){t.classList.remove('show');},2500);
}
function hideLoading(){document.getElementById('loading').style.display='none';}
function showLoading(msg){
  var el=document.getElementById('loading');
  el.style.display='flex';
  el.querySelector('.loading-text').textContent=msg||'Cargando...';
}

function loadAllData(){
  db.collection('asistencia').get().then(function(snap){
    snap.forEach(function(d){state.data[d.id]=d.data().patients||[];});
    hideLoading(); render();
  }).catch(function(e){
    console.error('Firebase error:',e);
    hideLoading(); showToast('Error al conectar: '+e.message); render();
  });
}

function saveDay(dateKey){
  return db.collection('asistencia').doc(dateKey).set({patients:state.data[dateKey]||[]})
    .then(function(){showToast('Guardado');})
    .catch(function(e){showToast('Error al guardar: '+e.message);});
}

function key(y,m,d){return y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');}
function initials(n){return n.trim().split(' ').slice(0,2).map(function(w){return w[0]||'';}).join('').toUpperCase()||'?';}
function fmtDate(k){var p=k.split('-').map(Number);return p[2]+' de '+MESES[p[1]-1]+' '+p[0];}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function updateBadge(){
  var all=new Set();
  Object.values(state.data).forEach(function(list){list.forEach(function(p){all.add(p.name.trim().toLowerCase());});});
  var n=all.size;
  document.getElementById('patient-count').textContent=n+' '+(n===1?'paciente':'pacientes');
}

function switchTab(tab){
  state.tab=tab;
  if(tab==='calendar') state.view='calendar';
  state.search.patient=null;
  document.getElementById('tab-calendar').classList.toggle('active',tab==='calendar');
  document.getElementById('tab-search').classList.toggle('active',tab==='search');
  render();
}

function getAllPatients(){
  var map={};
  Object.entries(state.data).forEach(function(e){
    e[1].forEach(function(p){
      var n=p.name.trim().toLowerCase();
      if(!map[n]) map[n]={name:p.name,count:0};
      map[n].count++;
    });
  });
  return Object.values(map).sort(function(a,b){return a.name.localeCompare(b.name);});
}

function getHistory(name,from,to){
  var entries=[];
  Object.entries(state.data).sort(function(a,b){return a[0].localeCompare(b[0]);}).forEach(function(e){
    var date=e[0],list=e[1];
    if(from&&date<from) return;
    if(to&&date>to) return;
    list.forEach(function(p){
      if(p.name.trim().toLowerCase()===name.trim().toLowerCase()) entries.push(Object.assign({date:date},p));
    });
  });
  return entries;
}

function render(){
  var el=document.getElementById('main');
  el.innerHTML=state.tab==='calendar'
    ?(state.view==='calendar'?renderCal():renderDay())
    :renderSearch();
  updateBadge();
}

function renderCal(){
  var y=state.year,m=state.month;
  var first=new Date(y,m,1).getDay();
  var offset=first===0?6:first-1;
  var days=new Date(y,m+1,0).getDate();
  var today=new Date();
  var cells='';
  for(var i=0;i<offset;i++) cells+='<div class="cal-cell empty"></div>';
  for(var d=1;d<=days;d++){
    var k=key(y,m,d);
    var isToday=today.getFullYear()===y&&today.getMonth()===m&&today.getDate()===d;
    var hasDot=state.data[k]&&state.data[k].length>0;
    cells+='<div class="cal-cell'+(isToday?' today':'')+(hasDot?' has-data':'')+'" onclick="openDay(\"'+k+'\")">'
      +'<span class="cal-num">'+d+'</span>'+(hasDot?'<span class="cal-dot"></span>':'')+'</div>';
  }
  return '<div class="section-label">Control de asistencia</div>'
    +'<div class="card">'
    +'<div class="cal-header"><span class="cal-month">'+MESES[m]+' '+y+'</span>'
    +'<div class="cal-controls">'
    +'<button class="cal-btn" onclick="changeMonth(-1)">&#8592;</button>'
    +'<button class="cal-btn" onclick="changeMonth(1)">&#8594;</button>'
    +'</div></div>'
    +'<div class="cal-grid">'+DIAS.map(function(d){return '<div class="cal-dayname">'+d+'</div>';}).join('')+cells+'</div>'
    +'<p class="cal-hint">&#9679; Dias con asistencia registrada &nbsp;|&nbsp; Pincha un dia para agregar pacientes</p>'
    +'</div>';
}

function renderDay(){
  var k=state.selectedDate;
  var p=k.split('-').map(Number),y=p[0],m=p[1],d=p[2];
  var patients=state.data[k]||[];
  var cards=patients.length===0
    ?'<div class="empty-state"><span class="empty-icon">&#128101;</span><p class="empty-text">Sin asistentes registrados para este dia</p></div>'
    :patients.map(function(p,i){
      return '<div class="p-card">'
        +'<div class="p-card-top">'
        +'<div class="p-avatar">'+initials(p.name)+'</div>'
        +'<span class="p-name">'+esc(p.name)+'</span>'
        +'<span class="p-time">'+p.time+'</span>'
        +'<button class="del-btn" onclick="deletePatient('+i+')" title="Eliminar">&#10005;</button>'
        +'</div>'
        +'<div class="p-detail">'
        +'<div class="p-detail-row"><span class="p-lbl">Actividades</span><span class="p-val">'+(esc(p.acts)||'-')+'</span></div>'
        +(p.obs?'<div class="p-detail-row"><span class="p-lbl">Observaciones</span><span class="p-val">'+esc(p.obs)+'</span></div>':'')
        +'</div></div>';
    }).join('');
  return '<button class="back-btn" onclick="goBack()">&#8592; Volver al calendario</button>'
    +'<div class="day-header">'
    +'<span class="day-title">'+d+' de '+MESES[m-1]+' '+y+'</span>'
    +'<span class="day-count">'+patients.length+' '+(patients.length===1?'paciente':'pacientes')+'</span>'
    +'</div>'
    +cards
    +'<div class="add-section" style="margin-top:16px">'
    +'<div class="form-title">+ Registrar asistencia</div>'
    +'<div class="field-wrap"><div class="field-lbl">Nombre del paciente</div>'
    +'<input type="text" id="f-name" placeholder="Ej: Juan Perez" value="'+esc(state.form.name)+'" oninput="state.form.name=this.value"></div>'
    +'<div class="field-wrap"><div class="field-lbl">Actividades</div>'
    +'<textarea id="f-acts" placeholder="Describe las actividades realizadas..." oninput="state.form.acts=this.value">'+esc(state.form.acts)+'</textarea></div>'
    +'<div class="field-wrap"><div class="field-lbl">Observaciones</div>'
    +'<textarea id="f-obs" placeholder="Notas clinicas, evolucion, indicaciones..." oninput="state.form.obs=this.value">'+esc(state.form.obs)+'</textarea></div>'
    +'<button class="submit-btn" onclick="addPatient()">Registrar asistencia</button>'
    +'</div>';
}

function renderSearch(){
  var q=state.search.query.toLowerCase().trim();
  var all=getAllPatients();
  var filtered=q?all.filter(function(p){return p.name.toLowerCase().indexOf(q)>-1;}):all;
  var patient=state.search.patient;
  var reportHtml='';
  if(patient){
    var entries=getHistory(patient,state.search.from,state.search.to);
    var fl=state.search.from?fmtDate(state.search.from):'inicio del registro';
    var tl=state.search.to?fmtDate(state.search.to):'hoy';
    var eHtml=entries.length===0
      ?'<div class="empty-state"><span class="empty-icon">&#128197;</span><p class="empty-text">Sin asistencias en el periodo seleccionado</p></div>'
      :entries.map(function(e){
        return '<div class="r-entry">'
          +'<div class="r-entry-date">&#128197; '+fmtDate(e.date)+' &nbsp;&middot;&nbsp; '+e.time+'</div>'
          +'<div class="r-row"><span class="r-lbl">Actividades</span><span>'+(esc(e.acts)||'-')+'</span></div>'
          +(e.obs?'<div class="r-row"><span class="r-lbl">Observaciones</span><span>'+esc(e.obs)+'</span></div>':'')
          +'</div>';
      }).join('');
    reportHtml='<div class="report-top">'
      +'<div class="report-av">'+initials(patient)+'</div>'
      +'<div style="flex:1"><div class="report-name">'+esc(patient)+'</div>'
      +'<div class="report-period">Periodo: '+fl+' -> '+tl+'</div></div></div>'
      +'<div class="stats-row">'
      +'<div class="stat-box"><div class="stat-lbl">Asistencias</div><div class="stat-val">'+entries.length+'</div></div>'
      +'<div class="stat-box"><div class="stat-lbl">Primera visita</div><div class="stat-val" style="font-size:13px">'+(entries.length?fmtDate(entries[0].date):'-')+'</div></div>'
      +'<div class="stat-box"><div class="stat-lbl">Ultima visita</div><div class="stat-val" style="font-size:13px">'+(entries.length?fmtDate(entries[entries.length-1].date):'-')+'</div></div>'
      +'</div>'+eHtml;
  }
  var listHtml='';
  if(!patient){
    if(filtered.length>0){
      listHtml='<div class="sug-list">'+filtered.map(function(p){
        return '<div class="sug-item" onclick="selectPatient(\x27"+esc(p.name)+"\x27)">'
          +'<div class="sug-av">'+initials(p.name)+'</div>'
          +'<div><div class="sug-name">'+esc(p.name)+'</div><div class="sug-count">'+p.count+' '+(p.count===1?'asistencia':'asistencias')+'</div></div>'
          +'<span class="sug-arrow">&#8250;</span></div>';
      }).join('')+'</div>';
    } else if(q){
      listHtml='<div class="empty-state"><span class="empty-icon">&#128269;</span><p class="empty-text">No se encontro ningun paciente</p></div>';
    } else if(all.length===0){
      listHtml='<div class="empty-state"><span class="empty-icon">&#128101;</span><p class="empty-text">Aun no hay pacientes registrados</p></div>';
    }
  }
  var html='<div class="section-label">Buscar paciente</div>'
    +(patient?'<button class="back-btn" onclick="backSearch()">&#8592; Volver al buscador</button>':'')
    +'<div class="card">'
    +'<div class="search-wrap"><span class="search-ico">&#128269;</span>'
    +'<input type="text" id="search-input" placeholder="Buscar por nombre..." value="'+esc(state.search.query)+'" autocomplete="off"></div>'
    +(!patient?'<div id="sug-container">'+listHtml+'</div>':'')
    +(patient?
      '<div class="field-lbl" style="margin-bottom:8px">Filtrar por rango de fechas</div>'
      +'<div class="filter-grid">'
      +'<div><div class="field-lbl" style="margin-bottom:5px">Desde</div><input type="date" id="f-from" value="'+state.search.from+'"></div>'
      +'<div><div class="field-lbl" style="margin-bottom:5px">Hasta</div><input type="date" id="f-to" value="'+state.search.to+'"></div>'
      +'</div>'
      +'<div class="action-row">'
      +'<button class="filter-btn" onclick="applyFilter()">Aplicar filtro</button>'
      +'<button class="pdf-btn" onclick="exportPDF()">&#128438; Exportar PDF</button>'
      +'</div>'+reportHtml
    :'')
    +'</div>';
  setTimeout(function(){
    var si=document.getElementById('search-input');
    if(si){
      si.addEventListener('input',function(){onSearchInput(this.value);});
      if(!state.search.patient){si.focus();var l=si.value.length;si.setSelectionRange(l,l);}
    }
  },0);
  return html;
}

function onSearchInput(v){
  state.search.query=v; state.search.patient=null;
  var q=v.toLowerCase().trim();
  var all=getAllPatients();
  var filtered=q?all.filter(function(p){return p.name.toLowerCase().indexOf(q)>-1;}):all;
  var cont=document.getElementById('sug-container');
  if(!cont) return;
  if(filtered.length>0){
    cont.innerHTML='<div class="sug-list">'+filtered.map(function(p){
      return '<div class="sug-item" onclick="selectPatient(\x27"+esc(p.name)+"\x27)">'
        +'<div class="sug-av">'+initials(p.name)+'</div>'
        +'<div><div class="sug-name">'+esc(p.name)+'</div><div class="sug-count">'+p.count+' '+(p.count===1?'asistencia':'asistencias')+'</div></div>'
        +'<span class="sug-arrow">&#8250;</span></div>';
    }).join('')+'</div>';
  } else if(q){
    cont.innerHTML='<div class="empty-state"><span class="empty-icon">&#128269;</span><p class="empty-text">No se encontro ningun paciente</p></div>';
  } else {
    cont.innerHTML='';
  }
}

function changeMonth(dir){
  state.month+=dir;
  if(state.month<0){state.month=11;state.year--;}
  else if(state.month>11){state.month=0;state.year++;}
  render();
}
function openDay(k){state.selectedDate=k;state.view='day';state.form={name:'',acts:'',obs:''};render();}
function goBack(){state.view='calendar';render();}
function backSearch(){state.search.patient=null;state.search.query='';render();}
function selectPatient(name){state.search.patient=name;state.search.query=name;render();}
function applyFilter(){state.search.from=document.getElementById('f-from').value;state.search.to=document.getElementById('f-to').value;render();}

function deletePatient(i){
  if(!confirm('Eliminar este registro?')) return;
  state.data[state.selectedDate].splice(i,1);
  saveDay(state.selectedDate);
  render();
}

function addPatient(){
  var name=document.getElementById('f-name').value.trim();
  if(!name){document.getElementById('f-name').focus();return;}
  if(!state.data[state.selectedDate]) state.data[state.selectedDate]=[];
  var now=new Date();
  state.data[state.selectedDate].push({
    name:name,
    acts:document.getElementById('f-acts').value.trim(),
    obs:document.getElementById('f-obs').value.trim(),
    time:now.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'})
  });
  state.form={name:'',acts:'',obs:''};
  saveDay(state.selectedDate);
  render();
}

function openDataModal(){
  var list=document.getElementById('modal-day-list');
  var days=Object.entries(state.data)
    .filter(function(e){return e[1]&&e[1].length>0;})
    .sort(function(a,b){return b[0].localeCompare(a[0]);});
  if(days.length===0){
    list.innerHTML='<div class="empty-modal">No hay registros guardados</div>';
  } else {
    list.innerHTML=days.map(function(e){
      return '<div class="modal-day-row">'
        +'<span><span class="modal-day-label">'+fmtDate(e[0])+'</span>'
        +'<span class="modal-day-count">'+e[1].length+' '+(e[1].length===1?'paciente':'pacientes')+'</span></span>'
        +'<button class="modal-del-btn" onclick="deleteDay(\"'+e[0]+'\")">Eliminar</button>'
        +'</div>';
    }).join('');
  }
  document.getElementById('data-modal').classList.add('open');
}
function closeModal(){document.getElementById('data-modal').classList.remove('open');}
function closeModalOutside(e){if(e.target===document.getElementById('data-modal'))closeModal();}

function deleteDay(k){
  if(!confirm('Eliminar todos los registros del '+fmtDate(k)+'?')) return;
  delete state.data[k];
  db.collection('asistencia').doc(k).delete()
    .then(function(){showToast('Dia eliminado');render();openDataModal();})
    .catch(function(e){showToast('Error: '+e.message);});
}

function clearAll(){
  if(!confirm('Estas seguro? Se eliminaran TODOS los registros permanentemente.')) return;
  showLoading('Eliminando datos...');
  var keys=Object.keys(state.data);
  var promises=keys.map(function(k){return db.collection('asistencia').doc(k).delete();});
  Promise.all(promises).then(function(){
    state.data={};
    hideLoading();showToast('Todos los registros eliminados');render();closeModal();
  }).catch(function(e){hideLoading();showToast('Error: '+e.message);});
}

function exportPDF(){
  if(typeof window.jspdf==='undefined'){alert('Cargando PDF, espera un momento...');return;}
  var jsPDF=window.jspdf.jsPDF;
  var doc=new jsPDF({unit:'mm',format:'a4'});
  var patient=state.search.patient;
  var entries=getHistory(patient,state.search.from,state.search.to);
  var fl=state.search.from?fmtDate(state.search.from):'inicio del registro';
  var tl=state.search.to?fmtDate(state.search.to):'hoy';
  var today=new Date().toLocaleDateString('es-CL',{day:'2-digit',month:'long',year:'numeric'});
  var pw=210,mg=20,cw=pw-mg*2;
  var y=0;
  doc.setFillColor(26,37,53);doc.rect(0,0,210,18,'F');
  doc.setFillColor(229,57,53);doc.rect(0,16,210,2,'F');
  doc.setTextColor(255,255,255);doc.setFontSize(11);doc.setFont('helvetica','bold');
  doc.text('Gimnasio Medico - Centro Clinico La Serena',mg,11);
  doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(180,180,180);
  doc.text('Generado: '+today,pw-mg,11,{align:'right'});
  y=28;
  doc.setTextColor(26,37,53);doc.setFontSize(18);doc.setFont('helvetica','bold');
  doc.text(patient,mg,y);y+=8;
  doc.setFontSize(9);doc.setFont('helvetica','normal');doc.setTextColor(100,110,120);
  doc.text('Periodo: '+fl+' -> '+tl,mg,y);y+=10;
  doc.setDrawColor(220,225,230);doc.setLineWidth(0.3);doc.line(mg,y,pw-mg,y);y+=8;
  var cw3=cw/3;
  var stats=[['Total asistencias',String(entries.length)],['Primera visita',entries.length?fmtDate(entries[0].date):'-'],['Ultima visita',entries.length?fmtDate(entries[entries.length-1].date):'-']];
  stats.forEach(function(s,i){
    var x=mg+i*cw3;
    doc.setFillColor(247,249,251);doc.setDrawColor(220,225,230);doc.setLineWidth(0.3);
    doc.roundedRect(x,y,cw3-4,16,2,2,'FD');
    doc.setFontSize(7);doc.setFont('helvetica','normal');doc.setTextColor(120,130,140);
    doc.text(s[0].toUpperCase(),x+4,y+5.5);
    doc.setFontSize(11);doc.setFont('helvetica','bold');doc.setTextColor(26,37,53);
    doc.text(s[1],x+4,y+13);
  });
  y+=24;
  doc.setFontSize(10);doc.setFont('helvetica','bold');doc.setTextColor(26,37,53);
  doc.text('Detalle de sesiones',mg,y);y+=7;
  if(entries.length===0){
    doc.setFont('helvetica','normal');doc.setTextColor(150,150,150);doc.setFontSize(9);
    doc.text('Sin asistencias en el periodo seleccionado.',mg,y);
  } else {
    entries.forEach(function(e){
      var aLines=doc.splitTextToSize(e.acts||'-',cw-28);
      var oLines=e.obs?doc.splitTextToSize(e.obs,cw-28):[];
      var bh=7+5.5*aLines.length+(oLines.length?5.5*oLines.length:0)+8;
      if(y+bh>275){
        doc.addPage();
        doc.setFillColor(26,37,53);doc.rect(0,0,210,18,'F');
        doc.setFillColor(229,57,53);doc.rect(0,16,210,2,'F');
        doc.setTextColor(180,180,180);doc.setFontSize(8);doc.setFont('helvetica','normal');
        doc.text('Gimnasio Medico - '+patient,mg,11);
        doc.text('Generado: '+today,pw-mg,11,{align:'right'});
        y=26;
      }
      doc.setFillColor(250,252,250);doc.setDrawColor(220,225,230);doc.setLineWidth(0.3);
      doc.roundedRect(mg,y,cw,bh,2,2,'FD');
      doc.setFillColor(29,158,117);doc.rect(mg,y,2.5,bh,'F');
      var iy=y+7;
      doc.setFontSize(9);doc.setFont('helvetica','bold');doc.setTextColor(15,110,86);
      doc.text(fmtDate(e.date)+' . '+e.time,mg+6,iy);iy+=6;
      doc.setFontSize(8);doc.setFont('helvetica','bold');doc.setTextColor(120,130,140);
      doc.text('ACTIVIDADES',mg+6,iy);
      doc.setFont('helvetica','normal');doc.setTextColor(60,70,80);
      doc.text(aLines,mg+30,iy);iy+=5.5*aLines.length;
      if(oLines.length){
        doc.setFont('helvetica','bold');doc.setTextColor(120,130,140);
        doc.text('OBSERVACIONES',mg+6,iy);
        doc.setFont('helvetica','normal');doc.setTextColor(60,70,80);
        doc.text(oLines,mg+30,iy);
      }
      y+=bh+4;
    });
  }
  var np=doc.internal.getNumberOfPages();
  for(var i=1;i<=np;i++){
    doc.setPage(i);doc.setFontSize(7);doc.setTextColor(160,160,160);doc.setFont('helvetica','normal');
    doc.text('Pagina '+i+' de '+np+' - Gimnasio Medico, Centro Clinico La Serena',pw/2,290,{align:'center'});
  }
  doc.save('informe_'+patient.replace(/\s+/g,'_').toLowerCase()+'_'+new Date().toISOString().slice(0,10)+'.pdf');
}

// Init
loadAllData();
