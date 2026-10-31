// lokal: the agent API's /start_job is public (the registry's apiBaseUrl). Each call makes the payment service
// sign a payment request, so cap them: 60 a minute, and 20 open requests whose pay-by time has not passed.
// The model only ever runs after the buyer's funds are locked, so this guards the payment service, not the model.
export const LIMIT={perMinute:Number(process.env.AGENT_API_MAX_PER_MINUTE||60),open:Number(process.env.AGENT_API_MAX_OPEN||20)};
// times: start timestamps of the last minute (mutated: old ones are dropped).
export function busy(jobs,times,now=Date.now(),limit=LIMIT){
 while(times.length&&now-times[0]>60000)times.shift();
 if(times.length>=limit.perMinute)return 'too many new jobs this minute';
 if(jobs.filter(j=>j.status==='awaiting_payment'&&!(Number(j.payment?.payByTime)<now)).length>=limit.open)return 'too many jobs waiting for payment';
 return null;
}
