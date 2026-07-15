/**
 * Preload setup for Jest bootstrap compatibility with Expo SDK 57.
 *
 * This file runs BEFORE jest-expo's setup.js to install the Expo global polyfill
 * and provide a no-op ExpoModulesCoreJSLogger module. This prevents async warnings
 * about missing native modules during the test bootstrap phase.
 *
 * The issue: jest-expo/src/preset/setup.js calls jest.requireActual('expo-modules-core')
 * which triggers setUpJsLogger.fx.ts. That file calls requireOptionalNativeModule('ExpoModulesCoreJSLogger')
 * before globalThis.expo is installed (polyfill happens later in jest-expo's setup).
 * This causes TurboModuleRegistry.get() to fail with "Cannot read properties of undefined (reading 'get')"
 * and logs asynchronously after tests finish.
 *
 * The fix: Install the polyfill and provide a no-op logger module BEFORE jest-expo loads expo-modules-core.
 */

'use strict';

// Install the Expo global polyfill (web implementations of EventEmitter, NativeModule, SharedObject, etc.)
require('expo-modules-core/src/polyfill/dangerous-internal').installExpoGlobalPolyfill();

// Provide a no-op ExpoModulesCoreJSLogger module with addListener method.
// This prevents the async warning when setUpJsLogger.fx.ts tries to require it.
if (globalThis.expo && globalThis.expo.modules) {
  globalThis.expo.modules.ExpoModulesCoreJSLogger = {
    addListener: () => {},
    removeListeners: () => {},
  };
}
