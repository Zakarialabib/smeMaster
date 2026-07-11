export const FIXTURE_TEMPLATES = {
  simple: {
    subject: 'Hello {{first_name}}',
    body_html: '<p>Hi {{first_name}},</p><p>Thanks for your interest in {{company}}.</p>',
  },
  withConditional: {
    subject: 'Update',
    body_html: '{{#if company}}<p>Hello {{company}}</p>{{else}}<p>Hello there</p>{{/if}}',
    conditional_blocks_json: '{}',
  },
  campaignStyle: {
    subject: '{{random_greeting}} {{first_name}}',
    body_html: '<p>{{random_greeting}} {{first_name}},</p><p>Welcome to {{company}}!</p>',
  },
  voiceMode: {
    subject: 'Hello {{first_name}}',
    body_html: '<p>Hi {{first_name}},</p><p>Check out our CTA: <a href="https://example.com">Click here</a></p><p>Thanks!</p>',
  },
};
