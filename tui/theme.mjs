export const C={accent:'#a78bfa',accent2:'#38bdf8',ok:'#4ade80',warn:'#facc15',fail:'#f87171',dim:'#6b7280',text:'#e5e7eb',card:'#374151'};
export const ICON={ok:'✔',todo:'○',running:'◐',action:'➜',input:'✎',fail:'✖',warn:'!',off:'·'};
export const COLOR={ok:C.ok,todo:C.dim,running:C.accent2,action:C.warn,input:C.warn,fail:C.fail,warn:C.warn,off:C.dim};
// OSC 8 terminal hyperlink (clickable in most modern terminals; plain text elsewhere).
export const link=(url,text=url)=>`\u001b]8;;${url}\u0007${text}\u001b]8;;\u0007`;
export const short=(h,n=10)=>h&&h.length>2*n?`${h.slice(0,n)}…${h.slice(-6)}`:h;
