const BASE = process.env.BASE || 'http://localhost';

export const narration = [
    {
        id: 'intro',
        caption: 'IFC Coordinator Demo',
        text: "Welcome to the IFC coordinator demonstration. This walkthrough covers the key features available to company coordinator users. We'll start by logging in with coordinator credentials, then explore every major module in detail from the dashboard.",
    },
    {
        id: 'login',
        caption: 'Coordinator Login',
        text: "Here at the login page, the coordinator enters their credentials — coordinator dot alembic at gmail dot com — and signs in. Once authenticated, we land on the company admin home dashboard, which serves as the central command center for all IFC activities.",
    },
    {
        id: 'dashboard-overview',
        caption: 'Dashboard Overview',
        text: "The dashboard provides an at-a-glance view of critical metrics: pending change requests, ineffective RACMs flagged for review, upcoming deadlines, and recent activity across all modules. Notice the notification badges — one RACM pending change request and one RACM found ineffective — these will be important later in the change request and deficiency response sections.",
    },
    {
        id: 'user-management',
        caption: 'User Management',
        text: "First, User Management. Navigating to the User Management module, administrators can view, add, edit, and manage all users in the organization. The grid displays each user's name, email, assigned roles, business units, and current status. You can filter by role, unit, or status. To add a new user, click the Add User button — this opens a form where you enter details, assign roles such as process owner, approver, or coordinator, and set their business unit permissions. The role-based access control ensures each user only sees what they need. We'll fill in the form fields but stop before submitting to avoid creating a test user.",
    },
    {
        id: 'racm-communication',
        caption: 'RACM Communication',
        text: "Next is RACM Communication. This module handles all communications related to Risk and Control Matrices. You can view a complete history of notifications sent, including change request alerts, deficiency notifications, approval reminders, and escalation emails. Each communication shows the recipient, subject, timestamp, and delivery status. The toolbar lets you compose new messages, attach documents, and select distribution lists. There's also a template library for common notification types. We'll open a sample communication to show the detail view with full threading and audit trail.",
    },
    {
        id: 'racm-templates',
        caption: 'RACM Templates',
        text: "RACM Templates provides a library of pre-built templates for common control frameworks like SOX, COSO, and custom organizational standards. The template grid shows each template's name, version, framework, last modified date, and status. You can preview any template by clicking its name — this opens a read-only view showing all sections, control objectives, risk categories, and predefined columns. The Import function allows you to bring in templates from Excel or CSV files. We'll click Import to show the file selection and mapping preview. You can also customize templates by adding columns — we'll demonstrate adding a dummy column named 'Test Column' to an existing template, walking through the column type selection, but we'll cancel before saving to preserve the original template.",
    },
    {
        id: 'creating-uploading-racms',
        caption: 'Creating & Uploading RACMs',
        text: "Creating and Uploading RACMs lets you build new matrices from scratch or upload them via Excel. The create-new workflow guides you through defining the matrix header — entity, business process, risk category, and period — then adding controls row by row with fields for control description, frequency, owner, evidence requirements, and test procedures. For bulk uploads, the Excel import feature is powerful: you select your file, then the column mapping screen appears where you match each spreadsheet column to the corresponding RACM field — control number, description, risk rating, control type, owner, frequency, and so on. We'll walk through the mapping interface, showing how to handle required versus optional fields, set default values, and validate the mapping before proceeding. We'll stop at the final confirmation screen, not executing the import.",
    },
    {
        id: 'racm-management',
        caption: 'RACM Management',
        text: "RACM Management is the central hub for all your Risk and Control Matrices. The main grid displays every RACM with columns for control number, description, entity, business process, risk rating, control type, frequency, current status, assigned owner, last tested date, and next due date. Powerful filters let you slice by entity, process, risk rating, status, or owner. Notice the two critical notifications at the top: one RACM pending change request — this indicates a process owner has requested a modification that needs coordinator review — and one RACM found ineffective — flagged during testing. We'll click into each notification to show the detail views. For the change request, you see the requested changes, rationale, and can approve, reject, or request more information. For the ineffective RACM, you see the test results, deficiency details, and can initiate a deficiency response workflow. We'll explore both up to the action buttons but not submit.",
    },
    {
        id: 'racm-assignment',
        caption: 'RACM Assignment',
        text: "RACM Assignment allows you to assign RACMs to process owners and approvers across the organization. The assignment matrix shows each RACM alongside its current owner, primary approver, backup approver, assignment status, and due date. You can bulk-assign by selecting multiple RACMs and choosing owners from the dropdown. The reminder configuration panel lets you set due date reminders — first reminder at three days, second at two days, final at one day — and escalation rules. There's also a reassignment workflow for when owners change roles. We'll demonstrate selecting a batch of RACMs, opening the assignment dialog, choosing new owners, setting due dates, and reviewing the reminder schedule — stopping before the final assign button.",
    },
    {
        id: 'reports',
        caption: 'Reports',
        text: "The Reports section provides comprehensive reporting on RACM status, compliance metrics, and audit trails. Available reports include: RACM Status Summary — showing counts by status across entities; Compliance Dashboard — tracking testing completion rates, overdue items, and trend lines; Change Request Log — every requested change with status and approver; Deficiency Tracker — all identified deficiencies with remediation status; Testing Evidence Report — detailed evidence collected per control; and Audit Trail — complete history of all actions. Each report can be filtered by date range, entity, process, or owner, and exported to PDF or Excel. We'll generate a sample RACM Status Summary for the current quarter, apply entity filters, and show the export options.",
    },
    {
        id: 'racm-change-requests',
        caption: 'RACM Change Requests',
        text: "RACM Change Requests manages the workflow for requesting and approving changes to existing RACMs. Navigating to the company coordinator RACM management page, we see the pending change request notification we noticed earlier. Clicking View opens the change request detail: the original control values, the proposed changes, the requester's justification, supporting documents, and the approval chain. The workflow shows current status — pending coordinator review — with buttons to Approve, Reject, or Request Clarification. If approved, the changes apply immediately; if rejected, the requester is notified with comments. We'll walk through each tab — Details, History, Documents — and hover over the action buttons to explain the consequences, but we won't click Approve or Reject to avoid modifying production data.",
    },
    {
        id: 'deficiency-response',
        caption: 'Deficiency Response Submission',
        text: "Deficiency Response Submission handles responses to identified control deficiencies. When a control is marked ineffective, the process owner receives a notification and must submit a remediation plan. The response form captures: root cause analysis, corrective action description, responsible person, target completion date, and required evidence. There's also a field for interim controls while the fix is implemented. Once submitted, the response routes to the coordinator for review — who can accept, request revision, or escalate. We'll open a sample deficiency response, fill in each field with example data, attach a sample evidence document, and show the submission confirmation dialog — stopping before the final Submit button.",
    },
    {
        id: 'risk-analysis',
        caption: 'Risk Analysis',
        text: "Risk Analysis displays generated risks for specific units and processes. Selecting the APL1 unit and P2P Business Process filter shows the pre-generated risk register. Each risk entry includes: risk ID, description, inherent risk rating, key controls mapped, residual risk rating, risk owner, and last assessment date. You can drill into any risk to see the full bow-tie analysis — causes, consequences, preventive controls, detective controls. The Generate Risks button uses the AI engine to suggest new risks based on process descriptions, industry benchmarks, and historical data — we'll click it to show the generation dialog with parameter options. Similarly, Design Gap Analysis evaluates whether existing controls adequately address identified risks — it shows coverage gaps, missing control mappings, and suggestions for new controls. We'll open the Design Gap view for the same APL1 and P2P combination to demonstrate the side-by-side comparison.",
    },
    {
        id: 'outro',
        caption: 'Demo Complete',
        text: "That concludes the IFC coordinator demo. You've seen the full workflow from user management through risk analysis, including all notification-driven processes like change requests and deficiency responses — all demonstrated up to the point of database modification, so no production data was changed. Thank you for watching.",
    },
];

export default async function flow({ page, say, hold, recap, click, type, glide, goto, safe }) {
    // Start at login page and log in automatically
    await goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    await say('intro');
    await hold(2000);

    // Automated login
    await say('login');
    // Fill email
    const emailInput = page.getByRole('textbox', { name: /email/i }).or(page.getByPlaceholder(/email/i)).or(page.locator('input[type="email"]')).or(page.locator('input[name="email"]'));
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await type(emailInput, 'coordinator.alembic@gmail.com');
    await hold(500);
    // Fill password
    const passwordInput = page.getByRole('textbox', { name: /password/i }).or(page.getByPlaceholder(/password/i)).or(page.locator('input[type="password"]')).or(page.locator('input[name="password"]'));
    await type(passwordInput, '123456');
    await hold(500);
    // Click login button
    const loginBtn = page.getByRole('button', { name: /sign in|login|submit/i }).or(page.getByText(/sign in|login|submit/i)).or(page.locator('button[type="submit"]')).or(page.locator('button:has-text("Login")')).or(page.locator('button:has-text("Sign In")'));
    await click(loginBtn);
    // Wait for navigation - try multiple possible URLs
    await Promise.race([
        page.waitForURL('**/company_admin/home', { timeout: 30000 }),
        page.waitForURL('**/company_admin/**', { timeout: 30000 }),
        page.waitForURL('**/dashboard**', { timeout: 30000 }),
        page.waitForLoadState('networkidle', { timeout: 30000 })
    ]);
    await recap();
    await hold(3000);

    // Dashboard Overview
    await say('dashboard-overview');
    await goto(`${BASE}/company_admin/home`);
    await page.waitForLoadState('networkidle');
    await hold(3000);
    await page.evaluate(() => window.scrollBy(0, 500));
    await hold(2000);
    await page.evaluate(() => window.scrollBy(0, -500));
    await hold(1000);

    // User Management
    await say('user-management');
    await goto(`${BASE}/company_admin/user-management`);
    await page.waitForLoadState('networkidle');
    await hold(4000);
    await page.evaluate(() => window.scrollBy(0, 600));
    await hold(2000);
    
    // Show Add User form
    await safe(async () => {
        const addBtn = page.getByRole('button', { name: /add user|new user/i }).or(page.getByText(/add user|new user/i));
        if (await addBtn.isVisible({ timeout: 3000 })) {
            await click(addBtn);
            await page.waitForLoadState('networkidle');
            await hold(2000);
            // Fill form fields
            const nameInput = page.getByRole('textbox', { name: /name/i }).or(page.getByPlaceholder(/name/i));
            if (await nameInput.isVisible({ timeout: 2000 })) {
                await type(nameInput, 'Test User');
                await hold(500);
            }
            const emailInput = page.getByRole('textbox', { name: /email/i }).or(page.getByPlaceholder(/email/i));
            if (await emailInput.isVisible({ timeout: 2000 })) {
                await type(emailInput, 'test@example.com');
                await hold(500);
            }
            // Show role dropdown
            const roleSelect = page.getByRole('combobox', { name: /role/i }).or(page.getByLabel(/role/i));
            if (await roleSelect.isVisible({ timeout: 2000 })) {
                await click(roleSelect);
                await hold(1000);
                await page.keyboard.press('Escape');
            }
            // Cancel
            const cancelBtn = page.getByRole('button', { name: /cancel/i }).or(page.getByText(/cancel/i));
            if (await cancelBtn.isVisible({ timeout: 2000 })) {
                await click(cancelBtn);
            }
            await hold(1000);
        }
    });
    await hold(2000);

    // RACM Communication
    await say('racm-communication');
    await goto(`${BASE}/company_admin/racm-communication`);
    await page.waitForLoadState('networkidle');
    await hold(4000);
    await page.evaluate(() => window.scrollBy(0, 600));
    await hold(2000);
    
    // Open a sample communication
    await safe(async () => {
        const commRow = page.locator('tbody tr').first();
        if (await commRow.isVisible({ timeout: 3000 })) {
            await click(commRow);
            await page.waitForLoadState('networkidle');
            await hold(3000);
            // Go back
            await page.goBack();
            await hold(1000);
        }
    });
    await hold(2000);

    // RACM Templates
    await say('racm-templates');
    await goto(`${BASE}/company_admin/racm-templates`);
    await page.waitForLoadState('networkidle');
    await hold(3000);
    
    // Show Import function
    await safe(async () => {
        const importBtn = page.getByRole('button', { name: /import/i }).or(page.getByText(/import/i));
        if (await importBtn.isVisible({ timeout: 3000 })) {
            await click(importBtn);
            await page.waitForLoadState('networkidle');
            await hold(2000);
            const cancelBtn = page.getByRole('button', { name: /cancel|close/i }).or(page.getByText(/cancel|close/i));
            if (await cancelBtn.isVisible({ timeout: 2000 })) {
                await click(cancelBtn);
            }
            await hold(1000);
        }
    });
    
    // Preview a template
    await safe(async () => {
        const templateLink = page.locator('tbody tr').first().locator('a').first();
        if (await templateLink.isVisible({ timeout: 3000 })) {
            await click(templateLink);
            await page.waitForLoadState('networkidle');
            await hold(3000);
            await page.goBack();
            await hold(1000);
        }
    });
    
    // Add dummy column
    await safe(async () => {
        const addColBtn = page.getByRole('button', { name: /add column/i }).or(page.getByText(/add column/i));
        if (await addColBtn.isVisible({ timeout: 3000 })) {
            await click(addColBtn);
            await hold(1000);
            const colNameInput = page.getByRole('textbox', { name: /column name/i }).or(page.getByPlaceholder(/column name/i));
            if (await colNameInput.isVisible({ timeout: 2000 })) {
                await type(colNameInput, 'Test Column');
                await hold(500);
                const cancelBtn = page.getByRole('button', { name: /cancel/i }).or(page.getByText(/cancel/i));
                if (await cancelBtn.isVisible({ timeout: 2000 })) {
                    await click(cancelBtn);
                }
            }
        }
    });
    await hold(3000);

    // Creating & Uploading RACMs
    await say('creating-uploading-racms');
    await goto(`${BASE}/company_admin/racm-upload`);
    await page.waitForLoadState('networkidle');
    await hold(3000);
    
    // Show file upload
    await safe(async () => {
        const fileInput = page.locator('input[type="file"]');
        if (await fileInput.isVisible({ timeout: 3000 })) {
            await glide(fileInput);
            await hold(1500);
        }
    });
    
    // Show column mapping
    await safe(async () => {
        const mappingBtn = page.getByRole('button', { name: /map|next|continue/i }).or(page.getByText(/map|next|continue/i));
        if (await mappingBtn.isVisible({ timeout: 3000 })) {
            await click(mappingBtn);
            await page.waitForLoadState('networkidle');
            await hold(3000);
            // Show mapping interface
            await page.evaluate(() => window.scrollBy(0, 600));
            await hold(2000);
            // Cancel/back
            const cancelBtn = page.getByRole('button', { name: /cancel/i }).or(page.getByText(/cancel/i));
            if (await cancelBtn.isVisible({ timeout: 2000 })) {
                await click(cancelBtn);
            } else {
                const backBtn = page.getByRole('button', { name: /back/i }).or(page.getByText(/back/i));
                if (await backBtn.isVisible({ timeout: 2000 })) {
                    await click(backBtn);
                }
            }
        }
    });
    await hold(3000);

    // RACM Management
    await say('racm-management');
    await goto(`${BASE}/company_admin/racm-management`);
    await page.waitForLoadState('networkidle');
    await hold(3000);
    
    // Show notifications
    await safe(async () => {
        const notif1 = page.getByText(/1.*racm.*pending.*change request/i);
        if (await notif1.isVisible({ timeout: 3000 })) {
            await glide(notif1);
            await hold(2000);
            await click(notif1);
            await page.waitForLoadState('networkidle');
            await hold(3000);
            await page.goBack();
            await hold(1000);
        }
    });
    await safe(async () => {
        const notif2 = page.getByText(/1.*racms?.*found.*ineffective/i);
        if (await notif2.isVisible({ timeout: 3000 })) {
            await glide(notif2);
            await hold(2000);
            await click(notif2);
            await page.waitForLoadState('networkidle');
            await hold(3000);
            await page.goBack();
            await hold(1000);
        }
    });
    await hold(3000);
    await page.evaluate(() => window.scrollBy(0, 800));
    await hold(2000);

    // RACM Assignment
    await say('racm-assignment');
    await goto(`${BASE}/company_admin/racm-assignment`);
    await page.waitForLoadState('networkidle');
    await hold(4000);
    await page.evaluate(() => window.scrollBy(0, 600));
    await hold(2000);
    
    // Show bulk assignment
    await safe(async () => {
        const assignBtn = page.getByRole('button', { name: /assign|bulk assign/i }).or(page.getByText(/assign|bulk assign/i));
        if (await assignBtn.isVisible({ timeout: 3000 })) {
            await click(assignBtn);
            await page.waitForLoadState('networkidle');
            await hold(2000);
            // Show owner dropdown
            const ownerSelect = page.getByRole('combobox', { name: /owner|approver/i }).or(page.getByLabel(/owner|approver/i));
            if (await ownerSelect.isVisible({ timeout: 2000 })) {
                await click(ownerSelect);
                await hold(1000);
                await page.keyboard.press('Escape');
            }
            const cancelBtn = page.getByRole('button', { name: /cancel/i }).or(page.getByText(/cancel/i));
            if (await cancelBtn.isVisible({ timeout: 2000 })) {
                await click(cancelBtn);
            }
        }
    });
    await hold(3000);

    // Reports
    await say('reports');
    await goto(`${BASE}/company_admin/reports`);
    await page.waitForLoadState('networkidle');
    await hold(4000);
    await page.evaluate(() => window.scrollBy(0, 600));
    await hold(2000);
    
    // Generate a sample report
    await safe(async () => {
        const reportBtn = page.getByRole('button', { name: /generate|run|export/i }).or(page.getByText(/generate|run|export/i));
        if (await reportBtn.isVisible({ timeout: 3000 })) {
            await click(reportBtn);
            await page.waitForLoadState('networkidle');
            await hold(2000);
            // Show filter options
            const filterSelect = page.getByRole('combobox', { name: /entity|date|period/i }).or(page.getByLabel(/entity|date|period/i));
            if (await filterSelect.isVisible({ timeout: 2000 })) {
                await click(filterSelect);
                await hold(1000);
                await page.keyboard.press('Escape');
            }
            const cancelBtn = page.getByRole('button', { name: /cancel|close/i }).or(page.getByText(/cancel|close/i));
            if (await cancelBtn.isVisible({ timeout: 2000 })) {
                await click(cancelBtn);
            }
        }
    });
    await hold(3000);

    // RACM Change Requests
    await say('racm-change-requests');
    await goto(`${BASE}/company-co/racm-management`);
    await page.waitForLoadState('networkidle');
    await recap();
    await hold(3000);
    
    // Show the change request notification
    await safe(async () => {
        const changeReqNotif = page.getByText(/1.*racm.*pending.*change request/i);
        if (await changeReqNotif.isVisible({ timeout: 5000 })) {
            await glide(changeReqNotif);
            await hold(2000);
            await click(changeReqNotif);
            await page.waitForLoadState('networkidle');
            await hold(4000);
            // Show tabs
            await safe(async () => {
                const detailsTab = page.getByRole('tab', { name: /detail/i }).or(page.getByText(/detail/i));
                if (await detailsTab.isVisible({ timeout: 2000 })) {
                    await click(detailsTab);
                    await hold(1500);
                }
            });
            await safe(async () => {
                const historyTab = page.getByRole('tab', { name: /history/i }).or(page.getByText(/history/i));
                if (await historyTab.isVisible({ timeout: 2000 })) {
                    await click(historyTab);
                    await hold(1500);
                }
            });
            await safe(async () => {
                const docsTab = page.getByRole('tab', { name: /document/i }).or(page.getByText(/document/i));
                if (await docsTab.isVisible({ timeout: 2000 })) {
                    await click(docsTab);
                    await hold(1500);
                }
            });
            // Show action buttons but don't click
            await safe(async () => {
                const approveBtn = page.getByRole('button', { name: /approve/i });
                if (await approveBtn.isVisible({ timeout: 2000 })) {
                    await glide(approveBtn);
                    await hold(1500);
                }
            });
            await safe(async () => {
                const rejectBtn = page.getByRole('button', { name: /reject/i });
                if (await rejectBtn.isVisible({ timeout: 2000 })) {
                    await glide(rejectBtn);
                    await hold(1500);
                }
            });
            await page.goBack();
            await hold(1000);
        }
    });
    await hold(2000);

    // Deficiency Response Submission
    await say('deficiency-response');
    await goto(`${BASE}/company_admin/deficiency-response`);
    await page.waitForLoadState('networkidle');
    await hold(3000);
    
    // Open a deficiency response
    await safe(async () => {
        const deficiencyRow = page.locator('tbody tr').first();
        if (await deficiencyRow.isVisible({ timeout: 3000 })) {
            await click(deficiencyRow);
            await page.waitForLoadState('networkidle');
            await hold(3000);
            // Fill response form
            await safe(async () => {
                const rootCause = page.getByRole('textbox', { name: /root cause/i }).or(page.getByPlaceholder(/root cause/i));
                if (await rootCause.isVisible({ timeout: 2000 })) {
                    await type(rootCause, 'Insufficient monitoring of vendor access controls');
                    await hold(500);
                }
            });
            await safe(async () => {
                const correctiveAction = page.getByRole('textbox', { name: /corrective action/i }).or(page.getByPlaceholder(/corrective action/i));
                if (await correctiveAction.isVisible({ timeout: 2000 })) {
                    await type(correctiveAction, 'Implement quarterly access reviews with documented evidence');
                    await hold(500);
                }
            });
            await safe(async () => {
                const responsibleInput = page.getByRole('textbox', { name: /responsible/i }).or(page.getByPlaceholder(/responsible/i));
                if (await responsibleInput.isVisible({ timeout: 2000 })) {
                    await type(responsibleInput, 'John Smith');
                    await hold(500);
                }
            });
            await safe(async () => {
                const dateInput = page.getByRole('textbox', { name: /target.*date|completion.*date/i }).or(page.getByPlaceholder(/target.*date|completion.*date/i));
                if (await dateInput.isVisible({ timeout: 2000 })) {
                    await type(dateInput, '2026-12-31');
                    await hold(500);
                }
            });
            // Show submit button but don't click
            const submitBtn = page.getByRole('button', { name: /submit|save/i });
            if (await submitBtn.isVisible({ timeout: 3000 })) {
                await glide(submitBtn);
                await hold(2000);
            }
            await page.goBack();
            await hold(1000);
        }
    });
    await hold(3000);

    // Risk Analysis
    await say('risk-analysis');
    await goto(`${BASE}/company_admin/risk-analysis`);
    await page.waitForLoadState('networkidle');
    await hold(3000);
    
    // Filter for APL1 unit
    await safe(async () => {
        const apl1Filter = page.getByRole('combobox', { name: /unit|entity/i }).or(page.getByLabel(/unit|entity/i));
        if (await apl1Filter.isVisible({ timeout: 3000 })) {
            await click(apl1Filter);
            const apl1Option = page.getByRole('option', { name: /apl1/i });
            if (await apl1Option.isVisible({ timeout: 2000 })) {
                await click(apl1Option);
                await hold(1500);
            }
        }
    });
    
    // Filter for P2P Business process
    await safe(async () => {
        const p2pFilter = page.getByRole('combobox', { name: /business process|process/i }).or(page.getByLabel(/business process|process/i));
        if (await p2pFilter.isVisible({ timeout: 3000 })) {
            await click(p2pFilter);
            const p2pOption = page.getByRole('option', { name: /p2p/i });
            if (await p2pOption.isVisible({ timeout: 2000 })) {
                await click(p2pOption);
                await hold(1500);
            }
        }
    });
    
    // Show generated risks
    await safe(async () => {
        const risksList = page.getByRole('list', { name: /risks/i }).or(page.getByText(/risks/i)).or(page.locator('tbody'));
        if (await risksList.isVisible({ timeout: 3000 })) {
            await glide(risksList);
            await hold(3000);
            // Click first risk for detail
            const firstRisk = page.locator('tbody tr').first();
            if (await firstRisk.isVisible({ timeout: 2000 })) {
                await click(firstRisk);
                await page.waitForLoadState('networkidle');
                await hold(3000);
                await page.goBack();
                await hold(1000);
            }
        }
    });
    
    // Show generate risks button
    await safe(async () => {
        const generateBtn = page.getByRole('button', { name: /generate.*risk/i }).or(page.getByText(/generate.*risk/i));
        if (await generateBtn.isVisible({ timeout: 3000 })) {
            await click(generateBtn);
            await page.waitForLoadState('networkidle');
            await hold(3000);
            // Show generation parameters
            await page.evaluate(() => window.scrollBy(0, 400));
            await hold(2000);
            const cancelBtn = page.getByRole('button', { name: /cancel|close/i }).or(page.getByText(/cancel|close/i));
            if (await cancelBtn.isVisible({ timeout: 2000 })) {
                await click(cancelBtn);
            }
        }
    });
    
    // Design Gap Analysis
    await safe(async () => {
        const designGapLink = page.getByRole('link', { name: /design gap/i }).or(page.getByText(/design gap/i));
        if (await designGapLink.isVisible({ timeout: 3000 })) {
            await click(designGapLink);
            await page.waitForLoadState('networkidle');
            await hold(3000);
            await page.evaluate(() => window.scrollBy(0, 600));
            await hold(2000);
        }
    });
    await hold(2000);

    // Outro
    await say('outro');
    await hold(3000);
}