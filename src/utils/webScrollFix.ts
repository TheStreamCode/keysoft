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
      /* Fix per ScrollView in React Native Web */
      .rn-scrollable,
      div[style*="overflow: hidden"] {
        overflow-y: auto !important;
        -webkit-overflow-scrolling: touch !important;
        height: 100% !important;
        max-height: 100vh !important;
      }

      /* Fix per contenuti scrollabili */
      .scroll-content {
        min-height: calc(100vh + 200px) !important;
        padding-bottom: 50px !important; /* Riduciamo il padding */
      }

      /* Fix generale per scroll su RN Web */
      .rn-view[style*="overflow: hidden"] {
        overflow: visible !important;
      }

      /* Force scroll per SafeAreaView e contenitori */
      .rn-view[style*="flex: 1"] {
        height: 100% !important;
        overflow-y: auto !important;
      }

      /* Fix specifico per Privacy Policy */
      div[style*="flex: 1"][style*="backgroundColor"] {
        max-height: 100vh !important;
        overflow-y: auto !important;
      }

      /* Hide scrollbars on Chrome/Safari when desired */
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

      /* Fix per device touch */
      html, body {
        touch-action: pan-y !important;
        -webkit-user-select: none;
        -webkit-touch-callout: none;
        -webkit-tap-highlight-color: transparent;
      }

      /* Allow text selection only where needed */
      p, span, div[class*="text"], div[class*="paragraph"] {
        -webkit-user-select: text !important;
        user-select: text !important;
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
 * Hook per applicare automaticamente i fix di scroll
 */
export const useWebScrollFix = () => {
  // Apply fixes when the component mounts on web
  React.useEffect(() => {
    if (Platform.OS === 'web') {
      WebScrollFix.applyScrollFix();
    }
    // Do not remove fixes on unmount because other components may still need them
  }, []);
};
