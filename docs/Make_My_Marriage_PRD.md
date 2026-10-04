# Make My Marriage — Product Requirements Document (PRD)

**Product:** Make My Marriage  
**Product Type:** SaaS — Collaborative Wedding Management Platform  
**Initial Market:** India  
**Primary Users:** Couples, Family Members, Wedding Planners/Organizers  
**Document Status:** Product Definition / V1 Requirements  
**Initial Business Model:** SaaS; monetization model to be finalized later.

---

## 1. Product Vision

Make My Marriage is an India-first SaaS platform that gives couples, families, and wedding planners one collaborative workspace to plan and manage a wedding, while giving guests a simple account-free digital experience for invitations, RSVP, wedding information, photos, live streaming, and easy email/WhatsApp access.

The core concept is:

> **One wedding = one collaborative digital workspace.**

The platform combines wedding planning, event management, family collaboration, guest management, vendor management, expense tracking, digital invitations, RSVP, wedding website, photography/memories, and third-party live streaming.

---

## 2. Product Goals

Authorized wedding members should be able to:

- Create and configure a wedding.
- Collaborate with family members and planners.
- Create and manage multiple wedding events.
- Plan and assign tasks.
- Record and monitor wedding expenses.
- Manage vendors associated with the wedding.
- Discover nearby businesses/vendors through Google Places.
- Maintain a centralized guest list.
- Assign guests to specific events.
- Create and distribute digital wedding invitations.
- Send invitations and reminders by email.
- Share invitation/reminder links through WhatsApp using pre-filled messages.
- Collect RSVP responses without requiring guest accounts.
- Create a wedding website.
- Share wedding information through secure links.
- Maintain a centralized wedding photo gallery.
- Allow authorized guests to contribute photos.
- Integrate third-party live streaming.
- Provide guests with a simple, frictionless experience.

---

## 3. Product Principles

- **Simplicity first:** Do not turn the product into a complex accounting, CRM, project-management, or social-networking platform.
- **Collaboration is core:** Bride, groom, parents, family members, and planners should be able to work together.
- **One wedding workspace:** Wedding data remains isolated within the relevant wedding.
- **Guest experience should be frictionless:** Guests should not need an account, password, app installation, or dashboard.
- **India-first:** Support common Indian wedding structures such as Engagement, Haldi, Mehendi, Sangeet, Wedding, Reception, and custom events.
- **Shareability:** Invitations, wedding websites, galleries, and live-stream experiences should be easy to share.
- **Secure by default:** Guest links, private media, personal data, and wedding information must be protected.

---

## 4. Target Users

### 4.1 Couples

Bride and groom are the primary wedding owners/users. They configure the wedding, invite collaborators, manage guests, tasks, expenses, vendors, invitations, website, and memories.

### 4.2 Family Members

Parents, siblings, relatives, and trusted family members can collaborate based on permissions.

### 4.3 Wedding Planners / Organizers

A planner or organizer can be invited into a specific wedding workspace and help manage planning activities. The current product model does not support a planner managing multiple wedding workspaces simultaneously.

### 4.4 Guests

Guests are fundamentally different from authenticated wedding managers.

Guests:

- Do not need accounts.
- Do not need passwords.
- Do not need app installation.
- Access invitations, wedding information, RSVP, galleries, and live streams through secure links.
- May upload photos through an authorized guest-upload link.

---

## 5. User Experience Model

The product has two primary experiences.

### 5.1 Private Management Experience

**Login → Wedding Dashboard → Events / Guests / Tasks / Expenses / Vendors / Invitations / Website / Gallery / Live Stream**

This experience is for authenticated wedding managers.

### 5.2 Guest Experience

**Invitation Link → Wedding Experience → Invitation / Events / RSVP / Venue / Website / Gallery / Live Stream**

No guest account is required.

---

## 6. Wedding Workspace

The wedding workspace is the central business entity of the product.

A wedding workspace contains:

- Couple information
- Wedding date and location
- Events
- Members
- Guests
- Vendors
- Tasks
- Expenses
- Invitations
- RSVP data
- Wedding website
- Gallery/albums
- Live-stream configuration
- Communication information

All wedding information must remain isolated to the appropriate wedding workspace.

---

## 7. Authentication

Authenticated access is required for wedding managers such as the couple, family members, and planners/organizers.

Guest access is token/link based rather than normal account authentication.

The detailed authentication architecture, user roles, permissions, and authorization matrix will be defined in a later system-design phase.

---

## 8. Wedding Setup

The wedding setup flow should capture core information such as:

- Bride name
- Groom name
- Wedding date
- Location
- Venue
- City
- Couple story
- Couple photos
- Wedding theme
- Initial events
- Relevant contact information

The setup should be simple enough for a couple or family member to complete without technical knowledge.

---

## 9. Wedding Members & Organizer Management

A wedding may contain multiple collaborating members, such as:

- Bride
- Groom
- Parents
- Siblings
- Family members
- Wedding planner/organizer

Members receive permission-controlled access to relevant parts of the wedding workspace.

Examples of permission areas include:

- Wedding settings
- Events
- Guests
- Tasks
- Expenses
- Vendors
- Invitations
- Website
- Gallery
- Live stream

The exact permission matrix is intentionally deferred to the later roles/permissions design.

---

## 10. Multiple Events

The platform must support multiple events within one wedding.

Examples:

- Engagement
- Haldi
- Mehendi
- Sangeet
- Wedding
- Reception
- Custom events

Each event can contain:

- Event name
- Date
- Start/end time
- Venue
- Address
- Description
- Event-specific guests
- Schedule
- Tasks
- Expenses
- Invitation information
- Live-stream information

---

## 11. Wedding Dashboard

The dashboard is the central control center for the wedding.

It should provide a simple summary of:

- Wedding date
- Upcoming event
- Event count
- Guest count
- RSVP summary
- Total expenses
- Pending tasks
- Vendor summary
- Invitation summary
- Upcoming tasks/events
- Pending RSVPs
- Recent expenses
- Vendor payment notes
- Important announcements

The dashboard should remain actionable rather than becoming an overloaded analytics screen.

---

## 12. Task Planner

The task planner is intentionally simple.

A task may contain:

- Title
- Description
- Assigned member
- Associated event
- Due date
- Priority
- Status
- Notes

Suggested statuses:

- To Do
- In Progress
- Completed

Overdue tasks should be clearly identifiable.

---

## 13. Expense Tracker

The expense tracker is a simple manual tracking system.

### Purpose

Family members and organizers should be able to write down wedding expenses and understand overall spending.

### Expense Data

- Amount
- Category
- Description
- Date
- Associated event
- Person who added the expense

### Features

- Add expense
- Edit expense
- Delete expense
- View expenses
- Filter by category
- Filter by event
- Filter by date
- View total spending
- View category breakdown
- Track who recorded the expense

### Explicitly Out of Scope

- Bank integrations
- Payment gateway processing
- Bank transaction imports
- Double-entry accounting
- Tax accounting
- Complex invoice management
- Financial reconciliation
- Investment/accounting functionality

Payments made outside Make My Marriage are only recorded for tracking purposes.

---

## 14. Vendor Management

Vendor management is **not a marketplace**.

It is intended for vendors that the couple/family/planner is considering or has hired.

### Vendor Categories

Examples include:

- Photographer
- Videographer
- Caterer
- Decorator
- Makeup artist
- Mehendi artist
- DJ
- Band
- Venue
- Florist
- Priest/Pandit
- Invitation provider
- Other wedding businesses

### Vendor Discovery

Nearby businesses should be discoverable through the **Google Places API**.

Basic flow:

**Add Vendor → Select Category → Search Nearby → View Places Results → Select Business → Review → Add to Wedding**

Where applicable, vendor information may include:

- Business name
- Category
- Address
- Contact information
- Website
- Google Place ID
- Location
- Assigned events
- Agreed amount
- Amount paid
- Remaining amount
- Notes
- Documents

The implementation must comply with applicable Google Maps Platform / Places terms, quotas, attribution requirements, and storage restrictions.

### Vendor Payments

Make My Marriage does not process vendor payments.

Users may manually record information such as:

- Agreed amount: ₹80,000
- Paid: ₹30,000
- Remaining: ₹50,000

### Out of Scope

- Vendor marketplace
- Vendor bidding
- Vendor lead marketplace
- Vendor commissions
- Vendor subscriptions
- Public vendor-review marketplace

---

## 15. Guest Management

The platform should maintain one centralized guest database for the wedding.

A guest may be associated with one or more events.

Potential guest information includes:

- Name
- Contact information
- Family/group
- Relationship
- Accompanying guests
- Adults
- Children
- RSVP status
- Events invited to
- Invitation status
- Accommodation requirement, where applicable
- Notes

---

## 16. Event-Level Guests

Guests must be assignable to individual events.

Example:

**Rahul**

- Haldi: Yes
- Mehendi: Yes
- Wedding: Yes
- Reception: No

Users should be able to filter guests by:

- Event
- RSVP status
- Invitation status
- Family/group

---

## 17. Family / Group Guests

Indian weddings frequently involve family or household-level invitations.

The system should support group concepts such as:

**Shah Family — 3 Adults + 2 Children**

The exact group RSVP workflow can be refined during detailed system design.

---

## 18. Digital Wedding Invitations

Digital invitations should support:

- Invitation templates
- Couple information
- Event information
- Date
- Venue
- Photos
- Personalized content
- Guest/family association
- RSVP link
- Shareable invitation URL

Guests access invitations without creating accounts.

Each personalized invitation should use a secure, unpredictable link/token.

---

## 19. RSVP & Reminders

Guests should be able to RSVP directly from their invitation.

Basic RSVP states:

- Yes / Attending
- No / Not attending
- Pending

The dashboard should show:

- Total invited
- Confirmed
- Declined
- Pending
- Event-level RSVP
- Family/group RSVP where applicable

Authorized wedding members should be able to remind guests who have not responded.

---

## 20. Email Communication

Email is a V1 communication channel.

Supported use cases:

- Wedding invitations
- RSVP reminders
- Relevant event reminders
- Important wedding/event notifications

Emails should contain a clear call-to-action and the appropriate secure invitation/wedding URL.

The communication architecture should remain extensible for future channels.

---

## 21. WhatsApp Sharing

WhatsApp sharing should be supported in V1 **without WhatsApp API integration**.

### Invitation Sharing

Flow:

**Select Guest → Generate Invitation URL → Generate Pre-filled WhatsApp Message → Open WhatsApp → User Reviews → User Presses Send**

Example:

> Hi Rahul,  
> We would love to invite you to our wedding! ❤️  
> Please find your digital invitation and event details here:  
> `<INVITATION_URL>`  
> We would be happy to have you celebrate with us!

### RSVP Reminder Sharing

The same model can be used for RSVP reminders.

Make My Marriage generates the message and URL, but the user controls the actual sending.

### Explicitly Out of Scope

- WhatsApp Business API
- WhatsApp Cloud API
- Automated WhatsApp sending
- WhatsApp delivery tracking
- WhatsApp webhooks
- WhatsApp campaign automation
- WhatsApp message-template management

---

## 22. Wedding Website

Each wedding can have its own wedding website.

Potential content:

- Couple names
- Couple photos
- Couple story
- Wedding date
- Events
- Venues
- Schedule
- RSVP
- Gallery
- Live stream
- Accommodation information where later supported
- Other selected wedding information

The website should be customizable but intentionally simple.

---

## 23. Public Website vs Personalized Invitation

These should be treated as separate but related experiences.

### Public Wedding Website

Example:

`makemymarriage.com/w/adit-priya`

Contains general wedding information.

### Personalized Invitation

Example:

`makemymarriage.com/i/<secure-token>`

Contains guest/family-specific invitation information and RSVP access.

The example URLs are illustrative only.

---

## 24. Guest Access & Secure Links

Supported link types may include:

- Invitation link
- Wedding website link
- Gallery link
- Live-stream link

Security requirements:

- Use unpredictable tokens.
- Allow authorized members to revoke links.
- Allow regeneration where appropriate.
- Allow links to be disabled.
- Configure visibility appropriately.
- Do not expose sensitive information through predictable URLs.

---

## 25. Live Streaming

The product should support remote guests through third-party live-stream providers.

Potential providers include:

- YouTube
- Vimeo
- Other suitable providers

Make My Marriage should not build custom streaming infrastructure for V1.

Live-stream configuration may contain:

- Provider
- Stream URL
- Associated event
- Start/end time
- Visibility/access settings

The guest experience may show a **Live Now** state when appropriate.

---

## 26. Photo Gallery & Memories

The gallery is a centralized space for wedding memories.

Uploads may come from:

- Bride
- Groom
- Family
- Wedding planner
- Authorized guests
- Photographer, where authorized

Suggested event/album structure:

- Engagement
- Haldi
- Mehendi
- Sangeet
- Wedding
- Reception
- Custom albums

Potential metadata:

- Event
- Album
- Uploader
- Upload date
- Visibility
- Favorite status

Guest photo contribution should be possible through an authorized gallery/upload link without requiring a guest account.

The goal is to create a shared collection of wedding memories rather than only a photographer-controlled album.

---

## 27. Wedding Timeline / Schedule

Tasks and schedules are different concepts.

The schedule is time-based, for example:

- 7:00 AM — Makeup
- 9:00 AM — Haldi
- 11:00 AM — Family photos

Schedules should be associated with events and can be made visible to members and/or guests where appropriate.

---

## 28. Notifications & Communication

Potential communication types include:

- RSVP reminders
- Event reminders
- Invitation notifications
- Schedule changes
- Venue changes
- Announcements
- Live-stream announcements

V1 priority:

1. Email
2. WhatsApp pre-filled sharing
3. In-app notifications for authenticated members where appropriate

---

## 29. Venue & Location

Each event may have:

- Venue name
- Address
- Map location
- Event association
- Directions information

Guest-facing pages should make venue information easy to understand and access.

---

## 30. QR Check-in

QR-based guest/event check-in is a future capability and is not required for the current V1 scope.

---

## 31. Accommodation

Accommodation management is a future capability.

Possible future information:

- Hotel
- Room
- Check-in/check-out
- Guest count
- Accommodation requirement
- Notes

---

## 32. Transportation

Transportation is explicitly deferred to a later stage and is not part of the current V1.

---

## 33. Documents

Future document management may support:

- Vendor contracts
- Venue agreements
- Receipts
- Invoices
- Other wedding documents

This is not a major V1 requirement.

---

## 34. Data Privacy & Security

The product handles sensitive wedding-related information, including:

- Guest contact information
- Wedding information
- Private invitations
- Photos/videos
- Vendor information
- Expenses
- Contracts, where later supported
- Live-stream access

Security requirements include:

- Wedding-level data isolation
- Role-based access control
- Secure authentication
- Secure guest tokens
- Private media access
- Revocable links
- Secure API authentication
- Prevention of cross-wedding data access
- Secure media handling
- Logging/auditing
- Data deletion
- Backups and recovery

The detailed security architecture will be defined during implementation.

---

## 35. SaaS Architecture

Conceptually:

**Make My Marriage → Wedding Workspace A / B / C**

Each wedding workspace contains isolated:

- Members
- Events
- Guests
- Vendors
- Tasks
- Expenses
- Invitations
- Website
- Gallery
- Live-stream configuration

A user may access only the wedding workspace(s) they are authorized to access. In the current product model, one user belongs to one wedding.

---

# 36. Product Release Strategy

The product should be released incrementally rather than attempting to build and launch every feature at once. Each phase should produce a coherent, testable product layer while minimizing cross-feature complexity.

## Phase 1 — Foundation

**Objective:** Establish the core application, identity, wedding workspace, and basic collaboration foundation.

### Scope

- Authentication
- Wedding creation/setup
- Couple information
- Wedding workspace initialization
- Wedding members
- Basic member invitations
- Basic authorization foundation
- Dashboard shell
- Core navigation/layout
- Initial wedding settings

### Exit Condition

A couple can create a wedding, access its workspace, invite collaborators, and reach a functional dashboard shell.

---

## Phase 2 — Planning

**Objective:** Enable the couple, family, and organizer to structure and manage the wedding itself.

### Scope

- Multiple events
- Event configuration
- Event dates/times/venues
- Event-level information
- Task planner
- Task assignment
- Task due dates
- Task status
- Basic wedding timeline/schedule

### Exit Condition

Wedding members can create events, organize wedding activities, assign tasks, and understand what needs to happen and when.

---

## Phase 3 — Guests & Invitations

**Objective:** Build the guest-facing communication and RSVP layer.

### Scope

- Central guest management
- Guest groups/families
- Event-level guest assignment
- Digital wedding invitations
- Personalized invitation links
- RSVP
- RSVP dashboard
- Email invitations
- Email RSVP reminders
- WhatsApp invitation sharing
- WhatsApp RSVP reminder sharing
- Secure guest links
- Basic guest-facing invitation experience

### WhatsApp V1 Constraint

WhatsApp functionality uses pre-filled messages and user-initiated sending. No WhatsApp API integration is required.

### Exit Condition

A wedding member can add guests, assign them to events, generate personalized invitations, send invitations through email or WhatsApp sharing, and receive RSVP responses without guests creating accounts.

---

## Phase 4 — Financials & Vendors

**Objective:** Add practical wedding spending and vendor management.

### Scope

- Manual expense tracker
- Expense categories
- Event-level expenses
- Expense summaries
- Vendor management
- My Vendors / wedding-associated vendors
- Google Places-based vendor discovery
- Vendor categories
- Vendor contact/business information
- Vendor event association
- Agreed amount
- Amount paid
- Remaining amount
- Vendor notes

### Explicit Constraints

- No payment processing
- No vendor marketplace
- No complex accounting
- Vendor payments are recorded manually

### Exit Condition

Wedding members can track spending, maintain their vendor list, discover nearby vendors/businesses, and record vendor payment status.

---

## Phase 5 — Wedding Experience

**Objective:** Turn the wedding workspace into a polished digital experience for guests.

### Scope

- Wedding website
- Public wedding information
- Couple story/photos
- Event information
- Venue/location information
- Wedding schedule
- RSVP access
- Guest-facing navigation
- Third-party live-stream integration
- YouTube/Vimeo/other suitable provider support
- Live-stream event association
- Live Now experience where applicable

### Exit Condition

A wedding can have a shareable digital wedding experience where guests can view wedding information, events, venues, schedule, RSVP, and live-stream content without creating an account.

---

## Phase 6 — Memories

**Objective:** Create the collaborative memory-sharing layer around the wedding.

### Scope

- Photo gallery
- Albums
- Event-based albums
- Guest photo uploads
- Family photo uploads
- Authorized member uploads
- Private gallery sharing
- Secure gallery/upload links
- Favorites
- Upload metadata
- QR-code-based access/sharing

### QR Code Scope

QR codes should provide a convenient entry point to the appropriate secure gallery, album, or upload experience. They should not bypass access controls.

### Exit Condition

Wedding participants can collectively build and share organized wedding memories, while guests can contribute photos through controlled links.

---

## Phase 7 — Product Readiness

**Objective:** Harden the complete product for a reliable production launch.

### Scope

#### Error Handling

- Consistent API error handling
- User-friendly error states
- Form validation
- Empty states
- Loading states
- Retry handling where appropriate
- Graceful failure for third-party services
- Secure error logging without exposing sensitive information

#### Security Review

- Authentication review
- Authorization review
- Wedding-level isolation testing
- Guest-token security review
- API security review
- Input validation
- File-upload security
- Media access controls
- Secrets/environment-variable review
- Dependency/security audit
- Privacy review
- Data deletion and access review

#### Responsive Design

- Mobile responsiveness
- Tablet support
- Desktop support
- Guest experience optimization
- Cross-browser validation
- Touch-friendly interactions

#### Performance

- Page-load optimization
- API performance
- Image optimization
- Lazy loading where appropriate
- Caching strategy
- Bundle optimization
- Database/query performance review
- Third-party API performance review

#### Testing

- Unit testing
- Integration testing
- API testing
- End-to-end testing
- Authentication/authorization testing
- Guest-flow testing
- Invitation/RSVP testing
- Email testing
- WhatsApp sharing testing
- Gallery/upload testing
- Live-stream testing
- Cross-browser testing
- Regression testing
- Production smoke testing

#### Analytics

- Product usage analytics
- Wedding creation funnel
- Member invitation/acceptance
- Event creation
- Guest creation
- Invitation generation/sending
- RSVP activity
- Website visits
- Gallery activity
- Guest photo uploads
- Error/quality metrics

Analytics should respect privacy and applicable data-protection requirements.

#### Deployment

- Production environment
- Environment configuration
- CI/CD
- Database migration process
- Asset/media deployment strategy
- Domain configuration
- HTTPS
- Email configuration
- Third-party integration configuration
- Production secrets management
- Backup strategy

#### Monitoring

- Application monitoring
- Server/infrastructure monitoring
- API monitoring
- Error tracking
- Performance monitoring
- Availability/uptime monitoring
- Third-party integration monitoring
- Alerting
- Logs
- Backup monitoring
- Incident response basics

### Exit Condition

The product is production-ready from reliability, security, performance, usability, testing, deployment, analytics, and monitoring perspectives.

---

## 37. Monetization

Make My Marriage is a SaaS product, but the exact monetization model is not finalized.

Possible future models include:

- Free tier
- Premium wedding plan
- Feature-based plans
- Trial period
- Planner/professional plans

The architecture should allow future monetization without making payment processing a dependency for the core wedding-management experience.

---

## 38. Core User Journeys

### Journey 1 — Couple Creates Wedding

**Sign Up → Create Wedding → Couple Information → Date → Location → Events → Dashboard**

### Journey 2 — Add Family Member

**Dashboard → Members → Invite → Accept → Permissions → Collaborate**

### Journey 3 — Add Vendor

**Vendors → Add → Category → Nearby Search → Google Places → Select → Wedding Details → Added**

### Journey 4 — Record Expense

**Expenses → Add → Amount / Category / Description / Date / Event → Save → Totals**

### Journey 5 — Add Guest

**Guests → Add → Guest Information → Assign Events → Create/Associate Invitation**

### Journey 6 — Send Email Invitation

**Guest List → Select Guest/Family → Generate Invitation → Secure URL → Send Email → Guest Opens → Views → RSVP**

### Journey 7 — Share Invitation Through WhatsApp

**Guest List → Select Guest/Family → Generate Invitation URL → Pre-filled WhatsApp Message → Open WhatsApp → User Reviews → User Sends**

### Journey 8 — RSVP Reminder

**Guest List → Filter Pending → Select Guest → Email or WhatsApp Sharing → Generate Reminder → Send/Open WhatsApp**

### Journey 9 — Guest RSVP

**Receive Link → Open → No Account → View Invitation → RSVP → Response Recorded**

### Journey 10 — Guest Views Wedding

**Website/Invitation → Events → Schedule → Venue → Gallery → Live Stream**

---

## 39. Success Criteria

The product should enable:

- Couples to manage most wedding-planning information in one place.
- Families to collaborate without technical expertise.
- Planners/organizers to participate in the assigned wedding workspace.
- Guests to open invitations without accounts.
- Guests to view wedding information and RSVP with minimal friction.
- Guests to access galleries and live streams through secure links.
- Wedding members to communicate through email and user-initiated WhatsApp sharing.
- The product to feel like:

> **“One place for the wedding, rather than another application the family has to learn.”**

---

## 40. Product Experience Requirements

The product should be:

- Simple
- Mobile-friendly
- Fast
- Shareable
- Collaborative
- Secure
- India-wedding-friendly
- Communication-friendly
- Easy for non-technical family members
- Frictionless for guests

---

## 41. Current V1 Scope Summary

1. Authentication
2. Wedding Setup
3. Wedding Members & Organizer Management
4. Multiple Events
5. Wedding Dashboard
6. Task Planner
7. Simple Expense Tracker
8. Vendor Management
9. Google Places-based Vendor Discovery
10. Guest Management
11. Event-Level Guests
12. Digital Wedding Invitations
13. Email Invitations
14. RSVP
15. Email RSVP Reminders
16. WhatsApp Invitation Sharing with Pre-filled Messages
17. WhatsApp RSVP Reminder Sharing with Pre-filled Messages
18. Wedding Website
19. Wedding Timeline/Schedule
20. Shared Photo Gallery
21. Guest Photo Upload
22. Third-Party Live Streaming Integration
23. Secure Guest Links
24. Basic Notifications/Communication

WhatsApp API integration is explicitly not required for V1.

---

## 42. Core Product Model

**Make My Marriage → Wedding Workspace → Members / Events / Guests / Vendors → Planning (Tasks / Expenses / Vendors / Events) + Experience (Website / Gallery / Live Stream / Invitations) → Communication (Email / WhatsApp pre-filled message + Secure URL)**

---

## 43. Current Product Decisions — Locked

- SaaS product
- India initial market
- Couples + families + planners/organizers
- One user = one wedding in the current model
- One wedding = multiple members
- Guests do not need app accounts
- Guests use secure invitation/gallery/live-stream links
- Vendor management is for wedding-associated vendors, not a marketplace
- Google Places is used for nearby vendor/business discovery
- Vendor payments are tracked, not processed
- Expense tracking is simple/manual
- Family members and organizers can record expenses
- Live streaming uses third-party providers
- Authorized members and guests can upload photos
- Email is supported for invitations/reminders
- WhatsApp uses pre-filled messages with relevant secure URLs
- WhatsApp API is not required for V1
- WhatsApp messages are user-initiated
- Transportation is deferred
- International support is deferred
- Multi-wedding planner accounts are deferred
- Payment processing is not a core feature
- Strong wedding-level data isolation and permissions are required
- Guest experience prioritizes zero-friction access
- Product development follows the seven-phase release strategy defined in Section 36

---

## 44. Out of Scope

The following are not part of the current V1:

- Vendor marketplace
- Vendor bidding
- Vendor lead marketplace
- Payment processing
- Complex accounting
- Transportation management
- International support
- Custom live-streaming infrastructure
- Multi-wedding planner accounts
- Mandatory guest accounts
- WhatsApp API integration
- Automated WhatsApp messaging
- Advanced accommodation management
- QR check-in as an event-management system
- Advanced document management

---

## 45. Future Opportunities

Potential future capabilities include:

- Transportation management
- Accommodation management
- Seating management
- QR event check-in
- Gift management
- Gift registry
- Advanced photo discovery
- AI wedding assistant
- AI-generated wedding website/invitation
- Smart task recommendations
- Advanced analytics
- Vendor marketplace
- Professional multi-wedding planner accounts
- International support
- WhatsApp Business API automation
- SMS automation
- Advanced communication campaigns
- Advanced wedding documents/contracts

---

## 46. One-Sentence Product Definition

> **Make My Marriage is an India-first SaaS platform that gives couples, families, and wedding planners one collaborative workspace to plan and manage a wedding, while giving guests a simple account-free digital experience for invitations, RSVP, wedding information, photos, live streaming, and easy email/WhatsApp access.**
