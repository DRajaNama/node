const templateCategoryCreateValidation = (data) => {
    const errors = {};

    if (!data.title || data.title.trim() === '') {
        errors.title = 'Title is required';
    }

    if (!data.description || data.description.trim() === '') {
        errors.description = 'Description is required';
    }

    if (data.status && !['active', 'inactive'].includes(data.status)) {
        errors.status = 'Status must be either active or inactive';
    }

    return {
        errors,
        isValid: Object.keys(errors).length === 0
    };
};

const templateCategoryUpdateValidation = (data) => {
    const errors = {};

    if (data.title && data.title.trim() === '') {
        errors.title = 'Title cannot be empty';
    }

    if (data.description && data.description.trim() === '') {
        errors.description = 'Description cannot be empty';
    }

    if (data.status && !['active', 'inactive'].includes(data.status)) {
        errors.status = 'Status must be either active or inactive';
    }

    return {
        errors,
        isValid: Object.keys(errors).length === 0
    };
};

module.exports = {
    templateCategoryCreateValidation,
    templateCategoryUpdateValidation
};