import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { signToken } from '../lib/jwt.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, companyName } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: 'Name, email, and password are required' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const hashed = await bcrypt.hash(password, 12);

    let company = null;
    if (companyName) {
      company = await prisma.company.create({ data: { name: companyName } });
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        role: company ? 'ADMIN' : 'MEMBER',
        companyId: company?.id || null,
      },
      select: { id: true, name: true, email: true, role: true, avatar: true, company: { select: { id: true, name: true } } },
    });

    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { company: { select: { id: true, name: true, logo: true } } },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    const { password: _pw, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true, name: true, email: true, role: true, avatar: true,
        company: { select: { id: true, name: true, logo: true, plan: true } },
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.put('/me', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, avatar } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { name, avatar },
      select: { id: true, name: true, email: true, role: true, avatar: true },
    });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Update failed' });
  }
});

router.put('/me/password', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }
    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.user!.userId }, data: { password: hashed } });
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Password update failed' });
  }
});

export default router;
