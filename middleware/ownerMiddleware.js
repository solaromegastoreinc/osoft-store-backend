// backend/middleware/ownerMiddleware.js
const ownerMiddleware = (req, res, next) => {
  // Check if user is authenticated and is an owner
  if (req.user && req.user.role === 'owner') {
    next();
  } else {
    res.status(403).json({ 
      success: false, 
      message: 'Forbidden: Only owners can perform this action.' 
    });
  }
};

export default ownerMiddleware;