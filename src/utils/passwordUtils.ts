/**
 * Utilities for password strength calculation and related operations
 */

export interface PasswordStrength {
  score: number;
  label: string;
  color: string;
}

export interface PasswordGeneratorStrength {
  label: string;
  color: string;
}

export interface PasswordGeneratorStrengthMap {
  weak: string;
  medium: string;
  excellent: string;
}

export interface PasswordGeneratorStrengthInput {
  length: number;
  includeUppercase: boolean;
  includeLowercase: boolean;
  includeNumbers: boolean;
  includeSymbols: boolean;
  labels: PasswordGeneratorStrengthMap;
  colors: PasswordGeneratorStrengthMap;
}

export function calculatePasswordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: '', color: '#e0e0e0' };

  // Evaluation criteria
  let score = 0;

  // Length (maximum 4 points)
  if (password.length >= 4) score += 1;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  // Complexity (maximum 4 points)
  if (/[A-Z]/.test(password)) score += 1; // Uppercase letters
  if (/[a-z]/.test(password)) score += 1; // Lowercase letters
  if (/[0-9]/.test(password)) score += 1; // Numbers
  if (/[^A-Za-z0-9]/.test(password)) score += 1; // Special characters

  // Normalize the score to a 0-4 scale
  const normalizedScore = Math.min(4, Math.floor(score / 2));

  // Define the color and label from the score
  let color = '';
  let label = '';

  switch (normalizedScore) {
    case 0:
      color = '#e0e0e0'; // Grigio
      label = '';
      break;
    case 1:
      color = '#ef4444'; // Rosso
      label = 'weak';
      break;
    case 2:
      color = '#f59e0b'; // Giallo/arancione
      label = 'medium';
      break;
    case 3:
      color = '#3b82f6'; // Blu
      label = 'good';
      break;
    case 4:
      color = '#22c55e'; // Verde
      label = 'excellent';
      break;
    default:
      color = '#e0e0e0';
      label = '';
  }

  return { score: normalizedScore, label, color };
}

export function calculatePasswordGeneratorStrength(
  input: PasswordGeneratorStrengthInput,
): PasswordGeneratorStrength {
  const {
    length,
    includeUppercase,
    includeLowercase,
    includeNumbers,
    includeSymbols,
    labels,
    colors,
  } = input;

  let strength = 0;

  if (length >= 12) {
    strength += 2;
  } else if (length >= 8) {
    strength += 1;
  }

  if (includeUppercase) strength += 1;
  if (includeLowercase) strength += 1;
  if (includeNumbers) strength += 1;
  if (includeSymbols) strength += 2;

  if (strength >= 6) {
    return { label: labels.excellent, color: colors.excellent };
  }

  if (strength >= 4) {
    return { label: labels.medium, color: colors.medium };
  }

  return { label: labels.weak, color: colors.weak };
}
