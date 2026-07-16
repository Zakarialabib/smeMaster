import type { Client } from '@shared/services/db/schema';
import {
  listClients,
  createClient,
  updateClient,
  deleteClient,
} from '@shared/services/db/invoke/invoicing';

export interface UnifiedClient extends Client {
  [key: string]: unknown;
  source?: 'invoicing-client';
}

export async function listInvoicingClients(companyId: string): Promise<Client[]> {
  const clients = await listClients(companyId);
  return clients.map((c) => (({ ...c } as Client)));
}

export async function createBillingContact(data: Parameters<typeof createClient>[0]): Promise<Client> {
  return createClient(data);
}

export async function updateBillingContact(id: string, fields: Record<string, unknown>): Promise<void> {
  await updateClient(id, fields);
}

export async function deleteBillingContact(id: string): Promise<void> {
  await deleteClient(id);
}
