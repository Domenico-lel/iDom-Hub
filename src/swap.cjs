const fs=require('node:fs/promises');
const exists=async p=>fs.access(p).then(()=>true,()=>false);
async function recover(target,backup){
  if(await exists(backup)){if(!(await exists(target)))await fs.rename(backup,target);else await fs.rm(backup,{recursive:true,force:true});}
}
async function swap(target,stage,backup,commit){
  let moved=false,placed=false;
  try {
    if(await exists(target)){await fs.rename(target,backup);moved=true;}
    await fs.rename(stage,target);placed=true;
    await commit();
  }catch(e){
    // Never delete the original if the first rename itself failed.
    if(placed)await fs.rm(target,{recursive:true,force:true});
    if(moved)await fs.rename(backup,target);
    throw e;
  }
  await fs.rm(backup,{recursive:true,force:true});
}
module.exports={recover,swap};
