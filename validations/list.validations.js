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
const listAddContactsValidation = (data) => {
    const errors = {};
    if (!data.id || data.id.trim() === '') {
        errors.id = 'List Id is required';
    }
    if (!data.contactsId || data.contactsId.length === 0) {
        errors.contactsId = 'Select Minimum 1 contact';
    }
    return {
        errors,
        isValid: Object.keys(errors).length === 0
    };
};
module.exports = {
    listCreateValidation,
    listAddContactsValidation
};