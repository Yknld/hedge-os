import type { AccountRules } from './types';
import { createState, transition, hedgeRatio } from './state';
export const evaluation40: AccountRules = {
  id:'example-eval-40',provider:'Example',accountName:'40% evaluation',startingBalance:50000,evaluationFee:83,activationFee:0,
  evaluation:{enabled:true,profitTarget:3000,maxLoss:{amount:2000,type:'EOD_TRAILING',locks:true,lockTriggerBalance:52100,lockedFloor:50100},consistency:{enabled:true,maxLargestDayFraction:0.4},maxContracts:10},
  funded:{maxLoss:{amount:2000,type:'EOD_TRAILING',locks:true,lockTriggerBalance:52100,lockedFloor:50100},maxContracts:10,
    payout:{frequency:'DAILY',profitShare:0.9,payoutConversionRate:0.5,defaultCap:1250,qualifyingDaysResetAfterPayout:true,cycleProfitResets:true,consistencyResetsAfterPayout:true}},
};
export const dailyFunded: AccountRules = {...evaluation40,id:'example-daily',accountName:'Daily funded',evaluation:undefined,evaluationFee:216,
  funded:{...evaluation40.funded,dailyLossLimit:{enabled:true,amount:1000}}};
export const flexFunded: AccountRules = {...dailyFunded,id:'example-flex',accountName:'Flex funded',
  funded:{...dailyFunded.funded,dailyLossLimit:undefined,minimumProfitDays:{requiredDays:5,minimumProfitPerDay:100},
    payout:{...dailyFunded.funded.payout,frequency:'N_DAYS',requiredDays:5,defaultCap:2500}}};
const initialEval = createState(evaluation40), initialDaily = createState(dailyFunded);
export const bufferedFunded: AccountRules = {...flexFunded,id:'example-buffered',accountName:'Protected buffer + surplus',
  funded:{...flexFunded.funded,minimumProfitDays:undefined,
    consistency:{enabled:true,maxLargestDayFraction:0.5,denominator:'TOTAL_ACCOUNT_PROFIT',resetsAfterPayout:true},
    payout:{frequency:'DAILY',model:'BUFFERED_SURPLUS',profitShare:1,minimumPayout:500,defaultCap:500,
      bufferedSurplus:{bufferAboveStartingBalance:2100,payoutReducesBalance:true,bufferIsProtected:true},
      qualifyingDaysResetAfterPayout:true,cycleProfitResets:true,consistencyResetsAfterPayout:true}}};
export const EXAMPLES = [
  {name:'Fresh 40% evaluation',rules:evaluation40,state:initialEval},
  {name:'Evaluation after +$1,200',rules:evaluation40,state:transition(initialEval,evaluation40,{targetProfit:1200,stopLoss:2000,hedgeRatio:hedgeRatio(initialEval,evaluation40),purpose:'EVAL_PROGRESS'},'TP')},
  {name:'Daily funded — fresh',rules:dailyFunded,state:initialDaily},
  {name:'Daily funded — after DLL loss',rules:dailyFunded,state:transition(initialDaily,dailyFunded,{targetProfit:2500,stopLoss:1000,hedgeRatio:hedgeRatio(initialDaily,dailyFunded),purpose:'MAX_PAYOUT'},'SL')},
  {name:'Flex funded — fresh',rules:flexFunded,state:createState(flexFunded)},
  {name:'Buffered surplus — 50% consistency',rules:bufferedFunded,state:createState(bufferedFunded)},
];
