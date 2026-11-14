export const narration = [
 {id:'intro',caption:'Strata · Company admin walkthrough',text:'Welcome to Strata, your internal financial controls workspace. This walkthrough follows the company admin journey: manage units, create users, configure approvers and business processes, then review RACMs and company-wide reports.'},
 {id:'units',caption:'01 · Unit Management',text:'Start with Unit Management. Each unit shows its name, address, and coordinator, with separate actions to edit the unit, assign its coordinator, or manage approvers.'},
 {id:'unit-create',caption:'Create a company unit',text:'Choose Create Unit and enter the unit name and address. These units organize responsibility across the company. This example is a preview, so we will cancel without adding a record.'},
 {id:'unit-coordinator',caption:'Assign unit responsibility',text:'The Coordinator action links a coordinator to the selected unit. This person manages process owners and uploads the unit’s RACMs. Review the selection before using Assign; we will leave the existing assignment unchanged.'},
 {id:'users',caption:'02 · User creation',text:'Next, open User Management. The company list shows account roles and contact details, with a role filter, export, and bulk upload. Use the plus button to open Create User.'},
 {id:'user-form',caption:'Enter user details',text:'For a normal user, select the relevant units and enter an email address and a valid ten-digit mobile number. Employee name, code, designation, and department provide additional context for the account.'},
 {id:'user-roles',caption:'Choose the account role',text:'The Role menu also supports Company Coordinator and Approver accounts. Coordinator unit selection is optional, so onboarding can happen before unit responsibility is assigned. Choose the role that matches the person’s work.'},
 {id:'bulk-users',caption:'Bulk onboarding with Excel',text:'For larger groups, Bulk Upload creates normal users from Excel. Download the template, select the units, and upload the completed file. This flow is separate from creating coordinator and approver accounts.'},
 {id:'approvers',caption:'03 · Approver Management',text:'Approver Management lets you search accounts and filter by assignment status or unit. Open an approver to review current assignments and configure the scope of their approval responsibilities.'},
 {id:'approver-scope',caption:'Set unit or process scope',text:'An assignment can cover a whole unit or a unit plus a business process. Select the assignment type, choose the unit, and select a process when needed. Review current assignments before saving.'},
 {id:'processes',caption:'04 · Business Process Management',text:'Business Process Management lists process names, codes, and scope. Common processes are already available, including Purchase to Pay and Order to Cash, while company-specific processes extend the same master list.'},
 {id:'process-create',caption:'Add a company-specific process',text:'Choose Add Company Process to enter a process name and its code. The code gives the process a consistent identifier. We will cancel this example and keep the process master unchanged.'},
 {id:'dashboard',caption:'05 · RACM Dashboard',text:'The RACM Dashboard provides company-wide, read-only visibility. Each row brings together the control number, business process, description, financial year, unit, process owner, activity, approval status, conclusion, and due date.'},
 {id:'dashboard-filters',caption:'Filter the control register',text:'Narrow the register by unit, business process, financial year, activity, approval status, or conclusion. Here we filter for approved controls. You can also search by control number and enable word wrap for longer descriptions.'},
 {id:'control-detail',caption:'Review a RACM in read-only mode',text:'Open a control to inspect its details. The company admin view supports oversight without changing the control or submitting an approval decision. Review the description, ownership, scheduling, and available supporting information.'},
 {id:'reports',caption:'06 · IFC reports',text:'Return to the RACM Dashboard and choose Reports. The IFC Report combines live aggregates across all company units, giving the administrator one place to review overall progress and control-design conclusions.'},
 {id:'report-metrics',caption:'Read the company-wide summary',text:'Review design conclusions alongside pending, approved, and rejected counts. Average Response Time summarizes turnaround, while Users and RACMs Count compares coverage by unit. Refresh reloads the latest report data.'},
 {id:'outro',caption:'Company admin · Structure, access, and oversight',text:'That completes the company admin workflow: establish units, onboard people, define approval scope and business processes, then monitor RACMs and reports. Strata brings structure, access management, and control oversight into one workspace.'},
];

export default async function flow({page,click,type,glide,goto,say,hold,recap,beat,waitForScreen}) {
 page.setDefaultTimeout(20000);
 const base='http://localhost:5174/company_admin/';
 const ready=async()=>{
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(350);
  await page.locator('[role="progressbar"]').first().waitFor({state:'hidden',timeout:45000});
  await page.evaluate(()=>document.fonts.ready);
 };
 const select=async(locator,name)=>{
  await click(locator);
  await page.getByRole('option',{name,exact:true}).waitFor();
  await click(page.getByRole('option',{name,exact:true}));
  await page.locator('[role="listbox"]').waitFor({state:'hidden'});
 };
 const chapter=async(title)=>{
  await click(page.getByRole('link',{name:'Strata',exact:true}));
  await page.getByText(title,{exact:true}).waitFor();
  await click(page.getByText(title,{exact:true}));
  await ready();await recap();
 };
 const done=async(id)=>{
  await hold();
  if(process.env.VERIFY_FRAME_DIR)await page.screenshot({path:process.env.VERIFY_FRAME_DIR+'/'+id+'.png'});
 };
 const cancel=async()=>{await click(page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}));await page.getByRole('dialog').waitFor({state:'hidden'});};
 await goto(base+'home');await ready();
 await say('intro');await glide(page.getByText('Reporting Snapshot',{exact:true}));await done('intro');

 await say('units');await click(page.getByText('Unit Management',{exact:true}));await ready();await recap();await glide(page.getByRole('button',{name:'Coordinator',exact:true}).first());await done('units');
 await say('unit-create');await click(page.getByRole('button',{name:'Create Unit',exact:true}));await page.getByRole('dialog').waitFor();await type(page.getByRole('textbox',{name:'Unit Name'}),'Demo Unit');await type(page.getByRole('textbox',{name:'Unit Address'}),'Example office location');await glide(page.getByRole('dialog').getByRole('button',{name:'Create',exact:true}));await done('unit-create');
 await say('unit-coordinator');await cancel();await click(page.getByRole('button',{name:'Coordinator',exact:true}).first());await page.getByRole('dialog').waitFor();await glide(page.getByRole('dialog').getByRole('combobox'));await done('unit-coordinator');

 await say('users');await cancel();await chapter('User Management');await glide(page.getByRole('button').filter({has:page.locator('[data-testid="AddIcon"]')}));await done('users');
 await say('user-form');await click(page.getByRole('button').filter({has:page.locator('[data-testid="AddIcon"]')}));await page.waitForURL('**/company_admin/create-user');await ready();await recap();await glide(page.locator('#unit_id'));await glide(page.locator('#email'));await glide(page.locator('#mobile'));await done('user-form');
 await say('user-roles');await select(page.locator('#role'),'Company Coordinator');await glide(page.locator('#unit_id'));await click(page.locator('#role'));await beat(750);await click(page.getByRole('option',{name:'Approver',exact:true}));await page.locator('[role="listbox"]').waitFor({state:'hidden'});await done('user-roles');
 await say('bulk-users');await click(page.getByRole('button',{name:'Back to List',exact:true}));await ready();await click(page.getByRole('button',{name:'Bulk Upload',exact:true}));await page.getByRole('dialog').waitFor();await glide(page.getByRole('button',{name:'Download Template',exact:true}));await done('bulk-users');

 await say('approvers');await cancel();await chapter('Approver Management');await glide(page.locator('input[placeholder]').first());await click(page.getByText('approver1.alembic@gmail.com',{exact:true}));await page.getByRole('dialog').waitFor();await done('approvers');
 await say('approver-scope');const dialog=page.getByRole('dialog');await select(dialog.getByRole('combobox').nth(0),'Unit + Business Process');await select(dialog.getByRole('combobox').nth(1),'Corporate VAD');await select(dialog.getByRole('combobox').nth(2),'Purchase to Pay');await glide(dialog.getByRole('button',{name:'Save Assignment',exact:true}));await done('approver-scope');

 await say('processes');await cancel();await chapter('Business Process Management');await glide(page.getByText('Purchase to Pay',{exact:true}));await done('processes');
 await say('process-create');await click(page.getByRole('button',{name:'Add Company Process',exact:true}));await page.getByRole('dialog').waitFor();await type(page.getByRole('textbox',{name:'Business Process',exact:true}),'Quality Review');await type(page.getByRole('textbox',{name:'Business Process Code',exact:true}),'QR');await done('process-create');

 await say('dashboard');await cancel();await chapter('RACM Dashboard');await glide(page.getByRole('combobox',{name:'Unit',exact:true}));await done('dashboard');
 await say('dashboard-filters');await select(page.getByRole('combobox',{name:'Approval Status',exact:true}),'Approved');await page.getByText('P2P2',{exact:true}).waitFor();await click(page.getByRole('switch',{name:'Word wrap'}));await done('dashboard-filters');
 await say('control-detail');await page.evaluate(()=>{window.open=url=>{window.location.assign(url);return null;};});await click(page.getByText('P2P2',{exact:true}));await waitForScreen(async()=>{await page.waitForURL('**/company_admin/form/**');await page.getByText('Process and Risk',{exact:true}).waitFor({timeout:45000});await ready();});await recap();await glide(page.getByText('Control Details',{exact:true}).first());await beat(2500);await glide(page.getByText('Documents & Approval',{exact:true}).first());await done('control-detail');

 await say('reports');await goto(base+'racms');await ready();await click(page.getByRole('button',{name:'Reports',exact:true}));await page.waitForURL('**/company_admin/ifc-report');await page.getByText('Design conclusions',{exact:true}).waitFor({timeout:45000});await ready();await recap();await done('reports');
 await say('report-metrics');await glide(page.getByText('Design conclusions',{exact:true}));await glide(page.getByText('Average Response Time',{exact:true}));await glide(page.getByText('Users/RACMs Count',{exact:true}));await done('report-metrics');
 await say('outro');await page.evaluate(()=>window.scrollTo({top:0,behavior:'smooth'}));await glide(page.getByRole('heading',{name:'IFC Report',exact:true}));await done('outro');
}
