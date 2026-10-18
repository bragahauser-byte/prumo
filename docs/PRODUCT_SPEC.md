# Product Specification

## Goals

- Give users a period-based view of commitments.
- Separate planned, paid, and pending expenses.
- Support individual expenses and bounded recurring schedules.
- Offer deterministic insights based on recorded data only.
- Keep the product responsive, accessible, and honest about incomplete records.

## Core flows

1. Create an account, verify email when enabled, and access protected financial routes.
2. Create, search, filter, edit, pay, and delete expenses.
3. Create weekly/monthly/yearly rules and generate unique occurrences for a 90-day window.
4. Review monthly totals, due dates, category totals, and explainable insights.
5. Optionally save user-reported income and bank balance independently.

## Constraints and non-goals

- No real bank integration or fabricated data.
- No AI-based financial advice, investment, credit, or loan recommendations.
- Estimates use only saved records and user-reported figures; they are not confirmed account balances.
- Custom categories, notifications, dark theme, account deletion, and full browser E2E coverage remain out of scope until implemented and tested.
- Supabase project credentials, migrations, Auth email settings, and Vercel account access are required before production use.
