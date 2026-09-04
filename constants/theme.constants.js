const DEFAULT_THEME = {
  primary: '#2B2E46',
  secondary: '#929EB1',
  accent: '#F51D38',
  background: '#EFF4F6',
  surface: '#FFFFFF',
  textPrimary: '#2B2E46',
  textSecondary: '#929EB1',
  textMuted: '#929EB1',
  border: '#D5DCE3',
  inputBackground: '#FFFFFF',
  buttonBackground: '#2B2E46',
  buttonText: '#FFFFFF',
  buttonHover: '#E40024',
  buttonActive: '#B8001D',
  buttonDisabled: '#B8C4D0',
  link: '#2B2E46',
  success: '#15803D',
  warning: '#A16207',
  error: '#B91C1C',
  info: '#1D4ED8',
  disabled: '#94A3B8',
  focus: '#F51D38',
  accentHover: '#E40024',
};

const THEME_PALETTES = {
  default: { name: 'Default Theme', colors: DEFAULT_THEME },
  ocean: { name: 'Ocean Blue', colors: { ...DEFAULT_THEME, primary: '#0F4C81', secondary: '#5B7896', accent: '#00A6A6', background: '#F1F7FB', surface: '#FFFFFF', textPrimary: '#123047', textSecondary: '#496579', textMuted: '#6B8495', border: '#C9DCE8', buttonBackground: '#0F4C81', buttonHover: '#0B3A63', buttonActive: '#082B4A', link: '#0B5CAD', focus: '#00A6A6' } },
  purple: { name: 'Modern Purple', colors: { ...DEFAULT_THEME, primary: '#552B8A', secondary: '#786A92', accent: '#C241A1', background: '#FAF7FC', surface: '#FFFFFF', textPrimary: '#2E1D43', textSecondary: '#645575', textMuted: '#887A98', border: '#DDD2E8', buttonBackground: '#552B8A', buttonHover: '#43216D', buttonActive: '#341A54', link: '#7A2F9E', focus: '#C241A1' } },
  emerald: { name: 'Emerald Green', colors: { ...DEFAULT_THEME, primary: '#135C4A', secondary: '#5A7D72', accent: '#D97706', background: '#F2F9F5', surface: '#FFFFFF', textPrimary: '#173B31', textSecondary: '#557267', textMuted: '#758F85', border: '#C9DFD5', buttonBackground: '#135C4A', buttonHover: '#0D4638', buttonActive: '#09352A', link: '#087F5B', focus: '#D97706' } },
  sunset: { name: 'Sunset Orange', colors: { ...DEFAULT_THEME, primary: '#8A3B12', secondary: '#92725F', accent: '#D94841', background: '#FFF8F3', surface: '#FFFFFF', textPrimary: '#4A2415', textSecondary: '#765B4C', textMuted: '#987E70', border: '#E8D5C9', buttonBackground: '#8A3B12', buttonHover: '#6C2D0D', buttonActive: '#512209', link: '#B33A2B', focus: '#D94841' } },
  rose: { name: 'Rose Pink', colors: { ...DEFAULT_THEME, primary: '#8F204B', secondary: '#966B7D', accent: '#C0266D', background: '#FFF6FA', surface: '#FFFFFF', textPrimary: '#4A1D31', textSecondary: '#765667', textMuted: '#987A89', border: '#E8D2DD', buttonBackground: '#8F204B', buttonHover: '#71183B', buttonActive: '#55132D', link: '#A61E55', focus: '#C0266D' } },
  indigo: { name: 'Indigo', colors: { ...DEFAULT_THEME, primary: '#293B7A', secondary: '#6B789F', accent: '#4F7CAC', background: '#F4F6FC', surface: '#FFFFFF', textPrimary: '#202C54', textSecondary: '#596887', textMuted: '#7C89A5', border: '#D2D9EA', buttonBackground: '#293B7A', buttonHover: '#202F62', buttonActive: '#18244A', link: '#2F5FB3', focus: '#4F7CAC' } },
  teal: { name: 'Teal', colors: { ...DEFAULT_THEME, primary: '#075E63', secondary: '#5E7F82', accent: '#D97706', background: '#F1FAFA', surface: '#FFFFFF', textPrimary: '#123E42', textSecondary: '#537175', textMuted: '#769094', border: '#C8DFE0', buttonBackground: '#075E63', buttonHover: '#05494D', buttonActive: '#03383B', link: '#087F8C', focus: '#D97706' } },
  dark: { name: 'Professional Dark', colors: { ...DEFAULT_THEME, primary: '#E2E8F0', secondary: '#94A3B8', accent: '#38BDF8', background: '#0F172A', surface: '#1E293B', textPrimary: '#F8FAFC', textSecondary: '#CBD5E1', textMuted: '#94A3B8', border: '#334155', inputBackground: '#0B1220', buttonBackground: '#38BDF8', buttonText: '#082032', buttonHover: '#0EA5E9', buttonActive: '#0284C7', buttonDisabled: '#475569', link: '#7DD3FC', success: '#4ADE80', warning: '#FACC15', error: '#F87171', info: '#60A5FA', disabled: '#64748B', focus: '#38BDF8', accentHover: '#0EA5E9' } },
  neutral: { name: 'Minimal Neutral', colors: { ...DEFAULT_THEME, primary: '#30343B', secondary: '#68717D', accent: '#52606D', background: '#F7F8FA', surface: '#FFFFFF', textPrimary: '#252A31', textSecondary: '#59636F', textMuted: '#7A8490', border: '#D9DEE5', buttonBackground: '#30343B', buttonHover: '#20242A', buttonActive: '#16191D', link: '#3D637F', focus: '#52606D', success: '#287D4B', warning: '#946B16', error: '#B33A3A', info: '#356AA0' } },
};

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

const isValidHexColor = (value) => typeof value === 'string' && HEX_COLOR_REGEX.test(value.trim());

const normalizeTheme = (input = {}) => {
  const source = input || {};
  const paletteId = Object.prototype.hasOwnProperty.call(THEME_PALETTES, source.paletteId) ? source.paletteId : 'default';
  const normalized = { paletteId, ...THEME_PALETTES[paletteId].colors };

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
  if (input.paletteId !== undefined && !Object.prototype.hasOwnProperty.call(THEME_PALETTES, input.paletteId)) errors.push('paletteId is invalid');
  return errors;
};

module.exports = {
  DEFAULT_THEME,
  THEME_PALETTES,
  HEX_COLOR_REGEX,
  isValidHexColor,
  normalizeTheme,
  validateTheme,
};
