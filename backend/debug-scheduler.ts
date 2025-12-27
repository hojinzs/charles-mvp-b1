
import { getKeywordsToCrawl } from './src/db/queries';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

async function check() {
    try {
        console.log("Fetching keywords to crawl (Threshold: 1 hour ago)...");
        // Create a threshold of 1 hour ago
        const threshold = new Date(Date.now() - 60 * 60 * 1000); 
        console.log(`Threshold: ${threshold.toISOString()}`);

        const keywords = await getKeywordsToCrawl(threshold);
        console.log(`Found ${keywords.length} keywords.`);
        
        if (keywords.length > 0) {
            const kw = keywords[0];
            console.log("First keyword:", kw);
            console.log("last_checked_at:", kw.last_checked_at);
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

check();
