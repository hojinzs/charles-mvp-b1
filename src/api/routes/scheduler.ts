import { Router } from 'express';
import { startScheduler, stopScheduler, getSchedulerState } from '../../queue/scheduler';

const router = Router();

router.post('/interval', (req, res) => {
  const { intervalMs } = req.body;
  if (!intervalMs || typeof intervalMs !== 'number') {
    return res.status(400).json({ success: false, error: 'Invalid intervalMs' });
  }
  
  startScheduler(intervalMs);
  res.json({ success: true, data: { intervalMs } });
});

router.post('/stop', (req, res) => {
  stopScheduler();
  res.json({ success: true, data: { message: 'Scheduler stopped' } });
});

router.get('/state', (req, res) => {
  res.json({ success: true, data: getSchedulerState() });
});

export default router;
