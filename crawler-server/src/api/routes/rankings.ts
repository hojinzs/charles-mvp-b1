import { Router } from 'express';
import { getAllRankings, getRankings } from '../../db/queries';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const rankings = await getAllRankings();
    res.json({ success: true, data: rankings });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/:keywordId/rankings', async (req, res) => {
  try {
    const keywordId = parseInt(req.params.keywordId);
    if (isNaN(keywordId)) {
      return res.status(400).json({ success: false, error: 'Invalid keyword ID' });
    }
    const rankings = await getRankings(keywordId);
    res.json({ success: true, data: rankings });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
