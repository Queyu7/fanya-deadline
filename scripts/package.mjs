import {packager} from '@electron/packager';
import {cp,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const staging=await mkdtemp(path.join(os.tmpdir(),'keqi-'));
try {
  for(const dir of ['desktop','web'])await cp(dir,path.join(staging,dir),{recursive:true});
  const manifest=JSON.parse(await readFile('package.json'));delete manifest.devDependencies;delete manifest.scripts;
  await writeFile(path.join(staging,'package.json'),JSON.stringify(manifest));
  await packager({dir:staging,out:'dist',name:'Keqi',appBundleId:'io.github.fanyadeadline.Keqi',electronZipDir:process.env.ELECTRON_ZIP_DIR,electronVersion:'45.4.1',platform:process.argv[2]||process.platform,arch:process.argv[3]||process.arch,asar:true,overwrite:true,prune:false});
}finally{await rm(staging,{recursive:true,force:true});}
