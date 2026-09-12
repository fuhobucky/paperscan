import {spawnSync} from "node:child_process";
import {resolve} from "node:path";
const root=resolve(import.meta.dirname,"..");
for(const args of [["scripts/prepare-pwa-assets.mjs"],["node_modules/next/dist/bin/next","build"],["scripts/generate-service-worker.mjs","out"]]) {
  const result=spawnSync(process.execPath,args,{cwd:root,stdio:"inherit",env:{...process.env,PAPERSCAN_STATIC_EXPORT:"1"}});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status??1);
}
