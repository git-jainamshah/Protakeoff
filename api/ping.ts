export default function(_req: any, res: any) {
  res.json({ message: 'pong', timestamp: new Date().toISOString() });
}
