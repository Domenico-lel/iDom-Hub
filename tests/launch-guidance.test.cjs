const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Manager}=require('../src/manager.cjs');
const {classifyLaunchError}=require('../src/launch-guidance.cjs');
function failed(stderr,code=1){return Object.assign(Error('Command failed: /usr/bin/open /Users/example/Applications/iVolume.app'),{stderr,code});}
function manager(openError,signatureError,assessmentError){
  const commands=[];
  const m=new Manager('unused',()=>{},'darwin',[],{run:async(cmd,args)=>{
    commands.push([cmd,args]);
    if(cmd==='/usr/bin/open'&&openError)throw openError;
    if(cmd==='/usr/bin/codesign'&&signatureError)throw signatureError;
    if(cmd==='/usr/sbin/spctl'&&assessmentError)throw assessmentError;
    return {stdout:'',stderr:''};
  }});
  m.installed=async()=>({path:'/Users/example/Applications/iVolume.app',version:'0.10.0'});
  return {m,commands};
}
test('successful launch stays successful without a security assessment',async()=>{
  const {m,commands}=manager();assert.equal((await m.open('ivolume')).status,'opened');assert.equal(commands.length,1);
});
test('Gatekeeper refusal produces a structured authorization guide without paths',async()=>{
  const {m}=manager(failed('_LSOpenURLsWithCompletionHandler() failed with error -128.'),null,failed('rejected',3));
  const r=await m.open('ivolume');assert.equal(r.status,'authorization');assert.match(r.message,/macOS/);assert.doesNotMatch(r.message,/Command failed|\/Users\/|-128/);
});
test('ordinary cancellation is not asserted to be a security block',async()=>{
  const {m}=manager(failed('failed with error -128.'));assert.equal((await m.open('ivolume')).status,'cancelled');
});
test('unsigned app may use the manual developer authorization guide',()=>{
  assert.equal(classifyLaunchError(failed('error -128'),{rejected:true},{failed:true,stderr:'code object is not signed at all'}),'authorization');
});
test('damaged signature never offers an override',async()=>{
  const {m}=manager(failed('error -128'),failed('a sealed resource is missing or invalid'),failed('rejected',3));
  assert.equal((await m.open('ivolume')).status,'damaged');
});
test('malware or revoked certificates never offer an override',()=>{
  for(const stderr of ['rejected: malware','CSSMERR_TP_CERT_REVOKED','XProtect: will damage your computer'])assert.equal(classifyLaunchError(failed('error -128'),{rejected:true,stderr},{failed:false}),'unsafe');
});
test('assessment timeout does not become an authorization claim',async()=>{
  const {m}=manager(failed('launch timeout'),null,Object.assign(failed(''),{killed:true}));assert.equal((await m.open('ivolume')).status,'failed');
});
test('missing installation has a recoverable message',async()=>{
  const {m,commands}=manager();m.installed=async()=>null;assert.equal((await m.open('ivolume')).status,'missing');assert.equal(commands.length,0);
});
