const DEFAULT_THEME = {
  primary: '#2B2E46',
  secondary: '#929EB1',
  background: '#EFF4F6',
  accent: '#F51D38',
  accentHover: '#E40024',
};

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

const isValidHexColor = (value) => typeof value === 'string' && HEX_COLOR_REGEX.test(value.trim());

const normalizeTheme = (input = {}) => {
  const source = input || {};
  const normalized = { ...DEFAULT_THEME };

  Object.keys(DEFAULT_THEME).forEach((key) => {
    const value = source[key];
    if (isValidHexColor(value)) {
      normalized[key] = value.trim().toUpperCase();
    }
  });

  return normalized;
};

const validateTheme = (input = {}) => {
  const errors = [];
  Object.keys(DEFAULT_THEME).forEach((key) => {
    const value = input[key];
    if (value === undefined || value === null || value === '') {
      return;
    }
    if (!isValidHexColor(value)) {
      errors.push(`${key} must be a valid HEX color (e.g. #2B2E46)`);
    }
  });
  return errors;
};

module.exports = {
  DEFAULT_THEME,
  HEX_COLOR_REGEX,
  isValidHexColor,
  normalizeTheme,
  validateTheme,
};
