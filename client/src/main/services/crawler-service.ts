import { BrowserWindow } from 'electron';

export async function checkRanking(keyword: string, targetUrlPart: string): Promise<number | null> {
  console.log(`[Crawler] Checking ranking for "${keyword}" looking for "${targetUrlPart}"...`);
  
  let win: BrowserWindow | null = new BrowserWindow({
    width: 1280,
    height: 1024,
    show: false, // Hidden window
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  try {
    await win.loadURL(`https://m.ad.search.naver.com/search.naver?where=m_expd&query=${encodeURIComponent(keyword)}`);

    // Wait for dynamic content
    await new Promise(resolve => setTimeout(resolve, 3000));

    const results = await win.webContents.executeJavaScript(`
      (() => {
        const ads = [];
        const items = document.querySelectorAll('li.list_item');
        
        items.forEach((el, index) => {
           const titleEl = el.querySelector('.tit_area .tit');
           const urlEl = el.querySelector('.url_link');
           const linkEl = el.querySelector('a.txt_link');
           
           if (titleEl) {
              ads.push({
                rank: index + 1,
                title: titleEl.innerText,
                displayUrl: urlEl ? urlEl.innerText : '',
                link: linkEl ? linkEl.href : ''
              });
           }
        });
        return ads;
      })()
    `);

    // Check Ranking
    const foundAd = results.find((ad: any) => 
      ad.displayUrl.includes(targetUrlPart) || ad.title.includes(targetUrlPart)
    );

    if (foundAd) {
      console.log(`[Crawler] Found in Ads at rank ${foundAd.rank}`);
      return foundAd.rank;
    }

    return null;

  } catch (error) {
    console.error('[Crawler] Error:', error);
    return null;
  } finally {
    if (win) {
      win.close();
      win = null;
    }
  }
}
