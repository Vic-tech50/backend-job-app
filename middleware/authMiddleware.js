const jwt = require("jsonwebtoken");
require("dotenv").config();

function authenticate(req, res, next) {
  const header = req.header("Authorization");
  if (!header) return res.status(401).json({ message: "Access denied. No token provided." });

  const token = header.replace("Bearer ", "");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // attach user data
    next();
  } catch (err) {
    res.status(400).json({ message: "Invalid token" });
  }
}

module.exports = authenticate;