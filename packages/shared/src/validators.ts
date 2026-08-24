/**
 * Password validation rules
 */
export interface PasswordValidation {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  isValid: boolean;
}

export function validatePassword(password: string): PasswordValidation {
  const minLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  return {
    minLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    isValid: minLength && hasUppercase && hasLowercase && hasNumber,
  };
}

export function passwordsMatch(password: string, confirmation: string): boolean {
  return password === confirmation && password.length > 0;
}
