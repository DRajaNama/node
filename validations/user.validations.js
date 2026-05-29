const userRegisterValidation = (data) => {
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
    if (!data.password || data.password.trim() === '') {
        errors.password = 'Password is required';
    } else if (data.password.length < 6) {
        errors.password = 'Password must be at least 6 characters';
    }
    return {
        errors,
        isValid: Object.keys(errors).length === 0
    };
};

const userLoginValidation = (data) => { 
    const errors = {};
    if (!data.email || data.email.trim() === '') {
        errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(data.email)) {  
        errors.email = 'Email is invalid';
    }
    if (!data.password || data.password.trim() === '') {
        errors.password = 'Password is required';
    }
    
    return {
        errors,
        isValid: Object.keys(errors).length === 0
    };
}

// throw error when payload blank by common method



module.exports = {
    userRegisterValidation,
    userLoginValidation
};