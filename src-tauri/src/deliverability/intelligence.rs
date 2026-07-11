use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::Manager;

use crate::error::SerializedError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FailureType {
    MissingSpf,
    SpfPermissive,
    SpfLookupLimit,
    MissingDkim,
    WeakDkimKey,
    MissingDmarc,
    WeakDmarcPolicy,
    BlacklistedIp,
    NoPtrMatch,
    MxIssues,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalizedString {
    pub en: String,
    pub fr: String,
    pub ar: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Provider {
    Gmail,
    Outlook,
    Yahoo,
    Exchange,
    All,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ImpactSeverity {
    Critical,
    Warning,
    Info,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderImpact {
    pub provider: Provider,
    pub severity: ImpactSeverity,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FixMethod {
    SelfService,
    Cpanel,
    Cloudflare,
    Godaddy,
    Ovh,
    Automated,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FixStep {
    pub step_number: u8,
    pub action: String,
    pub expected_result: String,
    pub copy_value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FixPath {
    pub method: FixMethod,
    pub instructions: Vec<FixStep>,
    pub estimated_time: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemediationNode {
    pub failure_type: FailureType,
    pub explanation: LocalizedString,
    pub impact: Vec<ProviderImpact>,
    pub fix_paths: Vec<FixPath>,
}

pub fn get_remediation_for_failure(failure: &FailureType) -> Option<RemediationNode> {
    match failure {
        FailureType::MissingSpf => Some(RemediationNode {
            failure_type: FailureType::MissingSpf,
            explanation: LocalizedString {
                en: "Your domain is missing an SPF record. SPF (Sender Policy Framework) tells receiving mail servers which IP addresses are authorized to send email on behalf of your domain. Without it, emails from your domain are more likely to be flagged as spam or rejected.".into(),
                fr: "Votre domaine n'a pas d'enregistrement SPF. L'enregistrement SPF (Sender Policy Framework) indique aux serveurs de réception quelles adresses IP sont autorisées à envoyer des e-mails pour votre domaine. Sans cela, vos e-mails risquent d'être marqués comme spam.".into(),
                ar: ".SPF (Sender Policy Framework) مجالك يفتقر إلى سجل SPF. يخبر  خوادم البريد المستقبلة بعناوين IP المسموح لها بإرسال البريد الإلكتروني نيابة عن نطاقك بدون ذلك، قد يتم وضع علامة على رسائلك كبريد عشوائي".into(),
            },
            impact: vec![
                ProviderImpact { provider: Provider::Gmail, severity: ImpactSeverity::Critical, description: "Gmail requires SPF for bulk senders and strongly recommends it for all senders".into() },
                ProviderImpact { provider: Provider::Outlook, severity: ImpactSeverity::Critical, description: "Outlook.com and Exchange Online may reject or quarantine mail without SPF".into() },
                ProviderImpact { provider: Provider::Yahoo, severity: ImpactSeverity::Warning, description: "Yahoo Mail applies increased spam filtering when SPF is absent".into() },
                ProviderImpact { provider: Provider::Exchange, severity: ImpactSeverity::Critical, description: "On-premises Exchange with anti-spam filters may block unauthenticated senders".into() },
            ],
            fix_paths: vec![
                FixPath {
                    method: FixMethod::SelfService,
                    instructions: vec![
                        FixStep { step_number: 1, action: "Log into your DNS management console (wherever your domain's nameservers point)".into(), expected_result: "DNS management dashboard".into(), copy_value: None },
                        FixStep { step_number: 2, action: "Locate the DNS zone file or DNS records section".into(), expected_result: "List of current DNS records".into(), copy_value: None },
                        FixStep { step_number: 3, action: "Add a new TXT record".into(), expected_result: "Form to enter record name and value".into(), copy_value: None },
                        FixStep { step_number: 4, action: "Set the record name to @ or your root domain".into(), expected_result: "Name field set to @".into(), copy_value: None },
                        FixStep { step_number: 5, action: "Paste the SPF record value below. Replace include:_spf.example.com with your actual email sending service".into(), expected_result: "TXT value field populated".into(), copy_value: Some("v=spf1 include:_spf.example.com ~all".into()) },
                        FixStep { step_number: 6, action: "Save the record".into(), expected_result: "Record added successfully".into(), copy_value: None },
                    ],
                    estimated_time: "10 minutes".into(),
                },
                FixPath {
                    method: FixMethod::Cpanel,
                    instructions: vec![
                        FixStep { step_number: 1, action: "Log into your cPanel account".into(), expected_result: "cPanel dashboard".into(), copy_value: None },
                        FixStep { step_number: 2, action: "Navigate to Zone Editor under the Domains section".into(), expected_result: "Zone Editor showing your domains".into(), copy_value: None },
                        FixStep { step_number: 3, action: "Click Manage next to your domain".into(), expected_result: "DNS records list".into(), copy_value: None },
                        FixStep { step_number: 4, action: "Click Add Record".into(), expected_result: "Record type dropdown".into(), copy_value: None },
                        FixStep { step_number: 5, action: "Select TXT Record type".into(), expected_result: "TXT record form".into(), copy_value: None },
                        FixStep { step_number: 6, action: "Leave Name blank (defaults to @)".into(), expected_result: "Name field empty".into(), copy_value: None },
                        FixStep { step_number: 7, action: "Paste the SPF value into the TXT Value field".into(), expected_result: "Value field populated".into(), copy_value: Some("v=spf1 include:_spf.example.com ~all".into()) },
                        FixStep { step_number: 8, action: "Set TTL to 3600 (or Auto)".into(), expected_result: "TTL set".into(), copy_value: None },
                        FixStep { step_number: 9, action: "Click Save / Add Record".into(), expected_result: "Record created".into(), copy_value: None },
                    ],
                    estimated_time: "5 minutes".into(),
                },
                FixPath {
                    method: FixMethod::Cloudflare,
                    instructions: vec![
                        FixStep { step_number: 1, action: "Log into your Cloudflare dashboard".into(), expected_result: "Cloudflare dashboard".into(), copy_value: None },
                        FixStep { step_number: 2, action: "Select your domain from the list".into(), expected_result: "Domain overview".into(), copy_value: None },
                        FixStep { step_number: 3, action: "Go to DNS → Records".into(), expected_result: "DNS records list".into(), copy_value: None },
                        FixStep { step_number: 4, action: "Click Add Record".into(), expected_result: "Add DNS record form".into(), copy_value: None },
                        FixStep { step_number: 5, action: "Select TXT as the record type".into(), expected_result: "TXT record form".into(), copy_value: None },
                        FixStep { step_number: 6, action: "Set Name to @ (or leave blank)".into(), expected_result: "Name set to @".into(), copy_value: None },
                        FixStep { step_number: 7, action: "Paste the SPF value into the Value field".into(), expected_result: "Value field populated".into(), copy_value: Some("v=spf1 include:_spf.example.com ~all".into()) },
                        FixStep { step_number: 8, action: "Disable the Proxy (orange cloud) — set to DNS Only".into(), expected_result: "Proxy disabled, grey cloud icon".into(), copy_value: None },
                        FixStep { step_number: 9, action: "Set TTL to Auto".into(), expected_result: "TTL set to Auto".into(), copy_value: None },
                        FixStep { step_number: 10, action: "Click Save".into(), expected_result: "Record saved".into(), copy_value: None },
                    ],
                    estimated_time: "5 minutes".into(),
                },
                FixPath {
                    method: FixMethod::Godaddy,
                    instructions: vec![
                        FixStep { step_number: 1, action: "Log into your GoDaddy account".into(), expected_result: "Account dashboard".into(), copy_value: None },
                        FixStep { step_number: 2, action: "Go to My Products → Domains".into(), expected_result: "Domain list".into(), copy_value: None },
                        FixStep { step_number: 3, action: "Click DNS next to your domain".into(), expected_result: "DNS management page".into(), copy_value: None },
                        FixStep { step_number: 4, action: "Click Add New Record".into(), expected_result: "Record type dropdown".into(), copy_value: None },
                        FixStep { step_number: 5, action: "Select TXT from the Type dropdown".into(), expected_result: "TXT record form".into(), copy_value: None },
                        FixStep { step_number: 6, action: "Enter @ in the Name / Host field".into(), expected_result: "Name set to @".into(), copy_value: None },
                        FixStep { step_number: 7, action: "Paste the SPF value into the Value / TXT Value field".into(), expected_result: "Value field populated".into(), copy_value: Some("v=spf1 include:_spf.example.com ~all".into()) },
                        FixStep { step_number: 8, action: "Set TTL to 1 Hour".into(), expected_result: "TTL set to 1 Hour".into(), copy_value: None },
                        FixStep { step_number: 9, action: "Click Save / Add Record".into(), expected_result: "Record saved".into(), copy_value: None },
                    ],
                    estimated_time: "5 minutes".into(),
                },
            ],
        }),
        FailureType::SpfPermissive => Some(RemediationNode {
            failure_type: FailureType::SpfPermissive,
            explanation: LocalizedString {
                en: "Your SPF record uses +all (permissive), which allows any server to send email from your domain. This bypasses SPF authentication entirely and makes your domain vulnerable to spoofing and phishing attacks. Change +all to ~all (soft fail) or -all (hard fail).".into(),
                fr: "Votre enregistrement SPF utilise +all (permissif), ce qui permet à n'importe quel serveur d'envoyer des e-mails depuis votre domaine. Remplacez +all par ~all (soft fail) ou -all (hard fail).".into(),
                ar: ".+all ~all -all سجل SPF الخاص بك يستخدم +all (مسموح بالجميع)، مما يسمح لأي خادم بإرسال البريد الإلكتروني من نطاقك. قم بتغيير +all إلى".into(),
            },
            impact: vec![
                ProviderImpact { provider: Provider::Gmail, severity: ImpactSeverity::Critical, description: "Gmail treats +all as a spoofing risk and may reject mail".into() },
                ProviderImpact { provider: Provider::Outlook, severity: ImpactSeverity::Critical, description: "Outlook flags permissive SPF records as insecure".into() },
                ProviderImpact { provider: Provider::Yahoo, severity: ImpactSeverity::Warning, description: "Yahoo may apply additional spam scoring".into() },
                ProviderImpact { provider: Provider::All, severity: ImpactSeverity::Info, description: "Any receiving server can be spoofed when +all is set".into() },
            ],
            fix_paths: vec![
                FixPath {
                    method: FixMethod::SelfService,
                    instructions: vec![
                        FixStep { step_number: 1, action: "Locate your SPF TXT record in your DNS management console".into(), expected_result: "Existing SPF record".into(), copy_value: None },
                        FixStep { step_number: 2, action: "Find the 'all' mechanism at the end of the record value".into(), expected_result: "+all at the end of the record".into(), copy_value: None },
                        FixStep { step_number: 3, action: "Replace +all with ~all (soft fail — recommended for transition)".into(), expected_result: "Record ends with ~all".into(), copy_value: Some("v=spf1 include:_spf.example.com ~all".into()) },
                        FixStep { step_number: 4, action: "Save the record".into(), expected_result: "Record updated".into(), copy_value: None },
                        FixStep { step_number: 5, action: "Monitor email delivery for 48 hours. If everything works, switch ~all to -all (hard fail) for maximum protection.".into(), expected_result: "All legitimate email still delivered".into(), copy_value: None },
                    ],
                    estimated_time: "5 minutes".into(),
                },
            ],
        }),
        FailureType::SpfLookupLimit => Some(RemediationNode {
            failure_type: FailureType::SpfLookupLimit,
            explanation: LocalizedString {
                en: "Your SPF record exceeds the DNS lookup limit of 10. SPF records with more than 10 DNS lookups (each include:, a:, mx:, ptr: mechanism counts as one) may be rejected by receiving servers, causing legitimate email to bounce.".into(),
                fr: "Votre enregistrement SPF dépasse la limite de 10 requêtes DNS. Les serveurs de réception peuvent rejeter vos e-mails.".into(),
                ar: "SPF سجل SPF الخاص بك يتجاوز حد البحث DNS البالغ 10 عمليات بحث. قد ترفض خوادم الاستقبال رسائلك الإلكترونية".into(),
            },
            impact: vec![
                ProviderImpact { provider: Provider::Gmail, severity: ImpactSeverity::Warning, description: "Gmail may reject mail if SPF permerror occurs".into() },
                ProviderImpact { provider: Provider::Outlook, severity: ImpactSeverity::Warning, description: "Outlook applies SPF permerror policy, delivery not guaranteed".into() },
                ProviderImpact { provider: Provider::Yahoo, severity: ImpactSeverity::Info, description: "Yahoo may still deliver but with reduced trust score".into() },
            ],
            fix_paths: vec![
                FixPath {
                    method: FixMethod::SelfService,
                    instructions: vec![
                        FixStep { step_number: 1, action: "Review your current SPF record and count the DNS lookups".into(), expected_result: "List of all mechanisms in the SPF record".into(), copy_value: None },
                        FixStep { step_number: 2, action: "Identify redundant or duplicate include: statements".into(), expected_result: "Identified consolidation candidates".into(), copy_value: None },
                        FixStep { step_number: 3, action: "Replace multiple include: statements for the same provider with a single include:".into(), expected_result: "Fewer lookups".into(), copy_value: None },
                        FixStep { step_number: 4, action: "Remove unnecessary a: or mx: mechanisms if not actively used".into(), expected_result: "Streamlined SPF record".into(), copy_value: None },
                        FixStep { step_number: 5, action: "If still over 10, consider creating a flat SPF record with explicit ip4: ranges instead of include:".into(), expected_result: "SPF record with 10 or fewer lookups".into(), copy_value: None },
                        FixStep { step_number: 6, action: "Save the updated record".into(), expected_result: "Record updated".into(), copy_value: None },
                    ],
                    estimated_time: "15 minutes".into(),
                },
            ],
        }),
        FailureType::MissingDkim => Some(RemediationNode {
            failure_type: FailureType::MissingDkim,
            explanation: LocalizedString {
                en: "Your domain is missing a DKIM record. DKIM (DomainKeys Identified Mail) adds a cryptographic signature to outgoing emails, allowing receiving servers to verify that the email was not tampered with in transit. Without it, your emails are more susceptible to spoofing and phishing detection.".into(),
                fr: "Votre domaine n'a pas d'enregistrement DKIM. DKIM (DomainKeys Identified Mail) ajoute une signature cryptographique aux e-mails sortants, permettant aux serveurs de vérifier l'intégrité du message.".into(),
                ar: "DKIM (DomainKeys Identified Mail) مجالك يفتقر إلى سجل DKIM. يضيف توقيعًا تشفيريًا إلى رسائل البريد الإلكتروني الصادرة، مما يسمح لخوادم الاستقبال بالتحقق من عدم العبث بالرسالة".into(),
            },
            impact: vec![
                ProviderImpact { provider: Provider::Gmail, severity: ImpactSeverity::Critical, description: "Gmail requires DKIM for bulk senders (over 5,000 messages/day)".into() },
                ProviderImpact { provider: Provider::Outlook, severity: ImpactSeverity::Warning, description: "Outlook uses DKIM as a key signal in spam filtering".into() },
                ProviderImpact { provider: Provider::Yahoo, severity: ImpactSeverity::Warning, description: "Yahoo DMARC alignment depends on DKIM for authentication".into() },
                ProviderImpact { provider: Provider::Exchange, severity: ImpactSeverity::Info, description: "Exchange uses DKIM as part of its reputation scoring".into() },
            ],
            fix_paths: vec![
                FixPath {
                    method: FixMethod::SelfService,
                    instructions: vec![
                        FixStep { step_number: 1, action: "Obtain your DKIM private/public key pair from your email sending provider (e.g., Google Workspace, Microsoft 365, Mailchimp, SendGrid)".into(), expected_result: "DKIM public key value and selector name".into(), copy_value: None },
                        FixStep { step_number: 2, action: "Log into your DNS management console".into(), expected_result: "DNS dashboard".into(), copy_value: None },
                        FixStep { step_number: 3, action: "Navigate to DNS records or zone editor".into(), expected_result: "DNS records list".into(), copy_value: None },
                        FixStep { step_number: 4, action: "Add a new TXT record".into(), expected_result: "Add record form".into(), copy_value: None },
                        FixStep { step_number: 5, action: "Set the record name to your DKIM selector (e.g., google._domainkey, selector1._domainkey, s1._domainkey)".into(), expected_result: "Name set to selector._domainkey".into(), copy_value: None },
                        FixStep { step_number: 6, action: "Paste the DKIM public key value provided by your email service".into(), expected_result: "TXT value field populated".into(), copy_value: Some("v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC..." .into()) },
                        FixStep { step_number: 7, action: "Save the record".into(), expected_result: "Record added".into(), copy_value: None },
                    ],
                    estimated_time: "10 minutes".into(),
                },
                FixPath {
                    method: FixMethod::Cpanel,
                    instructions: vec![
                        FixStep { step_number: 1, action: "Log into cPanel".into(), expected_result: "cPanel dashboard".into(), copy_value: None },
                        FixStep { step_number: 2, action: "Navigate to Zone Editor under Domains".into(), expected_result: "Zone Editor".into(), copy_value: None },
                        FixStep { step_number: 3, action: "Click Manage next to your domain".into(), expected_result: "DNS records".into(), copy_value: None },
                        FixStep { step_number: 4, action: "Click Add Record".into(), expected_result: "Add record form".into(), copy_value: None },
                        FixStep { step_number: 5, action: "Select TXT Record type".into(), expected_result: "TXT form".into(), copy_value: None },
                        FixStep { step_number: 6, action: "Enter your DKIM selector with _domainkey suffix (e.g., default._domainkey) in the Name field".into(), expected_result: "Name field filled".into(), copy_value: None },
                        FixStep { step_number: 7, action: "Paste the DKIM public key value provided by your email service".into(), expected_result: "TXT Value populated".into(), copy_value: Some("v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC..." .into()) },
                        FixStep { step_number: 8, action: "Set TTL to 3600 and click Save".into(), expected_result: "DKIM record created".into(), copy_value: None },
                    ],
                    estimated_time: "5 minutes".into(),
                },
            ],
        }),
        FailureType::WeakDkimKey => Some(RemediationNode {
            failure_type: FailureType::WeakDkimKey,
            explanation: LocalizedString {
                en: "Your DKIM key is weaker than 1024 bits. Modern email security standards recommend at least 1024-bit RSA keys, with 2048 bits strongly preferred. Weak keys can be compromised and reduce deliverability.".into(),
                fr: "Votre clé DKIM est inférieure à 1024 bits. Les normes de sécurité recommandent au moins 1024 bits.".into(),
                ar: "مفتاح DKIM الخاص بك أضعف من 1024 بت. توصي معايير أمان البريد الإلكتروني الحديثة بمفاتيح RSA بسعة 1024 بت على الأقل".into(),
            },
            impact: vec![
                ProviderImpact { provider: Provider::Gmail, severity: ImpactSeverity::Warning, description: "Gmail may downgrade trust for weak DKIM keys".into() },
                ProviderImpact { provider: Provider::Outlook, severity: ImpactSeverity::Warning, description: "Outlook flags weak DKIM keys as a security concern".into() },
                ProviderImpact { provider: Provider::Yahoo, severity: ImpactSeverity::Info, description: "Yahoo prefers strong DKIM keys for full authentication".into() },
            ],
            fix_paths: vec![
                FixPath {
                    method: FixMethod::SelfService,
                    instructions: vec![
                        FixStep { step_number: 1, action: "Log into your email sending platform (Google Workspace, Microsoft 365, etc.)".into(), expected_result: "Admin console".into(), copy_value: None },
                        FixStep { step_number: 2, action: "Navigate to the DKIM key management section".into(), expected_result: "DKIM settings".into(), copy_value: None },
                        FixStep { step_number: 3, action: "Generate a new DKIM key pair with 2048-bit key length".into(), expected_result: "New public key generated".into(), copy_value: None },
                        FixStep { step_number: 4, action: "Copy the new DKIM public key value".into(), expected_result: "Public key copied".into(), copy_value: None },
                        FixStep { step_number: 5, action: "Update your DNS TXT record for the DKIM selector with the new public key".into(), expected_result: "DNS record updated".into(), copy_value: None },
                        FixStep { step_number: 6, action: "Publish the updated record".into(), expected_result: "New key propagated".into(), copy_value: None },
                    ],
                    estimated_time: "15 minutes".into(),
                },
            ],
        }),
        FailureType::MissingDmarc => Some(RemediationNode {
            failure_type: FailureType::MissingDmarc,
            explanation: LocalizedString {
                en: "Your domain is missing a DMARC record. DMARC (Domain-based Message Authentication, Reporting & Conformance) tells receiving mail servers how to handle messages that fail SPF and DKIM checks. Without DMARC, spoofers can easily impersonate your domain with no policy enforcement.".into(),
                fr: "Votre domaine n'a pas d'enregistrement DMARC. DMARC indique aux serveurs de réception comment traiter les e-mails qui échouent aux vérifications SPF et DKIM.".into(),
                ar: "DMARC (Domain-based Message Authentication, Reporting & Conformance) مجالك يفتقر إلى سجل DMARC. يخبر خوادم البريد المستقبلة بكيفية التعامل مع الرسائل التي تفشل في فحوصات SPF و DKIM".into(),
            },
            impact: vec![
                ProviderImpact { provider: Provider::Gmail, severity: ImpactSeverity::Critical, description: "Gmail uses DMARC policy to determine whether to deliver, quarantine, or reject mail".into() },
                ProviderImpact { provider: Provider::Outlook, severity: ImpactSeverity::Critical, description: "Outlook enforces DMARC policy for incoming mail".into() },
                ProviderImpact { provider: Provider::Yahoo, severity: ImpactSeverity::Critical, description: "Yahoo requires DMARC alignment for delivery".into() },
                ProviderImpact { provider: Provider::Exchange, severity: ImpactSeverity::Warning, description: "Exchange with DMARC aggregation reports helps monitor auth failures".into() },
            ],
            fix_paths: vec![
                FixPath {
                    method: FixMethod::SelfService,
                    instructions: vec![
                        FixStep { step_number: 1, action: "Log into your DNS management console".into(), expected_result: "DNS dashboard".into(), copy_value: None },
                        FixStep { step_number: 2, action: "Navigate to your DNS records or zone editor".into(), expected_result: "DNS records".into(), copy_value: None },
                        FixStep { step_number: 3, action: "Add a new TXT record".into(), expected_result: "Add record form".into(), copy_value: None },
                        FixStep { step_number: 4, action: "Set the record name to _dmarc (this creates _dmarc.yourdomain.com)".into(), expected_result: "Name set to _dmarc".into(), copy_value: None },
                        FixStep { step_number: 5, action: "Paste the DMARC policy value. Start with p=none to monitor, then progress to p=quarantine or p=reject".into(), expected_result: "Value field populated".into(), copy_value: Some("v=DMARC1; p=none; rua=mailto:dmarc-reports@yourdomain.com; pct=100".into()) },
                        FixStep { step_number: 6, action: "Save the record".into(), expected_result: "Record added".into(), copy_value: None },
                        FixStep { step_number: 7, action: "Monitor DMARC reports for 1-2 weeks, then change policy to p=quarantine, and eventually p=reject".into(), expected_result: "Full DMARC protection active".into(), copy_value: None },
                    ],
                    estimated_time: "10 minutes".into(),
                },
                FixPath {
                    method: FixMethod::Cpanel,
                    instructions: vec![
                        FixStep { step_number: 1, action: "Log into cPanel".into(), expected_result: "cPanel dashboard".into(), copy_value: None },
                        FixStep { step_number: 2, action: "Go to Zone Editor under Domains".into(), expected_result: "Zone Editor".into(), copy_value: None },
                        FixStep { step_number: 3, action: "Click Manage next to your domain".into(), expected_result: "DNS records".into(), copy_value: None },
                        FixStep { step_number: 4, action: "Click Add Record".into(), expected_result: "Add record form".into(), copy_value: None },
                        FixStep { step_number: 5, action: "Select TXT Record type".into(), expected_result: "TXT form".into(), copy_value: None },
                        FixStep { step_number: 6, action: "Enter _dmarc in the Name field".into(), expected_result: "Name set to _dmarc".into(), copy_value: None },
                        FixStep { step_number: 7, action: "Paste the DMARC value. Start with p=none for monitoring".into(), expected_result: "TXT Value populated".into(), copy_value: Some("v=DMARC1; p=none; rua=mailto:dmarc-reports@yourdomain.com; pct=100".into()) },
                        FixStep { step_number: 8, action: "Set TTL to 3600 and click Save".into(), expected_result: "DMARC record created".into(), copy_value: None },
                    ],
                    estimated_time: "5 minutes".into(),
                },
            ],
        }),
        FailureType::WeakDmarcPolicy => Some(RemediationNode {
            failure_type: FailureType::WeakDmarcPolicy,
            explanation: LocalizedString {
                en: "Your DMARC policy is set to p=none, which means no action is taken when emails fail SPF or DKIM checks. This is useful for monitoring but does not prevent spoofing. For full protection, upgrade to p=quarantine or p=reject.".into(),
                fr: "Votre politique DMARC est définie sur p=none. Pour une protection complète, passez à p=quarantine ou p=reject.".into(),
                ar: "p=none p=quarantine p=reject سياسة DMARC الخاصة بك مضبوطة على p=none، مما يعني عدم اتخاذ أي إجراء عند فشل رسائل البريد الإلكتروني. للحماية الكاملة، قم بالترقية إلى".into(),
            },
            impact: vec![
                ProviderImpact { provider: Provider::Gmail, severity: ImpactSeverity::Warning, description: "Gmail still delivers mail flagged as suspicious when policy is p=none".into() },
                ProviderImpact { provider: Provider::Outlook, severity: ImpactSeverity::Warning, description: "Outlook does not enforce any policy with p=none".into() },
                ProviderImpact { provider: Provider::Yahoo, severity: ImpactSeverity::Info, description: "Yahoo recommends p=reject for domain protection".into() },
                ProviderImpact { provider: Provider::All, severity: ImpactSeverity::Info, description: "Your domain remains vulnerable to spoofing with p=none".into() },
            ],
            fix_paths: vec![
                FixPath {
                    method: FixMethod::SelfService,
                    instructions: vec![
                        FixStep { step_number: 1, action: "Review DMARC reports to verify no legitimate email is failing SPF/DKIM".into(), expected_result: "Clear understanding of email auth pass rate".into(), copy_value: None },
                        FixStep { step_number: 2, action: "Locate your DMARC TXT record (_dmarc.yourdomain.com) in DNS".into(), expected_result: "Current DMARC record".into(), copy_value: None },
                        FixStep { step_number: 3, action: "Change p=none to p=quarantine (suspicious mail goes to spam)".into(), expected_result: "p=quarantine set".into(), copy_value: Some("v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@yourdomain.com; pct=100".into()) },
                        FixStep { step_number: 4, action: "Monitor for 2 weeks, then upgrade to p=reject for maximum protection".into(), expected_result: "p=reject — spoofed mail is rejected at the server level".into(), copy_value: Some("v=DMARC1; p=reject; rua=mailto:dmarc-reports@yourdomain.com; pct=100".into()) },
                        FixStep { step_number: 5, action: "Save the updated record".into(), expected_result: "DMARC policy updated".into(), copy_value: None },
                    ],
                    estimated_time: "10 minutes".into(),
                },
            ],
        }),
        FailureType::BlacklistedIp => Some(RemediationNode {
            failure_type: FailureType::BlacklistedIp,
            explanation: LocalizedString {
                en: "Your sending IP address has been found on one or more DNS-based blacklists (DNSBL). This means receiving mail servers may automatically reject or spam-filter emails originating from this IP. Common causes include compromised mail scripts, previous spam activity, or shared IP reputation.".into(),
                fr: "Votre adresse IP d'envoi figure sur une ou plusieurs listes noires DNS. Les serveurs de réception peuvent rejeter automatiquement vos e-mails.".into(),
                ar: "تم العثور على عنوان IP الخاص بك في قائمة حظر واحدة أو أكثر. قد تقوم خوادم البريد المستقبلة تلقائيًا برفض رسائلك الإلكترونية أو تصفيتها كبريد عشوائي".into(),
            },
            impact: vec![
                ProviderImpact { provider: Provider::Gmail, severity: ImpactSeverity::Critical, description: "Gmail may reject mail from blacklisted IPs entirely".into() },
                ProviderImpact { provider: Provider::Outlook, severity: ImpactSeverity::Critical, description: "Outlook uses blacklist status as a strong spam signal".into() },
                ProviderImpact { provider: Provider::Yahoo, severity: ImpactSeverity::Warning, description: "Yahoo blocks known blacklisted IPs".into() },
                ProviderImpact { provider: Provider::All, severity: ImpactSeverity::Info, description: "Most email providers check one or more blacklists".into() },
            ],
            fix_paths: vec![
                FixPath {
                    method: FixMethod::SelfService,
                    instructions: vec![
                        FixStep { step_number: 1, action: "Identify which blacklists your IP appears on using a tool like MXToolbox or WhatIsMyIPAddress".into(), expected_result: "List of blacklists with the IP listed".into(), copy_value: None },
                        FixStep { step_number: 2, action: "Investigate the root cause — check for compromised accounts, open relays, or malware on your server".into(), expected_result: "Root cause identified".into(), copy_value: None },
                        FixStep { step_number: 3, action: "Fix the underlying issue (patch vulnerabilities, remove malware, secure mail scripts)".into(), expected_result: "Server secured".into(), copy_value: None },
                        FixStep { step_number: 4, action: "Visit each blacklist provider's website and follow their delisting / removal request process".into(), expected_result: "Delisting request submitted".into(), copy_value: None },
                        FixStep { step_number: 5, action: "Monitor for re-listing and ensure the root cause is fully resolved".into(), expected_result: "IP removed from blacklists, email delivery restored".into(), copy_value: None },
                    ],
                    estimated_time: "24-72 hours".into(),
                },
                FixPath {
                    method: FixMethod::Automated,
                    instructions: vec![
                        FixStep { step_number: 1, action: "Contact your hosting provider or ISP and request a new sending IP address".into(), expected_result: "New IP assigned".into(), copy_value: None },
                        FixStep { step_number: 2, action: "Update your SPF record to include the new IP if needed".into(), expected_result: "SPF updated".into(), copy_value: None },
                        FixStep { step_number: 3, action: "Warm up the new IP by gradually increasing sending volume over 2-4 weeks".into(), expected_result: "IP reputation established".into(), copy_value: None },
                    ],
                    estimated_time: "2-4 weeks".into(),
                },
            ],
        }),
        FailureType::NoPtrMatch => Some(RemediationNode {
            failure_type: FailureType::NoPtrMatch,
            explanation: LocalizedString {
                en: "Your sending IP does not have a PTR record (reverse DNS) that matches your domain's hostname. Many receiving mail servers perform a reverse DNS lookup to verify the sending server identity. A mismatch or missing PTR can reduce deliverability.".into(),
                fr: "Votre IP d'envoi n'a pas d'enregistrement PTR correspondant à votre domaine. Cela peut réduire la délivrabilité.".into(),
                ar: "IP عنوان IP الخاص بالإرسال ليس لديه سجل PTR (DNS عكسي) يطابق اسم المضيف لنطاقك. قد يؤثر ذلك سلبًا على قابلية التسليم".into(),
            },
            impact: vec![
                ProviderImpact { provider: Provider::Gmail, severity: ImpactSeverity::Warning, description: "Gmail checks PTR alignment for incoming mail".into() },
                ProviderImpact { provider: Provider::Outlook, severity: ImpactSeverity::Warning, description: "Outlook requires matching PTR for high-volume senders".into() },
                ProviderImpact { provider: Provider::Yahoo, severity: ImpactSeverity::Info, description: "Yahoo uses PTR as part of sender reputation".into() },
                ProviderImpact { provider: Provider::Exchange, severity: ImpactSeverity::Warning, description: "Exchange anti-spam filters weigh PTR mismatch heavily".into() },
            ],
            fix_paths: vec![
                FixPath {
                    method: FixMethod::SelfService,
                    instructions: vec![
                        FixStep { step_number: 1, action: "Contact your hosting provider or ISP to set up a PTR (reverse DNS) record for your sending IP".into(), expected_result: "PTR record created".into(), copy_value: None },
                        FixStep { step_number: 2, action: "Request that the PTR record points to your mail server hostname (e.g., mail.yourdomain.com)".into(), expected_result: "PTR resolves to mail.yourdomain.com".into(), copy_value: None },
                        FixStep { step_number: 3, action: "Ensure an A record exists for mail.yourdomain.com pointing to the same IP".into(), expected_result: "Forward and reverse DNS match".into(), copy_value: None },
                        FixStep { step_number: 4, action: "Verify with nslookup or dig that the PTR record is active".into(), expected_result: "PTR resolves correctly".into(), copy_value: None },
                    ],
                    estimated_time: "24 hours".into(),
                },
            ],
        }),
        FailureType::MxIssues => Some(RemediationNode {
            failure_type: FailureType::MxIssues,
            explanation: LocalizedString {
                en: "There are issues with your domain's MX (Mail Exchange) records. MX records specify which servers handle incoming email for your domain. Misconfigured MX records can cause email delivery failures and affect your domain's email reputation.".into(),
                fr: "Il y a des problèmes avec les enregistrements MX de votre domaine. Des enregistrements MX mal configurés peuvent entraîner des échecs de livraison.".into(),
                ar: "MX (Mail Exchange) توجد مشكلات في سجلات MX لنطاقك. تحدد سجلات MX الخوادم التي تتعامل مع البريد الإلكتروني الوارد لنطاقك. التكوين الخاطئ قد يسبب فشل في تسليم البريد".into(),
            },
            impact: vec![
                ProviderImpact { provider: Provider::Gmail, severity: ImpactSeverity::Info, description: "Gmail may still deliver but with lower sender reputation".into() },
                ProviderImpact { provider: Provider::Outlook, severity: ImpactSeverity::Warning, description: "Outlook checks MX configuration as part of domain validation".into() },
                ProviderImpact { provider: Provider::Exchange, severity: ImpactSeverity::Critical, description: "Exchange may fail to route incoming mail with bad MX records".into() },
                ProviderImpact { provider: Provider::All, severity: ImpactSeverity::Info, description: "Incoming email delivery is affected for all providers".into() },
            ],
            fix_paths: vec![
                FixPath {
                    method: FixMethod::SelfService,
                    instructions: vec![
                        FixStep { step_number: 1, action: "Review current MX records in your DNS management console".into(), expected_result: "Current MX records displayed".into(), copy_value: None },
                        FixStep { step_number: 2, action: "Verify MX records point to valid mail server hostnames (not IP addresses directly)".into(), expected_result: "MX records use hostnames".into(), copy_value: None },
                        FixStep { step_number: 3, action: "Ensure MX priority values are correct (lower values = higher priority, typically 0-30)".into(), expected_result: "Proper priority ordering".into(), copy_value: None },
                        FixStep { step_number: 4, action: "Remove any stale or orphaned MX records pointing to old servers".into(), expected_result: "Clean MX records".into(), copy_value: None },
                        FixStep { step_number: 5, action: "If using a third-party provider (Google Workspace, Microsoft 365), use their exact MX values".into(), expected_result: "MX records match provider documentation".into(), copy_value: None },
                    ],
                    estimated_time: "10 minutes".into(),
                },
            ],
        }),
    }
}

pub fn get_remediations_for_failures(failures: &[FailureType]) -> Vec<RemediationNode> {
    failures
        .iter()
        .filter_map(|f| get_remediation_for_failure(f))
        .collect()
}

#[tauri::command]
pub async fn get_remediation(
    handle: tauri::AppHandle,
    _domain: String,
    failure_types: Vec<FailureType>,
) -> Result<Vec<RemediationNode>, SerializedError> {
    // Require deliverability_sentinel subsystem active
    let registry = handle.state::<Arc<crate::orchestrator::SubsystemRegistry>>();
    let _ = crate::orchestrator::require_subsystem_active(&registry, "deliverability_sentinel", None)
        .await
        .map_err(|e| SerializedError::from(e))?;

    Ok(get_remediations_for_failures(&failure_types))
}
