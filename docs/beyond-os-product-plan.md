# Beyond OS Product Plan

## Objective

Beyond OS is the operating platform for Bangju Group. The first implementation must organize master data before adding automation:

- Company
- Building
- Floor
- Room
- Site
- Brand
- Employee
- Customer / member / tenant
- Project
- Document
- Operating metric

The core rule is that every worklog, contract, drawing, photo, revenue record, facility issue, and AI recommendation must connect back to a site and, when possible, a room.

## Benchmark Notes

### Microsoft Dynamics 365

Dynamics 365 separates CRM, ERP, finance, supply chain, field service, project operations, HR, and Business Central into connected business applications. It also positions the product around AI agents and Copilot-based workflow assistance.

Design implication for Beyond OS: keep modules separate, but share master data and user permissions.

Source: https://www.microsoft.com/en-us/dynamics-365

### Procore

Procore is a construction platform that connects people, processes, resources, project lifecycle data, analytics, AI insights, and external integrations. Its construction-specific model is relevant for BJ Construction and site-level quality/safety/document control.

Design implication for Beyond OS: construction modules need project, document, photo, quality, safety, cost, and field collaboration data under one project/site model.

Source: https://www.procore.com/platform

### Odoo

Odoo is a modular ERP approach covering CRM, accounting, POS, inventory, HR, marketing, project, documents, and more.

Design implication for Beyond OS: build modules as composable apps, but avoid letting each module invent its own customer, employee, site, or financial master data.

Source: https://www.odoo.com/

### Yardi

Yardi is a real-estate-focused property, asset, and investment management platform category.

Design implication for Beyond OS: room occupancy, leases, tenant/company records, renewals, rent, facility issues, and financial metrics must be native first-class objects.

Source: https://www.yardi.com/

## Phase 1 Scope

1. Beyond OS dashboard
2. Responsive desktop/tablet/mobile shell
3. Bangju master data seed
4. Existing personal worklog module preserved
5. Site operation score prototype
6. AI coaching placeholder based on worklog and operating risks
7. Supabase master schema draft

## Phase 2 Scope

1. Persist master data to Supabase
2. Add permission scopes: self, same site, selected site, selected employee, executive
3. Add site-level operating metrics
4. Add document/photo upload by site and room
5. Add construction site module
6. Add CRM module for members, tenants, vendors, and contracts

## Phase 3 Scope

1. AI daily CEO report
2. AI staff coaching
3. Facility predictive maintenance
4. Revenue and cash-flow analysis
5. Marketing activity gap detection
6. External integrations: accounting, POS, bank, access control, approval
