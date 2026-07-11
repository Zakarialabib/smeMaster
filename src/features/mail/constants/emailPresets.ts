export interface EmailPreset {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
  category: 'follow_up' | 'customer_success' | 'sales' | 'internal' | 'personal';
}

export const emailPresets: EmailPreset[] = [
  {
    id: 'preset-followup',
    name: 'Follow-Up',
    subject: 'Checking in',
    bodyHtml: '<p>Hi {{first_name}},</p><p>I wanted to follow up on our previous conversation. Have you had a chance to think about it?</p><p>Best regards,<br>{{my_name}}</p>',
    category: 'follow_up',
  },
  {
    id: 'preset-gentle-nudge',
    name: 'Gentle Nudge',
    subject: 'Quick thought',
    bodyHtml: '<p>Hi {{first_name}},</p><p>I know you are busy, so I will keep this brief. I just wanted to circle back on the item we discussed last week. No rush, but I would love to hear your thoughts when you get a moment.</p><p>Best regards,<br>{{my_name}}</p>',
    category: 'follow_up',
  },
  {
    id: 'preset-second-followup',
    name: 'Second Follow-Up',
    subject: 'Following up again',
    bodyHtml: '<p>Hi {{first_name}},</p><p>I am reaching out one more time to see if you had any questions about {{subject}}. I would be happy to hop on a quick call to walk through anything that might be unclear.</p><p>Looking forward to hearing back,<br>{{my_name}}</p>',
    category: 'follow_up',
  },
  {
    id: 'preset-final-notice',
    name: 'Final Notice',
    subject: 'Final notice: {{subject}}',
    bodyHtml: '<p>Hi {{first_name}},</p><p>This is a final reminder regarding {{subject}}. If I do not hear back by the end of this week, I will assume the timing is not right and close this out for now.</p><p>Please let me know if you would like to discuss further.</p><p>Best regards,<br>{{my_name}}</p>',
    category: 'follow_up',
  },
  {
    id: 'preset-post-meeting',
    name: 'Post-Meeting Summary',
    subject: 'Great meeting today',
    bodyHtml: '<p>Hi {{first_name}},</p><p>Thank you for your time today. I really enjoyed our conversation about {{subject}}.</p><p>Here is a quick summary of what we discussed and the next steps:<br>- Key topic: {{subject}}<br>- Action items: Shared on both sides<br>- Next meeting: To be scheduled</p><p>I will send over a calendar invite for our follow-up shortly.</p><p>Best regards,<br>{{my_name}}</p>',
    category: 'follow_up',
  },
  {
    id: 'preset-thankyou',
    name: 'Thank You',
    subject: 'Thank you',
    bodyHtml: '<p>Hi {{first_name}},</p><p>Thank you so much for your time. I really appreciate it.</p><p>Best regards,<br>{{my_name}}</p>',
    category: 'customer_success',
  },
  {
    id: 'preset-welcome-onboard',
    name: 'Welcome Onboard',
    subject: 'Welcome to {{company}}!',
    bodyHtml: '<p>Hi {{first_name}},</p><p>Welcome to {{company}}! We are thrilled to have you with us.</p><p>To help you get started, here are a few resources:<br>- Your account is ready<br>- A getting-started guide is attached<br>- Your onboarding contact is available for any questions</p><p>Please do not hesitate to reach out if you need anything.</p><p>Warm regards,<br>{{my_name}}</p>',
    category: 'customer_success',
  },
  {
    id: 'preset-checkin-30d',
    name: '30-Day Check-In',
    subject: 'How is everything going?',
    bodyHtml: '<p>Hi {{first_name}},</p><p>It has been about a month since you started with {{company}}, and I wanted to check in. How is everything going on your end?</p><p>If there are any questions or concerns, I would love to address them. Your success is our top priority.</p><p>Best regards,<br>{{my_name}}</p>',
    category: 'customer_success',
  },
  {
    id: 'preset-renewal-reminder',
    name: 'Renewal Reminder',
    subject: 'Your {{company}} plan is up for renewal',
    bodyHtml: '<p>Hi {{first_name}},</p><p>We wanted to let you know that your {{company}} plan is coming up for renewal soon. We have loved having you as a customer and would like to ensure a smooth renewal process.</p><p>Please take a moment to review your current plan, and let us know if you would like to discuss any adjustments or upgrades.</p><p>Best regards,<br>{{my_name}}</p>',
    category: 'customer_success',
  },
  {
    id: 'preset-satisfaction-survey',
    name: 'Satisfaction Survey',
    subject: 'How are we doing?',
    bodyHtml: '<p>Hi {{first_name}},</p><p>We value your feedback. Could you take two minutes to fill out a quick survey about your experience with {{company}}?</p><p>Your responses will help us improve and serve you better.</p><p>Thank you in advance,<br>{{my_name}}</p>',
    category: 'customer_success',
  },
  {
    id: 'preset-churn-prevention',
    name: 'Churn Prevention',
    subject: 'We want to keep you',
    bodyHtml: '<p>Hi {{first_name}},</p><p>We noticed you have not been as active on {{company}} recently, and we wanted to check in. Is there anything we can do to improve your experience?</p><p>We would love the opportunity to address any concerns and ensure you are getting the most value out of your plan.</p><p>Best regards,<br>{{my_name}}</p>',
    category: 'customer_success',
  },
  {
    id: 'preset-intro',
    name: 'Introduction',
    subject: 'Introduction',
    bodyHtml: '<p>Hi {{first_name}},</p><p>I am reaching out to introduce myself. I work at {{company}} and would love to connect.</p><p>Best regards,<br>{{my_name}}</p>',
    category: 'sales',
  },
  {
    id: 'preset-proposal',
    name: 'Proposal',
    subject: 'Proposal: {{subject}}',
    bodyHtml: '<p>Hi {{first_name}},</p><p>Following up on our discussion, I would like to share a proposal for {{subject}}.</p><p>Best regards,<br>{{my_name}}</p>',
    category: 'sales',
  },
  {
    id: 'preset-cold-outreach',
    name: 'Cold Outreach',
    subject: 'Idea for {{company}}',
    bodyHtml: '<p>Hi {{first_name}},</p><p>I have been following {{company}} for a while and am impressed by what you are building. I believe we could help take things to the next level.</p><p>Would you be open to a brief 15-minute call next week to explore a potential partnership?</p><p>Best regards,<br>{{my_name}}</p>',
    category: 'sales',
  },
  {
    id: 'preset-warm-intro',
    name: 'Warm Introduction',
    subject: 'Introduced by {{referral_name}}',
    bodyHtml: '<p>Hi {{first_name}},</p><p>{{referral_name}} suggested I reach out to you. They thought we might have some interesting synergies between {{company}} and your work.</p><p>I would love to find a time to chat and learn more about what you are working on.</p><p>Best regards,<br>{{my_name}}</p>',
    category: 'sales',
  },
  {
    id: 'preset-demo-request',
    name: 'Demo Request',
    subject: 'Can I show you something?',
    bodyHtml: '<p>Hi {{first_name}},</p><p>I would love to give you a quick demo of what we have been building at {{company}}. It only takes 15 minutes, and I think you will find it valuable.</p><p>Are you available this Thursday or Friday for a quick walkthrough?</p><p>Best regards,<br>{{my_name}}</p>',
    category: 'sales',
  },
  {
    id: 'preset-meeting',
    name: 'Meeting Request',
    subject: 'Meeting request',
    bodyHtml: '<p>Hi {{first_name}},</p><p>Would you be available for a 30-minute call next week to discuss {{subject}}?</p><p>Best regards,<br>{{my_name}}</p>',
    category: 'internal',
  },
  {
    id: 'preset-team-update',
    name: 'Team Update',
    subject: 'Weekly team update',
    bodyHtml: '<p>Hi team,</p><p>Here is a quick update on what we accomplished this week at {{company}}:<br>- Progress on {{subject}}<br>- Key milestones achieved<br>- Priorities for next week</p><p>Great work everyone. Let us keep the momentum going.</p><p>Best,<br>{{my_name}}</p>',
    category: 'internal',
  },
  {
    id: 'preset-meeting-notes',
    name: 'Meeting Notes',
    subject: 'Notes: {{subject}}',
    bodyHtml: '<p>Hi {{first_name}},</p><p>Thanks for the productive discussion today. Here are the notes from our meeting on {{subject}}:</p><p>Key decisions:<br>- Agreed on next steps<br>- Action items assigned<br>- Follow-up scheduled for next week</p><p>Please let me know if I missed anything.</p><p>Best,<br>{{my_name}}</p>',
    category: 'internal',
  },
  {
    id: 'preset-personal-thanks',
    name: 'Personal Thank You',
    subject: 'Thinking of you',
    bodyHtml: '<p>Hi {{first_name}},</p><p>I was just thinking about you and wanted to say thank you for your continued support and friendship. It means more than you know.</p><p>Hope you are doing well. Let us catch up soon.</p><p>Warmly,<br>{{my_name}}</p>',
    category: 'personal',
  },
];
