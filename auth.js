const jwt = require("jsonwebtoken");
const User = require("./models/User");
require("dotenv").config();

const SECRET_KEY = process.env.JWT_SECRET;

async function authenticate(username, password) {
  const user = await User.findOne({ username });
  if (!user) return null;

  const isMatch = await user.comparePassword(password);
  if (!isMatch) return null;

  const token = jwt.sign({ username: user.username }, SECRET_KEY, { expiresIn: "1h" });
  return token;
}

function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET_KEY);
  } catch {
    return null;
  }
}

module.exports = { authenticate, verifyToken };
