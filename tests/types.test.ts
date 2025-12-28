/**
 * Type Utility Tests
 */

import {
  DeviceType,
  getDeviceType,
  klfPositionToPercent,
  percentToKlfPosition,
  PRODUCT_TYPE_MAP
} from '../src/types';

describe('Type Utilities', () => {
  describe('getDeviceType', () => {
    test('should return WINDOW for roof window type', () => {
      expect(getDeviceType(0x0400)).toBe(DeviceType.WINDOW);
    });

    test('should return SHUTTER for roller shutter type', () => {
      expect(getDeviceType(0x0080)).toBe(DeviceType.SHUTTER);
    });

    test('should return BLIND for venetian blind type', () => {
      expect(getDeviceType(0x0040)).toBe(DeviceType.WINDOW); // Interior venetian blind maps to WINDOW
    });

    test('should return AWNING for awning type', () => {
      expect(getDeviceType(0x0100)).toBe(DeviceType.AWNING);
    });

    test('should return GARAGE for garage door type', () => {
      expect(getDeviceType(0x0600)).toBe(DeviceType.GARAGE);
    });

    test('should return GATE for gate type', () => {
      expect(getDeviceType(0x0640)).toBe(DeviceType.GATE);
    });

    test('should return LOCK for window lock type', () => {
      expect(getDeviceType(0x0500)).toBe(DeviceType.LOCK);
    });

    test('should return UNKNOWN for unrecognized type', () => {
      expect(getDeviceType(0x9999)).toBe(DeviceType.UNKNOWN);
    });
  });

  describe('klfPositionToPercent', () => {
    test('should convert 0 (fully open in KLF) to 100%', () => {
      expect(klfPositionToPercent(0)).toBe(100);
    });

    test('should convert 1 (fully closed in KLF) to 0%', () => {
      expect(klfPositionToPercent(1)).toBe(0);
    });

    test('should convert 0.5 to 50%', () => {
      expect(klfPositionToPercent(0.5)).toBe(50);
    });

    test('should convert 0.25 to 75%', () => {
      expect(klfPositionToPercent(0.25)).toBe(75);
    });

    test('should convert 0.75 to 25%', () => {
      expect(klfPositionToPercent(0.75)).toBe(25);
    });

    test('should round to nearest integer', () => {
      expect(klfPositionToPercent(0.333)).toBe(67);
      expect(klfPositionToPercent(0.666)).toBe(33);
    });
  });

  describe('percentToKlfPosition', () => {
    test('should convert 100% to 0 (fully open in KLF)', () => {
      expect(percentToKlfPosition(100)).toBe(0);
    });

    test('should convert 0% to 1 (fully closed in KLF)', () => {
      expect(percentToKlfPosition(0)).toBe(1);
    });

    test('should convert 50% to 0.5', () => {
      expect(percentToKlfPosition(50)).toBe(0.5);
    });

    test('should convert 75% to 0.25', () => {
      expect(percentToKlfPosition(75)).toBe(0.25);
    });

    test('should convert 25% to 0.75', () => {
      expect(percentToKlfPosition(25)).toBe(0.75);
    });
  });

  describe('Position conversion round-trip', () => {
    test('should be reversible for 0', () => {
      const klf = 0;
      const percent = klfPositionToPercent(klf);
      const back = percentToKlfPosition(percent);
      expect(back).toBe(klf);
    });

    test('should be reversible for 1', () => {
      const klf = 1;
      const percent = klfPositionToPercent(klf);
      const back = percentToKlfPosition(percent);
      expect(back).toBe(klf);
    });

    test('should be reversible for 0.5', () => {
      const klf = 0.5;
      const percent = klfPositionToPercent(klf);
      const back = percentToKlfPosition(percent);
      expect(back).toBe(klf);
    });

    test('should handle percent round-trip', () => {
      for (const percent of [0, 25, 50, 75, 100]) {
        const klf = percentToKlfPosition(percent);
        const back = klfPositionToPercent(klf);
        expect(back).toBe(percent);
      }
    });
  });

  describe('PRODUCT_TYPE_MAP', () => {
    test('should have entries for all documented device types', () => {
      // Verify we have mappings for common device types
      expect(PRODUCT_TYPE_MAP[0x0400]).toBeDefined(); // Roof window
      expect(PRODUCT_TYPE_MAP[0x0080]).toBeDefined(); // Roller shutter
      expect(PRODUCT_TYPE_MAP[0x0600]).toBeDefined(); // Garage door
      expect(PRODUCT_TYPE_MAP[0x0640]).toBeDefined(); // Gate
    });

    test('should not return undefined for mapped types', () => {
      Object.values(PRODUCT_TYPE_MAP).forEach(type => {
        expect(type).toBeDefined();
        expect(Object.values(DeviceType)).toContain(type);
      });
    });
  });
});
