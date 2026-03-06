import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import prisma from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = Router();
router.use(requireAuth);

router.get('/project/:projectId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const documents = await prisma.document.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(documents);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

router.post('/project/:projectId', upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    const document = await prisma.document.create({
      data: {
        name: req.body.name || req.file.originalname,
        fileUrl,
        fileType: req.file.mimetype.includes('pdf') ? 'pdf' : 'image',
        fileSize: req.file.size,
        projectId: req.params.projectId,
      },
    });

    // Create default layers for the new document
    await prisma.layer.createMany({
      data: [
        { name: 'Walls', color: '#EF4444', type: 'LINEAR', order: 0, documentId: document.id },
        { name: 'Flooring', color: '#22C55E', type: 'AREA', order: 1, documentId: document.id },
        { name: 'Electrical', color: '#EAB308', type: 'COUNT', order: 2, documentId: document.id },
        { name: 'Plumbing', color: '#3B82F6', type: 'LINEAR', order: 3, documentId: document.id },
      ],
    });

    res.status(201).json(document);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: {
        layers: {
          include: { shapes: true },
          orderBy: { order: 'asc' },
        },
      },
    });
    if (!document) { res.status(404).json({ error: 'Document not found' }); return; }
    res.json(document);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, scale, unit, pageCount } = req.body;
    const document = await prisma.document.update({
      where: { id: req.params.id },
      data: { name, scale: scale ? parseFloat(scale) : undefined, unit, pageCount },
    });
    res.json(document);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const document = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!document) { res.status(404).json({ error: 'Document not found' }); return; }

    const filePath = path.join(process.cwd(), document.fileUrl);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await prisma.document.delete({ where: { id: req.params.id } });
    res.json({ message: 'Document deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

export default router;
