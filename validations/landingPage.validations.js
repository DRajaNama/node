const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const hasPublishableContent = (html) => {
  if (!html || typeof html !== 'string') return false;
  const stripped = html.replace(/<[^>]*>/g, '').replace(/\s+/g, '').trim();
  return stripped.length > 0;
};

const landingPageCreateValidation = (data) => {
  const errors = {};
  if (!data.name || data.name.trim() === '') {
    errors.name = 'Name is required';
  }
  if (!data.slug || data.slug.trim() === '') {
    errors.slug = 'Slug is required';
  } else if (!slugRegex.test(data.slug.trim().toLowerCase())) {
    errors.slug = 'Slug must contain only lowercase letters, numbers, and hyphens';
  }
  return {
    errors,
    isValid: Object.keys(errors).length === 0,
  };
};

const landingPageUpdateValidation = (data) => {
  const errors = {};
  if (data.name !== undefined && data.name.trim() === '') {
    errors.name = 'Name cannot be empty';
  }
  if (data.slug !== undefined) {
    if (data.slug.trim() === '') {
      errors.slug = 'Slug cannot be empty';
    } else if (!slugRegex.test(data.slug.trim().toLowerCase())) {
      errors.slug = 'Slug must contain only lowercase letters, numbers, and hyphens';
    }
  }
  return {
    errors,
    isValid: Object.keys(errors).length === 0,
  };
};

module.exports = {
  landingPageCreateValidation,
  landingPageUpdateValidation,
  landingPageScheduleValidation: (data) => {
    const errors = {};
    if (!data.scheduledPublishAt) {
      errors.scheduledPublishAt = 'Scheduled date is required';
    } else {
      const scheduled = new Date(data.scheduledPublishAt);
      if (Number.isNaN(scheduled.getTime())) {
        errors.scheduledPublishAt = 'Scheduled date is invalid';
      } else if (scheduled.getTime() <= Date.now()) {
        errors.scheduledPublishAt = 'Scheduled time must be in the future';
      }
    }
    if (data.timezone !== undefined && data.timezone !== null && String(data.timezone).trim() === '') {
      errors.timezone = 'Timezone is required';
    }
    return {
      errors,
      isValid: Object.keys(errors).length === 0,
    };
  },
  landingPagePublishValidation: (data) => {
    const errors = {};
    if (!data.slug || data.slug.trim() === '') {
      errors.slug = 'Slug is required';
    } else if (!slugRegex.test(String(data.slug).trim().toLowerCase())) {
      errors.slug = 'Slug must contain only lowercase letters, numbers, and hyphens';
    }
    if (!hasPublishableContent(data.html)) {
      errors.html = 'Landing page content is required before publishing';
    }
    return {
      errors,
      isValid: Object.keys(errors).length === 0,
    };
  },
  hasPublishableContent,
};
