const listCreateValidation = (data) => {
    const errors = {};
    if (!data.name || data.name.trim() === '') {
        errors.name = 'List Name is required';
    }
    if (!data.description || data.description.trim() === '') {
        errors.description = 'Description is required';
    }
    if (!data.type || data.type.trim() === '') {
        errors.type = 'Type is required';
    }
    if (typeof data.isArchived !== 'boolean') {
        errors.isArchived = 'isArchived is required';
    }
    return {
        errors,
        isValid: Object.keys(errors).length === 0
    };
};

module.exports = {
    listCreateValidation
};