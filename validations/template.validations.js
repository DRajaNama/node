const templateCreateValidation = (data) => {
    const errors = {};

    if (!data.title || data.title.trim() === '') {
        errors.title = 'Title is required';
    }

    if (!data.description || data.description.trim() === '') {
        errors.description = 'Description is required';
    }

    if (!data.categoryId || data.categoryId.trim() === '') {
        errors.categoryId = 'CategoryId is required';
    }

    if (!data.templateId || data.templateId.trim() === '') {
        errors.templateId = 'Template is required';
    }

    if (data.status && ![true, false].includes(data.status)) {
        errors.status = 'Status must be either True or False';
    }

    return {
        errors,
        isValid: Object.keys(errors).length === 0
    };
};

const templateUpdateValidation = (data) => {
    const errors = {};

    if (data.title && data.title.trim() === '') {
        errors.title = 'Title cannot be empty';
    }

    if (data.description && data.description.trim() === '') {
        errors.description = 'Description cannot be empty';
    }

    if (data.categoryId && data.categoryId.trim() === '') {
        errors.categoryId = 'CategoryId cannot be empty';
    }

    if (data.templateId && data.templateId.trim() === '') {
        errors.templateId = 'TemplateId cannot be empty';
    }

    if (data.status && ![true, false].includes(data.status)) {
        errors.status = 'Status must be either True or False';
    }

    return {
        errors,
        isValid: Object.keys(errors).length === 0
    };
};

module.exports = {
    templateCreateValidation,
    templateUpdateValidation
};