export const setUserInfo = (req, res, next) => {
    try {
      req.user = {
        userId: req.headers['x-user-id'],
        email: req.headers['x-user-email']
      };
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Error setting user info' });
    }
};