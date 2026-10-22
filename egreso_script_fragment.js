(()=>{
'use strict';
const $=id=>document.getElementById(id);
const SPEC=HCIL_DISCHARGE_SPEC;
const TABS=[['episode','01 · Egreso e ingreso'],['course','02 · Evolución'],['procedures','03 · Procedimientos'],['studies','04 · Estudios'],['diagnoses','05 · Diagnósticos'],['medication','06 · Medicamentos y soporte'],['home','07 · Plan domiciliario'],['followup','08 · Pendientes y citas'],['closing','09 · Destino y firma'],['review','10 · Revisión y técnica']];
const TAB_FOR={
 'IDENTIFICACIÓN DEL EGRESO':'episode','ENFERMEDAD ACTUAL':'episode','DIAGNÓSTICOS AL INGRESO':'episode',
 'EVOLUCIÓN INTRAHOSPITALARIA':'course','EXAMEN FÍSICO':'studies','RADIOGRAFÍA':'studies','LABORATORIOS':'studies','OTROS ESTUDIOS CARDIOVASCULARES AL EGRESO':'studies',
 'SOPORTE Y DISPOSITIVOS PRESENTES AL EGRESO':'medication','DIAGNÓSTICOS DE EGRESO':'diagnoses','CONCILIACIÓN DE MEDICAMENTOS AL EGRESO':'medication',
 'PLAN NUTRICIONAL PARA EL HOGAR':'home','ACTIVIDAD FÍSICA Y CUIDADOS POSQUIRÚRGICOS':'home','PROFILAXIS Y CUIDADOS CARDIOVASCULARES ESPECIALES':'home',
 'MONITOREO DOMICILIARIO CARDIOVASCULAR':'home','SIGNOS DE ALARMA PARA LA FAMILIA':'home','RESULTADOS PENDIENTES AL EGRESO':'followup',
 'CITAS DE SEGUIMIENTO':'followup','DESTINO DEL PACIENTE':'closing','FIRMA':'closing'
};
const repeatGroups={
 discharge_procedure_links:['discharge_procedure_link_id','procedure_type','source_procedure_id','procedure_date'],
 complication_links:['complication_link_id','complication_source'],
 discharge_diagnoses:['discharge_diagnosis_id','diagnosis_id','diagnosis_status','diagnosis_notes'],
 discharge_medications:['discharge_medication_id','medication_order_id','medication_action','medication_indication','medication_duration','special_medication_instructions'],
 pending_results:['pending_result_id','pending_test_id','pending_test_name','followup_action'],
 followups:['followup_id','followup_specialty','followup_date','followup_interval','followup_reason']
};
const repeatKeys=Object.values(repeatGroups).flat();
const OBJECT_ARRAYS=['admission_diagnosis_ids','consultation_ids','cardiac_surgery_ids','cath_ids','ep_study_ids','discharge_lab_result_ids','discharge_other_imaging_ids','device_ids_at_discharge'];
const FIELD_MULTI=['home_equipment_required','home_feeding_route','warning_signs'];
const BOOLEANS=new Set(['icu_admission_occurred','mechanical_ventilation_during_stay','mechanical_support_during_stay','cardiac_surgery_performed','operative_note_attached','cath_performed_during_stay','ep_performed_during_stay','unresolved_complication_present','oxygen_at_home','drain_at_discharge','anticoagulation_at_discharge','home_monitoring_required','home_spo2_monitoring','home_weight_monitoring','home_hr_monitoring','home_feeding_monitoring']);
const AUTO=new Set(['discharge_id','encounter_id','admission_date','length_of_stay_days','discharge_physician_id','discharge_summary_status','present_illness_display','cardiac_surgery_performed','cardiac_surgery_ids','operative_note_id','operative_note_attached','operative_note_file','cath_performed_during_stay','cath_ids','ep_performed_during_stay','ep_study_ids','discharge_physical_exam_id','discharge_vitals_id','discharge_cxr_date','discharge_signed_by','discharge_signed_at']);
const FAKE_EXT=new Set(['present_illness_id','discharge_ecg_id','discharge_echo_id','discharge_physical_exam_id','discharge_vitals_id','admission_diagnosis_ids','medication_order_id','pending_test_id']);
const meta=Object.fromEntries(SPEC.map(x=>[x.key,x]));
const untilNow=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const timeNow=()=>{const d=new Date();return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`};
const iso=()=>new Date().toISOString();
const mkid=()=>{
 if(typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function')return crypto.randomUUID();
 const a=new Uint8Array(16);
 if(typeof crypto!=='undefined'&&typeof crypto.getRandomValues==='function')crypto.getRandomValues(a);
 else for(let i=0;i<16;i++)a[i]=Math.floor(Math.random()*256); // solo demo; jamás utilizar en producción
 a[6]=(a[6]&15)|64;a[8]=(a[8]&63)|128;
 const h=Array.from(a,b=>b.toString(16).padStart(2,'0')).join('');
 return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>Array.isArray(v)?v.join(', '):typeof v==='boolean'?(v?'Sí':'No'):v===null||v===undefined||v===''?'—':String(v);
const dayDiff=(a,b)=>{if(!a||!b)return null;const x=Date.parse(a+'T00:00:00Z'),y=Date.parse(b+'T00:00:00Z');if(!Number.isFinite(x)||!Number.isFinite(y))return null;return Math.floor((y-x)/86400000)};
const num=(v)=>v===''||v===null||v===undefined?null:Number(v);
const fin=(v)=>v!==null&&v!==undefined&&v!=='';
const unique=arr=>[...new Set(arr.filter(Boolean))];
const yes=v=>v===true||v==='true'||v==='Sí';
let discharges=[],activeId=null,tab='episode',modalMessage='',sources=null;
const active=()=>discharges.find(d=>d.discharge_id===activeId)||null;
function integration(){
 const xr=window.HCILXray?.capture?.()||{},ca=window.HCILCath?.capture?.()||{},sx=window.HCILSurgery?.capture?.()||{},lb=window.HCILLabs?.capture?.()||{},dn=window.HCILDaily?.capture?.()||{};
 const xrs=xr.chest_xrays||[],caths=ca.cardiac_catheterizations||[],surgeries=sx.cardiac_surgeries||[],labs=lb.lab_studies||[],notes=dn.daily_evolutions||[];
 const encounter=xr._radiography_encounter?.encounter_id||notes[0]?.encounter_id||surgeries[0]?.encounter_id||caths[0]?.encounter_id||null;
 const admission=xr._radiography_encounter?.admission_date||notes[0]?._auxiliary?.admission_date_override||null;
 const same=ls=>ls.filter(v=>!encounter||!v.encounter_id||v.encounter_id===encounter);
 const cleanX=same(xrs),cleanC=same(caths),cleanS=same(surgeries),cleanN=same(notes);
 const labEntries=[];for(const lb of labs)for(const r of lb.lab_results||[])labEntries.push({id:r.lab_result_id,label:`${r.test_name}: ${r.result_operator||''}${r.result_value_numeric??r.result_value_text??r.result_value_code??'—'} ${r.result_unit||''} · ${lb.lab_panel}`,lab_id:lb.lab_study_id});
 const procedures=[...cleanS.map(s=>({id:s.surgery_id,type:'Cirugía cardiovascular',date:s.surgery_date,notes:s.operative_procedure_summary||''})),...cleanC.map(c=>({id:c.cath_id,type:'Cateterismo',date:c.cath_date,notes:c.cath_conclusion||''}))];
 const complications=[];for(const s of cleanS)for(const c of s.surgical_complications||[])complications.push({id:c.surgical_complication_id,source:'Cirugía',type:c.complication_type,summary:c.complication_management||''});for(const c of cleanC)for(const x of c.complications||[])complications.push({id:x.complication_id,source:'Cateterismo',type:x.complication_type,summary:x.complication_treatment||''});
 return {encounter,admission,xrs:cleanX,caths:cleanC,surgeries:cleanS,labs,notes:cleanN,labEntries,procedures,complications};
}
function createSources(){return {
 provenance:'FUENTES SINTÉTICAS DEL EJEMPLO: NO SON INFORMES DEL HCIL NI EQUIVALEN A MÓDULOS INTEGRADOS',
 presentIllness:{id:mkid(),label:'Enfermedad actual de ingreso (registro sintético de demostración)',text:'Paciente pediátrico con cardiopatía congénita conocida, hospitalizada para evaluación y tratamiento cardiovascular. Texto ficticio que no procede del módulo Enfermedad Actual.'},
 admissionDiagnoses:[{id:mkid(),label:'Comunicación interventricular — sin codificación institucional (ejemplo ficticio)'}],
 ecg:{id:mkid(),label:'ECG de control · registro sintético no verificado'},
 echo:{id:mkid(),label:'Ecocardiograma de control · registro sintético no verificado'},
 medOrders:[{id:mkid(),label:'Medicamento ficticio A · prescripción simulada sin dosis',type:'dummy'}],
 pendingTests:[{id:mkid(),label:'Control analítico solicitado · orden simulada'}],
 examSnapshot:{id:mkid(),label:'Valoración física V8 no versionada · snapshot auxiliar de demostración'},
 audit:{created_at:iso(),origin:'synthetic_demo_record_only'}
};}
function optionsFromFormat(f){const fmt=f?.format||'';if(!fmt.includes(' / '))return [];
 let items=fmt.split(/\s+\/\s+/).map(t=>t.trim().replace(/\s+/g,' ')).filter(t=>t&&t.length<120);
 return items.length>1&&items.length<50?items:[];
}
const overrideOptions={
 discharge_service:['Cardiología','Cirugía cardiovascular','UCIP','Otro'],
 admission_condition:['Estable','Delicada','Crítica','Otra'],
 discharge_cxr_status:['Realizada','No realizada','No indicada'],
 discharge_labs_status:['Disponibles','No realizados','No indicados','Pendientes'],
 discharge_disposition:['Domicilio','Traslado a otro hospital','Rehabilitación','Otro servicio','Alta contra indicación','Fallecimiento','Otro'],
 medication_action:['Iniciar','Continuar','Modificar','Suspender'],
 diagnosis_status:['Activo','Resuelto','Crónico','Postoperatorio','Requiere seguimiento'],
 home_feeding_route:['Oral','SNG','Gastrostomía','Otra'],
 warning_signs:['Dificultad respiratoria','Aumento de cianosis','Saturación fuera de rango','Fiebre','Rechazo del alimento','Vómitos persistentes','Decaimiento','Síncope','Palpitaciones','Edema','Disminución de diuresis','Sangrado','Alteración de herida','Otro'],
 home_equipment_required:['Oxígeno','Pulsioxímetro','Balanza','Bomba de alimentación','Otro'],
 activity_restriction:['Sin restricción','Restricción parcial','Reposo relativo','Restricción específica'],
 ie_prophylaxis_status:['Indicada','No indicada','Pendiente definición'],
 anticoagulation_at_discharge:['Sí','No']
};
const selectOptions=(key)=>overrideOptions[key]||optionsFromFormat(meta[key]);
function optionsFor(key){const a=integration(),opts=[];
 if(key==='present_illness_id')return sources?.presentIllness?[{id:sources.presentIllness.id,label:sources.presentIllness.label}]:[];
 if(key==='admission_diagnosis_ids')return sources?.admissionDiagnoses||[];
 if(key==='discharge_ecg_id')return sources?.ecg?[sources.ecg]:[];
 if(key==='discharge_echo_id')return sources?.echo?[sources.echo]:[];
 if(key==='discharge_physical_exam_id')return sources?.examSnapshot?[sources.examSnapshot]:[];
 if(key==='discharge_vitals_id')return a.notes.map(n=>({id:n.daily_note_id,label:'Evolución '+n.evolution_date+' · referencia provisional a constantes vitales'}));
 if(key==='discharge_cxr_id')return a.xrs.map(x=>({id:x.chest_xray_id,label:x.xray_date+' · '+x.xray_projection+' · '+x.xray_location}));
 if(key==='discharge_lab_result_ids')return a.labEntries;
 if(key==='cardiac_surgery_ids')return a.surgeries.map(s=>({id:s.surgery_id,label:s.surgery_date+' · '+s.operative_procedure_summary}));
 if(key==='cath_ids')return a.caths.map(c=>({id:c.cath_id,label:c.cath_date+' · '+c.cath_conclusion}));
 if(key==='medication_order_id'||key==='anticoagulant_medication_id')return sources?.medOrders||[];
 if(key==='pending_test_id')return sources?.pendingTests||[];
 if(key==='diagnosis_id')return sources?.admissionDiagnoses||[];
 if(key==='device_ids_at_discharge'){const list=[];for(const x of a.xrs)for(const dv of x.xray_devices||[])list.push({id:dv.xray_device_id,label:'Rx '+x.xray_date+' · '+dv.device_type+' (confirmar que continúa activo)'});return list;}
 if(key==='discharge_other_imaging_ids')return [];
 if(key==='consultation_ids'||key==='ep_study_ids')return [];
 return opts;
}
function makeDraft(intent='normal',parent=null){
 const a=integration();const d={};for(const f of SPEC){if(OBJECT_ARRAYS.includes(f.key)||FIELD_MULTI.includes(f.key))d[f.key]=[];else d[f.key]=null;}
 Object.assign(d,{discharge_id:mkid(),encounter_id:a.encounter,admission_date:a.admission,discharge_date:untilNow(),discharge_time:timeNow(),discharge_service:'Cardiología',discharge_physician_id:'PROFESIONAL-DEMO-SIN-AUTENTICAR',discharge_summary_status:intent==='adenda'?'Adenda':'Borrador',
     present_illness_id:sources?.presentIllness?.id||null,present_illness_display:sources?.presentIllness?.text||null,
     admission_diagnosis_ids:sources?.admissionDiagnoses?.map(x=>x.id)||[],
     discharge_cxr_status:a.xrs.length?'Realizada':'No realizada', discharge_cxr_id:a.xrs.at(-1)?.chest_xray_id||null,
     discharge_labs_status:a.labEntries.length?'Disponibles':'No realizados',discharge_lab_result_ids:a.labEntries.slice(0,4).map(x=>x.id),
     discharge_ecg_id:sources?.ecg?.id||null,discharge_echo_id:sources?.echo?.id||null,
     discharge_physical_exam_id:sources?.examSnapshot?.id||null,discharge_vitals_id:a.notes.at(-1)?.daily_note_id||null,
     cardiac_surgery_performed:!!a.surgeries.length,cardiac_surgery_ids:a.surgeries.map(s=>s.surgery_id),
     cath_performed_during_stay:!!a.caths.length,cath_ids:a.caths.map(s=>s.cath_id),ep_performed_during_stay:null,
     operative_note_id:a.surgeries.at(-1)?.operative_note_id||null,
     operative_note_attached:!!a.surgeries.at(-1)?.operative_note_id&&!!a.surgeries.at(-1)?.operative_note_signed_at,
     surgery_result_discharge:a.surgeries.length?'Reparación satisfactoria':null,
     discharge_weight_kg:a.notes.at(-1)?.weight_kg??window.HCILExam?.capture?.()?.weight_kg??null,
     discharge_spo2:a.notes.at(-1)?.oxygen_saturation??window.HCILExam?.capture?.()?.oxygen_saturation??null,
     discharge_disposition:'Domicilio', icu_admission_occurred:null, mechanical_ventilation_during_stay:null, mechanical_support_during_stay:null, unresolved_complication_present:null,
     oxygen_at_home:false,vascular_access_at_discharge:'Ninguno',drain_at_discharge:false,anticoagulation_at_discharge:false,home_monitoring_required:false,
     home_feeding_route:['Oral'],ie_prophylaxis_status:'Pendiente definición',
     discharge_signed_by:null,discharge_signed_at:null,
     discharge_procedure_links:a.procedures.map(p=>({discharge_procedure_link_id:mkid(),procedure_type:p.type,source_procedure_id:p.id,procedure_date:p.date})),
     complication_links:a.complications.map(p=>({complication_link_id:mkid(),complication_source:p.source,_source_id:p.id,_event_type:p.type})),
     discharge_diagnoses:[],discharge_medications:[],pending_results:[],followups:[],
     _auxiliary:{intent,parent_discharge_id:parent,created_at:iso(),last_saved_at:null,signature_validation:'SIMULADA_SIN_VALIDEZ_LEGAL',missing_modules:['Enfermedad Actual','Diagnósticos de ingreso','ECG','Ecocardiografía'],has_synthetic_sources:!!sources,origin:'demo',lab_relation_check:'V12 no contiene encounter_id formal en todos los estudios',exam_snapshot_is_not_versioned:true,archived_originals:true,notes:[]}
 });
 d.discharge_cxr_date=a.xrs.at(-1)?.xray_date||null;
 d.length_of_stay_days=dayDiff(d.admission_date,d.discharge_date);
 d.followups=[];
 return d;
}
function normalizeDerived(d){if(!d||d.discharge_signed_at||Object.isFrozen(d))return;const a=integration();d.encounter_id=a.encounter;d.admission_date=a.admission;
 d.length_of_stay_days=dayDiff(d.admission_date,d.discharge_date);
 d.cardiac_surgery_ids=d.cardiac_surgery_ids.filter(id=>a.surgeries.some(s=>s.surgery_id===id));
 d.cath_ids=d.cath_ids.filter(id=>a.caths.some(s=>s.cath_id===id));
 d.cardiac_surgery_performed=!!d.cardiac_surgery_ids.length; d.cath_performed_during_stay=!!d.cath_ids.length;
 const surg=a.surgeries.find(s=>d.cardiac_surgery_ids.includes(s.surgery_id))||null;
 d.operative_note_id=surg?.operative_note_id||null;
 d.operative_note_attached=!!surg?.operative_note_id&&!!surg?.operative_note_signed_at;
 d.discharge_cxr_date=a.xrs.find(x=>x.chest_xray_id===d.discharge_cxr_id)?.xray_date||null;
 if(d.discharge_cxr_status!=='Realizada'){d.discharge_cxr_id=null;d.discharge_cxr_date=null;d.discharge_cxr_summary=null;d.discharge_cxr_comparison=null;}
 if(d.discharge_labs_status!=='Disponibles'){d.discharge_lab_result_ids=[];d.discharge_labs_summary=null;}
 if(d.present_illness_id===sources?.presentIllness?.id)d.present_illness_display=sources.presentIllness.text;
 else {d.present_illness_id=null;d.present_illness_display=null;}
 if(d.discharge_summary_status==='Firmado'||d.discharge_summary_status==='Adenda'&&!!d.discharge_signed_at)return;
 d.discharge_signed_by=null;d.discharge_signed_at=null;
}
function linkIsValid(key,id){if(!id)return false;return optionsFor(key).some(o=>o.id===id)}
function isVisible(k,d){
 const yesVal=v=>yes(d[v]);
 if(['oxygen_flow_home','oxygen_interface_home'].includes(k))return yesVal('oxygen_at_home');
 if(k==='icu_stay_days')return yesVal('icu_admission_occurred');
 if(['discharge_cxr_id','discharge_cxr_summary','discharge_cxr_date','discharge_cxr_comparison'].includes(k))return d.discharge_cxr_status==='Realizada';
 if(k==='discharge_cxr_not_done_reason')return d.discharge_cxr_status==='No realizada';
 if(['discharge_lab_result_ids','discharge_labs_summary'].includes(k))return d.discharge_labs_status==='Disponibles';
 if(['cath_discharge_summary'].includes(k))return !!d.cath_ids.length;
 if(['ep_discharge_summary'].includes(k))return yesVal('ep_performed_during_stay');
 if(k==='operative_note_missing_reason')return !!d.cardiac_surgery_ids.length&&!d.operative_note_attached;
 if(['surgery_result_discharge','operative_note_attached','operative_note_id','operative_note_file'].includes(k))return !!d.cardiac_surgery_ids.length;
 if(k==='complications_summary')return d.complication_links.length>0||yesVal('unresolved_complication_present');
 if(['oxygen_flow_home','oxygen_interface_home'].includes(k))return yesVal('oxygen_at_home');
 if(k==='activity_restriction_detail')return d.activity_restriction&&d.activity_restriction!=='Sin restricción';
 if(k==='sternal_precautions_duration')return !!d.cardiac_surgery_ids.length&&d.sternal_precautions==='Sí';
 if(k==='wound_care_instructions')return !!d.cardiac_surgery_ids.length&&yesVal('wound_care_required');
 if(['sternal_precautions','wound_care_required','bathing_instructions'].includes(k))return !!d.cardiac_surgery_ids.length;
 if(k==='ie_prophylaxis_instructions')return d.ie_prophylaxis_status==='Indicada';
 if(['anticoagulant_medication_id','target_inr_min','target_inr_max','next_inr_date'].includes(k))return yesVal('anticoagulation_at_discharge');
 if(k==='device_precautions')return !!(d.device_ids_at_discharge||[]).length;
 if(['home_spo2_monitoring','home_weight_monitoring','home_hr_monitoring','home_feeding_monitoring'].includes(k))return yesVal('home_monitoring_required');
 if(['home_spo2_lower_limit','home_spo2_upper_limit'].includes(k))return yesVal('home_monitoring_required')&&yesVal('home_spo2_monitoring');
 if(k==='warning_sign_other')return (d.warning_signs||[]).includes('Otro');
 if(['transfer_facility','transfer_reason','transport_requirement'].includes(k))return d.discharge_disposition==='Traslado a otro hospital';
 return true;
}
function matchesTab(f,t){if(repeatKeys.includes(f.key))return false;
 if(f.category==='EVOLUCIÓN INTRAHOSPITALARIA'&&f.subcat==='PROCEDIMIENTOS REALIZADOS DURANTE LA HOSPITALIZACIÓN')return t==='procedures';
 return TAB_FOR[f.category]===t;
}
function getValue(d,k){if(!d)return null;return d[k];}
function labelForOption(key,id){return optionsFor(key).find(x=>x.id===id)?.label||id;}
function inputField(f,d){const k=f.key,v=getValue(d,k);if(!isVisible(k,d))return '';
 const req=['Sí','Condicional'].includes(f.required)&&!AUTO.has(k);
 const note=(f.rule&&f.rule!=='—')?`<div class="dx-help">${esc(f.rule)}</div>`:'';
 let opts=[];let read=AUTO.has(k)||k==='present_illness_display';
 let html='';
 if(['discharge_physician_id','discharge_vitals_id','discharge_physical_exam_id','present_illness_id','discharge_ecg_id','discharge_echo_id','discharge_cxr_id','anticoagulant_medication_id'].includes(k))read=!['present_illness_id','discharge_ecg_id','discharge_echo_id','discharge_cxr_id','discharge_vitals_id','anticoagulant_medication_id'].includes(k);
 if(['admission_diagnosis_ids','cardiac_surgery_ids','cath_ids','discharge_lab_result_ids','device_ids_at_discharge'].includes(k))read=false;
 if(k==='discharge_summary_status')read=true;
 if(OBJECT_ARRAYS.includes(k)){opts=optionsFor(k);
  if(['cardiac_surgery_ids','cath_ids','admission_diagnosis_ids','discharge_lab_result_ids','device_ids_at_discharge'].includes(k)&&opts.length){html='<div class="dx-multi">'+opts.map(o=>`<label><input type="checkbox" data-dx-multi="${esc(k)}" value="${esc(o.id)}" ${Array.isArray(v)&&v.includes(o.id)?'checked':''} ${d.discharge_signed_at?'disabled':''}>${esc(o.label)}</label>`).join('')+'</div>';}
  else html=`<div class="dx-read">${opts.length===0?'No hay registros vinculables disponibles':esc((v||[]).map(x=>labelForOption(k,x)).join('; ')||'Sin selección')}</div>`;
 }else if(FIELD_MULTI.includes(k)){
  opts=selectOptions(k);html='<div class="dx-multi">'+opts.map(o=>`<label><input type="checkbox" data-dx-multi="${esc(k)}" value="${esc(o)}" ${Array.isArray(v)&&v.includes(o)?'checked':''} ${d.discharge_signed_at?'disabled':''}>${esc(o)}</label>`).join('')+'</div>';
 }else if(BOOLEANS.has(k)){
  html=read?`<div class="dx-read">${fmt(v)}</div>`:`<select data-dx-key="${esc(k)}" ${d.discharge_signed_at?'disabled':''}><option value="">Seleccione...</option><option value="true" ${v===true?'selected':''}>Sí</option><option value="false" ${v===false?'selected':''}>No</option></select>`;
 }else if(read||k==='discharge_cxr_date'||k==='length_of_stay_days'||k==='present_illness_display'){
  html=`<div class="dx-read" data-dx-read="${esc(k)}">${esc(fmt(v))}</div>`;
 }else if(['present_illness_id','discharge_ecg_id','discharge_echo_id','discharge_cxr_id','discharge_vitals_id','anticoagulant_medication_id'].includes(k)){
  opts=optionsFor(k);html=`<select data-dx-key="${esc(k)}" ${d.discharge_signed_at?'disabled':''}><option value="">${opts.length?'Seleccione un registro original...':'Sin módulo original disponible'}</option>${opts.map(o=>`<option value="${esc(o.id)}" ${v===o.id?'selected':''}>${esc(o.label)}</option>`).join('')}</select>`;
 }else if(k==='discharge_disposition'||k==='discharge_service'||selectOptions(k).length&&(/^ENUM/.test(f.type)||f.ui.toLowerCase().includes('select'))){
  opts=selectOptions(k);html=`<select data-dx-key="${esc(k)}" ${d.discharge_signed_at?'disabled':''}><option value="">Seleccione...</option>${opts.map(o=>`<option value="${esc(o)}" ${v===o?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
 }else if(['TEXT'].includes(f.type)||f.ui.toLowerCase().includes('textarea')){
  const max=/[Mm]áx\.\s*([\d.]+)\s*caract/.exec(f.format);const limit=max?Number(max[1].replace(/\./g,'')):200000;
  html=`<textarea data-dx-key="${esc(k)}" maxlength="${limit}" rows="4" ${d.discharge_signed_at?'disabled':''}>${esc(v||'')}</textarea>`;
 }else if(f.type==='DATE'||f.type==='TIME'){
  html=`<input data-dx-key="${esc(k)}" type="${f.type==='DATE'?'date':'time'}" ${f.type==='DATE'&&k!=='next_inr_date'?'max="'+untilNow()+'"':''} value="${esc(v||'')}" ${d.discharge_signed_at?'disabled':''}>`;
 }else if(/DECIMAL|INTEGER/.test(f.type)||f.ui.toLowerCase().includes('numeric')){
  html=`<input data-dx-key="${esc(k)}" type="number" step="any" value="${esc(v??'')}" ${d.discharge_signed_at?'disabled':''}>`;
 }else{
  html=`<input data-dx-key="${esc(k)}" type="text" value="${esc(v||'')}" ${d.discharge_signed_at?'disabled':''}>`;
 }
 const wid=(['present_illness_display','hospital_course_summary','discharge_exam_summary','cath_discharge_summary','consultations_summary','complications_summary','discharge_cxr_summary','discharge_labs_summary','discharge_studies_summary','home_diet_type','wound_care_instructions','ie_prophylaxis_instructions','device_precautions','transfer_reason'].includes(k)||f.type==='TEXT'||FIELD_MULTI.includes(k)||OBJECT_ARRAYS.includes(k))?'wide':'';
 return `<div class="dx-field ${wid}" data-dx-wrap="${esc(k)}"><label>${esc(f.label)} ${req?'<small>*</small>':''}${read?'<small>automático</small>':''}</label>${html}${note}</div>`;
}
function panel(tabId,d){let fs=SPEC.filter(f=>matchesTab(f,tabId));const groups=[];for(const f of fs){const name=f.subcat||f.category;let g=groups.find(g=>g.name===name);if(!g){g={name,fields:[]};groups.push(g)}g.fields.push(f)}
 return groups.map(g=>`<div class="dx-group"><h4>${esc(g.name)}</h4><div class="dx-grid">${g.fields.map(f=>inputField(f,d)).join('')}</div></div>`).join('');
}
function noticeFor(t,d){const a=integration();const out=[];
 if(t==='episode'){
  out.push('<div class="dx-alert info"><strong>Datos originales del ingreso</strong>Fecha de ingreso y hospitalización se obtienen del contexto V9. Enfermedad Actual y diagnósticos del ingreso aún requieren módulos propios. Las referencias del ejemplo llevan un sello de origen sintético.</div>');
  if(sources)out.push('<div class="dx-alert"><strong>Fuente ficticia activa</strong>Los registros de Enfermedad Actual, ECG, ecocardiograma y órdenes de medicación NO son informes originales. Úselos solo para ensayar la interfaz.</div>');
 }
 if(t==='studies')out.push('<div class="dx-alert info"><strong>Vínculos a resultados previos</strong>Se guardan identificadores de Rx V9, resultados V12 y notas V13, sin duplicar informes. V8 todavía no versiona cada examen físico; el ejemplo usa un snapshot auxiliar, no una consulta real.</div>');
 if(t==='procedures')out.push('<div class="dx-alert info"><strong>Procedimientos del mismo ingreso</strong>Las cirugías V11 y cateterismos V10 se seleccionan desde los registros finalizados. El sistema no copia las notas; faltan módulos de Electrofisiología y UCI.</div>');
 if(t==='medication')out.push('<div class="dx-alert info"><strong>Conciliación ≠ prescripción</strong>Este módulo referencia órdenes de medicación. La V13 no dispone de prescripción activa integrada; el ejemplo usa una orden ficticia sin dosis. No usar estas pantallas para indicar tratamientos reales.</div>');
 if(t==='home')out.push('<div class="dx-alert info"><strong>Plan individualizado</strong>Las alertas, la profilaxis, la anticoagulación y la monitorización se deciden por el médico. El sistema no prescribe ni infiere automáticamente umbrales de saturación o INR.</div>');
 if(t==='followup')out.push('<div class="dx-alert info"><strong>Seguimiento programado</strong>Cada cita y cada estudio pendiente son registros independientes. No se genera una orden real ni una cita institucional.</div>');
 return out.join('');
}
const buildSelect=(key,value='',more=[])=>{const opts=more.length?more:selectOptions(key).map(v=>({id:v,label:v}));return `<select data-dx-repeat="${esc(key)}"><option value="">Seleccione...</option>${opts.map(o=>`<option value="${esc(o.id)}" ${o.id===value?'selected':''}>${esc(o.label)}</option>`).join('')}</select>`;};
const repeatText=(key,value='',type='text')=>`<input data-dx-repeat="${esc(key)}" type="${type}" ${type==='date'?'max="'+untilNow()+'"':''} value="${esc(value||'')}">`;
const repeatArea=(key,value='',limit=750)=>`<textarea data-dx-repeat="${esc(key)}" maxlength="${limit}" rows="2">${esc(value||'')}</textarea>`;
function repeatForm(collection,r,d,i){let fields=[];
 const field=(name,body)=>fields.push(`<div class="dx-field"><label>${esc(meta[name]?.label||name)}</label>${body}</div>`);
 if(collection==='discharge_diagnoses'){
  field('diagnosis_id',buildSelect('diagnosis_id',r.diagnosis_id,optionsFor('diagnosis_id')));
  field('diagnosis_status',buildSelect('diagnosis_status',r.diagnosis_status));field('diagnosis_notes',repeatArea('diagnosis_notes',r.diagnosis_notes,500));
 }
 if(collection==='discharge_medications'){
  field('medication_order_id',buildSelect('medication_order_id',r.medication_order_id,optionsFor('medication_order_id')));
  field('medication_action',buildSelect('medication_action',r.medication_action));
  field('medication_indication',repeatText('medication_indication',r.medication_indication));
  field('medication_duration',repeatText('medication_duration',r.medication_duration));
  field('special_medication_instructions',repeatArea('special_medication_instructions',r.special_medication_instructions,500));
 }
 if(collection==='pending_results'){
  field('pending_test_id',buildSelect('pending_test_id',r.pending_test_id,optionsFor('pending_test_id')));
  field('pending_test_name',`<div class="dx-read">${esc(r.pending_test_name||'Derivado de la solicitud')}</div>`);
  field('followup_action',repeatArea('followup_action',r.followup_action));
 }
 if(collection==='followups'){
  field('followup_specialty',buildSelect('followup_specialty',r.followup_specialty));
  field('followup_date',repeatText('followup_date',r.followup_date,'date'));
  field('followup_interval',repeatText('followup_interval',r.followup_interval));
  field('followup_reason',repeatArea('followup_reason',r.followup_reason,500));
 }
 return `<div class="dx-repeat" data-dx-repeater="${esc(collection)}" data-dx-index="${i}"><div class="dx-repeat-head"><span>#${i+1} · ${esc({discharge_diagnoses:'Diagnóstico de egreso',discharge_medications:'Conciliación',pending_results:'Estudio pendiente',followups:'Control de seguimiento'}[collection])}</span><button type="button" class="dx-smallbtn danger" data-dx-remove="${esc(collection)}" data-dx-index="${i}" ${d.discharge_signed_at?'disabled':''}>Eliminar</button></div><div class="dx-grid">${fields.join('')}</div></div>`;
}
function repeatPanel(collection,d,title){return `<div class="dx-group"><h4>${esc(title)}</h4>${(d[collection]||[]).map((r,i)=>repeatForm(collection,r,d,i)).join('')||'<p class="dx-hint">Ningún registro agregado.</p>'}<button type="button" class="dx-smallbtn" data-dx-add="${esc(collection)}" ${d.discharge_signed_at?'disabled':''}>＋ Agregar ${esc(title.toLowerCase().replace(/s$/,''))}</button></div>`;}
function sourcesPanel(d){const a=integration();let result='<div class="dx-group"><h4>Procedimientos vinculados</h4><p class="dx-hint">Se importan referencias a procedimientos finalizados sin duplicar notas ni datos técnicos.</p>';
 for(const p of a.procedures){const present=d.discharge_procedure_links.some(x=>x.source_procedure_id===p.id);result+=`<label class="dx-compact"><span><strong>${esc(p.type)} · ${esc(p.date)}</strong><small>${esc(p.notes).slice(0,130)}</small></span><input type="checkbox" data-dx-procedure="${esc(p.id)}" ${present?'checked':''} ${d.discharge_signed_at?'disabled':''}></label>`;}
 if(!a.procedures.length)result+='<div class="dx-hint">No hay cirugías ni cateterismos finalizados para este ingreso.</div>';
 result+='</div>';
 result+=`<div class="dx-group"><h4>Complicaciones identificadas</h4>${a.complications.length?a.complications.map(x=>`<div class="dx-compact"><div><strong>${esc(x.source)} · ${esc(x.type||'Sin especificar')}</strong><small>Referencia UUID: ${esc(x.id)}</small></div></div>`).join(''):'<p class="dx-hint">No se encontraron complicaciones vinculadas a los módulos previos.</p>'}</div>`;
 return result;
}
function reviewed(d){const a=integration();const errs=validateDischarge(d);const existing={
  'Ingreso hospitalario':d.encounter_id&&d.admission_date?'Vinculado':'Falta hospitalización',
  'Enfermedad Actual':d.present_illness_id?`${sources?'Referencia ficticia':'Referencia'} · ${d.present_illness_id.slice(0,8)}…`:'Sin registro original disponible',
  'ECG / Ecocardiograma':d.discharge_ecg_id&&d.discharge_echo_id?(sources?'Referencias ficticias de prueba':'Estudios vinculados'):'Pendiente: módulos aún no desarrollados',
  'Radiografías':`${a.xrs.length} estudio(s) previo(s), ${d.discharge_cxr_id?'1 seleccionado':'ninguno seleccionado'}`,
  'Laboratorios':`${a.labEntries.length} resultado(s), ${d.discharge_lab_result_ids?.length||0} seleccionado(s)`,
  'Cirugías':`${d.cardiac_surgery_ids?.length||0} cirugía(s) vinculada(s)`,
  'Cateterismos':`${d.cath_ids?.length||0} procedimiento(s) vinculado(s)`,
  'Evoluciones':`${a.notes.length} nota(s) disponibles`,
  'Nota operatoria':d.operative_note_attached?'Referencia presente y firmada':(d.cardiac_surgery_ids.length?'Falta nota operatoria firmada':'No aplica')
 };
 const tiles=Object.entries(existing).map(([k,v])=>`<div class="dx-minicard"><strong>${esc(k)}</strong><p>${esc(v)}</p></div>`).join('');
 const all=SPEC.map(f=>{let val=d[f.key];if(repeatKeys.includes(f.key))val=(d[Object.keys(repeatGroups).find(g=>repeatGroups[g].includes(f.key))]||[]).map(x=>x[f.key]);return `<tr><td><code>${esc(f.key)}</code></td><td>${esc(f.type)}</td><td>${esc(fmt(val))}</td><td>${esc(f.rule)}</td></tr>`}).join('');
 let text=`HISTORIA CLÍNICA ELECTRÓNICA HCIL — EGRESO (SIMULACIÓN)\nPaciente: ${document.getElementById('patientHeroName')?.textContent||'Paciente ficticio'}\nHistoria HCIL: ${document.getElementById('mrnPreview')?.textContent||'Pendiente'}\nFecha de egreso: ${d.discharge_date||'—'} ${d.discharge_time||''}\nServicio: ${d.discharge_service||'—'} · Destino: ${d.discharge_disposition||'—'}\nEstancia hospitalaria: ${fmt(d.length_of_stay_days)} días\n\nENFERMEDAD ACTUAL AL INGRESO\n${d.present_illness_display||'[Pendiente: módulo no integrado]'}\n\nEVOLUCIÓN INTRAHOSPITALARIA\n${d.hospital_course_summary||'[Pendiente]'}\n\nEXAMEN FÍSICO AL EGRESO\n${d.discharge_exam_summary||'[Pendiente]'}\n\nDIAGNÓSTICOS DE EGRESO\n${d.discharge_diagnoses.map(r=>labelForOption('diagnosis_id',r.diagnosis_id)+' · '+(r.diagnosis_status||'')).join('\n')||'[Pendiente]'}\n\nPROCEDIMIENTOS\n${d.discharge_procedure_links.map(r=>r.procedure_type+' '+r.procedure_date).join('\n')||'Ninguno vinculado'}\n\nCONCILIACIÓN TERAPÉUTICA\n${d.discharge_medications.map(r=>labelForOption('medication_order_id',r.medication_order_id)+' · '+r.medication_action+' · '+r.medication_indication).join('\n')||'Sin medicación indicada en el simulador'}\n\nINDICACIONES Y SIGNOS DE ALARMA\n${(d.warning_signs||[]).join('; ')}\n\nCITAS DE CONTROL\n${d.followups.map(x=>x.followup_specialty+' · '+(x.followup_date||x.followup_interval)+' · '+x.followup_reason).join('\n')}\n\nESTADO: ${d.discharge_summary_status||'Borrador'}\nFirma: ${d.discharge_signed_by||'No firmada'}\nIMPORTANTE: DOCUMENTO FICTICIO PARA VALIDACIÓN DE REQUERIMIENTOS. NO ES UN EGRESO CLÍNICO REAL.`;
 return `<div class="dx-alert ${errs.length?'':'success'}"><strong>${errs.length?'Pendiente de validación':'Datos completos para firma simulada'}</strong>${errs.length?`Faltan ${errs.length} requisitos. Seleccione los campos o complete los registros faltantes.`:'El prototipo supera las validaciones de datos, sin autenticar a ningún profesional.'}</div>
 <div class="dx-statline"><div class="dx-minicard"><strong>Diagnósticos</strong><p>${d.discharge_diagnoses.length}</p></div><div class="dx-minicard"><strong>Medicamentos conciliados</strong><p>${d.discharge_medications.length}</p></div><div class="dx-minicard"><strong>Controles programados</strong><p>${d.followups.length}</p></div></div>
 <div class="dx-group"><h4>Comprobaciones del informe</h4><ul class="dx-reviewlist">${errs.length?errs.map(e=>`<li><button type="button" class="dx-smallbtn" data-dx-jump="${esc(e.key)}" style="margin-right:7px">Ir</button>${esc(e.message)}</li>`).join(''):'<li class="ok">Todas las verificaciones del egreso simulado se han cumplido.</li>'}</ul></div>
 <div class="dx-group"><h4>Fuentes y vínculos disponibles</h4><div class="dx-grid">${tiles}</div></div>
 <div class="dx-group"><h4>Resumen para revisión médica y familia — SOLO DEMO</h4><div class="dx-note-preview">${esc(text)}</div><div class="dx-btnrow"><button type="button" class="dx-smallbtn" id="dx_print">Imprimir resumen simulado</button></div></div>
 <div class="dx-group"><h4>Vista técnica · 120 campos de la tabla suministrada</h4><p class="dx-hint">Los campos de tablas repetibles se muestran como valores agrupados, y los identificadores conservan su tipo técnico.</p><div class="dx-tech"><table><thead><tr><th>ID técnico</th><th>Tipo BD</th><th>Valor</th><th>Regla</th></tr></thead><tbody>${all}</tbody></table></div></div>`;
}
function bodyFor(t,d){let html=noticeFor(t,d)+panel(t,d);
 if(t==='procedures')html+=sourcesPanel(d);
 if(t==='diagnoses')html+=repeatPanel('discharge_diagnoses',d,'Diagnósticos de egreso');
 if(t==='medication')html+=repeatPanel('discharge_medications',d,'Medicamentos conciliados');
 if(t==='followup')html+=repeatPanel('pending_results',d,'Resultados pendientes')+repeatPanel('followups',d,'Citas de seguimiento');
 if(t==='review')html=reviewed(d);
 return html;
}
function render(){const d=active();$('dx_count').textContent=discharges.filter(x=>x.discharge_signed_at).length+' firmado(s)';$('dx_status_count').textContent=discharges.length+' registro(s) en esta sesión';
 $('dx_record_list').innerHTML=discharges.length?discharges.map((r,i)=>`<button type="button" class="dx-entry ${r.discharge_id===activeId?'active':''}" data-dx-open="${esc(r.discharge_id)}"><strong>${esc(r.discharge_date||'Sin fecha')} · ${r._auxiliary.intent==='adenda'?'Adenda':'Egreso'}</strong><small>${esc(r.discharge_disposition||'Destino pendiente')}</small><span class="dx-tag ${r.discharge_signed_at?'final':''}">${esc(r.discharge_summary_status)}</span></button>`).join(''):'<div class="dx-hint" style="padding:16px">Sin informes todavía.</div>';
 $('dx_empty').hidden=!!d;$('dx_editor').hidden=!d;if(!d)return;
 normalizeDerived(d);
 $('dx_editor_title').textContent=d._auxiliary.intent==='adenda'?'Adenda al egreso':'Resumen de egreso';$('dx_editor_sub').textContent=(d.discharge_date||'Fecha pendiente')+' · '+(d.encounter_id?'Hospitalización '+d.encounter_id.slice(0,8)+'…':'Sin hospitalización vinculada');
 $('dx_badge').textContent=d.discharge_summary_status;$('dx_tabs').innerHTML=TABS.map(([k,n])=>`<button type="button" class="dx-tab ${k===tab?'active':''}" data-dx-tab="${k}">${esc(n)}</button>`).join('');
 $('dx_body').innerHTML=bodyFor(tab,d);
 $('dx_save_draft').hidden=!!d.discharge_signed_at;$('dx_sign').hidden=!!d.discharge_signed_at;$('dx_addendum').hidden=!d.discharge_signed_at||d._auxiliary.intent==='adenda';
 $('dx_foot_feedback').textContent=modalMessage;modalMessage='';
}
function newRecord(intent='normal',parent=null){const base=discharges.find(x=>x._auxiliary.intent==='normal'&&x.discharge_signed_at);
 if(intent==='normal'&&base){modalMessage='Este ingreso ya tiene un egreso firmado. Registre una adenda en lugar de generar otro egreso.';activeId=base.discharge_id;render();return;}
 if(intent==='normal'&&discharges.some(x=>x._auxiliary.intent==='normal'&&!x.discharge_signed_at)){activeId=discharges.find(x=>x._auxiliary.intent==='normal'&&!x.discharge_signed_at).discharge_id;modalMessage='Ya existe un borrador de egreso para esta hospitalización.';render();return;}
 const d=makeDraft(intent,parent);discharges.push(d);activeId=d.discharge_id;tab='episode';modalMessage='Registro creado; complete los campos antes de firmar.';render();}
function addRepeater(collection){const d=active();if(!d||d.discharge_signed_at)return;const template={};for(const f of repeatGroups[collection])template[f]=null;
 const idKey=repeatGroups[collection][0];template[idKey]=mkid();d[collection].push(template);render();}
function removeRepeater(coll,index){const d=active();if(!d||d.discharge_signed_at)return;d[coll].splice(index,1);render();}
function val(v){return v===true||v===false?String(v):v??'';}
function updateElement(el,isChange){const d=active();if(!d||d.discharge_signed_at)return;
 if(el.dataset.dxKey){const k=el.dataset.dxKey;let v=el.value;
  if(BOOLEANS.has(k))v=v===''?null:v==='true';
  else if(el.type==='number')v=v===''?null:Number(v);
  d[k]=v;
  if(k==='discharge_cxr_id')d.discharge_cxr_date=integration().xrs.find(x=>x.chest_xray_id===v)?.xray_date||null;
  if(k==='present_illness_id')d.present_illness_display=sources?.presentIllness?.id===v?sources.presentIllness.text:null;
  if(['discharge_date','discharge_time','discharge_cxr_id','discharge_cxr_status','discharge_labs_status'].includes(k))normalizeDerived(d);
  if(isChange){render()}
  return;
 }
 if(el.dataset.dxMulti){const k=el.dataset.dxMulti;let arr=d[k]||[];arr=el.checked?unique([...arr,el.value]):arr.filter(x=>x!==el.value);d[k]=arr;
  if(k==='cardiac_surgery_ids'||k==='cath_ids')normalizeDerived(d);
  if(isChange)render();return;
 }
 if(el.dataset.dxRepeat){const box=el.closest('[data-dx-repeater]');if(!box)return;const arr=d[box.dataset.dxRepeater];const r=arr[Number(box.dataset.dxIndex)];if(!r)return;
  const k=el.dataset.dxRepeat;r[k]=el.value;
  if(k==='pending_test_id')r.pending_test_name=optionsFor(k).find(o=>o.id===el.value)?.label||null;
  if(isChange&&(k==='pending_test_id'||k==='medication_order_id'||k==='diagnosis_id'))render();return;
 }
}
function required(k,d){
 if(!isVisible(k,d))return false;
 if(['discharge_id','encounter_id','admission_date','discharge_physician_id','discharge_summary_status','discharge_signed_by','discharge_signed_at','length_of_stay_days','present_illness_id','present_illness_display','admission_diagnosis_ids','discharge_physical_exam_id','discharge_vitals_id','discharge_ecg_id','discharge_echo_id'].includes(k))return true;
 if(['cardiac_surgery_performed','cath_performed_during_stay','ep_performed_during_stay','operative_note_attached'].includes(k))return false;
 if(k==='icu_stay_days')return yes(d.icu_admission_occurred);
 if(['operative_note_id'].includes(k))return !!d.cardiac_surgery_ids.length&&!d.operative_note_missing_reason;
 if(k==='operative_note_missing_reason')return !!d.cardiac_surgery_ids.length&&!d.operative_note_attached;
 if(k==='discharge_cxr_id'||k==='discharge_cxr_summary')return d.discharge_cxr_status==='Realizada';
 if(k==='discharge_cxr_not_done_reason')return d.discharge_cxr_status==='No realizada';
 if(k==='discharge_labs_summary'||k==='discharge_lab_result_ids')return d.discharge_labs_status==='Disponibles';
 if(['oxygen_flow_home','oxygen_interface_home'].includes(k))return yes(d.oxygen_at_home);
 if(k==='activity_restriction_detail')return d.activity_restriction!=='Sin restricción';
 if(k==='sternal_precautions')return !!d.cardiac_surgery_ids.length;
 if(k==='sternal_precautions_duration')return !!d.cardiac_surgery_ids.length&&d.sternal_precautions==='Sí';
 if(k==='wound_care_required')return !!d.cardiac_surgery_ids.length;
 if(k==='wound_care_instructions')return !!d.cardiac_surgery_ids.length&&yes(d.wound_care_required);
 if(k==='ie_prophylaxis_instructions')return d.ie_prophylaxis_status==='Indicada';
 if(k==='anticoagulant_medication_id')return yes(d.anticoagulation_at_discharge);
 if(k==='target_inr_min'||k==='target_inr_max'||k==='next_inr_date')return yes(d.anticoagulation_at_discharge)&&d._auxiliary.is_vka===true;
 if(k==='home_spo2_monitoring'||k==='home_weight_monitoring'||k==='home_hr_monitoring'||k==='home_feeding_monitoring')return yes(d.home_monitoring_required);
 if(k==='warning_sign_other')return d.warning_signs?.includes('Otro');
 if(k==='transfer_facility'||k==='transfer_reason')return d.discharge_disposition==='Traslado a otro hospital';
 if(k==='cath_discharge_summary')return !!d.cath_ids.length;
 if(k==='ep_discharge_summary')return d.ep_performed_during_stay===true;
 if(k==='complications_summary')return d.complication_links.length>0||d.unresolved_complication_present===true;
 if(k==='surgery_result_discharge')return !!d.cardiac_surgery_ids.length;
 if(k==='discharge_weight_kg'||k==='discharge_spo2')return true;
 if(k==='home_feeding_route')return true;
 if(k==='warning_signs')return true;
 if(k==='discharge_summary_status')return true;
 // all other "Sí" fields are mandatory, conditional only when displayed and noted above
 return meta[k]?.required==='Sí';
}
function validateDischarge(d){if(!d)return[];normalizeDerived(d);
 const errors=[],add=(k,m)=>errors.push({key:k,message:m});
 for(const f of SPEC){const k=f.key;if(repeatKeys.includes(k)||k==='discharge_signed_by'||k==='discharge_signed_at'||k==='discharge_procedure_link_id'||k==='complication_link_id'||k==='discharge_diagnosis_id'||k==='discharge_medication_id'||k==='pending_result_id'||k==='followup_id')continue;
  if(!required(k,d))continue;
  let v=d[k];if(v===null||v===undefined||v===''||Array.isArray(v)&&!v.length)add(k,'Falta completar «'+f.label+'».');
 }
 if(!d.encounter_id||!d.admission_date)add('encounter_id','No se encontró un ingreso hospitalario original con fecha asociada.');
 if(d.discharge_date&&d.admission_date&&d.discharge_date<d.admission_date)add('discharge_date','La fecha de egreso debe ser posterior o igual a la fecha de ingreso.');
 if(d.discharge_date&&d.discharge_date>untilNow())add('discharge_date','No se permite firmar un egreso con fecha futura.');
 if(!/^\d\d:\d\d$/.test(d.discharge_time||''))add('discharge_time','Ingrese hora válida del egreso.');
 for(const k of ['present_illness_id','discharge_ecg_id','discharge_echo_id','discharge_physical_exam_id','discharge_vitals_id'])if(d[k]&&!linkIsValid(k,d[k]))add(k,'La referencia de «'+(meta[k]?.label||k)+'» no existe en las fuentes disponibles.');
 if(d.discharge_cxr_status==='Realizada'&&d.discharge_cxr_id&&!linkIsValid('discharge_cxr_id',d.discharge_cxr_id))add('discharge_cxr_id','La radiografía seleccionada no existe en los estudios del ingreso.');
 if(d.discharge_labs_status==='Disponibles')for(const id of d.discharge_lab_result_ids||[])if(!linkIsValid('discharge_lab_result_ids',id))add('discharge_lab_result_ids','Uno de los resultados de laboratorio seleccionados no está disponible.');
 if(d.discharge_weight_kg!==null&&!(Number(d.discharge_weight_kg)>0))add('discharge_weight_kg','El peso al egreso debe ser positivo.');
 if(d.discharge_spo2!==null&&(Number(d.discharge_spo2)<0||Number(d.discharge_spo2)>100))add('discharge_spo2','SpO₂ debe estar entre 0 y 100 %.');
 if(d.icu_admission_occurred===true&&!(Number(d.icu_stay_days)>=0))add('icu_stay_days','Indique días de UCI/UCIP documentados; la V13 no dispone del cálculo exacto.');
 if(d.discharge_diagnoses.length===0)add('diagnosis_id','Registre al menos un diagnóstico estructurado de egreso.');
 d.discharge_diagnoses.forEach((r,i)=>{if(!r.diagnosis_id)add('diagnosis_id',`Diagnóstico #${i+1}: seleccione un diagnóstico.`);if(!r.diagnosis_status)add('diagnosis_status',`Diagnóstico #${i+1}: falta estado.`)});
 d.discharge_medications.forEach((r,i)=>{for(const k of ['medication_order_id','medication_action','medication_indication'])if(!r[k])add(k,`Medicamento #${i+1}: falta ${meta[k]?.label||k}.`);if(r.medication_order_id&&!linkIsValid('medication_order_id',r.medication_order_id))add('medication_order_id','Medicamento #'+(i+1)+': la orden de origen no existe.');});
 d.pending_results.forEach((r,i)=>{if(!r.pending_test_id)add('pending_test_id',`Resultado pendiente #${i+1}: falta orden original.`);if(!r.followup_action)add('followup_action',`Resultado pendiente #${i+1}: falta plan de actuación.`)});
 d.followups.forEach((r,i)=>{if(!r.followup_specialty||!r.followup_reason)add('followup_specialty',`Cita #${i+1}: especialidad y motivo obligatorios.`);if(!r.followup_date&&!r.followup_interval)add('followup_interval',`Cita #${i+1}: establezca fecha o intervalo.`)});
 if(d.unresolved_complication_present===true&&!d.followups.length)add('followup_specialty','Complicación activa: necesita seguimiento especificado.');
 if((d.vascular_access_at_discharge&&d.vascular_access_at_discharge!=='Ninguno'||d.drain_at_discharge===true)&&!String(d.devices_summary||'').trim())add('devices_summary','Describa las instrucciones de cuidado del acceso o drenaje al egreso.');
 if(d.cardiac_surgery_ids.length&&!d.operative_note_attached&&!String(d.operative_note_missing_reason||'').trim())add('operative_note_missing_reason','Falta nota operatoria original y su justificación excepcional.');
 if(d.cardiac_surgery_ids.length&&d.operative_note_attached&&d.operative_note_id&&!integration().surgeries.some(s=>s.operative_note_id===d.operative_note_id))add('operative_note_id','La nota operatoria vinculada no corresponde a las cirugías finalizadas.');
 if(d.home_spo2_monitoring===true&&d.home_spo2_lower_limit!==null&&d.home_spo2_upper_limit!==null&&Number(d.home_spo2_upper_limit)<=Number(d.home_spo2_lower_limit))add('home_spo2_lower_limit','El límite superior de SpO₂ debe superar al inferior.');
 if(d._auxiliary.is_vka===true&&d.anticoagulation_at_discharge===true&&Number(d.target_inr_max)<=Number(d.target_inr_min))add('target_inr_max','INR máximo debe ser mayor al mínimo.');
 if(d.discharge_disposition==='Fallecimiento'&&d.home_monitoring_required===true)add('home_monitoring_required','Inconsistencia: se registró monitoreo domiciliario y destino Fallecimiento.');
 // note: the clinical source id blockers can be addressed only by real future modules, or synthetic demo sources
 if(d._auxiliary.has_synthetic_sources&&!sources)add('present_illness_id','La fuente ficticia se reinició; no se pueden verificar las referencias.');
 return errors;
}
function saveDraft(){let d=active();if(!d||d.discharge_signed_at)return;d._auxiliary.last_saved_at=iso();modalMessage='Borrador guardado únicamente en memoria de esta página. No se realizó registro hospitalario real.';render();}
function freezeDeep(x){if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freezeDeep);Object.freeze(x)}return x;}
function sign(){const d=active();if(!d||d.discharge_signed_at)return;
 const errors=validateDischarge(d);if(errors.length){tab='review';modalMessage=`No puede firmarse: ${errors.length} requisitos pendientes.`;render();return;}
 d.discharge_signed_by='PROFESIONAL-DEMO-SIN-AUTENTICAR';d.discharge_signed_at=iso();d.discharge_summary_status=d._auxiliary.intent==='adenda'?'Adenda':'Firmado';d._auxiliary.signature_validation='FIRMA SIMULADA - NO ES IDENTIDAD VERIFICADA NI FIRMA LEGAL';d._auxiliary.last_saved_at=iso();freezeDeep(d);
 tab='review';modalMessage='Firma ficticia de demostración. Egreso bloqueado para edición directa.';render();}
function capture(){return {hospital_discharges:discharges.filter(d=>d.discharge_signed_at).map(d=>structuredClone(d)),_discharge_pending_drafts:discharges.filter(d=>!d.discharge_signed_at).map(d=>structuredClone(d)),_discharge_demo_sources:sources?structuredClone(sources):null,_discharge_spec_count:SPEC.length};}
function validate(paint=false){return [];/* un egreso en borrador no impide guardar la ficha general; se valida al firmar egreso */}
function summary(){const count=discharges.filter(d=>d.discharge_signed_at).length;return `${count} egreso(s)/adenda(s) firmados (demo), ${discharges.length-count} borrador(es). ${sources?'Incluye referencias sintéticas identificadas.':''}`;}
function reset(){discharges=[];activeId=null;tab='episode';sources=null;modalMessage='';render();}
function sample(){sources=createSources();const a=integration(),d=makeDraft();d.discharge_date=untilNow();d.discharge_time='14:30';
 d.admission_condition='Delicada';d.hospital_course_outcome='Favorable';d.icu_admission_occurred=true;d.icu_stay_days=1;d.mechanical_ventilation_during_stay=true;d.mechanical_support_during_stay=false;
 d.hospital_course_summary='Hospitalización de demostración por cardiopatía congénita. Se registró valoración preoperatoria, cateterismo y cirugía cardiovascular. Evolución favorable en este caso ficticio; no corresponde a una atención real.';
 d.consultations_summary='No se dispone de módulo de interconsultas; sin referencias originales vinculadas en la demo.';
 d.unresolved_complication_present=false;
 d.discharge_exam_summary='Paciente ficticia alerta, con adecuada perfusión y signos vitales sin alteraciones relevantes en la última evolución simulada.';
 d.discharge_cxr_summary='Radiografía de control ficticia: sin hallazgos agudos relevantes. Consultar informe original vinculado por UUID.';
 d.discharge_cxr_comparison='Sin cambios';d.discharge_labs_summary='Hemograma y perfil químico ficticios revisados. Referencias pediátricas no precargadas; no se infieren valores normales.';
 d.discharge_studies_summary='Se requieren los módulos institucionales de ECG y ecocardiograma; esta demo utiliza referencias sintéticas.';
 d.cath_discharge_summary='Cateterismo previo de demostración: consulte la conclusión del procedimiento enlazado, sin duplicar información.';
 d.discharge_diagnoses=[{discharge_diagnosis_id:mkid(),diagnosis_id:sources.admissionDiagnoses[0].id,diagnosis_status:'Postoperatorio',diagnosis_notes:'Ejemplo de enfermedad congénita intervenida; catálogo formal pendiente.'}];
 d.discharge_medications=[{discharge_medication_id:mkid(),medication_order_id:sources.medOrders[0].id,medication_action:'Continuar',medication_indication:'Según prescripción original (simulada)',medication_duration:'Hasta próxima valoración',special_medication_instructions:'No hay dosis registrada en este ejemplo; nunca utilizar para medicación real.'}];
 d.surgery_result_discharge=a.surgeries.length?'Reparación satisfactoria':null;
 d.oxygen_at_home=false;d.vascular_access_at_discharge='Ninguno';d.drain_at_discharge=false;d.home_equipment_required=[];
 d.home_feeding_route=['Oral'];d.home_diet_type='Alimentación según tolerancia y recomendaciones del equipo tratante (solo ejemplo ficticio).';
 d.activity_restriction='Restricción parcial';d.activity_restriction_detail='Recomendaciones individualizadas por el equipo tratante; ejemplo sin alcance terapéutico.';
 d.sternal_precautions=d.cardiac_surgery_ids.length?'Sí':null;d.sternal_precautions_duration=d.cardiac_surgery_ids.length?'Según control de cirugía cardiovascular':null;
 d.wound_care_required=!!d.cardiac_surgery_ids.length;d.wound_care_instructions=d.cardiac_surgery_ids.length?'Vigilar el estado de la herida; seguir indicaciones del centro tratante. Texto de demostración.':null;
 d.bathing_instructions='Según indicaciones individualizadas al alta.';
 d.ie_prophylaxis_status='Pendiente definición';d.anticoagulation_at_discharge=false;d.home_monitoring_required=false;
 d.warning_signs=['Dificultad respiratoria','Fiebre','Decaimiento','Alteración de herida'];
 d.pending_results=[{pending_result_id:mkid(),pending_test_id:sources.pendingTests[0].id,pending_test_name:sources.pendingTests[0].label,followup_action:'Revisar resultado en control programado de cardiología. Solicitud ficticia.'}];
 d.followups=[{followup_id:mkid(),followup_specialty:'Cardiología infantil',followup_date:null,followup_interval:'7 días (ejemplo)',followup_reason:'Valoración clínica de continuidad asistencial, revisión de heridas e indicaciones (solo simulación).'}];
 d.discharge_disposition='Domicilio'; d.discharge_physician_id='PROFESIONAL-DEMO-SIN-AUTENTICAR';
 if(d.cardiac_surgery_ids.length&&!d.operative_note_attached)d.operative_note_missing_reason='Nota operatoria V11 no firmada o ausente en el origen.';
 if(!d.discharge_cxr_id){d.discharge_cxr_status='No realizada';d.discharge_cxr_not_done_reason='Sin radiografía previa vinculable a este ingreso en la demo.';}
 if(!d.discharge_vitals_id){d.discharge_vitals_id=a.notes.at(-1)?.daily_note_id||null;}
 normalizeDerived(d);discharges=[d];activeId=d.discharge_id;tab='episode';modalMessage='Ejemplo ficticio de egreso cargado. Explore sus pestañas y valide antes de firmar.';render();}
function showField(k){let t=TAB_FOR[meta[k]?.category]||'review';if(meta[k]?.category==='EVOLUCIÓN INTRAHOSPITALARIA'&&meta[k]?.subcat==='PROCEDIMIENTOS REALIZADOS DURANTE LA HOSPITALIZACIÓN')t='procedures';if(repeatKeys.includes(k)){t=({discharge_diagnoses:'diagnoses',discharge_medications:'medication',pending_results:'followup',followups:'followup',discharge_procedure_links:'procedures'}[Object.keys(repeatGroups).find(g=>repeatGroups[g].includes(k))]||t);}tab=t;render();setTimeout(()=>{const element=document.querySelector(`[data-dx-wrap="${k}"], [data-dx-repeat="${k}"]`);element?.scrollIntoView?.({block:'center',behavior:'smooth'});},40);}
function exportJSON(){const b=new Blob([JSON.stringify(capture(),null,2)],{type:'application/json'});const url=URL.createObjectURL(b);const a=document.createElement('a');a.href=url;a.download='HCIL_V14_EGRESOS_DEMO.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),600);}
function init(){
 $('dx_new').addEventListener('click',()=>newRecord());
 $('dx_example').addEventListener('click',()=>{if(!integration().encounter){modalMessage='Cargue primero «Cargar ejemplo ficticio» de la ficha general para disponer de hospitalización.';render();return;}sample();});
 $('dx_export').addEventListener('click',exportJSON);
 $('dx_save_draft').addEventListener('click',saveDraft);
 $('dx_sign').addEventListener('click',sign);
 $('dx_addendum').addEventListener('click',()=>{const d=active();if(d?.discharge_signed_at)newRecord('adenda',d.discharge_id)});
 const board=$('pane_egresos');
 board.addEventListener('click',e=>{
  const t=e.target.closest('button');if(!t)return;
  if(t.dataset.dxTab){tab=t.dataset.dxTab;render();return;}
  if(t.dataset.dxOpen){activeId=t.dataset.dxOpen;tab='episode';render();return;}
  if(t.dataset.dxAdd){addRepeater(t.dataset.dxAdd);return;}
  if(t.dataset.dxRemove){removeRepeater(t.dataset.dxRemove,Number(t.dataset.dxIndex));return;}
  if(t.dataset.dxJump){showField(t.dataset.dxJump);return;}
  if(t.id==='dx_print'){const w=window.open('','_blank');if(w){w.document.write('<!doctype html><meta charset="utf-8"><title>HCIL egreso demo</title><body style="font:14px Arial;margin:45px"><pre style="white-space:pre-wrap;font:14px/1.6 Arial">'+esc(document.querySelector('.dx-note-preview')?.textContent||'')+'</pre></body>');w.document.close();w.focus();w.print();}return;}
 });
 board.addEventListener('input',e=>{if(e.target.matches('[data-dx-key],[data-dx-repeat],[data-dx-multi]'))updateElement(e.target,false);});
 board.addEventListener('change',e=>{const t=e.target;if(t.matches('[data-dx-key],[data-dx-repeat],[data-dx-multi]'))updateElement(t,true);
   if(t.dataset.dxProcedure){const d=active();if(!d||d.discharge_signed_at)return;const a=integration(),p=a.procedures.find(x=>x.id===t.dataset.dxProcedure);if(!p)return;
      d.discharge_procedure_links=t.checked?unique([...d.discharge_procedure_links.map(x=>x.source_procedure_id),p.id]).map(id=>{const found=a.procedures.find(x=>x.id===id);const prev=d.discharge_procedure_links.find(x=>x.source_procedure_id===id);return prev||{discharge_procedure_link_id:mkid(),procedure_type:found.type,source_procedure_id:found.id,procedure_date:found.date}}):d.discharge_procedure_links.filter(x=>x.source_procedure_id!==p.id);
      d.cardiac_surgery_ids=unique(d.discharge_procedure_links.filter(x=>x.procedure_type==='Cirugía cardiovascular').map(x=>x.source_procedure_id));
      d.cath_ids=unique(d.discharge_procedure_links.filter(x=>x.procedure_type==='Cateterismo').map(x=>x.source_procedure_id));render();
   }
 });
 document.querySelectorAll('[data-go="egresos"]').forEach(b=>b.addEventListener('click',()=>{render();}));
}
window.HCILDischarge={spec:SPEC,repeatGroups,repeatKeys,capture,validate,reset,sample,summary,showField,go:t=>{tab=t;render()},test:()=>({discharges,active:activeId,tab,issues:validateDischarge(active