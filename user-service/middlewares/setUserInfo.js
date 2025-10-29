export const setUserInfo = (req, res, next) => {
    req.user = {
      userId: req.headers['x-user-id'],
      email: req.headers['x-user-email']
    };
    next();
};