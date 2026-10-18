import type { Item, UIComponent } from '../lib/schema';
export function comparisonResults(items:Item[],criteria:NonNullable<UIComponent['criteria']>){const total=criteria.reduce((sum,c)=>sum+c.weight,0);return items.map(item=>({id:item.id,label:item.label,score:total?criteria.reduce((sum,c)=>sum+(item.scores?.[c.id]??50)*c.weight,0)/total:0})).sort((a,b)=>b.score-a.score);}
export function scheduleFacts(items:Item[]){
 const assigned=items.filter(i=>i.date&&i.group&&i.group.toLowerCase()!=='unassigned');
 const employees=Array.from(new Set(assigned.map(i=>i.group!)));
 const start=items.map(i=>i.date?.slice(0,10)).filter((d):d is string=>!!d).sort()[0];
 const anchor=start?new Date(`${start}T12:00:00Z`):null;
 if(anchor)anchor.setUTCDate(anchor.getUTCDate()-((anchor.getUTCDay()+6)%7));
 const weekStart=anchor?.toISOString().slice(0,10);
 const weekEnd=anchor?new Date(anchor.getTime()+7*86400000).toISOString().slice(0,10):undefined;
 const week=assigned.filter(i=>!weekStart||(i.date!>=weekStart&&i.date!<weekEnd!));
 const conflicts=employees.flatMap(employee=>{const dates=Array.from(new Set(week.filter(i=>i.group===employee).map(i=>i.date?.slice(0,10))));return dates.filter(date=>week.filter(i=>i.group===employee&&i.date?.slice(0,10)===date).length>1).map(date=>`${employee} has multiple assignments on ${date}. Review times for overlap.`)});
 const daysOff=employees.map(employee=>({employee,daysOff:7-new Set(week.filter(i=>i.group===employee).map(i=>i.date?.slice(0,10))).size}));
 return {conflicts,daysOff,unassigned:items.filter(i=>!i.group||i.group.toLowerCase()==='unassigned').length,weekStart};
}
