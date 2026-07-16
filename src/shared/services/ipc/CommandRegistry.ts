/**
 * IPC Command Registry - Single Source of Truth
 *
 * Centralized registry of all Tauri commands with their parameter and result types.
 * Inspired by simple-signage's CommandRegistry pattern for type-safe IPC.
 *
 * Each entry has:
 *   - `params`: Sample parameters (TypeScript uses this for type inference)
 *   - `result`: Sample return value (used for type inference)
 *
 * Usage with the typed wrapper:
 *   import { invoke } from "@shared/services/ipc";
 *   const tasks = await invoke("db_list_tasks", { accountId: null, isCompleted: false });
 *   // ^-- compile error if command name is wrong
 *   // ^-- type inferred for both params and result
 */

import type { LogEntry } from "@shared/services/logger";
import type {
  Invoice,
  InvoiceItem,
  InvoiceWithItems,
  Client,
  Item,
  Company,
  CompanySetting,
  Category,
  ErpAccount,
  JournalEntry,
  PnlResult,
  Wallet,
} from "@shared/services/db/schema";

// Type for empty parameters to avoid ESLint "empty object" errors
type EmptyParams = Record<string, never>;

// ── Subsystem lifecycle types ──────────────────────────────────────
export interface SubsystemStatusResponse {
  name: string;
  class: "always_on" | "lazy" | "on_demand";
  status: "inactive" | "dormant" | "starting" | "active" | "shutting_down" | "failed";
  reason: string;
  uptime_secs?: number;
  error?: string;
  feature_flag?: string;
}

// ============================================================================
// LOGGING COMMANDS
// ============================================================================

export const TauriCommands = {
  // ── Logging (in-memory ring buffer) ──────────────────────────────────
  get_logs: { params: { limit: 100 as number }, result: [] as LogEntry[] },
  clear_logs: { params: {} as EmptyParams, result: undefined as void },
  log_event: {
    params: {
      level: 'info' as 'debug' | 'info' | 'warning' | 'error' | 'critical',
      message: '' as string,
      category: undefined as string | undefined,
      data: undefined as unknown,
    },
    result: undefined as void,
  },
  log_error_command: {
    params: {
      error: '' as string,
      stack: undefined as string | undefined,
      component: undefined as string | undefined,
      timestamp: undefined as string | undefined,
    },
    result: undefined as void,
  },

  // ── App lifecycle ─────────────────────────────────────────────────────
  reset_app: { params: {} as EmptyParams, result: undefined as void },
  open_devtools: { params: {} as EmptyParams, result: undefined as void },
  check_for_update_now: { params: {} as EmptyParams, result: null as unknown },
  get_app_version: { params: {} as EmptyParams, result: '' as string },
  get_rollback_version: { params: {} as EmptyParams, result: null as string | null },
  needs_rollback: { params: {} as EmptyParams, result: false as boolean },
  mark_successful_launch: { params: {} as EmptyParams, result: undefined as void },
  verify_update_checksum: {
    params: { expectedSha256: '' as string, filePath: '' as string },
    result: false as boolean,
  },

  // ── Database: Tasks ───────────────────────────────────────────────────
  db_list_tasks: {
    params: { companyId: null as string | null, isCompleted: null as boolean | null },
    result: [] as unknown[],
  },
  db_list_task_tags: { params: {} as EmptyParams, result: [] as unknown[] },
  db_get_task: { params: { id: '' as string }, result: null as unknown },
  db_get_task_by_id: { params: { id: '' as string }, result: null as unknown },
  db_create_task: {
    params: { request: {} as Record<string, unknown> },
    result: null as unknown,
  },
  db_update_task: {
    params: { id: '' as string, request: {} as Record<string, unknown> },
    result: undefined as void,
  },
  db_delete_task: { params: { id: '' as string }, result: undefined as void },
  db_complete_task: { params: { id: '' as string }, result: undefined as void },
  db_uncomplete_task: { params: { id: '' as string }, result: undefined as void },
  db_reorder_tasks: {
    params: { taskIds: [] as string[] },
    result: undefined as void,
  },
  db_get_incomplete_task_count: {
    params: { companyId: undefined as string | undefined },
    result: 0 as number,
  },
  db_get_tasks_for_contact: {
    params: { contactId: '' as string, includeCompleted: false as boolean },
    result: [] as unknown[],
  },
  db_get_tasks_due_for_reminder: {
    params: {} as EmptyParams,
    result: [] as unknown[],
  },
  db_get_tasks_with_workflow: { params: {} as EmptyParams, result: [] as unknown[] },
  db_get_task_tags: { params: {} as EmptyParams, result: [] as unknown[] },
  db_upsert_task_tag: {
    params: { tag: '' as string, companyId: null as string | null, color: null as string | null },
    result: undefined as void,
  },
  db_delete_task_tag: { params: { tag: '' as string, companyId: null as string | null }, result: undefined as void },
  db_get_task_tag_by_tag: { params: { tag: '' as string }, result: null as unknown },
  db_get_tasks_for_account: {
    params: {
      companyId: null as string | null,
      includeCompleted: false as boolean,
    },
    result: [] as unknown[],
  },
  db_get_tasks_with_contacts: {
    params: {
      companyId: null as string | null,
      includeCompleted: false as boolean,
    },
    result: [] as unknown[],
  },
  db_get_tasks_with_contacts_paginated: {
    params: {
      companyId: null as string | null,
      includeCompleted: false as boolean,
      limit: 0 as number,
      offset: 0 as number,
    },
    result: [] as unknown[],
  },
  db_filter_tasks: {
    params: {
      companyId: null as string | null,
      includeCompleted: false as boolean,
      priority: null as string | null,
      dateFilter: null as string | null,
      search: null as string | null,
      sortField: 'sort_order' as string,
      sortDirection: 'asc' as string,
      limit: 0 as number,
      offset: 0 as number,
    },
    result: [] as unknown[],
  },
  db_get_tasks_for_thread: {
    params: { companyId: '' as string, threadId: '' as string },
    result: [] as unknown[],
  },
  db_get_subtasks: {
    params: { parentId: '' as string },
    result: [] as unknown[],
  },
  db_tasks_count_by_contact: { params: {} as EmptyParams, result: [] as unknown[] },
  db_dashboard_tasks_due_today: { params: {} as EmptyParams, result: 0 as number },
  db_dashboard_tasks_incomplete: { params: {} as EmptyParams, result: 0 as number },
  db_dashboard_tasks_overdue: { params: {} as EmptyParams, result: 0 as number },

  // ── Database: Deals / Pipelines ───────────────────────────────
  db_create_deal: {
    params: {
      companyId: '' as string,
      contactId: null as string | null,
      pipelineId: '' as string,
      stageId: '' as string,
      title: '' as string,
      amountMinor: 0 as number,
      currency: null as string | null,
      expectedCloseAt: null as number | null,
      notes: null as string | null,
    },
    result: null as unknown,
  },
  db_update_deal: {
    params: {
      companyId: '' as string,
      id: '' as string,
      fields: {} as Record<string, unknown>,
    },
    result: null as unknown,
  },
  db_delete_deal: { params: { id: '' as string }, result: undefined as void },
  db_get_deal: { params: { id: '' as string }, result: null as unknown },
  db_list_deals: {
    params: {
      companyId: '' as string,
      pipelineId: null as string | null,
      stageId: null as string | null,
      status: null as string | null,
    },
    result: [] as unknown[],
  },
  db_move_deal_stage: {
    params: { id: '' as string, stageId: '' as string },
    result: null as unknown,
  },
  db_create_pipeline: {
    params: {
      companyId: '' as string,
      name: '' as string,
      isDefault: false as boolean,
    },
    result: null as unknown,
  },
  db_list_pipelines: { params: { companyId: '' as string }, result: [] as unknown[] },
  db_create_deal_stage: {
    params: {
      pipelineId: '' as string,
      name: '' as string,
      position: 0 as number,
      probability: 0 as number,
      color: null as string | null,
    },
    result: null as unknown,
  },
  db_list_deal_stages: { params: { pipelineId: '' as string }, result: [] as unknown[] },
  db_get_deal_stage: { params: { stageId: '' as string }, result: null as unknown },
  db_ensure_default_pipeline: {
    params: { companyId: '' as string },
    result: null as unknown,
  },
  db_recompute_scores: {
    params: { companyId: '' as string },
    result: 0 as number,
  },

  // ── Subsystem lifecycle ───────────────────────────────────────
  get_subsystem_status: {
    params: {} as EmptyParams,
    result: [] as SubsystemStatusResponse[],
  },
  db_health_stats: {
    params: {} as EmptyParams,
    result: {} as Record<string, unknown>,
  },
  db_sync_status: {
    params: {} as EmptyParams,
    result: [] as unknown[],
  },
  db_bootstrap_state: {
    params: {} as EmptyParams,
    result: {} as Record<string, unknown>,
  },
  db_status_snapshot: {
    params: {} as EmptyParams,
    result: {} as Record<string, unknown>,
  },
  db_set_offline_available: {
    params: {
      id: '' as string,
      accountId: '' as string,
      folderId: undefined as string | undefined,
      contactId: undefined as string | undefined,
      reason: '' as string,
      enabled: true as boolean,
    },
    result: undefined as void,
  },
  db_remove_offline_available: {
    params: { id: '' as string },
    result: undefined as void,
  },
  db_list_offline_available: {
    params: { accountId: undefined as string | undefined },
    result: [] as unknown[],
  },
  db_filter_contacts: {
    params: {
      tagId: null as string | null,
      groupId: null as string | null,
      segmentId: null as string | null,
      limit: 200 as number,
      offset: 0 as number,
    },
    result: [] as unknown[],
  },
  db_restart_subsystem: {
    params: { name: '' as string },
    result: {} as SubsystemStatusResponse,
  },
  complete_onboarding: {
    params: {} as EmptyParams,
    result: undefined as void,
  },
  get_tool_state: {
    params: {} as EmptyParams,
    result: [] as [string, boolean][],
  },
  apply_tool_state: {
    params: { updates: [] as [string, boolean][] },
    result: undefined as void,
  },

  // ── Invoicing: invoices ───────────────────────────────────────────
  db_list_invoices: {
    params: { companyId: '' as string, typeFilter: null as string | null, statusFilter: null as string | null },
    result: [] as Invoice[],
  },
  db_get_invoice: { params: { id: '' as string }, result: {} as Invoice },
  db_get_invoice_with_items: { params: { invoiceId: '' as string }, result: {} as InvoiceWithItems },
  db_create_invoice: {
    params: {
      companyId: '' as string,
      clientId: '' as string,
      documentType: '' as string,
      invoiceNumber: '' as string,
      issueDate: 0 as number,
      dueDate: null as number | null,
      currency: '' as string,
      notes: null as string | null,
      itemsReq: [] as Array<{
        description: string;
        qty: number;
        unit?: string | null;
        unitPrice: number;
        taxRate: number;
        sortOrder: number;
      }>,
    },
    result: {} as Invoice,
  },
  db_update_invoice: {
    params: {
      id: '' as string,
      status: null as string | null,
      notes: null as string | null,
      date: null as number | null,
      dueDate: null as number | null,
      currency: null as string | null,
      clientId: null as string | null,
      items: null as Array<{
        description: string;
        qty: number;
        unit?: string | null;
        unitPrice: number;
        taxRate: number;
        sortOrder: number;
      }> | null,
    },
    result: {} as Invoice,
  },
  db_delete_invoice: { params: { id: '' as string }, result: undefined as void },
  db_add_invoice_item: {
    params: {
      invoiceId: '' as string,
      description: '' as string,
      qty: 0 as number,
      unit: null as string | null,
      unitPrice: 0 as number,
      taxRate: 0 as number,
      sortOrder: 0 as number,
    },
    result: {} as InvoiceItem,
  },
  db_remove_invoice_item: { params: { itemId: '' as string }, result: undefined as void },
  db_update_invoice_status: { params: { id: '' as string, status: '' as string }, result: undefined as void },
  db_calculate_invoice: { params: { invoiceId: '' as string }, result: {} as Invoice },

  // ── Invoicing: clients ─────────────────────────────────────────────
  db_list_clients: { params: { companyId: '' as string, role: null as string | null }, result: [] as Client[] },
  db_get_client: { params: { id: '' as string }, result: {} as Client },
  db_create_client: {
    params: {
      companyId: '' as string,
      name: '' as string,
      email: null as string | null,
      phone: null as string | null,
      address: null as string | null,
      city: null as string | null,
      country: null as string | null,
      taxId: null as string | null,
      role: null as string | null,
      creditLimit: null as number | null,
      paymentTerms: null as number | null,
      notes: null as string | null,
    },
    result: {} as Client,
  },
  db_update_client: {
    params: {
      id: '' as string,
      name: null as string | null,
      email: null as string | null,
      phone: null as string | null,
      address: null as string | null,
      city: null as string | null,
      country: null as string | null,
      taxId: null as string | null,
      role: null as string | null,
      creditLimit: null as number | null,
      paymentTerms: null as number | null,
      notes: null as string | null,
    },
    result: {} as Client,
  },
  db_delete_client: { params: { id: '' as string, hard: null as boolean | null }, result: undefined as void },

  // ── Invoicing: company settings ───────────────────────────────────
  db_get_company_settings: { params: { companyId: '' as string }, result: null as CompanySetting | null },
  db_upsert_company_settings: {
    params: {
      companyId: '' as string,
      defaultCurrency: null as string | null,
      defaultTaxRate: null as number | null,
      invoicePrefix: null as string | null,
      invoiceSuffix: null as string | null,
      quotePrefix: null as string | null,
      defaultTemplateId: null as string | null,
      logoUrl: null as string | null,
      signatureText: null as string | null,
      bankDetails: null as string | null,
      termsDefault: null as string | null,
      themeColor: null as string | null,
      unitsEnabled: null as string | null,
      taxPosition: null as string | null,
      decimalPlaces: null as number | null,
    },
    result: {} as CompanySetting,
  },
  db_delete_company_settings: { params: { companyId: '' as string }, result: undefined as void },

  // ── Invoicing: categories ─────────────────────────────────────────
  db_list_categories: { params: { companyId: '' as string }, result: [] as Category[] },
  db_get_category: { params: { id: '' as string }, result: {} as Category },
  db_create_category: { params: { name: '' as string, companyId: '' as string }, result: {} as Category },
  db_update_category: { params: { id: '' as string, name: '' as string }, result: {} as Category },
  db_delete_category: { params: { id: '' as string }, result: undefined as void },

  // ── Invoicing: catalog items ──────────────────────────────────────
  db_list_items: { params: { companyId: '' as string }, result: [] as Item[] },
  db_get_item: { params: { id: '' as string }, result: {} as Item },
  db_create_item: {
    params: {
      name: '' as string,
      description: null as string | null,
      itemType: '' as string,
      sku: null as string | null,
      unit: '' as string,
      buyPrice: 0 as number,
      sellPrice: 0 as number,
      stockQty: 0 as number,
      stockAlert: 0 as number,
      taxRate: 0 as number,
      barcode: null as string | null,
      imageUrl: null as string | null,
      companyId: '' as string,
    },
    result: {} as Item,
  },
  db_update_item: {
    params: {
      id: '' as string,
      name: null as string | null,
      description: null as string | null,
      itemType: null as string | null,
      sku: null as string | null,
      unit: null as string | null,
      buyPrice: null as number | null,
      sellPrice: null as number | null,
      stockQty: null as number | null,
      stockAlert: null as number | null,
      taxRate: null as number | null,
      barcode: null as string | null,
      imageUrl: null as string | null,
      active: null as number | null,
    },
    result: {} as Item,
  },
  db_delete_item: { params: { id: '' as string }, result: undefined as void },
  db_list_low_stock: { params: { companyId: '' as string }, result: [] as Item[] },

  // ── Invoicing: company ────────────────────────────────────────────
  db_get_company: { params: { companyId: '' as string }, result: {} as Company },
  db_update_company: {
    params: {
      companyId: '' as string,
      name: null as string | null,
      legalName: null as string | null,
      email: null as string | null,
      phone: null as string | null,
      addressLine1: null as string | null,
      addressLine2: null as string | null,
      city: null as string | null,
      state: null as string | null,
      postalCode: null as string | null,
      country: null as string | null,
      website: null as string | null,
      industry: null as string | null,
      timezone: null as string | null,
      logoUrl: null as string | null,
      ice: null as string | null,
      taxId: null as string | null,
      rc: null as string | null,
      cnss: null as string | null,
    },
    result: {} as Company,
  },
  db_list_companies: { params: {} as EmptyParams, result: [] as Company[] },
  db_create_company: {
    params: {
      name: '' as string,
      legalName: null as string | null,
      email: null as string | null,
      phone: null as string | null,
      addressLine1: null as string | null,
      addressLine2: null as string | null,
      city: null as string | null,
      state: null as string | null,
      postalCode: null as string | null,
      country: null as string | null,
      website: null as string | null,
      industry: null as string | null,
      timezone: null as string | null,
      logoUrl: null as string | null,
      ice: null as string | null,
      taxId: null as string | null,
      rc: null as string | null,
      cnss: null as string | null,
    },
    result: {} as Company,
  },

  // ── Invoicing: documents & delivery ───────────────────────────────
  db_generate_invoice_documents: { params: { invoiceId: '' as string }, result: ['', ''] as [string, string] },
  db_send_invoice: { params: { invoiceId: '' as string, to: null as string | null }, result: '' as string },

  // ── ERP: accounting (double-entry ledger) ─────────────────────────
  db_ensure_chart_of_accounts: { params: { companyId: '' as string }, result: undefined as void },
  db_list_chart_of_accounts: { params: { companyId: '' as string }, result: [] as ErpAccount[] },
  db_list_journal_entries: { params: { companyId: '' as string }, result: [] as JournalEntry[] },
  db_post_invoice_journal: { params: { invoiceId: '' as string }, result: undefined as void },
  db_get_profit_and_loss: { params: { companyId: '' as string }, result: {} as PnlResult },

  // ── ERP: wallet (company cash hub) ────────────────────────────────
  db_ensure_wallet: { params: { companyId: '' as string }, result: {} as Wallet },
  db_get_wallet: { params: { companyId: '' as string }, result: {} as Wallet },
  db_credit_wallet: {
    params: { companyId: '' as string, amount: 0 as number, reference: null as string | null, description: null as string | null },
    result: {} as Wallet,
  },
  db_debit_wallet: {
    params: { companyId: '' as string, amount: 0 as number, reference: null as string | null, description: null as string | null },
    result: {} as Wallet,
  },
} as const;

// ============================================================================
// TYPE HELPERS
// ============================================================================

export type CommandName = keyof typeof TauriCommands;

export type CommandParams<T extends CommandName> = T extends CommandName
  ? (typeof TauriCommands)[T] extends { params: infer P }
    ? P
    : never
  : never;

export type CommandResult<T extends CommandName> = T extends CommandName
  ? (typeof TauriCommands)[T] extends { result: infer R }
    ? R
    : never
  : never;
