import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const memberships = await prisma.projectMember.findMany({
      where: { userId: req.user!.userId },
      include: {
        project: {
          include: {
            company: { select: { id: true, name: true } },
            _count: { select: { documents: true, members: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const ownedProjects = await prisma.project.findMany({
      where: { createdById: req.user!.userId },
      include: {
        company: { select: { id: true, name: true } },
        _count: { select: { documents: true, members: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const memberProjects = memberships.map((m) => ({
      ...m.project,
      memberRole: m.role,
    }));

    const all = [
      ...ownedProjects.map((p) => ({ ...p, memberRole: 'ADMIN' })),
      ...memberProjects.filter((mp) => !ownedProjects.find((op) => op.id === mp.id)),
    ];

    res.json(all);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, address, clientName } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Project name is required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { company: true },
    });

    if (!user?.companyId) {
      res.status(400).json({ error: 'You must be associated with a company to create projects' });
      return;
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
        address,
        clientName,
        companyId: user.companyId,
        createdById: req.user!.userId,
      },
      include: {
        company: { select: { id: true, name: true } },
        _count: { select: { documents: true, members: true } },
      },
    });

    await prisma.projectMember.create({
      data: { projectId: project.id, userId: req.user!.userId, role: 'ADMIN' },
    });

    res.status(201).json({ ...project, memberRole: 'ADMIN' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        company: { select: { id: true, name: true, logo: true } },
        createdBy: { select: { id: true, name: true, email: true, avatar: true } },
        members: {
          include: { user: { select: { id: true, name: true, email: true, avatar: true, role: true } } },
        },
        documents: { orderBy: { createdAt: 'desc' } },
        _count: { select: { documents: true, members: true } },
      },
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const membership = project.members.find((m) => m.userId === req.user!.userId);
    const isOwner = project.createdById === req.user!.userId;
    if (!membership && !isOwner && req.user!.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json({ ...project, memberRole: membership?.role || 'ADMIN' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, address, clientName, status } = req.body;

    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: req.params.id, userId: req.user!.userId } },
    });
    if (!membership || membership.role === 'VIEW') {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: { name, description, address, clientName, status },
      include: { company: { select: { id: true, name: true } } },
    });
    res.json(project);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
    if (project.createdById !== req.user!.userId && req.user!.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Only the project owner can delete it' });
      return;
    }
    await prisma.project.delete({ where: { id: req.params.id } });
    res.json({ message: 'Project deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

router.post('/:id/members', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, role } = req.body;
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: req.params.id, userId: req.user!.userId } },
    });
    if (!membership || membership.role !== 'ADMIN') {
      res.status(403).json({ error: 'Only admins can add members' });
      return;
    }
    const invitee = await prisma.user.findUnique({ where: { email } });
    if (!invitee) { res.status(404).json({ error: 'User not found with that email' }); return; }

    const existing = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: req.params.id, userId: invitee.id } },
    });
    if (existing) { res.status(409).json({ error: 'User is already a member' }); return; }

    const newMember = await prisma.projectMember.create({
      data: { projectId: req.params.id, userId: invitee.id, role: role || 'VIEW' },
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
    });
    res.status(201).json(newMember);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

router.put('/:id/members/:userId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role } = req.body;
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: req.params.id, userId: req.user!.userId } },
    });
    if (!membership || membership.role !== 'ADMIN') {
      res.status(403).json({ error: 'Only admins can change member roles' });
      return;
    }
    const updated = await prisma.projectMember.update({
      where: { projectId_userId: { projectId: req.params.id, userId: req.params.userId } },
      data: { role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

router.delete('/:id/members/:userId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: req.params.id, userId: req.user!.userId } },
    });
    if (!membership || membership.role !== 'ADMIN') {
      res.status(403).json({ error: 'Only admins can remove members' });
      return;
    }
    await prisma.projectMember.delete({
      where: { projectId_userId: { projectId: req.params.id, userId: req.params.userId } },
    });
    res.json({ message: 'Member removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

export default router;
