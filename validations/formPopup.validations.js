const formPopupCreateValidation = (data) => {
  const errors = {};
  if (!data.name || data.name.trim() === '') {
    errors.name = 'Name is required';
  }
  return {
    errors,
    isValid: Object.keys(errors).length === 0,
  };
};

const formPopupUpdateValidation = (data) => {
  const errors = {};
  if (data.name !== undefined && data.name.trim() === '') {
    errors.name = 'Name cannot be empty';
  }
  return {
    errors,
    isValid: Object.keys(errors).length === 0,
  };
};

module.exports = {
  formPopupCreateValidation,
  formPopupUpdateValidation,
};
