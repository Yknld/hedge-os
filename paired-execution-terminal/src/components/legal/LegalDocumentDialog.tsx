import { useState } from 'react';
import { X } from 'lucide-react';
import { LEGAL_DOCUMENTS, submitTermsConsent, submitTradingRiskConsent, type LegalDocumentId } from '../../lib/legal';
import { Button } from '../ui/Button';

export function LegalDocumentDialog({documentId,onClose,requireConsent=false,onAccepted}:{documentId:LegalDocumentId;onClose:()=>void;requireConsent?:boolean;onAccepted?:()=>void}) {
  const document=LEGAL_DOCUMENTS[documentId];
  const [checks,setChecks]=useState([false,false,false]);
  const [submitting,setSubmitting]=useState(false);
  const [submitError,setSubmitError]=useState('');
  const canAccept=!requireConsent||checks.every(Boolean);
  const consentLabels=documentId==='terms' ? [
    'I have read and agree to the Hedge OS Terms of Service.',
    'I understand Hedge OS is not a broker, fiduciary, or guarantee against losses.',
    'I agree that this electronic acceptance records my agreement to these Terms.',
  ] : [
    'I understand Hedge OS can transmit orders involving real money and those orders can result in financial loss.',
    'I understand automated hedging can fail, partially fill, execute late, or execute at different prices; Hedge OS does not guarantee protection against losses.',
    'I accept this Trading Risk Acknowledgment and authorize Hedge OS to transmit instructions to accounts I connect when I enable trading.',
  ];
  const accept=async()=>{if(requireConsent&&!canAccept)return;setSubmitting(true);setSubmitError('');try{if(documentId==='risk')await submitTradingRiskConsent();if(documentId==='terms')await submitTermsConsent();onAccepted?.();onClose();}catch(error){setSubmitError(error instanceof Error?error.message:'Unable to save your acceptance. Please try again.');}finally{setSubmitting(false);}};
  return <div role="dialog" aria-modal="true" aria-labelledby="legal-document-title" className="legal-dialog-backdrop fixed inset-0 z-[200] grid place-items-center bg-black/70 p-6" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <section className="legal-dialog max-h-[86vh] w-full max-w-3xl overflow-hidden border border-line bg-surface shadow-2xl">
      <header className="flex items-start justify-between border-b border-line px-5 py-4"><div><div className="section-kicker">{document.eyebrow}</div><h2 id="legal-document-title" className="mt-1 text-base font-semibold text-slate-100">{document.title}</h2><p className="mt-1 font-mono text-[10px] text-muted">{document.version} · company details and effective date pending</p></div><button type="button" onClick={onClose} aria-label="Close document" className="grid size-8 place-items-center text-muted hover:bg-raised hover:text-slate-100"><X className="size-4"/></button></header>
      <div className={`${requireConsent?'max-h-[32vh]':'max-h-[58vh]'} overflow-y-auto p-5 text-xs leading-5 text-slate-300`}>{document.sections.map(section=><section key={section.heading} className="mb-5 last:mb-0"><h3 className="mb-2 text-xs font-semibold text-slate-100">{section.heading}</h3>{section.body.map((paragraph,index)=><p key={index} className="mb-2 last:mb-0 text-muted">{paragraph}</p>)}</section>)}</div>
      {requireConsent&&<div className="border-t border-line bg-canvas px-5 py-4"><div className="mb-3 text-xs font-semibold text-slate-200">{documentId==='terms'?'Required agreement to continue':'Required consent before arming a pair'}</div>{consentLabels.map((label,index)=><label key={label} className="mb-2 flex cursor-pointer items-start gap-2 text-[11px] leading-4 text-muted"><input className="mt-0.5" type="checkbox" checked={checks[index]} onChange={event=>setChecks(current=>current.map((value,item)=>item===index?event.target.checked:value))}/><span>{label}</span></label>)}</div>}
      <footer className="border-t border-line px-5 py-3">{submitError&&<p role="alert" className="mb-3 text-xs text-rose-300">{submitError}</p>}<div className="flex justify-end gap-2"><Button disabled={submitting} onClick={onClose}>Close</Button>{requireConsent&&<Button variant="primary" disabled={!canAccept||submitting} onClick={()=>void accept()}>{submitting?'Saving acceptance…':documentId==='terms'?'Agree to terms':'Submit acceptance'}</Button>}</div></footer>
    </section>
  </div>;
}
