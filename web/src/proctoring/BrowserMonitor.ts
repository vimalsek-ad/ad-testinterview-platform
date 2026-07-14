/**
 * Browser Monitoring — detects tab switches, fullscreen exit, clipboard paste, rapid input.
 * No ML model needed — uses browser APIs only.
 */

import { ProctoringFlag } from "./types";

export class BrowserMonitor {
  private flags: ProctoringFlag[] = [];
  private tabSwitchCount = 0;
  private onFlag: (flag: ProctoringFlag) => void;
  private listeners: Array<{ target: EventTarget; event: string; handler: EventListener }> = [];

  constructor(onFlag: (flag: ProctoringFlag) => void) {
    this.onFlag = onFlag;
  }

  start() {
    // Tab visibility change
    this.addListener(document, "visibilitychange", () => {
      if (document.hidden) {
        this.tabSwitchCount++;
        this.emitFlag("tab_switch", "high", `Tab switch detected (#${this.tabSwitchCount})`);
      }
    });

    // Window blur (click outside browser)
    this.addListener(window, "blur", () => {
      this.emitFlag("window_blur", "medium", "Browser window lost focus");
    });

    // Clipboard paste
    this.addListener(document, "paste", ((e: ClipboardEvent) => {
      const text = e.clipboardData?.getData("text") || "";
      if (text.length > 5) {
        this.emitFlag("external_paste", "medium", `Pasted ${text.length} characters from external source`, {
          contentLength: text.length,
        });
      }
    }) as EventListener);

    // Rapid input detection (>200 chars appearing without keystrokes)
    let lastKeyTime = Date.now();
    let charsSinceLastKey = 0;

    this.addListener(document, "keydown", () => {
      lastKeyTime = Date.now();
      charsSinceLastKey = 0;
    });

    this.addListener(document, "input", ((e: InputEvent) => {
      const timeSinceKey = Date.now() - lastKeyTime;
      if (e.data && timeSinceKey > 500) {
        charsSinceLastKey += e.data.length;
        if (charsSinceLastKey > 200) {
          this.emitFlag("rapid_input", "high", `${charsSinceLastKey} characters appeared without keystrokes (possible AI/paste injection)`);
          charsSinceLastKey = 0;
        }
      }
    }) as EventListener);
  }

  startFullscreenLockdown() {
    // Request fullscreen
    document.documentElement.requestFullscreen?.().catch(() => {
      // Browser may block if not triggered by user gesture
      console.warn("Fullscreen request denied — will monitor without lockdown");
    });

    this.addListener(document, "fullscreenchange", () => {
      if (!document.fullscreenElement) {
        this.emitFlag("fullscreen_exit", "high", "Exited fullscreen mode");
      }
    });
  }

  getTabSwitchCount(): number {
    return this.tabSwitchCount;
  }

  stop() {
    for (const { target, event, handler } of this.listeners) {
      target.removeEventListener(event, handler);
    }
    this.listeners = [];
  }

  private addListener(target: EventTarget, event: string, handler: EventListener) {
    target.addEventListener(event, handler);
    this.listeners.push({ target, event, handler });
  }

  private emitFlag(type: ProctoringFlag["type"], severity: ProctoringFlag["severity"], description: string, metadata?: Record<string, unknown>) {
    const flag: ProctoringFlag = {
      type,
      severity,
      description,
      timestamp: new Date().toISOString(),
      metadata,
    };
    this.flags.push(flag);
    this.onFlag(flag);
  }
}
