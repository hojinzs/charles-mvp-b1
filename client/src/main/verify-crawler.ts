import { app, BrowserWindow } from 'electron';

// FORCE QUIT after 45 seconds to avoid hanging processes
setTimeout(() => {
  console.log('Timeout reached, quitting...');
  if (process.platform !== 'darwin') app.quit();
  process.exit(0);
}, 45000);

app.whenReady().then(async () => {
  console.log('Spawning Window for Crawling Verification...');
  const win = new BrowserWindow({
    width: 1280,
    height: 1024,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const KEYWORD = '꽃배달'; 
  const TARGET_URL_PART = '99flower';

  console.log(`Navigating to Naver Search for keyword: ${KEYWORD}`);
  await win.loadURL(`https://search.naver.com/search.naver?query=${encodeURIComponent(KEYWORD)}`);

  console.log('Page loaded. Waiting 5s for dynamic content...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Attempt updated extraction
  const results = await win.webContents.executeJavaScript(`
    (() => {
      const data = { ads: [], organic: [] };
      
      // 1. Ads (Power Link)
      // Correct Selectors: a.lnk_head .lnk_tit, .lnk_url
      const adSection = document.getElementById('power_link_body');
      if (adSection) {
         const listItems = adSection.querySelectorAll('li.lst'); 
         
         listItems.forEach((el, index) => {
            const titleEl = el.querySelector('a.lnk_head .lnk_tit');
            const urlEl = el.querySelector('.lnk_url');
            const linkEl = el.querySelector('a.lnk_head');
            
            if (titleEl) {
               data.ads.push({
                 rank: index + 1,
                 title: titleEl.innerText,
                 displayUrl: urlEl ? urlEl.innerText : 'N/A',
                 link: linkEl ? linkEl.href : ''
               });
            }
         });
      }

      // 2. Organic
      // .sc_new sections. Website usually has .link_tit and .link_url
      const sections = document.querySelectorAll('.sc_new');
      sections.forEach((section) => {
          if (section.classList.contains('sp_nwebsite')) {
             const items = section.querySelectorAll('.list_type .bx');
             items.forEach((item) => {
                 const link = item.querySelector('a.link_tit');
                 const url = item.querySelector('a.link_url');
                 if (link) {
                     data.organic.push({
                         type: 'website',
                         title: link.innerText,
                         displayUrl: url ? url.innerText : '',
                         link: link.href
                     });
                 }
             });
          }
      });

      return data;
    })()
  `);
  
  console.log('--- EXTRACTED DATA ---');
  console.log(JSON.stringify(results, null, 2));

  // Check for Target presence
  const foundAd = results.ads.find((ad: any) => ad.displayUrl.includes(TARGET_URL_PART) || ad.title.includes(TARGET_URL_PART));
  
  if (foundAd) {
    console.log('[SUCCESS] Found Target Ad "' + TARGET_URL_PART + '" at Rank ' + foundAd.rank);
  } else {
    // Also check organic
    const foundOrganic = results.organic.find((item: any) => item.displayUrl.includes(TARGET_URL_PART) || item.title.includes(TARGET_URL_PART));
    if (foundOrganic) {
       console.log('[SUCCESS] Found Target Organic "' + TARGET_URL_PART + '"');
    } else {
       console.log('[INFO] Target "' + TARGET_URL_PART + '" not found in top ads/organic.');
    }
  }

  app.quit();
});
