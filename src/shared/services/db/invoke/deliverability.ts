import { invokeCommand } from './command';

import type { DeliverabilityConfig, DeliverabilityEvent, NewsletterBundle } from '../schema';

export async function listDeliverabilityConfigs(
  accountId: string,
): Promise<DeliverabilityConfig[]> {
  return invokeCommand<DeliverabilityConfig[]>('db_list_deliverability_configs', {
    accountId,
  });
}

export async function listDeliverabilityEvents(
  accountId: string,
  eventType?: string | null,
): Promise<DeliverabilityEvent[]> {
  return invokeCommand<DeliverabilityEvent[]>('db_list_deliverability_events', {
    accountId,
    eventType: eventType ?? null,
  });
}

export async function listNewsletterBundles(accountId: string): Promise<NewsletterBundle[]> {
  return invokeCommand<NewsletterBundle[]>('db_list_newsletter_bundles', {
    accountId,
  });
}
