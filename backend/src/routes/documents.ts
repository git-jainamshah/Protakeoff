import { Router, Response } from 'express';
import { put, del } from '@vercel/blob';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import prisma from '../lib/prisma.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = Router();
router.use(requireAuth);

// Client-side Blob upload token — allows frontend to upload directly to Vercel Blob
// without the file passing through the Vercel function (bypasses 4.5MB body limit).
router.post('/blob-token', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const jsonResponse = await handleUpload({
      body: req.body as HandleUploadBody,
      request: req as unknown as Request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'],
        maximumSizeInBytes: 200 * 1024 * 1024, // 200 MB
      }),
      onUploadCompleted: async () => { /* no-op */ },
    });
    res.json(jsonResponse);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: String(err) });
  }
});

// Register a document after successful client-side Blob upload
router.post('/register', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, fileUrl, fileType, fileSize, projectId } = req.body;
    if (!fileUrl || !projectId) {
      res.status(400).json({ error: 'fileUrl and projectId are required' });
      return;
    }

    const document = await prisma.document.create({
      data: {
        name: name || 'Untitled Plan',
        fileUrl,
        fileType: fileType?.includes('pdf') ? 'pdf' : 'image',
        fileSize: fileSize ? parseInt(fileSize) : undefined,
        projectId,
      },
    });

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
    res.status(500).json({ error: 'Failed to register document' });
  }
});

router.get('/project/:projectId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const documents = await prisma.document.findMany({
      where: { projectId: req.params.projectId as string },
      orderBy: { createdAt: 'desc' },
    });
    res.json(documents);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Upload file → Vercel Blob → create document record
router.post('/project/:projectId', upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const projectId = req.params.projectId as string;
    const fileName = `${Date.now()}-${req.file.originalname.replace(/\s+/g, '-')}`;

    // Upload buffer to Vercel Blob
    const blob = await put(fileName, req.file.buffer, {
      access: 'public',
      contentType: req.file.mimetype,
    });

    const document = await prisma.document.create({
      data: {
        name: req.body.name || req.file.originalname,
        fileUrl: blob.url,
        fileType: req.file.mimetype.includes('pdf') ? 'pdf' : 'image',
        fileSize: req.file.size,
        projectId,
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
      where: { id: req.params.id as string },
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
      where: { id: req.params.id as string },
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
    const document = await prisma.document.findUnique({ where: { id: req.params.id as string } });
    if (!document) { res.status(404).json({ error: 'Document not found' }); return; }

    // Delete the file from Vercel Blob if it's a blob URL
    if (document.fileUrl && document.fileUrl.includes('vercel-storage.com')) {
      try { await del(document.fileUrl); } catch { /* non-critical */ }
    }

    await prisma.document.delete({ where: { id: req.params.id as string } });
    res.json({ message: 'Document deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

export default router;
