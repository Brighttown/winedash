/**
 * Wraps an async Express route handler and forwards any thrown errors
 * to the next() error handler — eliminates repetitive try/catch boilerplate.
 */
export const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
