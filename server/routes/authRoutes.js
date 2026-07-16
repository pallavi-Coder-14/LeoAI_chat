import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();

// Register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const exist = await User.findOne({ email });
    if (exist) return res.json({ error: "User exists" });

    const hash = await bcrypt.hash(password, 10);

    await User.create({ name, email, password: hash });
    res.json({ msg: "Registered" });
  } catch {
    res.status(500).json({ error: "Register failed" });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.json({ error: "No user" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.json({ error: "Wrong password" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({ token, name: user.name });
  } catch {
    res.status(500).json({ error: "Login failed" });
  }
});

export default router;
