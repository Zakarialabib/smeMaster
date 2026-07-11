# SMEMaster — Account Setup Guide

## Supported Providers

| Provider | Method | Auto-Configured |
|----------|--------|-----------------|
| Gmail | OAuth 2.0 | Yes |
| Microsoft Outlook | OAuth 2.0 | Yes |
| Yahoo Mail | OAuth 2.0 | Yes |
| Any IMAP/SMTP | Manual | No |

## Setting Up Gmail

1. Click "Add Account" in the sidebar
2. Select "Google" from the provider list
3. Click "Sign in with Google"
4. Authorize SMEMaster to access your email
5. Your account will be configured automatically

## Setting Up Microsoft Outlook

1. Click "Add Account" in the sidebar
2. Select "Microsoft" from the provider list
3. Click "Sign in with Microsoft"
4. Authorize SMEMaster to access your email
5. Your account will be configured automatically

## Manual IMAP/SMTP Setup

For other providers or custom setups:

1. Click "Add Account" → "Other"
2. Enter your name and email address
3. Enter the IMAP server settings:
   - Server: (e.g., `imap.example.com`)
   - Port: `993` (SSL) or `143` (STARTTLS)
   - Username: Your full email address
   - Password: Your app password or mailbox password
4. Enter the SMTP server settings:
   - Server: (e.g., `smtp.example.com`)
   - Port: `465` (SSL) or `587` (STARTTLS)
   - Username: Your full email address
   - Password: Same as IMAP password
5. Click "Test Connection" to verify
6. Click "Save"

## Common Provider Settings

### Gmail (Manual)
- IMAP: `imap.gmail.com:993` (SSL)
- SMTP: `smtp.gmail.com:587` (STARTTLS)
- Requires an [App Password](https://support.google.com/accounts/answer/185833)

### Outlook.com (Manual)
- IMAP: `outlook.office365.com:993` (SSL)
- SMTP: `smtp-mail.outlook.com:587` (STARTTLS)

### Yahoo Mail
- IMAP: `imap.mail.yahoo.com:993` (SSL)
- SMTP: `smtp.mail.yahoo.com:465` (SSL)

## Troubleshooting

- **"Authentication failed"**: Check your password or generate an app password
- **"Connection timed out"**: Check your internet connection and firewall settings
- **"Certificate error"**: Ensure the server SSL certificate is valid