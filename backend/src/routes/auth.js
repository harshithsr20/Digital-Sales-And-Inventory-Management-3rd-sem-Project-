const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const { validateRegisterInput } = require('../utils/validators');

const router = express.Router();

/**
 * POST /api/auth/register
 * Registers a new wholesale business and its initial admin user.
 * Atomic transaction ensures both are created together or neither is.
 */
router.post('/register', async (req, res, next) => {
  try {
    // 1. Input Validation
    const validation = validateRegisterInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
    }

    const {
      businessName,
      gstNumber,
      address,
      businessEmail,
      ownerName, // Included in registration body
      adminEmail,
      password,
    } = req.body;

    const formattedGst = gstNumber.trim().toUpperCase();
    const formattedBizEmail = businessEmail.trim().toLowerCase();
    const formattedAdminEmail = adminEmail.trim().toLowerCase();

    // 2. Duplicate Checks (return HTTP 409 Conflict)
    const existingGst = await prisma.business.findUnique({
      where: { gstNumber: formattedGst },
    });
    if (existingGst) {
      return res.status(409).json({ message: 'A business with this GST number already exists' });
    }

    const existingBizEmail = await prisma.business.findUnique({
      where: { email: formattedBizEmail },
    });
    if (existingBizEmail) {
      return res.status(409).json({ message: 'A business with this email already exists' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: formattedAdminEmail },
    });
    if (existingUser) {
      return res.status(409).json({ message: 'A user with this admin email already exists' });
    }

    // 3. Hash Password (10 salt rounds) — never store or log plain text passwords
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 4. Create Business and User inside a single Prisma Transaction
    const result = await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          name: businessName.trim(),
          gstNumber: formattedGst,
          address: address.trim(),
          email: formattedBizEmail,
        },
      });

      const user = await tx.user.create({
        data: {
          email: formattedAdminEmail,
          passwordHash,
          role: 'admin',
          businessId: business.id,
        },
      });

      return { business, user };
    });

    // 5. Respond with 201 Created (do not expose passwordHash)
    return res.status(201).json({
      message: 'Business and admin user registered successfully',
      business: {
        id: result.business.id,
        name: result.business.name,
        gstNumber: result.business.gstNumber,
        address: result.business.address,
        email: result.business.email,
        createdAt: result.business.createdAt,
      },
      user: {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
        createdAt: result.user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/login
 * Verifies email & password, returns JWT token with user and business info.
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const formattedEmail = email.trim().toLowerCase();

    // Find user by email, including business details
    const user = await prisma.user.findUnique({
      where: { email: formattedEmail },
      include: { business: true },
    });

    // Generic error message if user not found (security best practice)
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Compare provided password with hashed password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token (expires in 1 day)
    const token = jwt.sign(
      {
        userId: user.id,
        businessId: user.businessId,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Return token and safe user + business profile
    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      business: {
        id: user.business.id,
        name: user.business.name,
        gstNumber: user.business.gstNumber,
        email: user.business.email,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

