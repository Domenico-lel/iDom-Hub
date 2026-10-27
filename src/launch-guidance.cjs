'use strict';
// Classify launch failures without exposing command lines or treating every cancellation as Gatekeeper.
function classifyLaunchError(error, assessment, signature) {
  const text=[assessment?.stderr,assessment?.stdout,signature?.stderr,signature?.stdout].filter(Boolean).join('\n');
  if(/revoked|malware|xprotect|will damage|danneggerà|CSSMERR_TP_CERT_REVOKED/i.test(text))return 'unsafe';
  if(signature?.failed&&!/not signed at all/i.test(signature.stderr||''))return 'damaged';
  const cancelled=/(?:error\s+|errore\s+)-128\b/i.test(error?.stderr||error?.message||'');
  if(assessment?.rejected && !assessment?.unavailable)return 'authorization';
  if(cancelled)return 'cancelled';
  return 'failed';
}
module.exports={classifyLaunchError};
