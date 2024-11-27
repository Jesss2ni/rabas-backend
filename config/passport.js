const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db = require('./database');
require('dotenv').config();

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    done(null, rows[0]);
  } catch (error) {
    done(error, null);
  }
});

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const [existingUser] = await db.query(
        'SELECT * FROM users WHERE google_id = ?', 
        [profile.id]
      );

      if (existingUser.length) {
        return done(null, existingUser[0]);
      }

      const [result] = await db.query(
        'INSERT INTO users (google_id, email, name) VALUES (?, ?, ?)',
        [profile.id, profile.emails[0].value, profile.displayName]
      );

      const [newUser] = await db.query(
        'SELECT * FROM users WHERE id = ?',
        [result.insertId]
      );

      done(null, newUser[0]);
    } catch (error) {
      done(error, null);
    }
  }
));

module.exports = passport; 