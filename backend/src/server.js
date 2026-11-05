// DukaanHub Backend Server Entry Point
const path = require('path');
// Automatically look for .env in backend/ or the project root
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const authMiddleware = require('./middleware/authMiddleware');
const prisma = require('./prisma');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable Cross-Origin Resource Sharing (CORS) for frontend clients
app.use(cors());

// Parse incoming JSON request bodies
app.use(express.json());

// Root health check route
app.get('/', (req, res) => {
  res.json({ message: 'DukaanHub Backend API is up and running' });
});

// Mount authentication routes at /api/auth
app.use('/api/auth', authRoutes);

/**
 * GET /api/me
 * Protected test route verifying JWT authMiddleware.
 * Returns the currently authenticated user's profile and business details.
 */
app.get('/api/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        business: {
          select: {
            id: true,
            name: true,
            gstNumber: true,
            address: true,
            email: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({
      user,
    });
  } catch (error) {
    next(error);
  }
});

// 404 handler for undefined endpoints
app.use((req, res) => {
  res.status(404).json({ message: 'Resource not found' });
});

// Global Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err);
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    message: err.message || 'Internal server error',
  });
});

// Start Express HTTP Server when executed directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

module.exports = app;

