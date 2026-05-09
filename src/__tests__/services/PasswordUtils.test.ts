import {
  calculatePasswordStrength,
  calculatePasswordGeneratorStrength,
} from '../../utils/passwordUtils';

describe('PasswordUtils', () => {
  describe('calculatePasswordStrength', () => {
    it('should return empty for empty password', () => {
      const result = calculatePasswordStrength('');
      expect(result.score).toBe(0);
      expect(result.label).toBe('');
      expect(result.color).toBe('#e0e0e0');
    });

    it('should rate very short password as weak', () => {
      const result = calculatePasswordStrength('a');
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('should rate simple 4-char password as weak', () => {
      const result = calculatePasswordStrength('abcd');
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('should rate 8-char with mixed case as medium', () => {
      const result = calculatePasswordStrength('Abcd1234');
      expect(result.score).toBeGreaterThanOrEqual(2);
    });

    it('should rate 12-char with all char types as good or excellent', () => {
      const result = calculatePasswordStrength('Abcdef123456!@#');
      expect(result.score).toBeGreaterThanOrEqual(3);
    });

    it('should rate 16-char with all types as excellent', () => {
      const result = calculatePasswordStrength('Abcd1234!@#$EFGH');
      expect(result.score).toBe(4);
      expect(result.label).toBe('excellent');
    });

    it('should detect uppercase characters', () => {
      const withUpper = calculatePasswordStrength('ABCDEFGHIJ12');
      const without = calculatePasswordStrength('abcdefghij12');
      expect(withUpper.score).toBeGreaterThanOrEqual(without.score);
    });

    it('should detect numbers', () => {
      const withNumbers = calculatePasswordStrength('abc12345def');
      const without = calculatePasswordStrength('abcdefghijk');
      expect(withNumbers.score).toBeGreaterThanOrEqual(without.score);
    });

    it('should detect special characters', () => {
      const withSpecial = calculatePasswordStrength('abcd!@#$efgh');
      const without = calculatePasswordStrength('abcdefghijk');
      expect(withSpecial.score).toBeGreaterThanOrEqual(without.score);
    });

    it('should cap score at 4', () => {
      const result = calculatePasswordStrength('Aa1!Aa1!Aa1!Aa1!Aa1!Aa1!');
      expect(result.score).toBeLessThanOrEqual(4);
    });

    it('should return gray for empty password', () => {
      expect(calculatePasswordStrength('').color).toBe('#e0e0e0');
    });

    it('should return red for very weak password', () => {
      const result = calculatePasswordStrength('abcd');
      expect(result.label).toBe('weak');
      expect(result.color).toBe('#ef4444');
    });

    it('should return green for excellent password', () => {
      const result = calculatePasswordStrength('Abcd1234!@#$EFGH');
      expect(result.label).toBe('excellent');
      expect(result.color).toBe('#22c55e');
    });
  });

  describe('calculatePasswordGeneratorStrength', () => {
    const labels = { weak: 'Debole', medium: 'Media', excellent: 'Eccellente' };
    const colors = { weak: '#ef4444', medium: '#f59e0b', excellent: '#22c55e' };

    it('should return weak for short password with few types', () => {
      const result = calculatePasswordGeneratorStrength({
        length: 6,
        includeUppercase: false,
        includeLowercase: true,
        includeNumbers: false,
        includeSymbols: false,
        labels,
        colors,
      });
      expect(result.label).toBe('Debole');
      expect(result.color).toBe('#ef4444');
    });

    it('should return medium for 8-char with mixed types', () => {
      const result = calculatePasswordGeneratorStrength({
        length: 8,
        includeUppercase: true,
        includeLowercase: true,
        includeNumbers: true,
        includeSymbols: false,
        labels,
        colors,
      });
      expect(result.label).toBe('Media');
      expect(result.color).toBe('#f59e0b');
    });

    it('should return excellent for 12+ with all types', () => {
      const result = calculatePasswordGeneratorStrength({
        length: 16,
        includeUppercase: true,
        includeLowercase: true,
        includeNumbers: true,
        includeSymbols: true,
        labels,
        colors,
      });
      expect(result.label).toBe('Eccellente');
      expect(result.color).toBe('#22c55e');
    });
  });
});
