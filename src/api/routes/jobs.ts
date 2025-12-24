import { Router } from 'express';
import { crawlQueue } from '../../queue/crawlQueue';

const router = Router();

router.post('/enqueue', async (req, res) => {
  try {
    const { keywordId, keyword, targetUrl } = req.body;
    
    // In a real app we might verify keywordId exists in DB first
    
    const job = await crawlQueue.add({
      keywordId,
      keyword,
      targetUrl
    });

    res.json({ 
      success: true, 
      data: { 
        jobId: job.id, 
        status: 'waiting' 
      } 
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/queue', async (req, res) => {
  try {
    const counts = await crawlQueue.getJobCounts();
    const jobs = await crawlQueue.getJobs(['active', 'waiting', 'delayed'], 0, 10);
    
    res.json({
      success: true,
      data: {
        ...counts,
        jobs: jobs.map(j => ({
          id: j.id,
          data: j.data,
          status: 'unknown', // Need to fetch status individually if precise status per job is needed, or infer from list
          progress: j.progress()
        }))
      }
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const job = await crawlQueue.getJob(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    
    const state = await job.getState();
    const result = job.returnvalue;
    
    res.json({
      success: true,
      data: {
        id: job.id,
        status: state,
        result,
        finishedOn: job.finishedOn
      }
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
