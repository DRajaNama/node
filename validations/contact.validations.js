const contactCreateValidation = (data) => {
    const errors = {};
    if (!data.firstName || data.firstName.trim() === '') {
        errors.firstName = 'First Name is required';
    }
    if (!data.lastName || data.lastName.trim() === '') {
        errors.lastName = 'Last Name is required';
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