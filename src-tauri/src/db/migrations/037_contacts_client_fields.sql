-- 037: Client/invoicing projection columns on the unified contacts table.
--
-- `db/tables/invoicing/clients.rs` stores clients as contacts and its
-- INSERT/UPDATE/SELECT projection (struct `Client`) requires phone, address,
-- city, country, tax_id, credit_limit and payment_terms. None of these were
-- created by 003_contacts.sql or 027_contacts_fix.sql, so every
-- db_create_client call failed with "table contacts has no column named phone".

ALTER TABLE contacts ADD COLUMN phone TEXT;
ALTER TABLE contacts ADD COLUMN address TEXT;
ALTER TABLE contacts ADD COLUMN city TEXT;
ALTER TABLE contacts ADD COLUMN country TEXT;
ALTER TABLE contacts ADD COLUMN tax_id TEXT;
ALTER TABLE contacts ADD COLUMN credit_limit INTEGER;
ALTER TABLE contacts ADD COLUMN payment_terms INTEGER;
