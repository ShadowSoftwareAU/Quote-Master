# Deck Me — Replit Update Instructions

> Items extracted from the 2026-05-23 meeting transcript.
> Apply these changes to the existing Deck Me Replit project.

---

## 1. Team Member / Employee Management (NEW MODULE)

The owner (tradie) can add team members (employees, subcontractors) to their account and assign them to specific projects/jobs.

### What team members CAN do (mobile app):
- View jobs they are assigned to (job details, address, scope, checklist)
- Upload **start photos** before beginning work on a job
- Upload **progress photos** and **completion photos**
- Add notes to a job (text input)
- **Clock on / clock off** for time tracking on a job
- Log hours manually if they forget to clock in/out

### What team members CANNOT see:
- Dollar values (no pricing, no costs, no quotes, no margins)
- Financial reports or P&L
- Customer payment information
- Revenue split or subscription details

### How it helps the owner:
- At end of day/week, the owner opens the web dashboard and sees:
  - Who worked on what jobs
  - Hours logged per team member per job
  - Photos uploaded (before/during/after)
  - Notes added by team members
- This feeds into job costing (labour hours x rate = labour cost per job)
- Eliminates paper timesheets and text message check-ins

### Data model additions:
```
team_members (update existing)
  id, user_id (owner), name, email, phone, role, pin_or_password,
  permissions_json, active, created_at

time_entries
  id, team_member_id, job_id, clock_on, clock_off, duration_minutes,
  manual_entry (boolean), notes, created_at

job_assignments
  id, job_id, team_member_id, assigned_at, role_on_job
```

### API routes:
- `GET /api/team` — list team members
- `POST /api/team` — add team member
- `PATCH /api/team/:id` — update team member
- `DELETE /api/team/:id` — deactivate team member
- `POST /api/team/:memberId/assign/:jobId` — assign to job
- `POST /api/time/clock-on` — clock on to a job
- `POST /api/time/clock-off` — clock off from a job
- `GET /api/time/job/:jobId` — time entries for a job
- `GET /api/time/member/:memberId` — time entries for a team member
- `POST /api/time/manual` — manual time entry

### Mobile UI:
- Team member login (simplified, possibly PIN-based)
- Home screen shows only their assigned jobs for today/this week
- Each job card has buttons: Clock On, Clock Off, Add Photo, Add Note
- No navigation to financials, quotes, or pricing screens

---

## 2. Weekly Planner View (NEW FEATURE)

Add a **Planner** view under Bookings/Schedule.

### Layout:
- Week view with days as columns (Mon through Sun)
- Jobs displayed as cards/blocks within each day column
- Multiple jobs per day supported (small jobs, large jobs)
- If team members exist, show which team member is assigned to which job
- Drag-and-drop to reschedule jobs between days

### Management tool purpose:
- Visual overview of where all work is happening this week
- See team member allocation at a glance
- Replaces whiteboard / written diary planning
- Owner can plan the week, assign team members, and see gaps

### UI:
- Web dashboard: full weekly planner with drag-and-drop
- Mobile: simplified read-only week view (swipe between days)

---

## 3. Handwritten Note Scanning (NEW FEATURE)

Allow tradies to write notes by hand and scan them into the app.

### How it works:
- User takes a photo of handwritten notes (mobile camera or upload)
- OCR processes the image and extracts text
- App intelligently routes the extracted data based on context/patterns:
  - Measurements → calculator or job dimensions
  - Material lists → BOM or shopping list
  - Customer details → CRM contact
  - General notes → job notes
- User confirms/edits the parsed result before saving

### Implementation:
- Use a cloud OCR service (Google Vision API, or Tesseract as fallback)
- Post-processing layer to identify content type and suggest routing
- "Scan Note" button available on job detail screen and as a standalone tool
- Store original photo + extracted text for reference

### Priority:
- This is a **Phase 2 / post-launch** feature, but build the photo upload infrastructure now so scanning can be added later without rearchitecting

---

## 4. Regulation Scope Clarification

### Current scope (launch):
- **Australia only**: Queensland and New South Wales building regulations
- Council compliance warnings based on AU state thresholds
- Australian suppliers only (Bunnings, Mitre 10, local trade suppliers)

### Future scope (post-traction):
- Expand to other Australian states/territories
- International markets (US, UK, etc.) require separate regulatory modules
- Each region needs: building codes, permit thresholds, measurement units, supplier integrations
- This is flagged as a **major future enhancement**, not part of the initial build
- International expansion is the path to 10M+ users and potential acquisition interest

---

## 5. Completed Jobs Showcase (NEW FEATURE)

Add a **Completed Jobs / Portfolio** section.

### What it shows:
- Before and after photos for completed jobs
- Job summary (deck type, dimensions, materials used)
- Optional customer testimonial/rating

### Purpose:
- Tradies use this to show prospective customers their past work
- Used during supplier pitches ("here's the app in action with real jobs")
- Acts as a portfolio/showroom within the app
- Visible on mobile so tradies can show it on-site

### UI:
- Gallery view with before/after photo pairs
- Filter by job type, date, or material
- "Share" button to send portfolio link to a customer

---

## 6. Supplier Onboarding Features (NEW)

To support the go-to-market strategy of onboarding trade suppliers:

### QR Code Sign-Up:
- Generate a QR code that links to the app sign-up page
- Suppliers can display this QR code at their front desk / trade counter
- Different QR codes per supplier (tracks referral source)
- QR code generation built into the admin/settings area

### Supplier Partnership View:
- Suppliers who partner get a read-only dashboard showing:
  - Number of app users buying their products
  - Aggregate volume data (anonymised)
  - Featured placement in the supplier comparison
- This is a **future premium feature** for suppliers, but the referral QR infrastructure should be built now

---

## 7. Milestone-Gated Feature Releases

Implement a simple feature flag system tied to user milestones.

### Concept:
- Certain premium features (e.g., AI rendering) are locked until the platform hits subscriber milestones
- Public-facing progress tracker on the website: "X users signed up, unlock AI Rendering at Y users"
- Creates community momentum and FOMO
- Milestone targets are configurable by admin

### Implementation:
- Feature flags table in database
- Admin UI to set milestone thresholds and toggle features
- Public widget/page showing progress toward next milestone
- When milestone is hit, feature auto-unlocks for all eligible tier users

---

## 8. Distribution Channel Tracking

Track where users come from for go-to-market:

### Channels to track:
- **Blue Dog** (training organisation, Jack's connection)
- **TAFE** partnerships
- **Trade suppliers** (Bunnings, Mitre 10, independents)
- **Word of mouth** (referral codes)
- **Direct sign-up** (website, app store)

### Implementation:
- Referral source field on sign-up (dropdown + "other" free text)
- UTM parameter tracking on web sign-up links
- QR codes with embedded referral source
- Reporting dashboard showing sign-ups by channel
- Feeds into the partner/supplier value proposition

---

## Summary of Changes for Replit

### Build Now (within 14-day sprint):
1. **Team member management** — add/assign team members to jobs, restricted mobile view (no dollar values), photo upload, notes, clock on/off time tracking
2. **Weekly planner view** — week-as-columns layout under Bookings, shows jobs + assigned team members, drag-and-drop on web
3. **Completed jobs gallery** — before/after photos, portfolio view, shareable
4. **QR code generation** — for sign-up referral tracking (supplier partnerships)
5. **Referral source tracking** — capture where each user came from on sign-up

### Build Later (post-launch / post-milestone):
6. **Handwritten note scanning (OCR)** — photo → text → smart routing. Build photo upload infra now, OCR later.
7. **International regulations** — AU-only at launch, architect for future regional modules
8. **Milestone-gated feature releases** — feature flags + public progress tracker
9. **Supplier partnership dashboard** — read-only analytics for partner suppliers

---

*Generated by Poida from meeting transcript (2026-05-23). Cross-referenced with REPLIT_BUILD_SPEC.md.*
