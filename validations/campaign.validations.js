const campaignCreateValidation = (data) => {
    const errors = {};

    if (!data.name || data.name.trim() === '') {
        errors.name = 'Campaign name is required';
    }

    if (!data.subject || data.subject.trim() === '') {
        errors.subject = 'Subject is required';
    }

    if (!data.fromName || data.fromName.trim() === '') {
        errors.fromName = 'From name is required';
    }

    if (!data.fromEmail || data.fromEmail.trim() === '') {
        errors.fromEmail = 'From email is required';
    } else if (!/\S+@\S+\.\S+/.test(data.fromEmail)) {
        errors.fromEmail = 'From email is invalid';
    }

    if (!data.templateId || data.templateId.trim() === '') {
        errors.templateId = 'Template is required';
    }

    if (!data.listIds || data.listIds.length === 0) {
        errors.listIds = 'At least one list is required';
    }

    if (data.sendType && !['now', 'schedule'].includes(data.sendType)) {
        errors.sendType = 'Invalid send type';
    }

    if (data.sendType === 'schedule' && !data.scheduledAt) {
        errors.scheduledAt = 'Scheduled date is required';
    }

    return {
        errors,
        isValid: Object.keys(errors).length === 0
    };
};


module.exports = {
    campaignCreateValidation
};