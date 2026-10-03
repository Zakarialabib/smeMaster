# Changelog

## [0.4.23](https://github.com/Zakarialabib/smeMaster/compare/smemaster-v0.4.22...smemaster-v0.4.23) (2026-10-03)


### Features

* **ai/rag:** LMStudio-aware multi-dimension vector store + provider indexing (Rust) ([6e764a0](https://github.com/Zakarialabib/smeMaster/commit/6e764a07cf8d87a2731eaf1908af6f13b8a603d9))
* **ai/rag:** wire LMStudio + RAG end-to-end on the frontend ([0eba28a](https://github.com/Zakarialabib/smeMaster/commit/0eba28ab36071355dc07d0667dd093eb15e3615d))
* **ai:** ai-router observability panel in AI settings + frontend tests ([7c3471d](https://github.com/Zakarialabib/smeMaster/commit/7c3471d9876b7114434ca6b8409e9a7be94b6005))
* **ai:** expose sidecar status/metrics/models to frontend ([e4d9589](https://github.com/Zakarialabib/smeMaster/commit/e4d958940a543af2cdf82c40c7cd62e2d9218088))
* **ai:** lazy, isolated local LLM/RAG sidecar ([ffb74ea](https://github.com/Zakarialabib/smeMaster/commit/ffb74ea9cadaead5f2ca1cdecd0f87749db7aa22))
* **ai:** refactor AI settings page — embedding model config, KnowledgeBase tab ([d4abed2](https://github.com/Zakarialabib/smeMaster/commit/d4abed2954870e6890a0ba3c8080294bfd7d8104))
* **ai:** runtime telemetry wiring in aiSidecar store/service ([fc6058c](https://github.com/Zakarialabib/smeMaster/commit/fc6058c2a62781f73783199f108ce72bf849e3dd))
* **attachments:** relocate to own feature + adopt PageScaffold + i18n ([2091686](https://github.com/Zakarialabib/smeMaster/commit/2091686e281e895f257b4124bb464de09e032760))
* **automation:** implement real action handlers with DB persistence ([39ed108](https://github.com/Zakarialabib/smeMaster/commit/39ed10824efae689fc82044fa7d451f16a4e5fd3))
* **automation:** make visual builder a real interactive editor + company switch feedback ([e69ff00](https://github.com/Zakarialabib/smeMaster/commit/e69ff0002deed2e4595b17fa2f7c85f0b21927c8))
* **backend:** add db_filter_contacts + db_restart_subsystem IPC commands ([8e844f7](https://github.com/Zakarialabib/smeMaster/commit/8e844f79ef5475161847fc52c88f79be0596f1b9))
* **backend:** add SMTP/PGP, stock and accounting DAL functions ([29aaaed](https://github.com/Zakarialabib/smeMaster/commit/29aaaed564972fb7fb5b2d7b0482a11a7245bdbc))
* **build:** gate local-ai/RAG behind feature flag + fix 2 pre-existing bugs ([2876301](https://github.com/Zakarialabib/smeMaster/commit/28763014ca05c23842b06d6c0f0dc85150e31a6f))
* **calendar,automation,invoicing,contacts:** adopt PageScaffold + i18n ([1888538](https://github.com/Zakarialabib/smeMaster/commit/18885383fdfabc940b83f90539849b23219989bf))
* **calendar:** bring EventCreateModal to Contacts/Tasks validation pattern ([3b898b5](https://github.com/Zakarialabib/smeMaster/commit/3b898b581636e11216c9fa3d7faf345724979d51))
* **calendar:** update CalendarPage component ([6295ffc](https://github.com/Zakarialabib/smeMaster/commit/6295ffc1f0bba3ee08a3427fb687d5db6ba7c372))
* **campaigns:** block editor UI (blocks, dnd list, config, preview, AI, vault) ([26cfbd0](https://github.com/Zakarialabib/smeMaster/commit/26cfbd038f1cd913bffb56bcac34783007b43f2e))
* **campaigns:** block-based email editor foundation ([cc5bfda](https://github.com/Zakarialabib/smeMaster/commit/cc5bfda0e386655e0647b6380f847a9217d3d000))
* **campaigns:** editor depth — A/B panel, template gallery+reverse parse, Card/Columns blocks ([87204d1](https://github.com/Zakarialabib/smeMaster/commit/87204d1abcc0fc024143b474c0007e379cea668a))
* **campaigns:** integrate block editor into composer + template persistence ([5deda13](https://github.com/Zakarialabib/smeMaster/commit/5deda13ffe49e77efac35c695212e47cf0248170))
* **cargo/email:** Phase B backend core — importance score + auto-categorize ([0024c42](https://github.com/Zakarialabib/smeMaster/commit/0024c42714b2d841d01f2eba8b7708dd5923985e))
* **company:** add db_list_companies and db_create_company backend commands ([27054d7](https://github.com/Zakarialabib/smeMaster/commit/27054d763b5f0e823b14939f3e1ff43f80876fb8))
* **contacts,tasks:** adopt PageScaffold + migrate UI strings to i18n ([9bb2ebd](https://github.com/Zakarialabib/smeMaster/commit/9bb2ebd273fc7fe1f09fd807d71ad81e8858efa2))
* **contacts:** enrich ContactSidebar with Relations tab (company, invoices, campaigns) ([06a9cea](https://github.com/Zakarialabib/smeMaster/commit/06a9cea3f9073f1d4190df9195e47e71cec5812f))
* **contacts:** unify clients into contacts as single source of truth ([2c1cae8](https://github.com/Zakarialabib/smeMaster/commit/2c1cae8631a530bc75cc521f31fbf98e26458468))
* **crm,erp:** integrate invoicing into CRM; add ERP shell ([6e73efe](https://github.com/Zakarialabib/smeMaster/commit/6e73efeca5b39de69f96d74a6fed04b9f9bc3a3f))
* **crm:** add Unified People & Relationships view ([8fb998b](https://github.com/Zakarialabib/smeMaster/commit/8fb998bb09f64a0b8af2ef0e435c236f16d76449))
* **crm:** deal/pipeline schema + DAL + commands + scoring engine; register migrations 030/031/032 ([d5d9b93](https://github.com/Zakarialabib/smeMaster/commit/d5d9b93c0ac04882ecfc50a703232bdd49dcbb98))
* **crm:** deals.ts wrappers + schema types + dealStore.ts (single-writer core) ([71ce979](https://github.com/Zakarialabib/smeMaster/commit/71ce97924e13a2dde2c32508f3b26b99b3ea5b07))
* **crm:** wire Kanban UI + contacts score column + segment filter + clean store imports ([0cf8277](https://github.com/Zakarialabib/smeMaster/commit/0cf82778d2f8113ba9a248f4303b7c4f80bfddec))
* **crm:** wire Kanban UI + navConfig fixes + contacts score column + segment filter + clean store imports ([0db7f85](https://github.com/Zakarialabib/smeMaster/commit/0db7f854f533870566440f8f08db637305f1796b))
* **dashboard:** add range/density store + upgraded hero KPI strip ([b87f922](https://github.com/Zakarialabib/smeMaster/commit/b87f922b593dbd9db90c792acbe90800da8b08f5))
* **dashboard:** business-health widget + range-aware charts + i18n ([3f8e8e2](https://github.com/Zakarialabib/smeMaster/commit/3f8e8e294bcadfae718f0e5735b542856361c5e3))
* **db:** migration 027 — add deleted_at/contact_type to contacts + import_history table ([e28ae8d](https://github.com/Zakarialabib/smeMaster/commit/e28ae8d58e851622a671a4bf412bed4a980f5908))
* **db:** production hardening migration for templates, schedule, calendar ([90129df](https://github.com/Zakarialabib/smeMaster/commit/90129df0cc735c1fc96058f6358720981b3546ab))
* **design-system:** add AI accent (purple) token ([8c6c262](https://github.com/Zakarialabib/smeMaster/commit/8c6c2621ef25820df644d2c975d78b415915edf5))
* **design-system:** condensed tokens + contextual-intelligence surfaces ([034cfab](https://github.com/Zakarialabib/smeMaster/commit/034cfab099e9c9e4f193e91b4d4c5311e5a485f0))
* **design:** add Flat/Glass surface layer (Direction A) with settings toggle ([812cc99](https://github.com/Zakarialabib/smeMaster/commit/812cc99ef009ad6bdff7200e9e0370c67cbd2443))
* **design:** form validation parity + state-component convention (Chunks 4-5) ([f7a3be4](https://github.com/Zakarialabib/smeMaster/commit/f7a3be40a417bdd55d06392cc5f8292ab9dcb331))
* **design:** global UI density toggle (compact/normal/relaxed) (Chunk 7) ([aa7d1c7](https://github.com/Zakarialabib/smeMaster/commit/aa7d1c7c58c33ef64541b18575c0b5f3b3f88170))
* **design:** mobile nav Hub sheet for secondary destinations (Chunk 6) ([e98adb9](https://github.com/Zakarialabib/smeMaster/commit/e98adb99fc24060d22b3d67432a2b4b12c79acd8))
* **erp,invoicing:** wire ERP console + invoicing to live backend ([b295cad](https://github.com/Zakarialabib/smeMaster/commit/b295cada615254fd7abda9c0fbe08a876ed49262))
* **erp:** adopt PageScaffold + create erp i18n namespace ([6308a2f](https://github.com/Zakarialabib/smeMaster/commit/6308a2fada91551fe720efea802ad4bd833ccd18))
* **frontend:** wrap newly-wired Tauri commands + seed default CRM pipeline ([40016c0](https://github.com/Zakarialabib/smeMaster/commit/40016c001b20e793355d3ea9a882ad2701c41c4d))
* **i18n:** onboarding block across all 5 locales ([03de175](https://github.com/Zakarialabib/smeMaster/commit/03de1751ae162a27fe3322948a1d2d32c37921d1))
* implement invoicing module with Morocco DGI compliance ([6784794](https://github.com/Zakarialabib/smeMaster/commit/67847945678dfc268fd46f324f6412c75a4289a6))
* implement invoicing module with Morocco DGI compliance ([6d9e54f](https://github.com/Zakarialabib/smeMaster/commit/6d9e54f9a7909e9b1d6b7aa36bcf4b2b69fe8ceb))
* implement POS hardware integration and point-of-sale module ([b28f666](https://github.com/Zakarialabib/smeMaster/commit/b28f666020f30cf9eccfac7db396379a176b6fed))
* implement POS hardware integration and point-of-sale module ([b58c1d3](https://github.com/Zakarialabib/smeMaster/commit/b58c1d3a1103e877080fb0474b8954df85833dad))
* **infra:** ML sidecar workspace + orchestration + complete feature gating ([17503a4](https://github.com/Zakarialabib/smeMaster/commit/17503a4f94e20b1d06d0d20305bff96ed9d3e73b))
* **infra:** production ML sidecar runtime + IPC routing + arch docs ([7c8dba8](https://github.com/Zakarialabib/smeMaster/commit/7c8dba894195137a2707aa59f28ce0705fe42e01))
* **infrastructure:** align EventBus with Simple-Signage best patterns + tests ([26dcfbd](https://github.com/Zakarialabib/smeMaster/commit/26dcfbd93fd46ad191e3b406efe27ef8745a7a17))
* **invoicing:** add 7-table invoicing schema with i64 money and company legal identifiers ([ea870bb](https://github.com/Zakarialabib/smeMaster/commit/ea870bb8c22f17df85a5aaa3dbcd9f479e027049))
* **invoicing:** add frontend TypeScript types, 24 invoke wrappers, nav entry, and settings tab ([be38809](https://github.com/Zakarialabib/smeMaster/commit/be3880934c09ee359b9fc4c1a816d2c09f2a88f1))
* **invoicing:** add lopdf A4 PDF generator, PEPPOL/UBL 2.1 XML, and 24 Tauri commands ([a413e63](https://github.com/Zakarialabib/smeMaster/commit/a413e63584629130afabea1f0a573445d187883c))
* **invoicing:** build invoice UI components, totals, line-items, settings, clients/items ([062a722](https://github.com/Zakarialabib/smeMaster/commit/062a722dcbb0d3f029202795cf06f859f801373c))
* **invoicing:** dashboard shell, editor, nav entry, routes, i18n keys ([d3afde0](https://github.com/Zakarialabib/smeMaster/commit/d3afde0ff9ea3bdfa931c94ff4a97e2f98d1bc3b))
* **invoicing:** implement table CRUD with transaction support and line-item calculation engine ([91df4d1](https://github.com/Zakarialabib/smeMaster/commit/91df4d1eed651db11cf8b5ae874f96e0651cca0d))
* **invoicing:** invoicing UI/store alignment + client registry service ([f7a9d20](https://github.com/Zakarialabib/smeMaster/commit/f7a9d20e1bd69e0b6a5fb52d819c9e3529e00590))
* **invoicing:** real dispatch + inventory to ERP ledger wiring ([8116c93](https://github.com/Zakarialabib/smeMaster/commit/8116c9380cee21fb13c815152b35deb2f4518c40))
* **mail:** Phase B email UX parity — hover rail, bulk toolbar, Focused inbox, NL snooze, command palette ([7872a25](https://github.com/Zakarialabib/smeMaster/commit/7872a25f5fcaa57216061f36fc1b187d9f058598))
* **mail:** update EmailList layout/behavior ([572e3ad](https://github.com/Zakarialabib/smeMaster/commit/572e3adb74833a1a975d3d4214611e96513f20c8))
* **mail:** use Avatar in list + reading pane, wire AI Task Detection items ([6b220a7](https://github.com/Zakarialabib/smeMaster/commit/6b220a731da776d19554dfd84e801c5996719972))
* **ml-sidecar:** close memory-limit + metrics gaps ([#2](https://github.com/Zakarialabib/smeMaster/issues/2), [#9](https://github.com/Zakarialabib/smeMaster/issues/9)) ([b03027c](https://github.com/Zakarialabib/smeMaster/commit/b03027c5065ae259d59b3c0d596c7b5c6ef95664))
* **ml-sidecar:** protocol v2, HTTP debug API, GPU feature-gating, memory/version/streaming ([e1d3301](https://github.com/Zakarialabib/smeMaster/commit/e1d3301edfec513a2e8e9df33537e21db0d969f9))
* **ml-sidecar:** real candle/lancedb/parser implementations — no more stubs ([ac52bf6](https://github.com/Zakarialabib/smeMaster/commit/ac52bf6fc2e52577d95b4cc4f59465005a9ee45a))
* **nav:** condensed rail (Tasks/Calendar) + Contextual Intelligence map ([9054dd7](https://github.com/Zakarialabib/smeMaster/commit/9054dd7032b90b922b0729a91c46c87ef09d8c22))
* **onboarding:** add 6 backend commands and full wizard frontend ([576d90d](https://github.com/Zakarialabib/smeMaster/commit/576d90d70187b2d5fad8d0e74bfaab498b0b20bb))
* **onboarding:** frosted glass redesign, tests aligned to new UI ([7990dbd](https://github.com/Zakarialabib/smeMaster/commit/7990dbdcf0468921398cd7bec3c50787d7a55d50))
* **orchestrator:** runtime feature-flag enforcement (gap [#1](https://github.com/Zakarialabib/smeMaster/issues/1)) ([f0fec50](https://github.com/Zakarialabib/smeMaster/commit/f0fec50a50c83b6eca9f95036116c090aa2e90c8))
* **orchestrator:** wire real WorkflowExecutorService, export from mod ([2c5f3bf](https://github.com/Zakarialabib/smeMaster/commit/2c5f3bffd0b0077d35707364edd010dd0084cfb9))
* Phase 2 a11y, Phase 7 campaign scheduling + Graph send + analytics ([2d61216](https://github.com/Zakarialabib/smeMaster/commit/2d6121636ff8531283c074619a03900171a863c1))
* Phase 7 calendar driver + template search + sender_credentials (030) ([9002dbb](https://github.com/Zakarialabib/smeMaster/commit/9002dbb4c66e5e3cf0f3f0df53b79a916ae0dd72))
* Phase 7.4 wire template search into CampaignTemplatePicker ([6469372](https://github.com/Zakarialabib/smeMaster/commit/6469372812eb8d2026e7e770f8842f3ed0a2e2ec))
* **pos:** wallet/ERP POS commands + UI + IPC invoke ([303fbe1](https://github.com/Zakarialabib/smeMaster/commit/303fbe1ef82dfc81c4616e83f5e10e3407182738))
* **query:** align hooks to key factory + optimistic mutations ([ba24c31](https://github.com/Zakarialabib/smeMaster/commit/ba24c31801291d306168d372f7ffe8bde25c2854))
* **query:** centralized key factory + QueryClient config ([4383841](https://github.com/Zakarialabib/smeMaster/commit/4383841ac26e4ac56b41feca5f73b4910e9c970e))
* **rust:** add data-cache control commands + Cache::benchmark ([d3a1890](https://github.com/Zakarialabib/smeMaster/commit/d3a18905fb02d7331082381f0b43b2bd0c34c936))
* **seeds:** expand Rust demo data for Gmail/Outlook-grade category tabs ([2149e7d](https://github.com/Zakarialabib/smeMaster/commit/2149e7d892805363dab1d45b947b1a8f619fcecf))
* **services:** wire task filter + deal contract and register invoicing/ERP commands ([d6d559a](https://github.com/Zakarialabib/smeMaster/commit/d6d559a9a52ee33489b6af12858ab59c8f4ad5f5))
* **settings:** add ai-router runtime observability panel ([970f83e](https://github.com/Zakarialabib/smeMaster/commit/970f83e21eb9f283ac907afd5f64caa920e23979))
* **settings:** add ai-router settings tab + runtime polling ([cda6795](https://github.com/Zakarialabib/smeMaster/commit/cda6795725f5c376cab359852457d35959042a2c))
* **settings:** add Cache tab with status, hit-rate, benchmark, clear ([b08fcc8](https://github.com/Zakarialabib/smeMaster/commit/b08fcc82cc1e23fac4fa6faee69315ecb79919c9))
* **settings:** add HelpCard education content to 6 tabs, fix Rust DB issues ([db7dcf7](https://github.com/Zakarialabib/smeMaster/commit/db7dcf73f119f6d053dc9fd8935a6518066de72e))
* **settings:** add RAG/invoicing flags, Dev Pro Mode toggle, developer overview ([466a785](https://github.com/Zakarialabib/smeMaster/commit/466a785d77406ce8b9140f64cecd115334d1c3b4))
* **settings:** beautify TemplatesTab, DeveloperTab, AboutTab with premium card UI ([a75bfee](https://github.com/Zakarialabib/smeMaster/commit/a75bfeeccf463acb7b983d7a2f7e667970795acf))
* **settings:** enhance Composing tab with stats row and setup progress stepper ([0a27b38](https://github.com/Zakarialabib/smeMaster/commit/0a27b38025a823ba9065d9ea7545275b7c76abb2))
* **shared:** add reusable UI/util library + AI sidecar tests ([b4e8330](https://github.com/Zakarialabib/smeMaster/commit/b4e8330b9bb1826b919536e143e43467bda6b97a))
* **tasks:** add db_filter_tasks Rust command with real predicate/sort/date filtering ([86f837b](https://github.com/Zakarialabib/smeMaster/commit/86f837b5efb93e7b7be53690342d9ac279a0495b))
* **tasks:** bring Tasks page to Contacts design/validation parity ([e8e0491](https://github.com/Zakarialabib/smeMaster/commit/e8e049163b652d913658cd85b9dba9d3f8dcab4f))
* **tasks:** reminders toggle, archive completed, fix empty state ([20e3b87](https://github.com/Zakarialabib/smeMaster/commit/20e3b87481caed16748356a6a554b5080fb30ee8))
* **tauri:** lightweight reactive SQLite change tracker ([1f007dd](https://github.com/Zakarialabib/smeMaster/commit/1f007dd28bc28aa685da812bb1390e7e78ad17f5))
* templates gallery, undo/redo, company management, real backends ([783eb03](https://github.com/Zakarialabib/smeMaster/commit/783eb03191aeaf99216616e9b99c4b2a4c659522))
* **theme:** make Frosted Glass the default surface + fix frosted token drift ([0ec8cd8](https://github.com/Zakarialabib/smeMaster/commit/0ec8cd8d4c754522d284883ac35b9e7f73308950))
* **ts:** register db_filter_contacts + db_restart_subsystem and add service wrappers ([97affde](https://github.com/Zakarialabib/smeMaster/commit/97affde624a76c7b6ce55c7502f2338be5c87747))
* **ui:** add 'ai' badge variant + BADGE_AI token ([b27f16c](https://github.com/Zakarialabib/smeMaster/commit/b27f16c25d501170dd2c6d267f71da6f7bb11dd8))
* **ui:** add PageScaffold layout + shared form validators ([b65bdb6](https://github.com/Zakarialabib/smeMaster/commit/b65bdb6aec84ced9adc32b69224fbb1e8ac2290e))
* **ui:** add reusable frosted Avatar + richer AiSuggestionBanner ([05b797e](https://github.com/Zakarialabib/smeMaster/commit/05b797e162b7b99f7541e9fe5467d09d70806a49))
* **ui:** add shared CardTabBar component (mirrors CRM tab strip) ([e6668d3](https://github.com/Zakarialabib/smeMaster/commit/e6668d38b9bbc9dcb73e6df38c74fa261b3b862f))
* **ui:** flat theme foundation — replace frosted-glass tokens with flat surfaces ([2a90e0d](https://github.com/Zakarialabib/smeMaster/commit/2a90e0d6a2e2ccdeecda4a52d39d059b84889f5d))
* **ui:** make AiSuggestionBanner handlers optional (read-only AI summaries) ([9c8951e](https://github.com/Zakarialabib/smeMaster/commit/9c8951e33e652c23a3605eef27f1b21584e47dfb))
* **ui:** merge Automation & Campaigns, enrich empty states, fix nav and help ([d2fe065](https://github.com/Zakarialabib/smeMaster/commit/d2fe0658203ddc777818d53d65429eabbe20e6f4))
* **ui:** PremiumSidebar redesign, FilterBar multi-select, navConfig reorg, ja i18n ([33973c0](https://github.com/Zakarialabib/smeMaster/commit/33973c01cc0be5e4e6d491a2c576dfcd099a48e2))
* **ui:** settings page + premium sidebar/nav updates ([b74be40](https://github.com/Zakarialabib/smeMaster/commit/b74be40b5fa2ce984faf4ab9bf26229aad69a5f7))
* **ui:** wire real contacts filtering + subsystem restart into the UI ([14aebae](https://github.com/Zakarialabib/smeMaster/commit/14aebaedcad1e197e09afa1f05527d88dd94f3fe))
* **unified:** add Unified Inbox page (top nav, DataTable, per-section AI) ([c7645f9](https://github.com/Zakarialabib/smeMaster/commit/c7645f9bdb983ef52ee1e95861a69c3a83c7fae4))
* **wallet:** company cash wallet + ERP ledger sync (backend) ([1651df1](https://github.com/Zakarialabib/smeMaster/commit/1651df1714c0504a2cbde8589aded0f1df189d50))
* **wallet:** responsive Company Wallet UI + Cash tab (frontend) ([c4750a4](https://github.com/Zakarialabib/smeMaster/commit/c4750a4547a8393beaf89c10558e1a91528c95c4))
* **workflows:** add execution logs, Tauri commands, and automation migration ([6ab86f0](https://github.com/Zakarialabib/smeMaster/commit/6ab86f08ea9fe33ad1d7a9c6c853104944310e5f))


### Bug Fixes

* **ai.rs:** remove duplicate #[tauri::command] attr, fix incorrect Option::ok() call on metrics, ([e6c6885](https://github.com/Zakarialabib/smeMaster/commit/e6c68851bbd2dc9048edd01c9d0676f1ee2fa90f))
* **automation,invoicing:** wrap Visual Builder in Suspense; clarify client empty state ([502dbf3](https://github.com/Zakarialabib/smeMaster/commit/502dbf39f3d4542c025e88b775f2305441f9585c))
* **automation:** scope workflow rules to company id instead of account id ([58024a1](https://github.com/Zakarialabib/smeMaster/commit/58024a1b55dbfbdcab5b2549c4680a03241f7f0f))
* **automation:** stop ReactFlow node rebuild from clobbering action edits ([52c7463](https://github.com/Zakarialabib/smeMaster/commit/52c746322f3d8760bd2113c8e64d0ac4fb5c6a5e))
* **campaigns:** compile db_create_campaign_template (error mapping) ([32e52ff](https://github.com/Zakarialabib/smeMaster/commit/32e52ff817725e65fcd90ca9a58dfff7e9aef2b1))
* **campaigns:** fix empty audience contacts list ([0add3f6](https://github.com/Zakarialabib/smeMaster/commit/0add3f67f59f46ae0ad70bcdc8f5499216f84e83))
* **cargo:** resolve Rust test-compile blockers (E0433/E0277) + add MVP launch plan ([60efedb](https://github.com/Zakarialabib/smeMaster/commit/60efedba541b6cc0a1ce4bbc46812c511893a875))
* **contacts:** mark tag/group/segment filter gap clearly instead of silently broken ([662956e](https://github.com/Zakarialabib/smeMaster/commit/662956ef44708766e20b47cf0a15a3349205229a))
* **contacts:** persist new contacts + show LocalRAG; add email extraction and modal validation ([b3a4c5a](https://github.com/Zakarialabib/smeMaster/commit/b3a4c5acf9740bba25a5a680d517e6a679fe7915))
* **contacts:** set company_id from UpsertContactRequest in From impl ([15e0be0](https://github.com/Zakarialabib/smeMaster/commit/15e0be06ee3af58e7335a091e4b2dca46858b61b))
* correct DB column references in workflows, crm, contacts queries ([dc9e954](https://github.com/Zakarialabib/smeMaster/commit/dc9e95459ad5279e409f581721a49c4061fb2247))
* create ML sidecar placeholder for cargo check/test ([2df2c4a](https://github.com/Zakarialabib/smeMaster/commit/2df2c4ab2c2c406696d511edb30b19a6aae0ee46))
* **crm/contacts:** open /people?tab=deals, remove dead segment operator, surface drop errors ([d4c6a53](https://github.com/Zakarialabib/smeMaster/commit/d4c6a5341da161d2e18fedfc015a590ecd7ff0b6))
* **dashboard:** render widget errors via dev-aware WidgetError + fix i18n count keys ([b8f29ed](https://github.com/Zakarialabib/smeMaster/commit/b8f29ed00deca3680e5f8b08d319ab2728dc438a))
* **dashboard:** show calm dev-mode empty state instead of raw IPC error ([70f6045](https://github.com/Zakarialabib/smeMaster/commit/70f60457cf5603622995fa183e13fff5104afc44))
* **db:** correct db search and task update payload ([411740d](https://github.com/Zakarialabib/smeMaster/commit/411740dc70227eac0e28b378af0c6cb08cd534af))
* **db:** make migrations idempotent and fix missing attachment columns ([ce2a122](https://github.com/Zakarialabib/smeMaster/commit/ce2a12230952347aaf9fe2ad1c5d34b5ea6bf3e2))
* **db:** orphaned migrations + dynamic/opt-in demo data ([4afdad4](https://github.com/Zakarialabib/smeMaster/commit/4afdad4b4b962388a8e4a83efb0d7f97d1dced73))
* enable rustls-tls feature for core-only cargo check/test ([52206a1](https://github.com/Zakarialabib/smeMaster/commit/52206a1d223d3198b5ff880eb5bd80cb0292b923))
* **events:** add UiBus.off + fix consumers and broken lint rule ([d050836](https://github.com/Zakarialabib/smeMaster/commit/d0508369b4ffe5b50ccd55d4b6a1d3883f5e9983))
* full request/response matching via DashMap + oneshot channels. ([2291182](https://github.com/Zakarialabib/smeMaster/commit/2291182dee0c9ace8c9f002dcbc3d86caf7a219b))
* **i18n+rtl:** clear 1685 [TODO] translation prefixes, fix 164 RTL violations across 48 files ([4168c5c](https://github.com/Zakarialabib/smeMaster/commit/4168c5cf361f16080cf6425c8f636f79c264cf7d))
* **i18n:** backfill missing keys, clear self-ref/TODO placeholders across all locales ([f34c0ba](https://github.com/Zakarialabib/smeMaster/commit/f34c0ba461ffbcadf862834efd6fe3ef74c6863f))
* **i18n:** clear settings-tab raw keys, object-leak diagnostics, and missing category labels ([02351ba](https://github.com/Zakarialabib/smeMaster/commit/02351ba9a6f15a9a98d2556901907206b9b810b8))
* **i18n:** make feature flags, settings registry, and help center translation-ready; fix rules-of-hooks ESLint errors ([c944faf](https://github.com/Zakarialabib/smeMaster/commit/c944faf34ef2b796df8d5c591e56afbcf90116a3))
* **i18n:** translate hardcoded strings in new shared components ([f686f4b](https://github.com/Zakarialabib/smeMaster/commit/f686f4b83fc08f3bb7610369201bc3ef11c5f1ed))
* **invoicing:** align TS wrapper with Rust db_* contracts; add contract/store tests ([d64966d](https://github.com/Zakarialabib/smeMaster/commit/d64966d8aeb998ae3b1f1bd83747eed31c822f5a))
* **invoicing:** filter db_list_clients by company_id ([b53928f](https://github.com/Zakarialabib/smeMaster/commit/b53928f76b117e35829ba5610b826450c10250dd))
* **invoicing:** make db_list_companies account_id optional ([df8d58c](https://github.com/Zakarialabib/smeMaster/commit/df8d58cf9f2c3ca3caaff9c9adb1ff9c4ca97690))
* **invoicing:** pass company_id to db_list_clients and update wrapper/test ([41e0f85](https://github.com/Zakarialabib/smeMaster/commit/41e0f85d6e79b63595a5735221cc1091234e8a85))
* **invoicing:** repair broken Rust invoicing tests (DocumentTotals + schema drift) ([70cf0e4](https://github.com/Zakarialabib/smeMaster/commit/70cf0e4dceef76195a15e484aa5a30a495745641))
* **invoicing:** surface product/client create failures with toast ([908a714](https://github.com/Zakarialabib/smeMaster/commit/908a714b5145cede19cd7a2394396984f568e49f))
* **invoicing:** use client display name in generated docs ([68bb383](https://github.com/Zakarialabib/smeMaster/commit/68bb3831d4702d22adfc843f4054b085de041cc9))
* **ipc:** guard commands.ts invoke outside Tauri shell ([8e6f937](https://github.com/Zakarialabib/smeMaster/commit/8e6f9374eb1670d46e1399c3898c680bd121d1d5))
* **ipc:** guard invoke outside Tauri shell with clean TauriUnavailableError ([d1168c3](https://github.com/Zakarialabib/smeMaster/commit/d1168c36833a011b990f11dce3ef077e00325f88))
* **mail:** align FolderSyncState/PendingOperation types with schema ([0e569fd](https://github.com/Zakarialabib/smeMaster/commit/0e569fd860464f0a08d3eef215b37fc410beb94e))
* **mail:** open CommandPalette on Cmd/Ctrl+K from EmailList ([4baed12](https://github.com/Zakarialabib/smeMaster/commit/4baed12d7ac9f21ea75c746c9af2d44cb829b0c7))
* **mail:** wire AI suggestion review to AiTaskExtractDialog ([85a8d15](https://github.com/Zakarialabib/smeMaster/commit/85a8d15f31a9c7b2fcde5e2a75b9adcf433a8600))
* **ml-sidecar:** proper JSON-RPC IPC with request/response matching + watchdog restart ([2291182](https://github.com/Zakarialabib/smeMaster/commit/2291182dee0c9ace8c9f002dcbc3d86caf7a219b))
* naming cleanup, critical UX fixes, AI/RAG docs cleanup ([746316c](https://github.com/Zakarialabib/smeMaster/commit/746316c43c8054b60830912cce06418c726b33ca))
* **notifications:** make notify() toasts visible ([c01d90b](https://github.com/Zakarialabib/smeMaster/commit/c01d90b068ba46d7a4473dda23049fc8627ec747))
* **onboarding:** skip if accounts/demo exist, change root redirect to /dashboard ([dbe7105](https://github.com/Zakarialabib/smeMaster/commit/dbe7105d82f5c68cc930cbb6afd65144fc513a3c))
* **onboarding:** tolerate backend-unavailable in browser/dev server ([f366e1e](https://github.com/Zakarialabib/smeMaster/commit/f366e1e7719b962748c210cb71251efa63ce82f0))
* **persistent-storage:** make Tauri detection lazy so browser fallback works in tests ([43f8a86](https://github.com/Zakarialabib/smeMaster/commit/43f8a86d6b99a40746a49dce2d83d5972835fc74))
* **platform:** report no native capability outside Tauri + friendly pairing error ([72a9918](https://github.com/Zakarialabib/smeMaster/commit/72a9918f5f6ec7be4909ac9b00af3154c56cfc39))
* **pos:** wrap tauriStoreStorage with createJSONStorage for zustand persist ([3cba550](https://github.com/Zakarialabib/smeMaster/commit/3cba550250d7aa7c99987873e1eb90ce6da2a76e))
* register missing commands + wire workflow dispatch into event processor ([64bfe14](https://github.com/Zakarialabib/smeMaster/commit/64bfe142c43520d7e04c084ca898a4103122dc95))
* resolve 3 runtime IPC errors, wire calc engine, add company settings/categories CRUD ([3bbe35e](https://github.com/Zakarialabib/smeMaster/commit/3bbe35e0a3eb22a52276df6da13e18d35759b1f3))
* resolve automation create_task company_id + DataCacheService early init ([466571d](https://github.com/Zakarialabib/smeMaster/commit/466571d1b76e26e203b07898f175e29b2f1ef433))
* resolve TS errors in AiTab.tsx caught by new CI ([afe5a67](https://github.com/Zakarialabib/smeMaster/commit/afe5a6727c3f49aaec51361c5b10c39152866eba))
* **rust:** wire missing pos module and remove dead pdf assignment ([bfa01c6](https://github.com/Zakarialabib/smeMaster/commit/bfa01c65430d705817db981be6b197297b6f3b62))
* **schema:** fix template_categories account_id→company_id, add missing fields, migration 021 ([576d90d](https://github.com/Zakarialabib/smeMaster/commit/576d90d70187b2d5fad8d0e74bfaab498b0b20bb))
* **settings:** route HardwareSettings through invokeCommand ([529ebcb](https://github.com/Zakarialabib/smeMaster/commit/529ebcb5d12cbda10cb3d9c75eda4376bdfb68a4))
* **settings:** route reset/data-wipe through db_reset_and_reseed ([f9c0ea8](https://github.com/Zakarialabib/smeMaster/commit/f9c0ea870f6c7c51c218ad50af6478230cbb9b6a))
* **shared:** resolve TS/lint errors in component & hook library ([76b1b41](https://github.com/Zakarialabib/smeMaster/commit/76b1b41877a7bdfe504e60a901151420dab448f9))
* **sidecar:** send init request on spawn + CI/CD setup for sidecar build ([408f128](https://github.com/Zakarialabib/smeMaster/commit/408f1287bfa0f7cd60bf10e37a2842750049ebac))
* **styles:** move [data-density] selectors out of [@theme](https://github.com/theme) block (Tailwind v4) ([b766f29](https://github.com/Zakarialabib/smeMaster/commit/b766f2986588538eeccc485386802337b0b723b8))
* **sync:** wire HealthDashboard to real db_status_snapshot instead of mock data ([07d38aa](https://github.com/Zakarialabib/smeMaster/commit/07d38aa10f50766982bae17b7ba802b144b8cfa9))
* **tasks+reset+onboarding:** empty task table, dev server termination, soft reset ([4152401](https://github.com/Zakarialabib/smeMaster/commit/4152401ca1cf51ba96c8b7efc20bbb986da4440b))
* **tasks:** route SmartFilterBar through real backend filterTasks ([c853429](https://github.com/Zakarialabib/smeMaster/commit/c853429849bb90bd6f772ecfcde861437ab79460))
* **tauri:** fix onboarding listener panic ([a85e84d](https://github.com/Zakarialabib/smeMaster/commit/a85e84d1b197ac416ab9cfded1f5cbfd31ccdcc6))
* **tests:** make full vitest suite green with real fixes (not glue) ([216ecfc](https://github.com/Zakarialabib/smeMaster/commit/216ecfc2567ca07a9a3e2a822295978dce956f50))
* **tests:** repair aiSidecar test mocks + AiTab useEffect refresh scoping ([4155ac9](https://github.com/Zakarialabib/smeMaster/commit/4155ac91cc63f6d9d079ac1b8ca46063a6ceb01c))
* **typecheck:** resolve 3 baseline TS errors (useEmailMutations ThreadSnapshot, useLabels null guard, main.tsx previousData type) ([2387ffa](https://github.com/Zakarialabib/smeMaster/commit/2387ffafc04de0c91bc0d40e854bdb1ed5fd154f))
* uiBus tests + vitest project filtering ([817f79d](https://github.com/Zakarialabib/smeMaster/commit/817f79dc12034bfae1960c89d56889ceeaed614f))
* **ui:** mark device-pairing + vault picker gaps clearly instead of silent no-ops ([ebcae49](https://github.com/Zakarialabib/smeMaster/commit/ebcae49079e6a4b8ffc6fc1b65fa4ba1de1bacda))
* **vault:** critical security fixes — auth gates, path traversal, argon2 PIN, rate limiting ([3d58319](https://github.com/Zakarialabib/smeMaster/commit/3d58319439c697cb369dc9c021e124026be1a4ff))


### Performance Improvements

* **infrastructure:** harden templates data layer (Rust) ([dffa6f1](https://github.com/Zakarialabib/smeMaster/commit/dffa6f190481635aaa67f94035c60b123c8f476d))

## [v1.0.0-rc.1] — 2026-07-13

### Highlights

- **Settings UI overhaul**: All 24 settings tabs redesigned with premium card layout,
  stats rows (DeliverabilityDashboard pattern), step-by-step setup wizards
- **RTL + i18n cleanup**: 164 physical-direction CSS violations fixed across 48 files
  using Tailwind logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`);
  1,685 `[TODO]` translation prefixes cleared across fr/ar/ja/it locales
- **Onboarding rework**: Standalone page after splash; auto-skips if email accounts
  or demo data exist; root redirect changed from `/mail/inbox` to `/dashboard`
- **Onboarding data-check**: Uses `db_has_email_accounts` and `is_system_initialized`
  IPC to skip onboarding when accounts or demo data already exist

### Settings tabs redesigned

- ComposingTab: Stats row (4 cards), Quick Setup Guide stepper with 6-step progress
- TemplatesTab: Stats row (template count, categories, AI ready, demo presets)
- DeveloperTab: Stats row (system status, features, database, updates); consolidated health pane
- AboutTab: Premium gradient hero with app icon, tech stack badges, 8-feature highlights grid
- GeneralTab: 4 HelpCards for appearance/language/privacy/advanced sub-tabs
- FeatureFlagsTab, AccountCleaningTab, HardwareSettings: Added HelpCard education content
- LicensePage, DevicePairingPage: Added HelpCard education content

### Quality

- TypeScript: `tsc --noEmit` — zero errors
- ESLint: zero warnings
- 2,470+ TS tests + 735 Rust tests passing

## [Unreleased] — account_id → company_id rename (company-scoped domains)

### Scope

Renamed all company-scoped Tauri command parameters and frontend invoke wrapper
signatures from `account_id`/`accountId` to `company_id`/`companyId`. This aligns
the IPC contract with the database schema, where company-scoped tables use a
`company_id` foreign key to `companies(id)` rather than `account_id`.

### Company-scoped domains affected

- CRM: contacts, contact labels, contact groups, contact tags, segments, dynamic
  segments, contact files, contact activity
- Campaigns, backup schedules
- Templates / template categories
- Tasks / task tags
- Workflows: rules, follow-up reminders, pending operations, cleanup rules/history
- Calendar: calendars, events, snooze presets
- Compliance checks

### Account-scoped domains (intentionally unchanged)

threads, messages, mail labels, attachments, folder sync state, signatures,
aliases, scheduled emails, local drafts, filter rules, smart folders, quick steps,
quick replies, PGP keys, allowlists, deliverability, AI config/cache, settings,
warming, suppression, bundle rules, writing-style profiles, thread categories.

### `thread_account_id` (kept unchanged)

The `thread_account_id` column on `tasks` is a thread-ownership field, not a
company scope. It was intentionally left as-is.

### Changes

- **Rust commands** (`src-tauri/src/commands/*.rs`): all company-scoped command
  parameters renamed `account_id` → `company_id`.
- **Rust query layer** (`src-tauri/src/db/tables/tasks/tasks.rs`): fixed SQL column
  references (`account_id` → `company_id`) in `list`, `create`, `list_by_account`,
  `count_by_account`, `list_with_contacts*`, `count_incomplete`. Fixed `create()`
  INSERT column list (`account_id` → `company_id`).
- **Rust test** (`src-tauri/src/db/tables/comms/templates.rs`): `Template.company_id`
  is `String` (not `Option<String>`); test helper updated accordingly.
- **Frontend invoke wrapper** (`src/shared/services/db/db-invoke.ts`): 89 issues
  fixed — type-field renames, param-name renames, invoke-key renames, raw SQL
  column fix in `listDynamicSegments`, and JSDoc comment updates.
- **Frontend feature wrappers**: `contactTags.ts`, `contactGroups.ts`,
  `contactSegments.ts`, `calendars.ts`, `calendarEvents.ts` updated to use
  `companyId` for company-scoped operations.

### Frontend callers (additional fixes, 2026-07-09 batch)

- **Stores**: `automationStore.ts`, `workflowStore.ts`, `campaignStore.ts` (x2),
  `contactStore.ts` — all `loadCampaigns`/`loadRules`/`loadWorkflows`/`createCampaign`
  `/`createWorkflow`/`createTag`/`createSegment`/`deleteSegment`use`companyId`.
- **Components**: `ContactActivityTab.tsx`, `SegmentManager.tsx`,
  `SegmentQueryEditor.tsx`, `ContactsStatsWidget.tsx`, `ContactSidebar.tsx`,
  `TaskSidebar.tsx`, `TasksPage.tsx`, `TaskDetailPanel.tsx`,
  `SnoozePresetsEditor.tsx`, `WorkflowEditor.tsx`, `CampaignComposer.tsx`,
  `CampaignTemplatePicker.tsx` — fixed object-literal keys, property accesses,
  and variable references.
- **Service wrappers**: `followUpReminders.ts`, `pendingOperations.ts`,
  `workflowRules.ts`, `snoozePresets.ts`, `vaultService.ts`, `syncManager.ts`,
  `queueProcessor.ts` — fixed `accountId`→`companyId` keys and `account_id`→`company_id`
  property access.
- **Wrappers**: `campaigns.ts`, `workflows.ts`, `workflowRules.ts`,
  `snoozePresets.ts` — param names and internal calls updated.
- **db-invoke.ts**: Fixed `clearFailedOperations`, `retryFailedOperations`,
  `cancelFollowUpForThread` — invoke objects now pass `companyId`.
- **Test mocks**: `entities.mock.ts` — `sync_state` and `company_id` added to
  `createMockDbAccount`.

### Verification

- `npx tsc --noEmit` → **zero errors** ✅
- `cargo check` → **zero errors, zero warnings** ✅

### Migration note

Frontend callers that previously passed `accountId` to company-scoped functions
must now pass `companyId`. No database migration was required — the schema already
used `company_id` on these tables.
