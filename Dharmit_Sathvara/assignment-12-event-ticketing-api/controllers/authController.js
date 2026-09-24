const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/firebaseConfig');

/**
 * Generate a signed JWT token for a user.
 * @param {Object} user - User object with id, role, email.
 * @returns {string} Signed JWT.
 */
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

/**
 * POST /api/auth/register
 * Register a new user as 'organizer' or 'attendee'.
 * Hashes password, checks email uniqueness, creates user doc, returns JWT.
 */
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    // Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: name, email, password, role',
      });
    }

    // Validate role
    if (!['organizer', 'attendee'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Role must be either 'organizer' or 'attendee'",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    // Check email uniqueness
    const existingQuery = await db
      .collection('users')
      .where('email', '==', email.toLowerCase())
      .limit(1)
      .get();

    if (!existingQuery.empty) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists',
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user document
    const userRef = db.collection('users').doc();
    const userId = userRef.id;
    const now = new Date().toISOString();

    const newUser = {
      id: userId,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      role,
      createdAt: now,
    };

    await userRef.set(newUser);

    // Generate JWT
    const token = generateToken({ id: userId, role, email: newUser.email });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        user: {
          id: userId,
          name: newUser.name,
          email: newUser.email,
          role,
          createdAt: now,
        },
        token,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 * Authenticate user with email + password. Returns JWT on success.
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Find user by email
    const userQuery = await db
      .collection('users')
      .where('email', '==', email.toLowerCase().trim())
      .limit(1)
      .get();

    if (userQuery.empty) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const userDoc = userQuery.docs[0];
    const userData = userDoc.data();

    // Compare password
    const isMatch = await bcrypt.compare(password, userData.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Generate JWT
    const token = generateToken({
      id: userData.id,
      role: userData.role,
      email: userData.email,
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: userData.id,
          name: userData.name,
          email: userData.email,
          role: userData.role,
          createdAt: userData.createdAt,
        },
        token,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/profile
 * Returns the authenticated user's profile (no passwordHash).
 */
exports.getProfile = async (req, res, next) => {
  try {
    const userDoc = await db.collection('users').doc(req.user.id).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found',
      });
    }

    const userData = userDoc.data();
    // Exclude sensitive fields
    const { passwordHash, ...profile } = userData;

    return res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (err) {
    next(err);
  }
};
