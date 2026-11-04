// Serve this repository locally, then run with Node and Playwright.
// TEST_URL, PLAYWRIGHT_MODULE and BROWSER_EXECUTABLE may override defaults.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE||undefined,headless:true});let failed=0;const results=[];
 async function check(name,repo,fn,init){const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.setDefaultTimeout(6000);page.on('pageerror',e=>errors.push(e.message));try{if(init)await page.addInitScript(init);await page.goto(process.env.TEST_URL||'http://127.0.0.1:8000/',{waitUntil:'domcontentloaded'});await fn(page);assert.deepEqual(errors,[]);results.push({name,passed:true});console.log('PASS',name);}catch(e){failed++;results.push({name,passed:false,error:e.message,errors});console.log('FAIL',name,e.message,errors)}finally{await page.close()}}

 await check('neon startup interruption pauses audio and judging','neon-beat',async p=>{await p.locator('#start').click();await p.evaluate(()=>window.dispatchEvent(new Event('blur')));await p.waitForTimeout(900);assert.match(await p.locator('#overlay-title').textContent(),/잠시 쉬어가기/);assert.equal(await p.locator('#overlay').isVisible(),true);},()=>{const original=AudioContext.prototype.resume;AudioContext.prototype.resume=async function(){await new Promise(r=>setTimeout(r,400));return original.call(this)}});
 await browser.close();process.exitCode=failed?1:0;
})();
