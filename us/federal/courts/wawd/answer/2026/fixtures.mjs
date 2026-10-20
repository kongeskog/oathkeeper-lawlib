import {mkdir,writeFile} from 'node:fs/promises';
const dir=import.meta.dirname;
const known=value=>({state:'known',value,evidence:['hypothetical-fixture:accepted-finding']});
const bool=value=>known({type:'bool',value});
const int=value=>known({type:'int',value:String(value)});
const record=(name,fields)=>known({type:'record',name,type_args:[],fields});
const date=iso=>record('std.date.Date',{day:int(Math.floor(Date.parse(iso+'T00:00:00Z')/86400000))});
const list=items=>known({type:'list',items});
const missing=id=>({state:'missing',issues:[{id,kind:'Fact',message:'No accepted finding supplied'}]});
const disputed=id=>({state:'disputed',issue:id,claims:[true,false].map(value=>({value:{type:'bool',value},evidence:['competing claim']}))});
// Expected dates are independently authored, not calculated by a duplicate evaluator.
const cases=[
 {id:'ordinary',on:'2026-03-02',expected:'2026-03-23',reason:'21 days after Monday March 2 is Monday March 23; intermediate weekends count.'},
 {id:'saturday_endpoint',on:'2026-03-07',expected:'2026-03-30'},
 {id:'washington_friday_holiday',on:'2026-11-06',expected:'2026-11-30',reason:'Day 21 is Friday November 27, a Washington legal holiday; weekend follows.'},
 {id:'thanksgiving',on:'2026-11-05',expected:'2026-11-30'},
 {id:'july_observance',on:'2026-06-12',expected:'2026-07-06'},
 {id:'juneteenth',on:'2026-05-29',expected:'2026-06-22'},
 {id:'columbus_day',on:'2026-09-21',expected:'2026-10-13'},
 {id:'recognized_day_not_holiday',on:'2026-03-10',expected:'2026-03-31',reason:'March 31 recognition under RCW (7) does not make it a legal holiday.'},
 {id:'additional_declared_holiday',on:'2026-03-02',extra:['2026-03-23'],expected:'2026-03-24',reason:'Synthetic additional legally declared holiday finding.'},
 {id:'no_automatic_three_days',on:'2026-03-02',expected:'2026-03-23',reason:'Personal Rule 4 service does not receive Rule 6(d) days.'},
 {id:'first_supported_date',on:'2026-01-13',expected:'2026-02-03'},
 {id:'last_supported_date',on:'2026-12-04',expected:'2026-12-28'},
 {id:'earlier_revision_not_assumed',on:'2026-01-12',status:'outside_coverage'},
 {id:'cross_year_excluded',on:'2026-12-05',status:'outside_coverage'},
 {id:'invalid_service',patch:{valid_personal_rule4_service:bool(false)},status:'inapplicable'},
 {id:'unknown_service',patch:{valid_personal_rule4_service:missing('valid-service')},status:'undetermined',stage:'applicability',issue:'valid-service'},
 {id:'unknown_motion',patch:{rule12_motion_served:missing('motion')},status:'undetermined',stage:'scope',issue:'motion'},
 {id:'disputed_order',patch:{modifying_order:disputed('order-dispute')},status:'undetermined',stage:'scope',issue:'order-dispute'},
 {id:'unknown_holiday_inventory',patch:{additional_holidays_complete:missing('holiday-inventory')},status:'undetermined',stage:'scope',issue:'holiday-inventory'},
 {id:'wrong_court',patch:{court_id:known({type:'text',value:'us.court.waed'})},status:'outside_coverage'},
 ...['service_waived','removed_from_state_court','rule12_motion_served','amended_pleading','different_statutory_period','modifying_order','stay_or_tolling','special_proceeding'].map(field=>({id:field,patch:{[field]:bool(true)},status:'outside_coverage'})),
 ...['selected_authorities_apply','ordinary_original_complaint','private_domestic_defendant','procedural_inventory_complete','additional_holidays_complete'].map(field=>({id:field,patch:{[field]:bool(false)},status:'outside_coverage'})),
];
await mkdir(dir+'/tests',{recursive:true});await mkdir(dir+'/scenarios',{recursive:true});
for(const c of cases){
 const fields={court_id:known({type:'text',value:'us.court.wawd'}),served_on:date(c.on??'2026-03-02'),additional_federal_holidays:list((c.extra??[]).map(date)),additional_state_holidays:list([])};
 for(const f of ['selected_authorities_apply','valid_personal_rule4_service','ordinary_original_complaint','private_domestic_defendant','procedural_inventory_complete','additional_holidays_complete'])fields[f]=bool(true);
 for(const f of ['service_waived','removed_from_state_court','rule12_motion_served','amended_pleading','different_statutory_period','modifying_order','stay_or_tolling','special_proceeding'])fields[f]=bool(false);
 Object.assign(fields,c.patch);
 const request={version:'0.1.0',query:'us.wawd.answer.answer_service_date',arguments:{facts:record('us.wawd.answer.AnswerFacts',fields)},metadata:{fixture_kind:'Hypothetical facts; real pinned authorities',legal_review:'Unreviewed',reason:c.reason??c.id}};
 const expected={kind:'outcome',status:c.expected?'resolved':c.status,...(c.expected?{value:date(c.expected).value}:{}),...(c.issue?{stage:c.stage,issue_ids:[c.issue]}:{})};
 // A computed date has no new observation evidence attached to its day field.
 if(c.expected)expected.value.fields.day.evidence=[];
 await writeFile(dir+'/tests/'+c.id+'.json',JSON.stringify({name:c.id,request,expected},null,2)+'\n');
 if(c.id==='washington_friday_holiday')await writeFile(dir+'/scenarios/thanksgiving-friday.json',JSON.stringify(request,null,2)+'\n');
}
console.log(`Wrote ${cases.length} fixtures`);
