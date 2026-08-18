import{spawnSync,spawn}from"node:child_process";
import{fileURLToPath}from"node:url";
const bin=(name)=>`"${fileURLToPath(new URL(`../node_modules/.bin/${name}.cmd`,import.meta.url))}"`;
const configHome=fileURLToPath(new URL("../.config",import.meta.url));
const run=(name,args)=>{const result=spawnSync(bin(name),args,{stdio:"inherit",shell:true,env:{...process.env,ASTRO_TELEMETRY_DISABLED:"1",XDG_CONFIG_HOME:configHome}});if(result.status!==0)process.exit(result.status??1)};
run("wrangler",["d1","migrations","apply","zimaxx-qr","--local"]);run("wrangler",["d1","execute","zimaxx-qr","--local","--file=./db/seed.sql"]);run("astro",["build"]);const child=spawn(bin("wrangler"),["dev","--port","8787"],{stdio:"inherit",shell:true,env:{...process.env,XDG_CONFIG_HOME:configHome}});for(const signal of["SIGINT","SIGTERM"])process.on(signal,()=>child.kill(signal));child.on("exit",code=>process.exit(code??0));
