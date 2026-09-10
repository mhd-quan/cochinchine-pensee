import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {brotliCompressSync} from 'node:zlib';
const { chromium } = await import(process.env.PERF_PLAYWRIGHT_MODULE || 'playwright');
const [directory='dist', label='performance', runs='5'] = process.argv.slice(2);
const root = path.resolve(directory);
const output = process.env.PERF_OUTPUT || '/tmp';
const traceEnabled = process.env.PERF_TRACE === '1';
const desktop = process.env.PERF_DESKTOP === '1';
const cache=new Map();
const server=http.createServer(async(req,res)=>{try{
 let file=path.resolve(root, `.${decodeURIComponent(new URL(req.url,'http://localhost').pathname)}`);
 if (file !== root && !file.startsWith(root + path.sep)) throw new Error('Invalid path');
 if((await fs.stat(file)).isDirectory()) file=path.join(file,'index.html');
 let item=cache.get(file);if(!item){let data=await fs.readFile(file);const ext=path.extname(file);const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.woff2':'font/woff2','.avif':'image/avif','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'}[ext]||'application/octet-stream';const compress=/text|json/.test(type);if(compress)data=brotliCompressSync(data);item={data,type,compress};cache.set(file,item);}
 res.setHeader('Content-Type',item.type);res.setHeader('Cache-Control','no-store');if(item.compress)res.setHeader('Content-Encoding','br');res.end(item.data);
}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url = `http://127.0.0.1:${server.address().port}/`;
const browser=await chromium.launch({executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const results=[];
for(let i=0;i<+runs;i++){
 const context=await browser.newContext({viewport:desktop ? {width:1440,height:1000} : {width:390,height:663},deviceScaleFactor:desktop ? 1 : 3,isMobile:!desktop});const page=await context.newPage();
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.addInitScript(()=>{window.__perf={lcp:0,cls:0,longTasks:[]};new PerformanceObserver(l=>{for(const e of l.getEntries())window.__perf.lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__perf.cls+=e.value;}).observe({type:'layout-shift',buffered:true});new PerformanceObserver(l=>{for(const e of l.getEntries())window.__perf.longTasks.push({start:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:true});});
 const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:170,downloadThroughput:1125000,uploadThroughput:187500});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await cdp.send('Performance.enable');
 if(traceEnabled && i===0)await cdp.send('Tracing.start',{categories:'devtools.timeline,blink.user_timing,loading',transferMode:'ReturnAsStream'});
 await page.goto(url,{waitUntil:'load'});await page.waitForTimeout(2000);
 const result=await page.evaluate(()=>({...window.__perf,fcp:performance.getEntriesByName('first-contentful-paint')[0]?.startTime,resources:performance.getEntriesByType('resource').map(r=>({name:r.name,bytes:r.encodedBodySize,start:r.startTime,end:r.responseEnd})),fonts:[...document.fonts].filter(f=>f.status==='loaded').map(f=>[f.family,f.weight,f.style]),height:document.documentElement.scrollHeight}));result.metrics=(await cdp.send('Performance.getMetrics')).metrics.filter(m=>/LayoutDuration|RecalcStyleDuration|ScriptDuration|TaskDuration|LayoutCount/.test(m.name));
 if(traceEnabled && i===0){await page.screenshot({path:`${output}/${label}.png`});const finished=new Promise(r=>cdp.once('Tracing.tracingComplete',r));await cdp.send('Tracing.end');const {stream}=await finished;let trace='';while(true){const chunk=await cdp.send('IO.read',{handle:stream});trace+=chunk.data;if(chunk.eof)break;}await fs.writeFile(`${output}/${label}-trace.json`,trace);await cdp.send('IO.close',{handle:stream});}
 results.push(result);console.log(label,i,JSON.stringify({fcp:result.fcp,lcp:result.lcp,cls:result.cls,metrics:result.metrics}));await context.close();
}
await fs.writeFile(`${output}/${label}.json`,JSON.stringify({
 metadata: { browser: browser.version(), viewport: desktop ? '1440x1000@1' : '390x663@3', cpuRate: 4, latencyMs: 170, downloadBytesPerSecond: 1125000, externalRequests: 'blocked', cache: 'fresh context, disabled', observation: 'load + 2000 ms; long tasks are not a WebPageTest TBT equivalent' }, results
},null,2));await browser.close();server.close();
