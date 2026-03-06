import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/document/:documentId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const documentId = req.params.documentId as string;
    const layers = await prisma.layer.findMany({
      where: { documentId },
      include: { shapes: { orderBy: { createdAt: 'asc' } } },
      orderBy: { order: 'asc' },
    });
    res.json(layers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch layers' });
  }
});

router.post('/document/:documentId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const documentId = req.params.documentId as string;
    const { name, color, type } = req.body;
    if (!name) { res.status(400).json({ error: 'Layer name is required' }); return; }

    const count = await prisma.layer.count({ where: { documentId } });
    const layer = await prisma.layer.create({
      data: {
        name,
        color: color || '#6366F1',
        type: type || 'AREA',
        order: count,
        documentId,
      },
      include: { shapes: true },
    });
    res.status(201).json(layer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create layer' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, color, type, visible, order } = req.body;
    const layer = await prisma.layer.update({
      where: { id: req.params.id as string },
      data: { name, color, type, visible, order },
      include: { shapes: true },
    });
    res.json(layer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update layer' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.layer.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Layer deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete layer' });
  }
});

export default router;
