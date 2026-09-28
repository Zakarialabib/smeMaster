#!/usr/bin/env python
"""Generate mockups 06-09 for the voice console.

Self-contained, JS-free, responsive, on the real tokens from
src/styles/globals.css. Run from the repo root:
    dekenv/Scripts/python.exe scripts/build_voice_mockups.py
"""
import pathlib

# Token block — byte-identical to mockups/01-call-log.html (from globals.css @theme)
TOKENS = """    --radius-sm:8px; --radius:12px; --radius-lg:16px; --radius-xl:20px; --radius-2xl:24px;
    --bg-primary:#ffffff; --bg-secondary:#f7f8fa; --bg-tertiary:#f0f1f3; --bg-hover:#eef0f3;
    --bg-selected:rgba(11,87,208,.12);
    --text-primary:#1c1b1f; --text-secondary:#49454f; --text-tertiary:#7a7680;
    --border-primary:#e4e6ea; --border-secondary:#eceef1;
    --accent:#0b57d0; --accent-hover:#0842a0; --accent-light:#d3e3fd; --accent-subtle:rgba(11,87,208,.08);
    --ai:#9333ea; --ai-subtle:rgba(147,51,234,.08);
    --danger:#e11d48; --warning:#d97706; --warning-light:#fef3c7;
    --success:#059669; --success-light:#d1fae5; --info:#0284c7; --info-light:#e0f2fe;
    --glass-blur:14px;
    --elevation-sm:0 1px 2px rgba(16,24,40,.04);
    --elevation-md:0 1px 3px rgba(16,24,40,.08), 0 1px 2px rgba(16,24,40,.04);
    --elevation-lg:0 4px 16px rgba(16,24,40,.08);
    --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-5:20px; --space-6:24px;
"""

BASE_CSS = """  /* ---- Tokens copied verbatim from src/styles/globals.css (@theme) ---- */
  :root{
""" + TOKENS + """  }
  *{box-sizing:border-box}
  html,body{margin:0}
  body{
    font-family:-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
    font-size:14px; line-height:1.45; color:var(--text-primary);
    background:
      radial-gradient(1200px 600px at 88% -10%, rgba(11,87,208,.10), transparent 60%),
      radial-gradient(900px 500px at 4% 110%, rgba(147,51,234,.07), transparent 60%),
      var(--bg-secondary);
    min-height:100vh; padding:var(--space-4);
  }
  .frost{background:rgba(255,255,255,.72);backdrop-filter:blur(var(--glass-blur));
    -webkit-backdrop-filter:blur(var(--glass-blur));border:1px solid var(--border-primary);
    box-shadow:var(--elevation-sm)}
  .wrap{max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:var(--space-4)}

  /* app rail */
  .rail{display:flex;align-items:center;gap:var(--space-1);padding:var(--space-2) var(--space-3);
    border-radius:var(--radius-lg);overflow-x:auto}
  .rail .brand{font-weight:600;padding-inline-end:var(--space-3);white-space:nowrap}
  .rail a{color:var(--text-secondary);text-decoration:none;padding:6px 10px;border-radius:var(--radius);
    white-space:nowrap}
  .rail a.on{color:var(--accent);background:var(--bg-selected);font-weight:600}

  /* console nav */
  .cnav{display:flex;align-items:center;gap:var(--space-1);padding:var(--space-1) var(--space-2);
    border-radius:var(--radius-lg)}
  .cnav button{font:inherit;border:0;background:transparent;color:var(--text-secondary);
    padding:7px 12px;border-radius:var(--radius);cursor:pointer}
  .cnav button.on{color:var(--accent);background:var(--accent-subtle);font-weight:600}
  .cnav .spacer{flex:1}
  .tenant{font-size:12px;color:var(--text-tertiary);padding-inline-end:var(--space-2)}

  /* panel */
  .panel{border-radius:var(--radius-lg);background:var(--bg-primary);
    border:1px solid var(--border-primary);box-shadow:var(--elevation-sm);overflow:hidden}
  .phead{display:flex;align-items:center;gap:var(--space-3);flex-wrap:wrap;
    padding:var(--space-3) var(--space-4);border-bottom:1px solid var(--border-primary)}
  .phead h1{font-size:16px;margin:0;font-weight:600}
  .phead .grow{flex:1}
  .pbody{padding:var(--space-4)}

  /* controls */
  .btn{font:inherit;font-weight:500;border-radius:var(--radius);padding:7px 12px;cursor:pointer;
    border:1px solid var(--border-primary);background:var(--bg-primary);color:var(--text-secondary)}
  .btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
  .btn:disabled{opacity:.5;cursor:not-allowed}
  .sel{font:inherit;border:1px solid var(--border-primary);background:var(--bg-tertiary);
    color:var(--text-primary);border-radius:var(--radius);padding:6px 10px}
  .sel:disabled{opacity:.55}

  /* AI banner — the app's AiSuggestionBanner shape */
  .ai{display:flex;gap:var(--space-3);align-items:flex-start;margin:var(--space-3) var(--space-4);
    padding:var(--space-3);border-radius:var(--radius-lg);
    background:var(--ai-subtle);border:1px solid rgba(147,51,234,.28)}
  .ai .mk{width:22px;height:22px;flex:none;border-radius:999px;background:var(--ai);color:#fff;
    display:grid;place-items:center;font-size:12px;font-weight:700}
  .ai .bd{flex:1;min-width:0}
  .ai .bd b{display:block;color:var(--ai);font-weight:600;margin-bottom:2px}
  .ai .bd p{margin:0;color:var(--text-secondary)}
  .ai .act{display:flex;gap:var(--space-2);flex-wrap:wrap;margin-top:var(--space-2)}
  .ai .act a{font-size:12px;font-weight:600;color:var(--ai);text-decoration:none}
  .ai .act a.mut{color:var(--text-tertiary);font-weight:400}

  /* degraded / offline banner — never a bare empty state */
  .down{margin:var(--space-3) var(--space-4);padding:var(--space-3);border-radius:var(--radius-lg);
    background:#fff1f2;border:1px solid rgba(225,29,72,.3);display:flex;gap:var(--space-3);
    align-items:flex-start}
  .down .mk{width:22px;height:22px;flex:none;border-radius:999px;background:var(--danger);
    color:#fff;display:grid;place-items:center;font-size:12px;font-weight:700}
  .down .bd b{display:block;color:#9f1239;margin-bottom:2px}
  .down .bd p{margin:0;color:var(--text-secondary)}
  .note{margin:var(--space-3) var(--space-4);padding:var(--space-3);border-radius:var(--radius-lg);
    background:var(--bg-tertiary);color:var(--text-secondary);font-size:12.5px}

  .sub{font-size:12px;color:var(--text-tertiary)}
  .row{display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap}
  .num{font-variant-numeric:tabular-nums}
  .end{text-align:end}
  .mono{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px}

  .pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;
    padding:3px 9px;border-radius:999px;border:1px solid transparent;white-space:nowrap}
  .pill.ok{background:var(--success-light);color:#065f46;border-color:rgba(5,150,105,.25)}
  .pill.tr{background:var(--accent-light);color:var(--accent-hover);border-color:rgba(11,87,208,.25)}
  .pill.vm{background:var(--info-light);color:#075985;border-color:rgba(2,132,199,.25)}
  .pill.p1{background:#ffe4e6;color:#9f1239;border-color:rgba(225,29,72,.3)}
  .pill.flag{background:var(--warning-light);color:#92400e;border-color:rgba(217,119,6,.3)}
  .pill.off{background:var(--bg-tertiary);color:var(--text-tertiary);border-color:var(--border-primary)}
  .dot{width:6px;height:6px;border-radius:999px;background:var(--danger);display:inline-block}
  .dot.ok{background:var(--success)}
  .dot.warn{background:var(--warning)}

  @media (max-width:720px){
    body{padding:var(--space-2)}
    .rail a:nth-child(n+6){display:none}
  }
"""

FORM_CSS = """
  /* form rows */
  .fset{padding:var(--space-4);border-bottom:1px solid var(--border-secondary)}
  .fset:last-of-type{border-bottom:0}
  .fset > h2{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--text-tertiary);
    margin:0 0 var(--space-3);font-weight:600}
  .f{display:grid;grid-template-columns:220px 1fr;gap:var(--space-3);align-items:center;
    padding:var(--space-2) 0}
  .f > label{color:var(--text-secondary);font-size:13px}
  .f .ctl{display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap}
  .f .hint{color:var(--text-tertiary);font-size:12px}
  .radios{display:flex;gap:var(--space-3);flex-wrap:wrap}
  .radios label{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--text-secondary)}
  .radios label.dis{color:var(--text-tertiary);cursor:not-allowed}
  .tier{border:1px solid var(--border-primary);border-radius:var(--radius-lg);padding:var(--space-3);
    display:flex;flex-direction:column;gap:4px;min-width:220px}
  .tier.on{border-color:var(--accent);background:var(--accent-subtle)}
  .tier.dis{opacity:.6}
  .tier b{font-size:13px}
  .tier .price{font-size:15px;font-weight:600;font-variant-numeric:tabular-nums}
  .tiers{display:flex;gap:var(--space-3);flex-wrap:wrap}
  .foot{display:flex;justify-content:flex-end;gap:var(--space-2);padding:var(--space-3) var(--space-4);
    background:var(--bg-secondary);border-top:1px solid var(--border-primary);
    position:sticky;bottom:0}

  @media (max-width:720px){
    .f{grid-template-columns:1fr;gap:var(--space-1)}
    .tiers{flex-direction:column}
    .foot{position:static}
  }
"""

TABLE_CSS = """
  .scroll{overflow-x:auto}
  table.data{width:100%;border-collapse:separate;border-spacing:0;min-width:640px}
  table.data th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-tertiary);
    font-weight:600;text-align:start;padding:var(--space-2) var(--space-4);
    border-bottom:1px solid var(--border-primary);background:var(--bg-secondary)}
  table.data td{padding:var(--space-3) var(--space-4);border-bottom:1px solid var(--border-secondary);
    color:var(--text-secondary);vertical-align:middle}
  table.data tbody tr:hover{background:var(--bg-hover)}
  table.data td.who{color:var(--text-primary);font-weight:500;font-variant-numeric:tabular-nums}
  .cards{display:none;padding:var(--space-3);gap:var(--space-2);flex-direction:column}
  .ccard{border:1px solid var(--border-primary);border-radius:var(--radius-lg);
    background:var(--bg-primary);padding:var(--space-3);display:flex;flex-direction:column;gap:6px}
  .ccard .top{display:flex;justify-content:space-between;gap:var(--space-2);align-items:center}
  @media (max-width:720px){ .deskonly{display:none !important} .cards{display:flex} }
"""

# Mobile mockup is 390px by definition — its own width IS the viewport.
MOBILE_CSS = """
  /* Fixed 390px phone frame. This mockup's width IS the viewport it is
     designing for, so the body is constrained and centred rather than
     fluid — that is the point of the artefact. */
  body{width:390px;margin:0 auto;padding:var(--space-3);
    border-inline:1px solid var(--border-primary);background:var(--bg-tertiary)}
  @media (min-width:430px){
    body{margin:24px auto;border:1px solid var(--border-primary);border-radius:var(--radius-2xl);
      box-shadow:var(--elevation-lg)}
  }
  .wrap{max-width:none;gap:var(--space-3)}
  .mhead{display:flex;align-items:center;justify-content:space-between;gap:var(--space-2);
    padding:var(--space-2) var(--space-3);border-radius:var(--radius-lg)}
  .mhead .ttl{font-size:14px;font-weight:600}
  .mbox{border-radius:var(--radius-lg);background:var(--bg-primary);
    border:1px solid var(--border-primary);box-shadow:var(--elevation-sm);overflow:hidden}
  .mitem{padding:var(--space-3);border-bottom:1px solid var(--border-secondary);
    display:flex;flex-direction:column;gap:var(--space-1)}
  .mitem:last-child{border-bottom:0}
  .mitem .t{display:flex;justify-content:space-between;gap:var(--space-2);align-items:baseline}
  .mitem .b{font-size:12.5px;color:var(--text-tertiary)}
  .mfoot{padding:var(--space-3);display:flex;gap:var(--space-2);
    border-top:1px solid var(--border-primary);background:var(--bg-secondary)}
  .mfoot .btn{flex:1;text-align:center;padding:11px 12px}
  /* the states that must never be confused with each other */
  .state{padding:var(--space-4);border-radius:var(--radius-lg);display:flex;gap:var(--space-3);
    align-items:flex-start;margin:0 0 var(--space-3)}
  .state .mk{width:24px;height:24px;flex:none;border-radius:999px;color:#fff;
    display:grid;place-items:center;font-size:13px;font-weight:700}
  .state b{display:block;margin-bottom:2px}
  .state p{margin:0;font-size:12.5px;color:var(--text-secondary)}
  .state.off{background:#fff1f2;border:1px solid rgba(225,29,72,.3)}
  .state.off .mk{background:var(--danger)}
  .state.off b{color:#9f1239}
  .state.empty{background:var(--bg-primary);border:1px solid var(--border-primary)}
  .state.empty .mk{background:var(--text-tertiary)}
  .state.empty b{color:var(--text-primary)}
  /* thumb zone: the lower 40% of the viewport */
  .thumbzone{border:1px dashed var(--border-primary);border-radius:var(--radius-lg);
    padding:var(--space-3);background:repeating-linear-gradient(45deg,
    transparent,transparent 7px,rgba(11,87,208,.04) 7px,rgba(11,87,208,.04) 14px)}
  .thumbzone .lbl{font-size:11px;color:var(--accent);font-weight:600;margin-bottom:var(--space-2)}
"""




TOPOLOGY_CSS = """
  /* Desktop: two nodes side by side with the connector between them.
     Flex-basis rather than a media query, so the pairing does not depend on
     the viewport the mockup happens to be rendered at. */
  .topo{display:flex;flex-wrap:wrap;gap:var(--space-3);padding:var(--space-4);
    align-items:stretch}
  .node{flex:1 1 320px;min-width:min(100%,320px);border:1px solid var(--border-primary);
    border-radius:var(--radius-lg);background:var(--bg-primary);padding:var(--space-3);
    display:flex;flex-direction:column;gap:var(--space-2)}
  .node h3{margin:0;font-size:13px;font-weight:600}
  .node .tag{font-size:11px;color:var(--text-tertiary)}
  .node .cap{display:flex;flex-direction:column;gap:4px;margin-top:var(--space-1)}
  .caprow{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-secondary)}
  .caprow .k{width:8px;height:8px;border-radius:999px;flex:none}
  .k.ok{background:var(--success)} .k.off{background:var(--text-tertiary)}
  .k.warn{background:var(--warning)} .k.key{background:var(--ai)}
  .link{align-self:center;color:var(--text-tertiary);font-size:20px;
    flex:0 0 auto;padding:0 var(--space-1)}
  @media (max-width:720px){ .link{transform:rotate(90deg)} }
"""


def page(name, title, css, body, note):
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Voice Console — {title}</title>
<style>
{BASE_CSS}{css}</style>
</head>
<body>
<div class="wrap">
{body}
  <p class="sub" style="text-align:center">
    Static mockup · tokens from <code>src/styles/globals.css</code> · no JS ·
    {note}
  </p>
</div>
</body>
</html>
"""


def rail(active="Calls"):
    items = ["Mail", "Today", "CRM", "Calls", "Tasks", "Calendar", "AI", "Business"]
    links = "".join(
        f'<a href="#" class="on" aria-current="page">{i}</a>' if i == active else f'<a href="#">{i}</a>'
        for i in items)
    return f"""
  <nav class="rail frost" aria-label="App">
    <span class="brand">SMEMaster</span>{links}
  </nav>
"""


def cnav(active):
    tabs = ["Calls", "Live", "Ops", "Config", "Cost"]
    btns = "".join(
        f'<button class="on" aria-current="page">{t}</button>' if t == active else f"<button>{t}</button>"
        for t in tabs)
    return f"""
  <nav class="cnav frost" aria-label="Voice console">
    {btns}<span class="spacer"></span><span class="tenant">⟨client⟩ ▾</span>
  </nav>
"""


D = pathlib.Path("docs/voice/design/mockups")
D.mkdir(parents=True, exist_ok=True)

# ── 06 Agent config ─────────────────────────────────────────────────────────
cfg_body = rail() + cnav("Config") + """
  <section class="panel">
    <div class="phead"><h1>Config</h1><span class="grow"></span>
      <span class="pill off">changes are per-tenant</span></div>

    <div class="fset">
      <h2>Voice</h2>
      <div class="f"><label for="langpair">Language pair</label>
        <div class="ctl">
          <span class="pill ok">FR ✓</span><span class="pill ok">EN ✓</span>
          <span class="pill off">AR — permanently off</span>
          <span class="hint">voice is FR/EN only; the UI ships 5 locales, that is separate</span>
        </div></div>
      <div class="f"><label for="vfr">TTS voice (FR)</label>
        <div class="ctl"><select class="sel" id="vfr" aria-label="French TTS voice">
          <option selected>siwis-medium</option><option>marie</option></select>
          <span class="hint">1024 cached phrases · cache invalidated on change</span></div></div>
      <div class="f"><label for="ven">TTS voice (EN)</label>
        <div class="ctl"><select class="sel" id="ven" aria-label="English TTS voice">
          <option selected>matilda</option><option>rachel</option></select></div></div>
      <div class="f"><span></span><div class="ctl">
        <button class="btn primary">▸ Test greeting + disclosure (6s)</button>
        <span class="hint">plays the real voice — the disclosure line is spoken on 100% of calls</span>
      </div></div>
    </div>

    <div class="fset">
      <h2>Availability</h2>
      <div class="f"><label for="hours">Business hours</label>
        <div class="ctl"><input type="text" class="sel" id="hours" value="Mon–Fri 09:00–18:00" size="22">
          <span class="hint">tz</span><select class="sel" aria-label="Time zone">
            <option selected>Europe/Paris</option></select></div></div>
      <div class="f"><label for="xfer">Transfer target</label>
        <div class="ctl"><span class="mono">+33 6 •• •• 41 22</span>
          <span class="pill ok">required while in-hours</span>
          <span class="hint">an in-hours agent with no transfer target fails "no silent failure"</span></div></div>
      <div class="f"><label for="ah">After hours</label>
        <div class="ctl radios" id="ah">
          <label><input type="radio" name="ah" checked> take message</label>
          <label><input type="radio" name="ah"> transfer</label>
          <label><input type="radio" name="ah"> announce only</label>
        </div></div>
    </div>

    <div class="fset">
      <h2>Tier</h2>
      <div class="tiers">
        <div class="tier dis"><b>○ Budget · self-hosted</b>
          <span class="price">—</span><span class="sub">unavailable · latency unmeasured, Gate 4</span></div>
        <div class="tier on"><b>● Standard · cloud</b>
          <span class="price">€0.19/min</span><span class="sub">signed model</span></div>
        <div class="tier"><b>○ Premium · ElevenLabs</b>
          <span class="price">€0.28/min</span><span class="sub">best quality, higher cost</span></div>
      </div>
    </div>

    <div class="fset">
      <h2>Behaviour ⚠ read-only</h2>
      <div class="note" style="margin:0">
        Prompts, the tool set and the assistant's "never" list are <b>not editable in
        this console</b> — see <code>dev/AGENT-PROMPTS.md</code>. If you want different
        wording, that is a change request, not a setting.
      </div>
    </div>

    <div class="foot">
      <button class="btn">Discard</button><button class="btn primary">Save changes</button>
    </div>
  </section>

  <!-- DEGRADED STATE — this is what the screen must render instead of the form
       when agent-core cannot be reached. Never a silent empty form. -->
  <section class="panel">
    <div class="phead"><h1>Config — degraded</h1>
      <span class="pill p1">offline</span></div>
    <div class="down">
      <span class="mk" aria-hidden="true">!</span>
      <div class="bd">
        <b>We cannot reach the agent — last seen 14:51</b>
        <p>Configuration is unchanged. Saving is disabled until the agent answers.
           This is <b>not</b> a sign your settings are wrong.</p>
      </div>
    </div>
    <div class="pbody">
      <p class="sub">The form above is retained read-only so the operator can read the
         current configuration while degraded — a blank panel would read as "everything
         was lost".</p>
    </div>
    <div class="foot">
      <button class="btn" disabled>Discard</button>
      <button class="btn primary" disabled>Save changes</button>
    </div>
  </section>

  <section class="panel">
    <div class="phead"><h1>Config — capability unavailable</h1></div>
    <div class="down" style="background:var(--warning-light);border-color:rgba(217,119,6,.35)">
      <span class="mk" aria-hidden="true" style="background:var(--warning)">!</span>
      <div class="bd">
        <b style="color:#92400e">Budget tier unavailable</b>
        <p>The self-hosted tier is disabled because its end-of-turn latency has not been
           measured yet. It is not hidden — it is shown with the reason, so nobody files
           a support ticket asking where it went.</p>
      </div>
    </div>
  </section>
"""
(D / "06-agent-config.html").write_text(page(
    "06", "Agent config", FORM_CSS, cfg_body,
    "degraded states: agent-core unreachable · capability unavailable"), encoding="utf-8")

# ── 07 Knowledge ────────────────────────────────────────────────────────────
kn_body = rail() + cnav("Config") + """
  <section class="panel">
    <div class="phead"><h1>Knowledge</h1><span class="grow"></span>
      <span class="sub">what the agent is allowed to see</span></div>

    <div class="fset">
      <h2>Scope</h2>
      <div class="f"><span></span><div class="ctl">
        <label class="radios"><input type="checkbox" checked> services &amp; pricing</label>
        <span class="hint">142 chunks</span></div></div>
      <div class="f"><span></span><div class="ctl">
        <label class="radios"><input type="checkbox" checked> opening hours</label>
        <span class="hint">18 chunks</span></div></div>
      <div class="f"><span></span><div class="ctl">
        <label class="radios"><input type="checkbox" checked> booking rules</label>
        <span class="hint">31 chunks</span></div></div>
      <div class="f"><span></span><div class="ctl">
        <label class="radios dis"><input type="checkbox" disabled> email</label>
        <span class="pill off">never enabled in v1</span></div></div>
      <div class="f"><span></span><div class="ctl">
        <label class="radios dis"><input type="checkbox" disabled> contacts</label>
        <span class="pill off">needs an explicit decision</span></div></div>
    </div>

    <div class="fset">
      <h2>Index</h2>
      <div class="f"><label for="chunks">Chunks</label>
        <div class="ctl"><span class="num">287 / 500</span></div></div>
      <div class="f"><label for="emb">Embedding</label>
        <div class="ctl"><span class="mono">bge-m3 · 1024-d · self-hosted</span>
          <span class="hint">ⓘ deliberately separate from the desktop's 384-d local
            index — the two spaces cannot be merged</span></div></div>
      <div class="f"><label for="ing">Ingest</label>
        <div class="ctl"><span>last 2 h ago</span><span class="sub">·</span>
          <span>next 22:00</span><button class="btn">Re-index now</button></div></div>
    </div>

    <div class="ai">
      <span class="mk" aria-hidden="true">⟡</span>
      <div class="bd">
        <b>4 digest answers cited no chunk</b>
        <p>The agent may not know enough about refunds. Sample question: "remboursement
           sous 30 jours". This is an inference from answer/retrieval pairs, not a
           recorded fact.</p>
        <div class="act"><a href="#">See the 4 answers →</a><a href="#" class="mut">Dismiss</a></div>
      </div>
    </div>

    <div class="foot">
      <button class="btn">Discard</button><button class="btn primary">Publish</button>
    </div>
    <div class="note">
      Publishing re-indexes the agent's knowledge. It takes about 90 seconds and the
      agent keeps serving the previous index until it completes.
    </div>
  </section>

  <!-- DEGRADED STATE — nothing published yet -->
  <section class="panel">
    <div class="phead"><h1>Knowledge — nothing published yet</h1>
      <span class="pill flag">not indexed</span></div>
    <div class="pbody">
      <div class="note" style="margin:0 0 var(--space-3)">
        <b>Nothing has been published, so the agent has no knowledge to answer from.</b>
        It will still answer — from its prompt — and every such answer is a guess. Pick
        your sources above and publish, or the pilot's containment figure will reflect
        an empty knowledge base rather than a weak model.
      </div>
      <table class="data" style="min-width:0">
        <caption class="sub" style="text-align:start;padding:0 0 var(--space-2)">
          What is ready to ingest</caption>
        <thead><tr><th scope="col">Source</th><th scope="col">Status</th>
          <th scope="col" class="end">Chunks</th></tr></thead>
        <tbody>
          <tr><td class="who">Pricing page (web)</td><td><span class="pill ok">ready</span></td>
            <td class="end num">142</td></tr>
          <tr><td class="who">Opening hours (web)</td><td><span class="pill ok">ready</span></td>
            <td class="end num">18</td></tr>
          <tr><td class="who">Booking rules (PDF)</td><td><span class="pill flag">parse failed</span></td>
            <td class="end num">—</td></tr>
        </tbody>
      </table>
      <div class="foot"><button class="btn primary">Publish</button></div>
    </div>
  </section>

  <!-- DEGRADED STATE — partial ingest, the silent-consistency case -->
  <section class="panel">
    <div class="phead"><h1>Knowledge — ingest incomplete</h1>
      <span class="pill p1">mixed index</span></div>
    <div class="down">
      <span class="mk" aria-hidden="true">!</span>
      <div class="bd">
        <b>Ingest stopped at 61% — the index is mixed</b>
        <p>Services and hours are on the new index; booking rules are still on the old
           one. Answers may cite either. The previous complete index is still available
           to roll back to.</p>
      </div>
    </div>
    <div class="pbody"><div class="row">
      <button class="btn primary">Retry ingest</button>
      <button class="btn">Roll back to 14:20</button>
    </div></div>
  </section>
"""
(D / "07-knowledge.html").write_text(page(
    "07", "Knowledge scope", FORM_CSS + TABLE_CSS, kn_body,
    "degraded states: nothing published · ingest incomplete"), encoding="utf-8")

# ── 08 Cost ─────────────────────────────────────────────────────────────────
cost_body = rail() + cnav("Cost") + """
  <section class="panel">
    <div class="phead"><h1>Cost</h1><span class="grow"></span>
      <span class="pill flag">all figures UNVERIFIED</span></div>
    <div class="note" style="border-radius:0;border-inline:0;margin:0">
      Vendor rates are <b>not yet confirmed</b> — these are the signed-model figures
      from <code>client/COST-MODEL.md</code>, whose §6 checklist is still open. Do not
      quote this screen to anyone.
    </div>

    <div class="pbody">
      <div class="row" style="gap:var(--space-6);align-items:flex-end">
        <div><div class="sub">volume</div>
          <div style="font-size:26px;font-weight:600" class="num">412 min · 128 calls</div></div>
        <div><div class="sub">signed model</div>
          <div style="font-size:26px;font-weight:600" class="num">€0.19/min</div></div>
        <div><div class="sub">actual</div>
          <div style="font-size:26px;font-weight:600;color:var(--warning)" class="num">€0.21/min</div>
          <div class="sub">⚠ +11% · within the ±20% band</div></div>
      </div>
      <div style="font-size:34px;letter-spacing:2px;color:var(--accent);margin:var(--space-4) 0 var(--space-1)"
           role="img" aria-label="Sparkline: daily minutes over 30 days, trending upward in the second half">
        ▁▂▃▅▂▁▃▇▅▃▂▁▃▂▄▃▁▂▃▅▃▂▁▂▃▄▅▃▂▁▃▂▄▃▂▁▂▃▅▃▂▁▂▃▄▅▃▂▁▃▂▄▃▂▁▂▃▅▃
      </div>
      <div class="sub">minutes per day, 30 days · group the table by day for exact figures</div>
    </div>

    <div class="fset" style="border-top:1px solid var(--border-primary)">
      <div class="row"><h2 style="margin:0">By call type</h2>
        <select class="sel" aria-label="Group by"><option selected>call type</option><option>day</option></select>
        <span class="pill flag">⚑ 4 over model</span></div>
    </div>

    <div class="scroll">
      <table class="data">
        <thead><tr>
          <th scope="col">Call type</th><th scope="col" class="end">Calls</th>
          <th scope="col" class="end">Minutes</th><th scope="col" class="end">Actual</th>
          <th scope="col" class="end">vs model</th></tr></thead>
        <tbody>
          <tr><td class="who">Contained — pricing</td><td class="end num">38</td>
            <td class="end num">118.4</td><td class="end num">€24.90</td>
            <td class="end num">+4%</td></tr>
          <tr><td class="who">Contained — hours</td><td class="end num">27</td>
            <td class="end num">61.2</td><td class="end num">€11.40</td>
            <td class="end num">−3%</td></tr>
          <tr><td class="who">Voicemail → WhatsApp</td><td class="end num">22</td>
            <td class="end num">66.0</td><td class="end num">€18.90</td>
            <td class="end num"><span class="pill flag">⚑ +31%</span></td></tr>
          <tr><td class="who">Transferred</td><td class="end num">29</td>
            <td class="end num">99.1</td><td class="end num">€17.10</td>
            <td class="end num">−9%</td></tr>
          <tr><td class="who">Abandoned</td><td class="end num">8</td>
            <td class="end num">12.3</td><td class="end num">€3.80</td>
            <td class="end num"><span class="pill flag">⚑ +48%</span></td></tr>
          <tr><td class="who">WhatsApp (text) ⓘ</td><td class="end num">12</td>
            <td class="end num">—</td><td class="end num">€0.00</td>
            <td class="end num">n/a</td></tr>
        </tbody>
      </table>
    </div>

    <div class="note">
      ⓘ <b>Why WhatsApp text is €0.00.</b> Those are user-initiated service
      conversations inside the 24-hour window, which Meta does not charge for. It is a
      policy consequence, not missing data — inbound-only v1 means Meta cost ≈ 0.
    </div>

    <div class="ai">
      <span class="mk" aria-hidden="true">⟡</span>
      <div class="bd">
        <b>4 of the over-model calls are after-hours</b>
        <p>At the current tier that is expected: off-hours minutes are billed at the
           lower rate, so a higher per-minute figure there is not a regression. Re-check
           at 3,000 min/month, where the tier changes.</p>
      </div>
    </div>

    <div class="foot"><button class="btn">Show the 4 over-model calls</button></div>
  </section>
"""
(D / "08-cost.html").write_text(page(
    "08", "Cost", FORM_CSS + TABLE_CSS, cost_body,
    "carries the same UNVERIFIED marker as client/COST-MODEL.md"), encoding="utf-8")

# ── 09 Mobile digest (390px) ────────────────────────────────────────────────
mob_body = """
  <div class="mhead frost">
    <span class="ttl">Monday 14 Sep</span>
    <span class="row"><span class="sub">⟨fr⟩ ▾</span><span class="pill p1">P1 · 1</span></span>
  </div>

  <div class="mbox">
    <div class="mitem">
      <div class="t"><strong>14 calls · 79% contained</strong>
        <span class="sub num">since 08:00</span></div>
      <div class="b">3 transfers · 2 voicemail sent to WhatsApp</div>
    </div>
  </div>

  <h2 style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;
             color:var(--text-tertiary);margin:var(--space-2) 0 var(--space-2)">
    Needs you</h2>
  <div class="mbox">
    <div class="mitem" style="border-inline-start:3px solid var(--danger)">
      <div class="t"><span class="pill p1">P1 · Transfers</span>
        <span class="sub num">14:32</span></div>
      <div class="b">6 failed, 3 callers still waiting for a human</div>
      <div class="mfoot" style="margin:calc(var(--space-2) * -1) -1px -1px;
                  border-radius:0 0 var(--radius-lg) var(--radius-lg)">
        <button class="btn primary">Open the 3</button>
        <button class="btn">Acknowledge</button>
      </div>
    </div>
    <div class="mitem">
      <div class="t"><span class="pill vm">Voicemail → WhatsApp</span>
        <span class="sub num">22:41</span></div>
      <div class="b">"Rappelez-moi après 15h" — sent ✓</div>
    </div>
    <div class="mitem">
      <div class="t"><span class="pill flag">⚑ Pricing</span>
        <span class="sub num">21:05</span></div>
      <div class="b">knowledge gap — no chunk cited</div>
    </div>
  </div>

  <details style="margin-top:var(--space-3)">
    <summary class="sub" style="cursor:pointer;padding:var(--space-2) 0">2 more (P3)</summary>
    <div class="mbox" style="margin-top:var(--space-2)">
      <div class="mitem"><div class="b">09:15 WhatsApp text · contained</div></div>
      <div class="mitem"><div class="b">08:40 WhatsApp text · contained</div></div>
    </div>
  </details>

  <!-- DEGRADED STATE — agent-core unreachable. This must NEVER render as
       "no calls": an operator would read it as a quiet day and stand down. -->
  <h2 style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;
             color:var(--text-tertiary);margin:var(--space-4) 0 var(--space-2)">
    Degraded states — not interchangeable</h2>

  <div class="state off">
    <span class="mk" aria-hidden="true">!</span>
    <div><b>We cannot reach the agent</b>
      <p>Last seen 14:51. The digest below is <b>stale data</b>, not today's calls.
         Do not treat the absence of P1 alerts as an absence of problems.</p></div>
  </div>

  <div class="state empty">
    <span class="mk" aria-hidden="true">·</span>
    <div><b>No calls yet</b>
      <p>This tenant is set up but has not received a call. Two things must finish
         first: the phone number is provisioned, and Meta verification is complete.</p></div>
  </div>

  <div class="thumbzone" style="margin-top:var(--space-4)">
    <div class="lbl">THUMB ZONE — primary actions</div>
    <div class="mfoot" style="border:0;background:none;padding:0">
      <button class="btn primary">Open the 3</button>
      <button class="btn">Acknowledge</button>
    </div>
    <p class="sub" style="margin:var(--space-2) 0 0">
      Both primary actions sit in the lower part of the viewport, never the top-right.
      Nothing here implies a mid-call intervention — a live call on a phone is
      read-only in v1.
    </p>
  </div>
"""
(D / "09-mobile-digest.html").write_text(page(
    "09", "Mobile digest (390px)", MOBILE_CSS, mob_body,
    "390px by definition · offline vs no-calls are distinct states"), encoding="utf-8")

for f in sorted(D.glob("0[6-9]-*.html")):
    print("wrote", f, f.stat().st_size, "bytes")


# ── 10 Topology & capabilities ───────────────────────────────────────────────
# The question "why do we need a VPS if the app runs on the desktop?" is answered
# by a screen, not an argument. See docs/06-ROADMAP/12-voice-agent-topology-decision.md
topo_body = rail() + cnav("Config") + """
  <section class="panel">
    <div class="phead"><h1>Topology &amp; capabilities</h1><span class="grow"></span>
      <span class="pill ok"><span class="dot ok"></span>agent-core reachable</span></div>
    <div class="note" style="border-radius:0;border-inline:0;margin:0">
      Where each job actually runs, and what this device can do. The desktop is a
      <b>client</b> of the agent — closing SMEMaster does not stop calls being answered.
    </div>

    <div class="topo">
      <div class="node">
        <h3>This desktop</h3>
        <span class="tag">Tauri v2 · React 19 · SMEMaster</span>
        <div class="cap">
          <div class="caprow"><span class="k ok"></span> Console — digest, call log, live, config, cost</div>
          <div class="caprow"><span class="k ok"></span> Local RAG — candle + LanceDB, offline (384-d)</div>
          <div class="caprow"><span class="k ok"></span> <b>Provider keys — this tier only</b></div>
          <div class="caprow"><span class="k off"></span> ml-sidecar — local tier, disabled (unmeasured)</div>
          <div class="caprow"><span class="k off"></span> Answering calls if powered off</div>
        </div>
      </div>

      <div class="link" aria-hidden="true">⇄</div>

      <div class="node">
        <h3>agent-core (EU VPS)</h3>
        <span class="tag">Python · FastAPI · reachable wss://…</span>
        <div class="cap">
          <div class="caprow"><span class="k ok"></span> Carrier media stream — inbound FR DID</div>
          <div class="caprow"><span class="k ok"></span> Turn loop — LLM · TTS · STT (cloud tier)</div>
          <div class="caprow"><span class="k ok"></span> WhatsApp — official BSP (prod) / Baileys (dev)</div>
          <div class="caprow"><span class="k ok"></span> Metering · ops snapshot · alerts</div>
          <div class="caprow"><span class="k ok"></span> Answers calls when the office is shut</div>
          <div class="caprow"><span class="k warn"></span> Compromising it exposes tenant transcripts,
            <b>not</b> the speech-vendor accounts</div>
        </div>
      </div>
    </div>

    <div class="fset" style="border-top:1px solid var(--border-primary)">
      <h2>Tier — decides where the keys live</h2>
      <table class="data" style="min-width:0">
        <thead><tr>
          <th scope="col">Tier</th><th scope="col">Speech runs</th>
          <th scope="col">Keys live on</th><th scope="col">State</th></tr></thead>
        <tbody>
          <tr><td class="who">Standard (cloud)</td><td>agent-core, cloud vendors</td>
            <td>the VPS</td><td><span class="pill ok">● active</span></td></tr>
          <tr><td class="who">Self-hosted (local)</td><td>this desktop, offline</td>
            <td><b>this desktop</b></td><td><span class="pill flag">⛠ disabled — RTF unmeasured</span></td></tr>
          <tr><td class="who">Premium</td><td>agent-core, ElevenLabs</td>
            <td>the VPS</td><td><span class="pill off">○ available</span></td></tr>
        </tbody>
      </table>
      <div class="note" style="margin:var(--space-3) 0 0">
        ⚠️ <b>Only one tier is local at a time.</b> Whichever provider the agent calls must
        have a key on the machine running it. Selecting a cloud tier moves the keys to the
        VPS; selecting self-hosted keeps them here. The console never implies both are local.
      </div>
    </div>

    <div class="ai">
      <span class="mk" aria-hidden="true">⟡</span>
      <div class="bd">
        <b>Capability gaps this device cannot close</b>
        <p>Inferred from a capability probe, not a config file: this device has no local
           speech models installed, no GPU execution provider, and reports no microphone or
           speaker capture permission. It can run the console; it cannot run the local tier
           today.</p>
      </div>
    </div>
  </section>

  <section class="panel">
    <div class="phead"><h1>Topology — agent-core unreachable</h1>
      <span class="pill p1">offline</span></div>
    <div class="down">
      <span class="mk" aria-hidden="true">!</span>
      <div class="bd">
        <b>We cannot reach the agent — last seen 14:51</b>
        <p>The desktop and its local features keep working: the console renders, the local
           RAG searches, settings are still editable locally. What is <b>not</b> working is
           anything that needs the agent — including <b>answering calls</b>. If the VPS is
           down, inbound calls are going to the carrier's failover, not to voicemail.</p>
      </div>
    </div>
    <div class="pbody"><div class="row">
      <button class="btn primary">Retry connection</button>
      <button class="btn">Check the agent's own health page</button>
      <span class="sub">This is a P1: calls are currently unanswered.</span>
    </div></div>
  </section>
"""
(D / "10-topology-capabilities.html").write_text(page(
    "10", "Topology & capabilities", FORM_CSS + TABLE_CSS + TOPOLOGY_CSS, topo_body,
    "why the agent runs on the VPS and the desktop does not"), encoding="utf-8")
print("wrote", D / "10-topology-capabilities.html")

