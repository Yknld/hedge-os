import { PROP_ACCOUNT_TYPES } from '../../data/propAccountTypes';
import { EXAMPLES } from './examples';
import { createState } from './state';
import type { AccountRules, DrawdownRule } from './types';

// Reuse the application's existing catalog; this does not certify current firm rules.
export const PLANNER_PRESETS = [...PROP_ACCOUNT_TYPES.map(p=>{
  const dd=(amount:number,buffer?:number,type=p.drawdownType):DrawdownRule=>({amount,type:type==='end-of-day'?'EOD_TRAILING':type==='intraday-trailing'?'INTRADAY_TRAILING':'STATIC',
    locks:Boolean(buffer),lockTriggerBalance:buffer?p.balance+buffer:undefined,lockedFloor:buffer?p.balance+buffer-amount:undefined});
  const rules:AccountRules={id:p.id,provider:p.brand,accountName:p.name,startingBalance:p.balance,evaluationFee:p.price,activationFee:p.activationFee,
    pricing:{billing:'ONE_TIME',listPrice:p.listPrice,currentPrice:p.price,resetFee:p.resetFee,promotionalPrice:p.promotionalPrice,promotionalResetFee:p.promotionalResetFee,sourceAsOf:p.sourceAsOf},
    evaluation:{enabled:true,profitTarget:p.evalTarget,maxLoss:dd(p.evalMaxLoss),dailyLossLimit:{enabled:p.dailyLossLimit>0,amount:p.dailyLossLimit},maxContracts:p.evalMaxContracts,minimumTradingDays:p.minEvalDays,consistency:{enabled:p.consistency>0,maxLargestDayFraction:p.consistency/100}},
    funded:{maxLoss:dd(p.paMaxLoss,p.bufferLock,p.fundedDrawdownType),dailyLossLimit:p.fundedDailyLossLimit?{enabled:true,amount:p.fundedDailyLossLimit,dynamicDescription:p.fundedDynamicDllDescription}:undefined,maxContracts:p.paMaxContracts,consistency:{enabled:p.payoutConsistency>0,maxLargestDayFraction:p.payoutConsistency/100},
      minimumProfitDays:p.minWinningDays?{requiredDays:p.minWinningDays,minimumProfitPerDay:p.minWinningProfit}:undefined,
      scalingPlan:p.fundedScalingPlan,payoutsToLive:p.productFamily==='FLEX'||p.productFamily==='PRO'?5:undefined,payoutProfitTarget:p.fundedPayoutProfitTarget,
      payout:{model:'PROFIT_CONVERSION',frequency:p.minPayoutDays>1?'N_DAYS':'DAILY',requiredDays:p.minPayoutDays,profitShare:p.payoutSplitPercent/100,payoutConversionRate:p.withdrawableBalancePercent/100,
        minimumCycleProfit:p.fundedPayoutProfitTarget,minimumPayout:p.minimumPayout,defaultCap:p.payoutCap,qualifyingDaysResetAfterPayout:true,cycleProfitResets:true,consistencyResetsAfterPayout:true}}};
  return {name:`${p.brand} · ${p.name}`,rules,state:createState(rules)};
}),...EXAMPLES];
