# WIS-021 — Manual Demo QA Report
**Date:** [TO BE FILLED BY HUMAN TESTER]  
**Tester:** [NAME]  
**Admin URL:** http://localhost:3000  
**Technician App:** Expo Go / Physical Device  

---

## Legend
- ✅ **PASS** - Works as expected, no issues
- ❌ **FAIL** - Broken, blocks demo
- ⚠️ **ISSUE** - Works but has visible problem
- ⏭ **NOT APPLICABLE** - Feature not present or not testable
- 📝 **NOTES** - Additional observations

---

## 1. ADMIN — LOGIN

**URL:** http://localhost:3000/login

### Visual Inspection
- [ ] Logo/branding present: ___
- [ ] Labels in Spanish: ___
- [ ] Email field visible and clickable: ___
- [ ] Password field visible (hidden text): ___
- [ ] Login button clearly labeled: ___
- [ ] No layout breaks on page load: ___

### Functional Test
- [ ] Invalid credentials show error: ___
- [ ] Error message in Spanish: ___
- [ ] Successful login redirects to dashboard: ___
- [ ] No white screen or undefined errors: ___

**Status:** [✅ / ❌ / ⚠️]  
**Screenshots:** [Attach if issues found]  
**Notes:**
```
[Human tester notes here]
```

---

## 2. ADMIN — DASHBOARD

**URL:** http://localhost:3000/dashboard

### Metrics Cards
- [ ] Pending tickets count visible: ___
- [ ] Overdue tickets count visible: ___
- [ ] Closed today count visible: ___
- [ ] Metrics match current E2E data: ___
- [ ] Cards properly aligned: ___
- [ ] No text clipping: ___
- [ ] Values not stale (reflect current state): ___

### Layout
- [ ] No horizontal scroll (1440x900): ___
- [ ] Cards responsive: ___
- [ ] Spacing consistent: ___

**Status:** [✅ / ❌ / ⚠️]  
**Screenshots:**  
**Notes:**
```
[Human tester notes here]
```

---

## 3. SLA VISUALIZATION

**URL:** http://localhost:3000/tickets

### Visual Priority System
- [ ] OVERDUE tickets clearly marked: ___
- [ ] RED tickets clearly marked: ___
- [ ] YELLOW tickets clearly marked: ___
- [ ] GREEN tickets clearly marked: ___
- [ ] Labels use text, not just color: ___
- [ ] Order is OVERDUE → RED → YELLOW → GREEN: ___

### Accessibility
- [ ] Meaning understandable without color: ___
- [ ] Priority visible at a glance: ___

**Status:** [✅ / ❌ / ⚠️]  
**Screenshots:**  
**Notes:**
```
[Human tester notes here]
```

---

## 4. CLIENTS PAGE

**URL:** http://localhost:3000/clients

### List View
- [ ] Client list loads: ___
- [ ] [E2E] Cliente Centro visible: ___
- [ ] [E2E] Cliente Norte visible: ___
- [ ] Search box present (if applicable): ___
- [ ] Search works (if applicable): ___
- [ ] Filters work (if applicable): ___

### Detail/Edit
- [ ] Client detail opens: ___
- [ ] Fields readable: ___
- [ ] Create/Edit buttons work: ___
- [ ] No broken fields: ___

**Status:** [✅ / ❌ / ⚠️]  
**Screenshots:**  
**Notes:**
```
[Human tester notes here]
```

---

## 5. TECHNICIANS PAGE

**URL:** http://localhost:3000/technicians

### List View
- [ ] Técnico E2E visible: ___
- [ ] Técnico E2E 2 visible: ___
- [ ] Active state readable: ___
- [ ] Search/filter works (if present): ___

### Create/Edit
- [ ] Create screen shows all fields: ___
- [ ] Edit screens work: ___
- [ ] No hidden buttons: ___

**Status:** [✅ / ❌ / ⚠️]  
**Screenshots:**  
**Notes:**
```
[Human tester notes here]
```

---

## 6. CREATE DEMO TICKET

**URL:** http://localhost:3000/tickets (Create button)

### Form UX
- [ ] All required fields marked clearly: ___
- [ ] Client selector works: ___
- [ ] Technician selector works: ___
- [ ] Failure type field present: ___
- [ ] Priority selector works: ___
- [ ] No label overlap: ___
- [ ] No hidden buttons: ___
- [ ] Save button visible and clickable: ___

### Validation
- [ ] Required field validation works: ___
- [ ] Error messages understandable: ___

### Post-Save
- [ ] New ticket appears in list immediately: ___
- [ ] No hard refresh needed: ___
- [ ] Ticket has correct data: ___

**Test Ticket Created:**
- **Title:** [DEMO-QA] Ticket Cliente
- **Client:** [E2E] Cliente Centro
- **Technician:** Técnico E2E
- **Ticket ID:** ___________

**Status:** [✅ / ❌ / ⚠️]  
**Screenshots:**  
**Notes:**
```
[Human tester notes here]
```

---

## 7. ADMIN TICKET DETAIL

**URL:** http://localhost:3000/tickets/[ID from step 6]

### Visible Information
- [ ] Folio number visible: ___
- [ ] Client name visible: ___
- [ ] Technician name visible: ___
- [ ] Failure type visible: ___
- [ ] Description/details visible: ___
- [ ] Status clearly shown: ___
- [ ] SLA indicator present: ___
- [ ] Timestamps visible (if applicable): ___
- [ ] Evidence section present: ___
- [ ] Signature section present: ___

### Data Quality
- [ ] No raw UUIDs exposed: ___
- [ ] No technical IDs shown to user: ___
- [ ] All text in Spanish: ___

**Status:** [✅ / ❌ / ⚠️]  
**Screenshots:**  
**Notes:**
```
[Human tester notes here]
```

---

## 8. ADMIN MAP

**URL:** http://localhost:3000/map

**Google Maps API Key Configured:** [YES / NO]

### If Key Configured:
- [ ] Map loads: ___
- [ ] Technician marker(s) visible: ___
- [ ] Latest location shown: ___
- [ ] No JavaScript console errors: ___
- [ ] Map controls work (zoom, pan): ___

### If Key NOT Configured:
- [ ] Graceful degradation (no white screen): ___
- [ ] Understandable message shown: ___
- [ ] Rest of app still works: ___

**Status:** [✅ / ❌ / ⚠️ / ⏭]  
**Screenshots:**  
**Notes:**
```
[Human tester notes here]
```

---

## 9. TECHNICIAN APP — LOGIN

**Device:** [Physical / Emulator / Simulator]  
**OS:** [iOS / Android] **Version:** ___

### Visual Inspection
- [ ] Login screen layout correct: ___
- [ ] Email field visible: ___
- [ ] Password field visible: ___
- [ ] Login button accessible: ___
- [ ] No clipped controls: ___

### Keyboard Behavior
- [ ] Keyboard appears for email field: ___
- [ ] Keyboard appears for password field: ___
- [ ] Login button not hidden by keyboard: ___
- [ ] Keyboard dismisses appropriately: ___

### Functional Test
- [ ] Invalid credentials show error: ___
- [ ] Error message in Spanish: ___
- [ ] Successful login redirects to home: ___

**Test Credentials Used:**
- Email: tecnico.e2e@wisper.com
- Password: E2ETechPass2024!

**Status:** [✅ / ❌ / ⚠️]  
**Screenshots:**  
**Notes:**
```
[Human tester notes here]
```

---

## 10. TECHNICIAN HOME

### Counters/Metrics
- [ ] Assigned/pending counter visible: ___
- [ ] Counter value correct: ___
- [ ] Counter updates when state changes: ___

### Ticket List
- [ ] Current tickets shown: ___
- [ ] [DEMO-QA] ticket visible (from step 6): ___
- [ ] Tech 2 tickets NOT visible: ___
- [ ] Cards readable on mobile: ___
- [ ] Scrolling works: ___

**Status:** [✅ / ❌ / ⚠️]  
**Screenshots:**  
**Notes:**
```
[Human tester notes here]
```

---

## 11. TECHNICIAN TICKET DETAIL

**Ticket:** [DEMO-QA] Ticket Cliente

### Visible Information
- [ ] Client name visible: ___
- [ ] Address/location visible (if applicable): ___
- [ ] Problem/failure description: ___
- [ ] SLA indicator: ___
- [ ] Current status: ___
- [ ] Available actions clear: ___

### UX
- [ ] Primary action obvious: ___
- [ ] All text readable on screen: ___
- [ ] No scrolling issues: ___

**Status:** [✅ / ❌ / ⚠️]  
**Screenshots:**  
**Notes:**
```
[Human tester notes here]
```

---

## 12. START TICKET WORKFLOW

**Action:** Tap "Iniciar" button

### Immediate Feedback
- [ ] Status updates immediately (no stale): ___
- [ ] Button state changes: ___
- [ ] Next actions appear: ___
- [ ] No need to leave and re-enter: ___

### Status After Start
- [ ] Status is "In Review" or similar: ___
- [ ] Timestamp recorded: ___

**Status:** [✅ / ❌ / ⚠️]  
**Screenshots:**  
**Notes:**
```
[Human tester notes here]
```

---

## 13. PAUSE / RESUME WORKFLOW

**Current Status Enum:** [PENDING, ASSIGNED, IN_REVIEW, PAUSED, RESOLVED, CANCELLED]

### Pause (if supported)
- [ ] Pause button available: ___
- [ ] Tap pause: ___
- [ ] Status immediately shows "Pausado": ___
- [ ] No stale buttons: ___

### Resume
- [ ] Resume button available: ___
- [ ] Tap resume: ___
- [ ] Status returns to "En Revisión": ___
- [ ] UI responsive: ___

**Status:** [✅ / ❌ / ⚠️ / ⏭]  
**Notes:**
```
[Human tester notes here]
```

---

## 14. PHOTO EVIDENCE — DEVICE CAMERA

**Device Type:** [Physical / Emulator]

### Permission Request
- [ ] Permission prompt appears: ___
- [ ] Permission prompt understandable: ___
- [ ] Grant permission works: ___

### Camera
- [ ] Camera opens: ___
- [ ] Can take photo: ___
- [ ] Photo preview shows: ___

### Upload
- [ ] Upload starts: ___
- [ ] Loading state shown: ___
- [ ] Success feedback: ___
- [ ] Evidence appears in ticket: ___

### Fallback (if camera unavailable)
- [ ] Gallery picker available: ___
- [ ] Can select existing photo: ___

**Status:** [✅ / ❌ / ⚠️]  
**Screenshots/Photo:**  
**Notes:**
```
[Human tester notes here]
[Note device limitations if any]
```

---

## 15. EVIDENCE DISPLAY

### After Upload
- [ ] Evidence item visible: ___
- [ ] Thumbnail or name shown: ___
- [ ] Date/timestamp shown: ___
- [ ] Loading state during upload: ___
- [ ] Error/retry if upload fails: ___

### Data Quality
- [ ] No raw storage paths shown: ___
- [ ] User-friendly display: ___

**Status:** [✅ / ❌ / ⚠️]  
**Screenshots:**  
**Notes:**
```
[Human tester notes here]
```

---

## 16. SIGNATURE CAPTURE

### Drawing Surface
- [ ] Signature screen opens: ___
- [ ] Drawing surface usable: ___
- [ ] Touch/stylus responsive: ___
- [ ] Clear/reset button works (if present): ___
- [ ] No clipping on small screen: ___

### Save
- [ ] Save button accessible: ___
- [ ] Signature persists: ___
- [ ] Signature visible in ticket: ___

**Status:** [✅ / ❌ / ⚠️]  
**Screenshots:**  
**Notes:**
```
[Human tester notes here]
```

---

## 17. GPS — FOREGROUND (Physical Device Only)

**Device:** [Physical / Emulator - skip if emulator]

### Permission
- [ ] Location permission requested: ___
- [ ] Permission prompt clear: ___
- [ ] Grant permission: ___

### Location Tracking
- [ ] App handles granted permission: ___
- [ ] Location updates while app active: ___
- [ ] No background GPS (as expected): ___

### If Permission Denied
- [ ] App shows understandable state: ___
- [ ] App doesn't crash: ___

### Visual Feedback (if present)
- [ ] GPS indicator visible: ___
- [ ] Status clear: ___

**Status:** [✅ / ❌ / ⚠️ / ⏭ if emulator]  
**Screenshots:**  
**Notes:**
```
[Human tester notes here]
[Emulator limitation noted if applicable]
```

---

## 18. COMPLETE TICKET

**Action:** Tap "Completar" / "Resolver" button

### Pre-Completion
- [ ] Confirmation prompt (if applicable): ___
- [ ] Required evidence/signature enforced: ___

### Completion
- [ ] Success feedback shown: ___
- [ ] Status updates to "Resolved": ___
- [ ] Timestamp recorded: ___
- [ ] Ticket leaves active queue or moves to completed: ___

### Post-Completion
- [ ] No stale UI: ___
- [ ] Ticket state consistent: ___

**Status:** [✅ / ❌ / ⚠️]  
**Screenshots:**  
**Notes:**
```
[Human tester notes here]
```

---

## 19. ADMIN POST-COMPLETION VERIFICATION

**Action:** Return to Admin dashboard

### Dashboard Update
- [ ] Dashboard metrics updated (no forced refresh): ___
- [ ] Pending count decreased: ___
- [ ] Closed today count increased: ___
- [ ] Changes visible within reasonable time: ___

### Ticket Detail
- [ ] Open completed [DEMO-QA] ticket: ___
- [ ] Status shows "Resolved": ___
- [ ] Evidence photo visible: ___
- [ ] Signature visible/accessible: ___
- [ ] Completion timestamp present: ___

**Status:** [✅ / ❌ / ⚠️]  
**Screenshots:**  
**Notes:**
```
[Human tester notes here]
```

---

## 20. STATUS HISTORY

**Location:** Ticket detail page (if exposed)

### History Timeline
- [ ] History section visible: ___
- [ ] Events in chronological order: ___
- [ ] Transitions readable:
  - [ ] Assigned: ___
  - [ ] In Review: ___
  - [ ] Paused (if applicable): ___
  - [ ] In Review (resumed): ___
  - [ ] Resolved: ___
- [ ] Timestamps correct: ___
- [ ] No duplicate events: ___

**Status:** [✅ / ❌ / ⚠️ / ⏭]  
**Screenshots:**  
**Notes:**
```
[Human tester notes here]
```

---

## 21. RESPONSIVE — DESKTOP (1440x900)

**Test Pages:**
- Dashboard: ___
- Clients: ___
- Technicians: ___
- Tickets: ___
- Ticket Detail: ___

### Layout Issues
- [ ] No horizontal scroll: ___
- [ ] No clipped dialogs: ___
- [ ] No oversized whitespace: ___
- [ ] Floating actions not hiding content: ___
- [ ] Navigation accessible: ___

**Status:** [✅ / ❌ / ⚠️]  
**Screenshots:**  
**Notes:**
```
[Human tester notes here]
```

---

## 22. RESPONSIVE — TABLET (768x1024)

**Test Pages:**
- Dashboard: ___
- Clients: ___
- Technicians: ___
- Tickets: ___
- Ticket Detail: ___

### Layout
- [ ] Navigation works: ___
- [ ] Ticket list readable: ___
- [ ] Ticket detail usable: ___
- [ ] Dialogs/forms fit: ___
- [ ] Action buttons accessible: ___

### Touch Targets
- [ ] Buttons ≥44px (reasonable): ___
- [ ] Links tappable: ___

**Status:** [✅ / ❌ / ⚠️]  
**Screenshots:**  
**Notes:**
```
[Human tester notes here]
```

---

## 23. RESPONSIVE — MOBILE ADMIN (390x844)

**Note:** Admin doesn't need to be perfect on mobile, but should remain usable.

### Critical Flows
- [ ] Can login: ___
- [ ] Can view dashboard: ___
- [ ] Can view ticket list: ___
- [ ] Can open ticket detail: ___
- [ ] Can create ticket: ___
- [ ] No catastrophic layout break: ___

**Status:** [✅ / ❌ / ⚠️]  
**Screenshots:**  
**Notes:**
```
[Human tester notes here]
```

---

## 24. TECHNICIAN SMALL-SCREEN QA

**Device Screen Size:** ___ x ___

### Layout
- [ ] Buttons not clipped: ___
- [ ] Safe areas respected (notch/home bar): ___
- [ ] Bottom actions accessible: ___
- [ ] Scrolling works with keyboard: ___
- [ ] Photo/signature controls accessible: ___

**Status:** [✅ / ❌ / ⚠️]  
**Screenshots:**  
**Notes:**
```
[Human tester notes here]
```

---

## 25. LOADING STATES

**Test:** Various network operations

### Indicators
- [ ] Buttons disable during operation: ___
- [ ] Spinner/progress shown: ___
- [ ] No duplicate submits possible: ___
- [ ] No blank screen during load: ___

**Status:** [✅ / ❌ / ⚠️]  
**Notes:**
```
[Human tester notes here]
```

---

## 26. ERROR STATES

**Test:** Simulate recoverable error (e.g., temporary network issue)

### User Experience
- [ ] Error message understandable: ___
- [ ] App doesn't crash: ___
- [ ] Retry path exists (if supported): ___
- [ ] Unsaved work not lost unexpectedly: ___

**Status:** [✅ / ❌ / ⚠️]  
**Notes:**
```
[Human tester notes here]
```

---

## 27. LOGOUT

### Admin
- [ ] Logout button accessible: ___
- [ ] Logout works: ___
- [ ] Redirects to login: ___
- [ ] Protected pages inaccessible after logout: ___

### Technician
- [ ] Logout option accessible: ___
- [ ] Logout works: ___
- [ ] Returns to login: ___
- [ ] Protected screens inaccessible after logout: ___

**Status:** [✅ / ❌ / ⚠️]  
**Notes:**
```
[Human tester notes here]
```

---

## 28. VISUAL CONSISTENCY

**Global Check Across All Pages**

### Typography
- [ ] Consistent font family: ___
- [ ] Consistent heading sizes: ___
- [ ] Readable font sizes (≥14px body): ___

### Spacing
- [ ] Consistent card padding: ___
- [ ] Consistent page margins: ___
- [ ] Consistent button spacing: ___

### Components
- [ ] Card styles consistent: ___
- [ ] Button hierarchy clear (primary/secondary): ___
- [ ] Icons consistent style: ___

### Language
- [ ] All Spanish terminology: ___
- [ ] Consistent status labels: ___
- [ ] No English leaking through: ___

**Status:** [✅ / ❌ / ⚠️]  
**Notes:**
```
[Human tester notes here]
[Only note meaningful demo-visible issues]
```

---

## 29. CONSOLE / RUNTIME ERRORS

### Admin Browser Console
**Open DevTools → Console during QA**

- [ ] No unexpected JavaScript errors: ___
- [ ] No broken API calls: ___
- [ ] Warnings reviewed (classify below): ___

**Errors Found:**
```
[Paste actual errors here]
[Distinguish between benign framework warnings and actual issues]
```

### Technician App Logs
**Metro/Device Logs**

- [ ] No runtime errors during workflow: ___
- [ ] No crashes: ___
- [ ] Warnings reviewed (classify below): ___

**Errors Found:**
```
[Paste actual errors here]
```

**Status:** [✅ / ❌ / ⚠️]  

---

## DEFECT SUMMARY

### P0 Defects (Demo/Core Flow Blocked)
```
[List P0 defects found]
[None = write "None"]
```

### P1 Defects (Visible/Functional Issue with Workaround)
```
[List P1 defects found]
[None = write "None"]
```

### P2 Defects (Polish/Minor Issues)
```
[List P2 defects found]
[None = write "None"]
```

---

## BUGS FIXED DURING QA

**Hotfixes Applied:**
```
[List any small fixes made during QA]
[None = write "None"]
```

---

## EXTERNAL CONFIGURATION

**Still Pending (Optional):**
- [ ] Google Maps API key
- [ ] Google Routes API key
- [ ] Production Supabase project
- [ ] Production credentials
- [ ] Other: ___

---

## RELEASE RECOMMENDATION

**Based on Manual QA, the recommendation is:**

[ ] ✅ **READY FOR RELEASE PREP** - No blocking defects, demo-ready

[ ] ⚠️ **CONDITIONAL** - Minor issues found, hotfixes recommended before demo

[ ] ❌ **NOT READY** - P0 defects found, release blocked

**Justification:**
```
[Explain recommendation]
```

---

## FINAL STATUS

**Overall Manual QA Result:** [✅ PASS / ⚠️ CONDITIONAL / ❌ FAIL]

**Completed By:** [Tester Name]  
**Date Completed:** [Date]  
**Time Spent:** [Hours]

---

## NEXT TASK RECOMMENDATION

Based on QA results:

**If PASS:**
- WIS-022 — Production Deployment Preparation

**If CONDITIONAL:**
- Apply hotfixes for P0/P1 issues
- Re-run affected QA sections
- Then proceed to WIS-022

**If FAIL:**
- Create P0 bug tickets
- Fix critical issues
- Re-run full WIS-021 manual QA

**Exact Next Task:** [TO BE DETERMINED BY QA RESULTS]
