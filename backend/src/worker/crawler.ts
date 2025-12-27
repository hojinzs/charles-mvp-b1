import puppeteer, { Browser } from "puppeteer";

let browserInstance: Browser | null = null;
let browserLaunchPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }

  if (browserLaunchPromise) {
    return browserLaunchPromise;
  }

  console.log("[Crawler] Launching new browser instance...");
  
  browserLaunchPromise = puppeteer.launch({
    headless: "new",
    protocolTimeout: 60000,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  }).then(browser => {
      browserInstance = browser;
      return browser;
  }).finally(() => {
      browserLaunchPromise = null;
  });

  return browserLaunchPromise;
}

export async function checkRanking(
  keyword: string,
  targetUrl: string,
): Promise<number | null> {
  let context = null;
  let page = null;
  
  try {
    const browser = await getBrowser();
    
    // Create isolated context for this job
    context = await browser.createIncognitoBrowserContext();
    page = await context.newPage();

    // Set user agent
    await page.setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1",
    );

    console.log(`[Crawler] Navigating to search result for: ${keyword}`);
    
    await page.goto(
      `https://m.ad.search.naver.com/search.naver?where=m_expd&query=${encodeURIComponent(keyword)}`,
      { waitUntil: "networkidle0", timeout: 30000 },
    );

    // Wait for results to load
    await new Promise((r) => setTimeout(r, 2000));

    const rank = await page.evaluate((url: string) => {
      const items = document.querySelectorAll("li.list_item");

      for (let i = 0; i < items.length; i++) {
        const titleEl = items[i].querySelector(".tit_area .tit");
        const urlEl = items[i].querySelector(".url_link");

        const title = titleEl?.textContent || "";
        const displayUrl = urlEl?.textContent || "";

        // Simple check: if display URL or title includes the target URL
        if (displayUrl.includes(url) || title.includes(url)) {
          return i + 1;
        }
      }

      return null;
    }, targetUrl);

    console.log(`[Crawler] Rank for "${keyword}": ${rank}`);

    return rank;
  } catch (e) {
    console.error(`Error crawling keyword "${keyword}":`, e);
    
    // If browser crashed or disconnected, reset instance
    if (browserInstance && !browserInstance.isConnected()) {
        console.warn("[Crawler] Browser disconnected, resetting instance.");
        browserInstance = null;
    }
    
    throw e;
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
  }
}
