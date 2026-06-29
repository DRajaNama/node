const Message = {

    // =========================
    // CONTROLLERS
    // =========================
    AUTH_CONTROLLER: 'AuthController',
    USER_CONTROLLER: 'UserController',
    AI_CONTROLLER: 'AIController',
    CONTACT_CONTROLLER: 'ContactController',
    LIST_CONTROLLER: 'ListController',
    TEMPLATE_CATEGORY_CONTROLLER: 'TemplateCategoryController',

    // =========================
    // LOGGING
    // =========================
    LOG_START: 'LOG_START',
    LOG_END: 'LOG_END',
    ERROR_IN: 'Error In',
    SUCCESS: 'Success',

    // =========================
    // AUTH / USER
    // =========================
    USER_NOT_FOUND: 'User not found',
    INVALID_CREDENTIALS: 'Invalid credentials',
    USER_CREATED: 'User created successfully',
    USER_FOUND: 'User found successfully',
    USER_DELETED: 'User deleted successfully',
    USER_UPDATED: 'User updated successfully',
    EMAIL_ALREADY_EXISTS: 'Email already exists',
    LOGIN_SUCCESS: 'Login successful',
    LOGIN_ATTEMPT: 'Login attempt',
    REGISTRATION_ATTEMPT: 'Registration attempt',
    FETCHING_USER_INFO: 'Fetching user info',
    DELETE_USER_ATTEMPT: 'Delete User Attempt',
    UPDATE_USER_ATTEMPT: 'Update User Attempt',
    GET_ALL_USERS_ATTEMPT: 'Get All Users Attempt',

    FAILED_TO_AUTHENTICATE: 'Failed to authenticate token',
    NO_TOKEN_PROVIDED: 'No token provided',
    ADMIN_ONLY: 'Admin access required',

    // =========================
    // GENERAL ERRORS
    // =========================
    SERVER_ERROR: 'Server error',
    VALIDATION_ERROR: 'Validation error',
    EMPTY_FIELD: 'Field cannot be empty',
    ID_IS_REQUIRED: 'ID is required',
    QUERY_REQUIRED: 'Query is required',
    IS_REQUIRED: 'is required',

    MONGODB_CONNECTION_ERROR: 'MongoDB connection error',
    MONGODB_CONNECTED: 'MongoDB connected',

    // =========================
    // COMMON CRUD
    // =========================
    DATA_FOUND: 'Data found successfully',
    DATA_NOT_FOUND: 'Data not found',

    CREATE_ATTEMPT: 'Create attempt',
    FETCHING_RECORD: 'Fetching record',
    DELETE_RECORD_ATTEMPT: 'Delete Record Attempt',
    UPDATE_RECORD_ATTEMPT: 'Update Record Attempt',
    GET_ALL_RECORD_ATTEMPT: 'Get All Records Attempt',

    RECORD_CREATED: 'Record created successfully',
    RECORD_UPDATED: 'Record updated successfully',
    DUPLICATE_RECORD: 'Record already exists',

    UPLOAD_FILE: 'Upload File',
    UPLOADED_CONTACT_SUCCESS: 'Upload contact successfully',

    ADD_LIST_CONTACTS: 'Add List Contacts',
    REMOVE_LIST_CONTACTS: 'Remove List Contacts',

    AI_SEARCH: 'AI search',
    AI_SEARCH_ATTEMPT: 'AI Search Attempt',

    // =========================
    // TEMPLATE CATEGORY
    // =========================
    TEMPLATE_CATEGORY_CREATED: 'Template category created successfully',
    TEMPLATE_CATEGORY_UPDATED: 'Template category updated successfully',
    TEMPLATE_CATEGORY_DELETED: 'Template category deleted successfully',
    TEMPLATE_CATEGORY_FOUND: 'Template category fetched successfully',
    TEMPLATE_CATEGORY_NOT_FOUND: 'Template category not found',
    GET_ALL_TEMPLATE_CATEGORY_ATTEMPT: 'Get All Template Categories Attempt',
    TEMPLATE_CATEGORY_CREATE_ATTEMPT: 'Template Category Create Attempt',
    TEMPLATE_CATEGORY_UPDATE_ATTEMPT: 'Template Category Update Attempt',
    TEMPLATE_CATEGORY_DELETE_ATTEMPT: 'Template Category Delete Attempt',
    TEMPLATE_CATEGORY_FETCH_ATTEMPT: 'Template Category Fetch Attempt',

};

module.exports = Message;