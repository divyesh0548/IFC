import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const browser = await chromium.launch({headless:false});
const context = await browser.newContext({viewport:{width:1440,height:1000}});
const page = await context.newPage();
await page.goto('http://localhost:5174/company_admin/home');
console.log('Recording browser opened. Waiting for company admin authentication.');
for(let i=0;i<1800;i++) {
 await page.waitForTimeout(1000);
 try {
  const profile = await page.evaluate(async()=>{
   const response=await fetch('http://localhost:3000/api/auth/verify',{credentials:'include'});
   const data=await response.json();
   return data.user;
  });
  if(profile?.role === 'company_admin' && page.url().includes('/company_admin/')) {
   await context.storageState({path:'output/ifc-recording/session.private.json'});
   console.log('Authenticated company admin session saved for recording.');
   await browser.close(); process.exit(0);
  }
 } catch {}
}
await browser.close(); process.exit(1);
