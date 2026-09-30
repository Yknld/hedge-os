import type { Campaign, DrawdownType } from '../store/useAppStore';

/** Provider rule sheets mix NQ/mini-equivalent and MNQ limits. Hedge OS uses
 * MNQ throughout the prop order path, so normalize mini-equivalent limits at
 * the catalog boundary rather than making each consumer guess the unit. */
const mnqFromMini = (contracts: number) => contracts * 10;

export interface PropAccountType {
  id: string;
  brand: string;
  name: string;
  balance: number;
  price: number;
  billing: 'Monthly' | 'One-time';
  evalTarget: number;
  evalMaxLoss: number;
  drawdownType: DrawdownType;
  consistency: number;
  evalMaxContracts: number;
  activationFee: number;
  paMaxLoss: number;
  paMaxContracts: number;
  minEvalDays: number;
  minPayoutDays: number;
  minWinningDays: number;
  minWinningProfit: number;
  payoutConsistency: number;
  payoutCap: number;
  minimumHedgeBalance: number;
  bufferLock: number;
  withdrawableBalancePercent: number;
  payoutSplitPercent: number;
  dailyLossLimit: number;
  resetFee: number;
  listPrice: number;
  promotionalPrice?: number;
  promotionalResetFee?: number;
  sourceAsOf: string;
  productFamily: 'FLEX' | 'PRO' | 'TRADEIFY_GROWTH_DAILY' | 'TRADEIFY_GROWTH_FLEX' | 'APEX_EOD';
  fundedDrawdownType?: DrawdownType;
  fundedDailyLossLimit?: number;
  fundedPayoutProfitTarget?: number;
  fundedDynamicDllDescription?: string;
  fundedScalingPlan?: { minimumProfit: number; maximumProfit?: number; maxContracts: number }[];
  minimumPayout?: number;
}

const lucidFlex = (size: 25000 | 50000 | 100000 | 150000, dllEnabled: boolean): PropAccountType => {
  const values = {
    25000: [65.3, 1250, 1000, 20, 100, 1000, 800, 600, 89, 50.3, 50],
    50000: [105.2, 3000, 2000, 40, 150, 2000, 1600, 1200, 146, 90.2, 90],
    100000: [215.6, 6000, 3000, 60, 200, 2500, 2350, 1800, 293, 170.6, 170],
    150000: [295.4, 9000, 4500, 100, 250, 3000, 3500, 2700, 407, 250.4, 250],
  }[size];
  return {
    id: `lucid-${size}-flex-dll-${dllEnabled ? 'on' : 'off'}`,
    brand: 'Lucid Trading',
    name: `${size / 1000}K LucidFlex · DLL ${dllEnabled ? 'On' : 'Off'}`,
    balance: size,
    price: values[0],
    billing: 'One-time',
    evalTarget: values[1],
    evalMaxLoss: values[2],
    drawdownType: 'end-of-day',
    consistency: 50,
    evalMaxContracts: values[3],
    activationFee: 0,
    paMaxLoss: values[2],
    paMaxContracts: values[3],
    // No separate payout-day requirement during evaluation. Consistency
    // determines the clean path (50% of the target on each of two days).
    minEvalDays: 0,
    minPayoutDays: 5,
    minWinningDays: 5,
    minWinningProfit: values[4],
    payoutConsistency: 0,
    payoutCap: values[5],
    minimumHedgeBalance: values[6],
    bufferLock: values[2] + 100,
    withdrawableBalancePercent: 50,
    payoutSplitPercent: 90,
    dailyLossLimit: dllEnabled ? values[7] : 0,
    resetFee: dllEnabled ? values[10] : Math.floor(values[0]),
    listPrice: values[8],
    promotionalPrice: dllEnabled ? values[9] : undefined,
    promotionalResetFee: dllEnabled ? values[10] : undefined,
    sourceAsOf: '2026-09-07',
    productFamily: 'FLEX',
    fundedDailyLossLimit: dllEnabled ? values[7] : undefined,
    fundedScalingPlan: {
      25000: [{minimumProfit:0,maximumProfit:1000,maxContracts:10},{minimumProfit:1000,maxContracts:20}],
      50000: [{minimumProfit:0,maximumProfit:1000,maxContracts:20},{minimumProfit:1000,maximumProfit:2000,maxContracts:30},{minimumProfit:2000,maxContracts:40}],
      100000: [{minimumProfit:0,maximumProfit:1000,maxContracts:30},{minimumProfit:1000,maximumProfit:2000,maxContracts:40},{minimumProfit:2000,maximumProfit:3000,maxContracts:50},{minimumProfit:3000,maxContracts:60}],
      150000: [{minimumProfit:0,maximumProfit:1000,maxContracts:40},{minimumProfit:1000,maximumProfit:2000,maxContracts:50},{minimumProfit:2000,maximumProfit:3000,maxContracts:60},{minimumProfit:3000,maximumProfit:4500,maxContracts:80},{minimumProfit:4500,maxContracts:100}],
    }[size],
  };
};

const lucidPro = (size: 25000 | 50000 | 100000 | 150000, dllEnabled: boolean): PropAccountType => {
  const values = {
    25000: [90.6,1250,1000,20,600,123,70.6,90,70,250,1000,800],
    50000: [140.4,3000,2000,40,1200,192,115.4,140,115,500,2000,1600],
    100000: [225.4,6000,3000,60,1800,307,180.4,225,180,750,2500,2350],
    150000: [300.5,9000,4500,100,2700,440,245.5,300,245,1000,3000,3500],
  }[size];
  return {
    id:`lucid-${size}-pro-dll-${dllEnabled?'on':'off'}`,brand:'Lucid Trading',
    name:`${size/1000}K LucidPro · DLL ${dllEnabled?'On':'Off'}`,balance:size,price:values[0],billing:'One-time',
    evalTarget:values[1],evalMaxLoss:values[2],drawdownType:'end-of-day',consistency:0,evalMaxContracts:values[3],
    activationFee:0,paMaxLoss:values[2],paMaxContracts:values[3],minEvalDays:1,minPayoutDays:3,minWinningDays:0,
    minWinningProfit:0,payoutConsistency:40,payoutCap:values[10],minimumHedgeBalance:values[11],bufferLock:values[2]+100,
    withdrawableBalancePercent:50,payoutSplitPercent:90,dailyLossLimit:dllEnabled?values[4]:0,
    resetFee:dllEnabled?values[8]:values[7],listPrice:values[5],promotionalPrice:dllEnabled?values[6]:undefined,
    promotionalResetFee:dllEnabled?values[8]:undefined,sourceAsOf:'2026-09-07',productFamily:'PRO',
    fundedDailyLossLimit:dllEnabled?values[4]:undefined,fundedPayoutProfitTarget:values[9],
    fundedDynamicDllDescription:dllEnabled?'Above the initial trail: LucidScale DLL is 60% of Peak EOD Balance.':undefined,
  };
};

const tradeifyGrowth = (size:25000|50000|100000|150000,path:'DAILY'|'FLEX'):PropAccountType => {
  const v={25000:[109,55,75,1500,1000,1,600,1250,500],50000:[165,83,109,3000,2000,4,1250,2500,1000],100000:[265,133,169,6000,3000,8,1750,3500,1250],150000:[369,185,239,9000,4500,12,2500,4500,1750]}[size];
  const daily=path==='DAILY',paLoss=daily?(size===100000?2500:size===150000?3500:v[4]):v[4];
  return {id:`tradeify-${size}-growth-${path.toLowerCase()}`,brand:'Tradeify',name:`${size/1000}K Growth · ${daily?'Daily':'Flex'} funded path`,balance:size,
    price:v[1],billing:'One-time',evalTarget:v[3],evalMaxLoss:v[4],drawdownType:'end-of-day',consistency:40,evalMaxContracts:mnqFromMini(v[5]),activationFee:0,
    paMaxLoss:paLoss,paMaxContracts:mnqFromMini(v[5]),minEvalDays:1,minPayoutDays:daily?0:5,
    minWinningDays:0,minWinningProfit:0,payoutConsistency:0,payoutCap:daily?v[6]:v[7],minimumHedgeBalance:v[4],bufferLock:paLoss+100,
    withdrawableBalancePercent:50,payoutSplitPercent:90,dailyLossLimit:0,resetFee:v[2],listPrice:v[0],promotionalPrice:v[1],sourceAsOf:'2026-09-07',
    productFamily:daily?'TRADEIFY_GROWTH_DAILY':'TRADEIFY_GROWTH_FLEX',fundedDailyLossLimit:daily?v[8]:undefined,
    fundedScalingPlan:{25000:[{minimumProfit:0,maximumProfit:1500,maxContracts:10},{minimumProfit:1500,maxContracts:20}],50000:[{minimumProfit:0,maximumProfit:1500,maxContracts:20},{minimumProfit:1500,maximumProfit:2000,maxContracts:30},{minimumProfit:2000,maxContracts:40}],100000:[{minimumProfit:0,maximumProfit:1500,maxContracts:30},{minimumProfit:1500,maximumProfit:2000,maxContracts:40},{minimumProfit:2000,maximumProfit:3000,maxContracts:50},{minimumProfit:3000,maxContracts:80}],150000:[{minimumProfit:0,maximumProfit:1500,maxContracts:30},{minimumProfit:1500,maximumProfit:2000,maxContracts:40},{minimumProfit:2000,maximumProfit:3000,maxContracts:50},{minimumProfit:3000,maximumProfit:4500,maxContracts:80},{minimumProfit:4500,maxContracts:120}]}[size]};
};

const apexEod = (size:25000|50000|100000|150000,noActivationFee:boolean):PropAccountType => {
  const v={25000:[45,99,1500,1000,40,20,1250,1500,119],50000:[55,119,3000,2000,60,40,3000,2000,139],100000:[99,159,6000,3000,80,60,3500,2500,149],150000:[189,249,9000,4000,120,100,4000,2750,159]}[size];
  const list=noActivationFee?v[1]:v[0],promo=list*.1;
  return {id:`apex-${size}-eod-${noActivationFee?'no-activation':'standard'}`,brand:'Apex Trader Funding',name:`${size/1000}K EOD Trail · ${noActivationFee?'No Activation Fee':'Standard'}`,
    balance:size,price:promo,billing:'One-time',evalTarget:v[2],evalMaxLoss:v[3],drawdownType:'end-of-day',consistency:30,evalMaxContracts:v[4],
    activationFee:noActivationFee?0:59,paMaxLoss:v[3],paMaxContracts:mnqFromMini({25000:2,50000:4,100000:6,150000:10}[size]),minEvalDays:1,minPayoutDays:5,minWinningDays:0,minWinningProfit:0,
    payoutConsistency:50,payoutCap:v[7],minimumHedgeBalance:v[3],bufferLock:v[3]+100,withdrawableBalancePercent:100,payoutSplitPercent:100,
    dailyLossLimit:0,resetFee:80,listPrice:list,promotionalPrice:promo,sourceAsOf:'2026-09-13',productFamily:'APEX_EOD',fundedDailyLossLimit:v[6],minimumPayout:500,
    fundedScalingPlan:{25000:[{minimumProfit:0,maximumProfit:1000,maxContracts:10},{minimumProfit:1000,maxContracts:20}],50000:[{minimumProfit:0,maximumProfit:1500,maxContracts:20},{minimumProfit:1500,maximumProfit:3000,maxContracts:30},{minimumProfit:3000,maxContracts:40}],100000:[{minimumProfit:0,maximumProfit:2000,maxContracts:30},{minimumProfit:2000,maximumProfit:3000,maxContracts:40},{minimumProfit:3000,maximumProfit:5000,maxContracts:50},{minimumProfit:5000,maxContracts:60}],150000:[{minimumProfit:0,maximumProfit:2000,maxContracts:40},{minimumProfit:2000,maximumProfit:3000,maxContracts:50},{minimumProfit:3000,maximumProfit:5000,maxContracts:70},{minimumProfit:5000,maxContracts:100}]}[size]};
};

export const PROP_ACCOUNT_TYPES: PropAccountType[] = [
  ...([25000, 50000, 100000, 150000] as const).flatMap(size => [lucidFlex(size, true), lucidFlex(size, false)]),
  ...([25000,50000,100000,150000] as const).flatMap(size => [lucidPro(size,true),lucidPro(size,false)]),
  ...([25000,50000,100000,150000] as const).flatMap(size => [tradeifyGrowth(size,'DAILY'),tradeifyGrowth(size,'FLEX')]),
  ...([25000,50000,100000,150000] as const).flatMap(size => [apexEod(size,false),apexEod(size,true)]),
];

export type CurrentContractLimit = { maxContracts: number; phase: 'evaluation' | 'funded'; source: 'catalog' | 'campaign'; tierProfit: number | null };

/** Returns the per-account MNQ limit. Provider scaling is based
 * on closed/EOD profit, so this deliberately never treats intraday P&L as a tier change. */
export function getCurrentContractLimit(campaign: Campaign): CurrentContractLimit {
  const account = PROP_ACCOUNT_TYPES.find((item) =>
    campaign.accountTypeName.includes(item.brand) && campaign.accountTypeName.includes(item.name)
  );
  const funded = campaign.roadmapStage === 'performance' || campaign.roadmapStage === 'post-payout' || campaign.currentPhase > 0;
  if (!account) return { maxContracts: funded ? campaign.performanceRules.maxContracts : campaign.evaluationRules.maxContracts, phase: funded ? 'funded' : 'evaluation', source: 'campaign', tierProfit: null };
  if (!funded) return { maxContracts: account.evalMaxContracts, phase: 'evaluation', source: 'catalog', tierProfit: null };
  const profit = Math.max(0, campaign.currentBalance - campaign.accountSize);
  const tier = [...(account.fundedScalingPlan ?? [])].sort((a, b) => a.minimumProfit - b.minimumProfit).filter((item) => profit >= item.minimumProfit).at(-1);
  return { maxContracts: tier?.maxContracts ?? account.paMaxContracts, phase: 'funded', source: 'catalog', tierProfit: tier?.minimumProfit ?? null };
}

export function estimateHedgeBalance(balance: number) {
  const anchors = [
    [25000, 800],
    [50000, 1600],
    [100000, 2350],
    [150000, 3500],
  ] as const;
  if (balance <= anchors[0][0]) return Math.max(0, (balance / anchors[0][0]) * anchors[0][1]);
  for (let index = 1; index < anchors.length; index += 1) {
    const [highBalance, highHedge] = anchors[index];
    const [lowBalance, lowHedge] = anchors[index - 1];
    if (balance <= highBalance)
      return (
        lowHedge + ((balance - lowBalance) / (highBalance - lowBalance)) * (highHedge - lowHedge)
      );
  }
  return (anchors[3][1] * balance) / anchors[3][0];
}
