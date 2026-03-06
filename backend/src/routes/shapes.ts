import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/layer/:layerId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const shapes = await prisma.shape.findMany({
      where: { layerId: req.params.layerId },
      orderBy: { createdAt: 'asc' },
    });
    res.json(shapes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch shapes' });
  }
});

router.post('/layer/:layerId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type, data, label, color } = req.body;
    if (!type || !data) { res.status(400).json({ error: 'Type and data are required' }); return; }

    const shape = await prisma.shape.create({
      data: {
        type,
        data: typeof data === 'string' ? data : JSON.stringify(data),
        label,
        color,
        layerId: req.params.layerId,
        createdById: req.user!.userId,
      },
    });
    res.status(201).json(shape);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create shape' });
  }
});

router.post('/layer/:layerId/batch', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { shapes } = req.body;
    if (!Array.isArray(shapes)) { res.status(400).json({ error: 'shapes array is required' }); return; }

    await prisma.shape.deleteMany({ where: { layerId: req.params.layerId } });

    if (shapes.length > 0) {
      await prisma.shape.createMany({
        data: shapes.map((s: { type: string; data: unknown; label?: string; color?: string }) => ({
          type: s.type,
          data: typeof s.data === 'string' ? s.data : JSON.stringify(s.data),
          label: s.label,
          color: s.color,
          layerId: req.params.layerId,
          createdById: req.user!.userId,
        })),
      });
    }

    const updated = await prisma.shape.findMany({
      where: { layerId: req.params.layerId },
      orderBy: { createdAt: 'asc' },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to batch save shapes' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type, data, label, color } = req.body;
    const shape = await prisma.shape.update({
      where: { id: req.params.id },
      data: {
        type,
        data: data ? (typeof data === 'string' ? data : JSON.stringify(data)) : undefined,
        label,
        color,
      },
    });
    res.json(shape);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update shape' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.shape.delete({ where: { id: req.params.id } });
    res.json({ message: 'Shape deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete shape' });
  }
});

export default router;
