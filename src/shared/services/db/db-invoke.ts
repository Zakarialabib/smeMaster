// Re-exports the per-domain DB invoke wrappers so existing importers of
// '@shared/services/db/db-invoke' keep working unchanged.
export * from './invoke/core';
export * from './invoke/mail';
export * from './invoke/crm';
export * from './invoke/comms';
export * from './invoke/campaigns';
export * from './invoke/calendar';
export * from './invoke/tasks';
export * from './invoke/workflows';
export * from './invoke/deliverability';
export * from './invoke/security';
export * from './invoke/ai';
export * from './invoke/compliance';
export * from './invoke/vault';
export * from './invoke/rag';
export * from './invoke/invoicing';
