const leadSubmitValidation = (data) => {
  const errors = {};
  if (!data.landingPageId && !data.formPopupId) {
    errors.landingPageId = 'Landing page or form popup is required';
  }
  if (data.email && data.email.trim() !== '' && !/\S+@\S+\.\S+/.test(data.email)) {
    errors.email = 'Email is invalid';
  }
  return {
    errors,
    isValid: Object.keys(errors).length === 0,
  };
};

module.exports = {
  leadSubmitValidation,
};
