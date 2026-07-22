import React from 'react';
import { Platform } from 'react-native';

/**
 * Utility for applying React Native Web-specific CSS fixes
 */
export class WebScrollFix {
  private static isApplied = false;

  /**
   * Applies CSS fixes for web scrolling
   */
  static applyScrollFix() {
    if (Platform.OS !== 'web' || this.isApplied) return;

    const style = document.createElement('style');
    style.id = 'rn-web-scroll-fix';
    style.textContent = `
      /* Keep the application root stable without overriding component layout. */
      html, body, #root {
        width: 100%;
        min-height: 100%;
        margin: 0;
      }

      /* Optional scroll containers can opt into a consistent web scrollbar. */
      .rn-scrollable {
        -webkit-overflow-scrolling: touch;
      }

      .rn-scrollable::-webkit-scrollbar {
        width: 8px;
      }

      .rn-scrollable::-webkit-scrollbar-track {
        background: rgba(0,0,0,0.1);
        border-radius: 4px;
      }

      .rn-scrollable::-webkit-scrollbar-thumb {
        background: rgba(0,0,0,0.3);
        border-radius: 4px;
      }

      .rn-scrollable::-webkit-scrollbar-thumb:hover {
        background: rgba(0,0,0,0.5);
      }

      /* Preserve native vertical gestures without affecting nested controls. */
      html, body {
        touch-action: pan-y;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
        -webkit-tap-highlight-color: transparent;
      }

      /* Allow text selection in copy-oriented content. */
      p, span, div[class*="text"], div[class*="paragraph"] {
        -webkit-user-select: text;
        user-select: text;
      }
    `;

    document.head.appendChild(style);
    this.isApplied = true;
  }

  /**
   * Removes CSS fixes during cleanup
   */
  static removeScrollFix() {
    if (Platform.OS !== 'web' || !this.isApplied) return;

    const style = document.getElementById('rn-web-scroll-fix');
    if (style) {
      document.head.removeChild(style);
      this.isApplied = false;
    }
  }
}

/**
 * Applies the web root and scrolling safeguards once.
 */
export const useWebScrollFix = () => {
  React.useEffect(() => {
    if (Platform.OS === 'web') {
      WebScrollFix.applyScrollFix();
    }
    // Do not remove fixes on unmount because other components may still need them
  }, []);
};
