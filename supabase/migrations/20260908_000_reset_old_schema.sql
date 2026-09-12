-- Migration: 000_reset_old_schema
-- Description: Drop ALL objects — both old single-restaurant schema and any
--              partially-created new multi-tenant tables.
--              Safe to run on a fresh/empty database or after a partial migration.

-- ─── RPC Functions ────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.create_pos_order         CASCADE;
DROP FUNCTION IF EXISTS public.create_pos_order_v2      CASCADE;
DROP FUNCTION IF EXISTS public.get_auth_role             CASCADE;
DROP FUNCTION IF EXISTS public.allocate_invoice_number   CASCADE;
DROP FUNCTION IF EXISTS public.is_super_admin            CASCADE;
DROP FUNCTION IF EXISTS public.my_restaurant_ids         CASCADE;
DROP FUNCTION IF EXISTS public.my_branch_ids             CASCADE;
DROP FUNCTION IF EXISTS public.can_access_branch         CASCADE;
DROP FUNCTION IF EXISTS public.can_access_restaurant     CASCADE;
DROP FUNCTION IF EXISTS public.has_permission            CASCADE;
DROP FUNCTION IF EXISTS public.create_default_roles      CASCADE;
DROP FUNCTION IF EXISTS public.create_restaurant_with_admin CASCADE;
DROP FUNCTION IF EXISTS public.setup_branch_user         CASCADE;
DROP FUNCTION IF EXISTS public.next_order_no             CASCADE;
DROP FUNCTION IF EXISTS public.confirm_stock_count       CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user           CASCADE;

-- ─── Triggers ─────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- ─── Tables (leaf → root order to satisfy FK constraints) ─────────────────────

-- Printing
DROP TABLE IF EXISTS public.print_jobs     CASCADE;
DROP TABLE IF EXISTS public.printers       CASCADE;

-- QR Ordering
DROP TABLE IF EXISTS public.customer_sessions CASCADE;
DROP TABLE IF EXISTS public.qr_codes          CASCADE;

-- Payments & Orders
DROP TABLE IF EXISTS public.payments          CASCADE;
DROP TABLE IF EXISTS public.order_items       CASCADE;
DROP TABLE IF EXISTS public.orders            CASCADE;
DROP TABLE IF EXISTS public.branch_order_sequences CASCADE;

-- Inventory
DROP TABLE IF EXISTS public.stock_count_items  CASCADE;
DROP TABLE IF EXISTS public.stock_counts       CASCADE;
DROP TABLE IF EXISTS public.inventory_transactions CASCADE;
DROP TABLE IF EXISTS public.inventory_items    CASCADE;

-- Recipes
DROP TABLE IF EXISTS public.recipe_items  CASCADE;
DROP TABLE IF EXISTS public.recipes       CASCADE;

-- Menu
DROP TABLE IF EXISTS public.branch_menu_items CASCADE;
DROP TABLE IF EXISTS public.menu_items        CASCADE;
DROP TABLE IF EXISTS public.menu_categories   CASCADE;

-- Roles & Permissions
DROP TABLE IF EXISTS public.role_permissions  CASCADE;
DROP TABLE IF EXISTS public.roles             CASCADE;
DROP TABLE IF EXISTS public.permissions       CASCADE;

-- Membership
DROP TABLE IF EXISTS public.branch_members      CASCADE;
DROP TABLE IF EXISTS public.restaurant_members  CASCADE;
DROP TABLE IF EXISTS public.platform_members    CASCADE;

-- Core
DROP TABLE IF EXISTS public.profiles   CASCADE;
DROP TABLE IF EXISTS public.branches   CASCADE;
DROP TABLE IF EXISTS public.restaurants CASCADE;

-- Old tables
DROP TABLE IF EXISTS public.settings   CASCADE;

-- ─── Sequences ────────────────────────────────────────────────────────────────
DROP SEQUENCE IF EXISTS public.order_no_seq CASCADE;

-- ─── Views ────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.inventory_current_stock CASCADE;

-- ─── ENUMs ────────────────────────────────────────────────────────────────────
DROP TYPE IF EXISTS public.user_role            CASCADE;
DROP TYPE IF EXISTS public.order_status         CASCADE;
DROP TYPE IF EXISTS public.payment_mode         CASCADE;
DROP TYPE IF EXISTS public.fulfillment_status   CASCADE;
DROP TYPE IF EXISTS public.inventory_tx_type    CASCADE;
DROP TYPE IF EXISTS public.stock_count_status   CASCADE;
DROP TYPE IF EXISTS public.printer_type         CASCADE;
DROP TYPE IF EXISTS public.print_job_status     CASCADE;
DROP TYPE IF EXISTS public.order_source         CASCADE;
