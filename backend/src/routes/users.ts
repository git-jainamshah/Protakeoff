import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', requireRole(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    const where = req.user!.role === 'SUPER_ADMIN' ? {} : { companyId: user?.companyId || undefined };

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true, name: true, email: true, role: true, avatar: true,
        company: { select: { id: true, name: true } },
        createdAt: true,
        _count: { select: { createdProjects: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.put('/:id/role', requireRole(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role } = req.body;
    const allowed = ['MEMBER', 'ADMIN'];
    if (!allowed.includes(role)) { res.status(400).json({ error: 'Invalid role' }); return; }

    const user = await prisma.user.update({
      where: { id: req.params.id as string },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

router.put('/company', requireRole(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, logo, website, address, phone } = req.body;
    const currentUser = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!currentUser?.companyId) { res.status(400).json({ error: 'No company associated' }); return; }

    const company = await prisma.company.update({
      where: { id: currentUser.companyId },
      data: { name, logo, website, address, phone },
    });
    res.json(company);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update company' });
  }
});

export default router;
