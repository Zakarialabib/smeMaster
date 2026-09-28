"""agent-core — the realtime voice + messaging runtime.

A 24/7 server workload, deliberately NOT inside the Tauri app. The desktop is a
client of this process; closing the desktop does not stop calls being answered
(`docs/06-ROADMAP/12-voice-agent-topology-decision.md`).
"""

from __future__ import annotations

__all__ = ["__version__"]

__version__ = "0.1.0"
