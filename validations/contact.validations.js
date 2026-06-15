const contactCreateValidation = (data) => {
    const errors = {};
    if (!data.name || data.name.trim() === '') {
        errors.name = 'Name is required';
    }
    if (!data.mobile || data.mobile.trim() === '') {
        errors.mobile = 'Mobile number is required';
    }
    if (!data.email || data.email.trim() === '') {
        errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(data.email)) {
        errors.email = 'Email is invalid';
    }
    return {
        errors,
        isValid: Object.keys(errors).length === 0
    };
};

module.exports = {
    contactCreateValidation
};