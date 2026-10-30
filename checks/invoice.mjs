import {validate} from './schema.mjs';
const TOLERANCE=0.01;
const near=(a,b)=>Math.abs(a-b)<=TOLERANCE+1e-9;
const money=n=>Math.round(n*100)/100;
export const invoiceSchema={
 type:'object',additionalProperties:false,
 required:['vendor','invoice_number','date','currency','line_items','subtotal','tax','total'],
 properties:{
  vendor:{type:'string',minLength:1},
  invoice_number:{type:['string','null']},
  date:{type:['string','null'],pattern:'^\\d{4}-\\d{2}-\\d{2}$'},
  currency:{type:'string',pattern:'^[A-Z]{3}$'},
  line_items:{type:'array',items:{type:'object',required:['description','quantity','unit_price','amount'],
   properties:{description:{type:'string'},quantity:{type:'number'},unit_price:{type:'number'},amount:{type:'number'}}}},
  subtotal:{type:['number','null']},
  tax:{type:['number','null']},
  total:{type:'number'}
 }
};
export function checkInvoice(value){
 const reasons=validate(invoiceSchema,value);
 if(reasons.length)return reasons;
 const items=value.line_items;
 if(!items.length)return ['$.line_items: needs at least 1 item'];
 items.forEach((item,i)=>{const expected=item.quantity*item.unit_price;if(!near(item.amount,expected))reasons.push(`$.line_items[${i}]: amount ${item.amount} ≠ quantity × unit_price = ${money(expected)}`)});
 const sum=items.reduce((s,item)=>s+item.amount,0);
 if(value.subtotal!==null&&!near(value.subtotal,sum))reasons.push(`$.subtotal: ${value.subtotal} ≠ sum of line items ${money(sum)}`);
 const expectedTotal=sum+(value.tax??0);
 if(!near(value.total,expectedTotal))reasons.push(`$.total: ${value.total} ≠ line items + tax = ${money(expectedTotal)}`);
 return reasons;
}
