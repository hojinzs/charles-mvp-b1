import { Router } from 'express';
import { addKeyword, getKeywords } from '../../db/queries';

const router = Router();

router.post('/', async (req, res) => {
  try {
    const { keyword, url } = req.body;
    if (!keyword || !url) {
      return res.status(400).json({ success: false, error: 'Missing keyword or url' });
    }
    const result = await addKeyword(keyword, url);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const keywords = await getKeywords();
    res.json({ success: true, data: keywords });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
