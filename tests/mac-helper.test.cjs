const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {spawn,execFile}=require('node:child_process');
const {promisify}=require('node:util');
const crypto=require('node:crypto');
const run=promisify(execFile);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
test('Mac helper waits for the real running app despite padded ps timestamps, then installs and confirms startup',{skip:process.platform!=='darwin',timeout:30000},async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'idom-process-test-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const token=crypto.randomUUID(),job=path.join(root,'job-'+token);await fs.mkdir(job);
 const target=path.join(root,'iDom Launcher.app'),stage=path.join(root,'stage.app'),backup=path.join(root,'backup.app');
 const source=path.join(root,'fixture.c');
 await fs.writeFile(source,String.raw`#include <stdio.h>
#include <string.h>
#include <unistd.h>
int main(int argc,char**argv){if(argc>1&&strcmp(argv[1],"--hold")==0){sleep(3);return 0;}for(int i=1;i<argc;i++){if(strncmp(argv[i],"--idom-update-job=",18)==0){char f[4096];snprintf(f,sizeof(f),"%s/ack.json",argv[i]+18);FILE*out=fopen(f,"w");if(out){fprintf(out,"{\"version\":\"0.3.2\",\"token\":\"%s\"}",strrchr(argv[i],'/')+5);fclose(out);}}}return 0;}`);
 for(const [bundle,version] of [[target,'0.3.1'],[stage,'0.3.2']]){
  await fs.mkdir(path.join(bundle,'Contents','MacOS'),{recursive:true});
  await fs.writeFile(path.join(bundle,'Contents','Info.plist'),JSON.stringify({CFBundleIdentifier:'it.domenicolella.updaterfixture',CFBundleShortVersionString:version,CFBundlePackageType:'APPL',CFBundleExecutable:'iDom Launcher',CFBundleName:'Update Fixture'}));
  await run('/usr/bin/plutil',['-convert','xml1',path.join(bundle,'Contents','Info.plist')]);
  await run('/usr/bin/clang',[source,'-o',path.join(bundle,'Contents','MacOS','iDom Launcher')]);
  await run('/usr/bin/codesign',['--force','--sign','-',bundle]);
 }
 await fs.writeFile(path.join(target,'previous-version'),'old');
 const parent=spawn(path.join(target,'Contents','MacOS','iDom Launcher'),['--hold'],{stdio:'ignore'});t.after(()=>{if(parent.exitCode===null)parent.kill();});
 const exited=new Promise(resolve=>parent.once('exit',resolve));
 await delay(50);const raw=(await run('/bin/ps',['-p',String(parent.pid),'-o','lstart='])).stdout;
 const helper=spawn('/bin/sh',[path.join(__dirname,'../src/update-helpers/mac.sh'),target,stage,backup,String(parent.pid),raw.trim(),job,'0.3.2','it.domenicolella.updaterfixture','10',token],{stdio:'ignore'});t.after(()=>{if(helper.exitCode===null)helper.kill();});
 const finished=new Promise((resolve,reject)=>{helper.once('exit',resolve);helper.once('error',reject);});
 await delay(300);assert.equal(parent.exitCode,null);assert.equal(helper.exitCode,null,'Helper must not reject padded process timestamp');assert.equal(await fs.readFile(path.join(target,'previous-version'),'utf8'),'old','Existing bundle must remain until parent exits');
 await exited;assert.equal(await finished,0,(await fs.readFile(path.join(job,'helper.log'),'utf8')));
 const result=JSON.parse(await fs.readFile(path.join(root,'last-result.json'),'utf8'));assert.equal(result.success,true);assert.equal(result.token,token);await assert.rejects(fs.access(backup));
 const ack=JSON.parse(await fs.readFile(path.join(job,'ack.json'),'utf8'));assert.equal(ack.version,'0.3.2');
});
