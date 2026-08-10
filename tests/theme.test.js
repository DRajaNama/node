const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_THEME,
  isValidHexColor,
  normalizeTheme,
  validateTheme,
} = require('../constants/theme.constants');

describe('theme.constants', () => {
  it('defines the expected default palette', () => {
    assert.equal(DEFAULT_THEME.primary, '#2B2E46');
    assert.equal(DEFAULT_THEME.secondary, '#929EB1');
    assert.equal(DEFAULT_THEME.background, '#EFF4F6');
    assert.equal(DEFAULT_THEME.accent, '#F51D38');
    assert.equal(DEFAULT_THEME.accentHover, '#E40024');
  });

  it('validates HEX colors', () => {
    assert.equal(isValidHexColor('#2B2E46'), true);
    assert.equal(isValidHexColor('#fff'), false);
    assert.equal(isValidHexColor('2B2E46'), false);
    assert.equal(isValidHexColor('#GGGGGG'), false);
  });

  it('normalizes partial theme input with defaults', () => {
    const theme = normalizeTheme({ primary: '#111111' });
    assert.equal(theme.primary, '#111111');
    assert.equal(theme.secondary, DEFAULT_THEME.secondary);
    assert.equal(theme.accent, DEFAULT_THEME.accent);
  });

  it('rejects invalid theme values in validateTheme', () => {
    const errors = validateTheme({ primary: 'red', accent: '#12345' });
    assert.ok(errors.length >= 2);
  });

  it('reset defaults remain exact', () => {
    const reset = normalizeTheme({});
    assert.deepEqual(reset, {
      primary: '#2B2E46',
      secondary: '#929EB1',
      background: '#EFF4F6',
      accent: '#F51D38',
      accentHover: '#E40024',
    });
  });
});
