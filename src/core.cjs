const crypto = require('node:crypto');
function compareVersions(a,b) {
  const parse = s => /^v?(\d+(?:\.\d+)*)$/.exec(String(s));
  const x=parse(a), y=parse(b); if(!x || !y) return null;
  const u=x[1].split('.').map(Number), v=y[1].split('.').map(Number);
  for(let i=0;i<Math.max(u.length,v.length);i++) {const d=(u[i]||0)-(v[i]||0); if(d) return Math.sign(d);}
  return 0;
}
function selectAsset(entry, release, platform) {
  if(!entry.platforms.includes(platform)) return null;
  return release.assets.find(a=>platform==='darwin' && entry.macAsset.test(a.name)) || null;
}
function needsUpdate(installed, release, record) {
  if(!installed) return false;
  // GitHub release and asset identity also cover non-semantic tags such as "iVolume".
  if(record && record.version===installed.version) return record.releaseId!==release.id || record.assetId!==release.asset.id || record.digest!==release.asset.digest;
  const cmp=compareVersions(release.tag_name,installed.version);
  return cmp===null ? null : cmp>0;
}
function verifyDigest(buffer,digest) {
  if(!/^sha256:[a-f0-9]{64}$/i.test(digest||'')) throw new Error('La release non contiene un checksum SHA-256. Pubblica nuovamente il file su GitHub.');
  const actual=crypto.createHash('sha256').update(buffer).digest('hex');
  if(actual!==digest.slice(7).toLowerCase()) throw new Error('Il checksum non corrisponde: download rifiutato.');
}
function validateArchivePaths(names) {
  if(names.some(n=>n.startsWith('/') || n.includes('\\') || n.split('/').includes('..'))) throw new Error('Archivio con percorsi non sicuri.');
}
module.exports={compareVersions,selectAsset,needsUpdate,verifyDigest,validateArchivePaths};
