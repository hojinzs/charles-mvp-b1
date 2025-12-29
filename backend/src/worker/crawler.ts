import axios from "axios";
import * as cheerio from "cheerio";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { Browser } from "puppeteer";
import { createCursor } from "ghost-cursor";
import { ProxyManager } from "./proxy-manager";
import { networkBytesHistogram, networkBytesCounter } from "../metrics";

export interface NetworkStats {
  requestSize: number;  // in KB
  responseSize: number; // in KB
  totalSize: number;    // in KB
}

// Add stealth plugin
puppeteer.use(StealthPlugin());

let browserInstance: Browser | null = null;
let browserLaunchPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }

  if (browserLaunchPromise) {
    return browserLaunchPromise;
  }

  console.log("[Crawler] Launching new stealth browser instance...");

  const proxyManager = ProxyManager.getInstance();
  const proxyConfig = proxyManager.getProxyServer();

  const launchArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-infobars",
    "--window-position=0,0",
    "--ignore-certifcate-errors",
    "--ignore-certifcate-errors-spki-list",
  ];

  if (proxyConfig) {
    console.log(
      `[Crawler] Using proxy server: ${proxyConfig.host}:${proxyConfig.port}`,
    );
    launchArgs.push(
      `--proxy-server=http://${proxyConfig.host}:${proxyConfig.port}`,
    );
  }

  browserLaunchPromise = puppeteer
    .launch({
      headless: "new",
      protocolTimeout: 60000,
      args: launchArgs,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    })
    .then((browser) => {
      browserInstance = browser;
      return browser;
    })
    .finally(() => {
      browserLaunchPromise = null;
    });

  return browserLaunchPromise;
}

async function checkRankingViaAxios(
  keyword: string,
  targetUrl: string,
): Promise<{ rank: number | null; networkStats: NetworkStats }> {
  try {
    const proxyManager = ProxyManager.getInstance();
    const proxyConfig = proxyManager.getProxyServer();
    const credentials = proxyManager.getProxyCredentials();

    let axiosConfig: any = {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      timeout: 10000, // Fast timeout for axios
    };

    if (proxyConfig) {
      axiosConfig.proxy = {
        host: proxyConfig.host,
        port: proxyConfig.port,
        protocol: "http",
      };

      if (credentials) {
        axiosConfig.proxy.auth = {
          username: credentials.username,
          password: credentials.password,
        };
      }
    }

    // Naver Mobile Search URL
    const searchUrl = `https://m.ad.search.naver.com/search.naver?where=m_expd&query=${encodeURIComponent(
      keyword,
    )}`;

    console.log(`[Crawler] (Axios) Checking ${keyword}...`);
    const response = await axios.get(searchUrl, axiosConfig);

    // Calculate network sizes in bytes
    const responseBodySizeBytes = Buffer.byteLength(response.data, 'utf8');
    const responseHeaderSizeBytes = JSON.stringify(response.headers).length;
    const responseTotalSizeBytes = responseBodySizeBytes + responseHeaderSizeBytes;

    const requestHeaderSizeBytes = JSON.stringify(axiosConfig.headers || {}).length;
    const requestTotalSizeBytes = requestHeaderSizeBytes + searchUrl.length;

    const totalNetworkSizeBytes = requestTotalSizeBytes + responseTotalSizeBytes;

    // Record metrics in bytes (Prometheus standard)
    networkBytesHistogram.observe({ method: 'axios', direction: 'request' }, requestTotalSizeBytes);
    networkBytesHistogram.observe({ method: 'axios', direction: 'response' }, responseTotalSizeBytes);
    networkBytesHistogram.observe({ method: 'axios', direction: 'total' }, totalNetworkSizeBytes);
    networkBytesCounter.inc({ method: 'axios' }, totalNetworkSizeBytes);

    // Convert to KB for storage
    const requestKb = Math.round(requestTotalSizeBytes / 1024);
    const responseKb = Math.round(responseTotalSizeBytes / 1024);
    const totalKb = Math.round(totalNetworkSizeBytes / 1024);

    console.log(`[Crawler] (Axios) Network stats - Request: ${requestKb}KB, Response: ${responseKb}KB, Total: ${totalKb}KB`);

    const $ = cheerio.load(response.data);
    const items = $("li.list_item");
    let rank = null;

    items.each((i, el) => {
      const title = $(el).find(".tit_area .tit").text() || "";
      const urlText = $(el).find(".url_link").text() || "";

      if (title.includes(targetUrl) || urlText.includes(targetUrl)) {
        rank = i + 1;
        return false; // break loop
      }
    });

    if (rank) {
      console.log(`[Crawler] (Axios) Found rank: ${rank}`);
    } else {
      console.log(`[Crawler] (Axios) Not found or valid result.`);
    }

    return {
      rank,
      networkStats: {
        requestSize: requestKb,
        responseSize: responseKb,
        totalSize: totalKb
      }
    };
  } catch (error) {
    console.warn(`[Crawler] (Axios) Failed: ${error}`);
    // Return null rank with zero network stats on error
    return {
      rank: null,
      networkStats: {
        requestSize: 0,
        responseSize: 0,
        totalSize: 0
      }
    };
  }
}

async function checkRankingViaPuppeteer(
  keyword: string,
  targetUrl: string,
): Promise<{ rank: number | null; networkStats: NetworkStats }> {
  let context: any = null;
  let page: any = null;

  try {
    const browser = await getBrowser();

    // Create isolated context for this job
    context = await browser.createIncognitoBrowserContext();
    page = await context.newPage();

    // Network monitoring setup
    let totalRequestSize = 0;
    let totalResponseSize = 0;

    page.on('request', (request: any) => {
      const headers = request.headers();
      const headerSize = JSON.stringify(headers).length;
      const urlSize = request.url().length;
      totalRequestSize += headerSize + urlSize;
    });

    page.on('response', async (response: any) => {
      try {
        const buffer = await response.buffer();
        const bodySize = buffer.length;
        const headers = response.headers();
        const headerSize = JSON.stringify(headers).length;
        totalResponseSize += bodySize + headerSize;
      } catch (e) {
        // Some responses may not support buffer()
      }
    });

    // Authenticate with Proxy (if configured)
    const proxyManager = ProxyManager.getInstance();
    const credentials = proxyManager.getProxyCredentials();

    if (credentials) {
      console.log(`[Crawler] Authenticating proxy session...`);
      await page.authenticate({
        username: credentials.username,
        password: credentials.password || "",
      });
    }

    // Helper to simulate human behavior
    const cursor = createCursor(page);
    await cursor.toggleRandomMove(true);

    // Randomize Viewport slightly
    await page.setViewport({
      width: 375 + Math.floor(Math.random() * 50),
      height: 812 + Math.floor(Math.random() * 100),
      isMobile: true,
      hasTouch: true,
    });

    console.log(`[Crawler] (Puppeteer) Navigating to: ${keyword}`);
    
    // Initial Strategy: Direct Navigation
    await page.goto(
      `https://m.ad.search.naver.com/search.naver?where=m_expd&query=${encodeURIComponent(
        keyword,
      )}`,
      { waitUntil: "networkidle2", timeout: 30000 },
    );

    // Check if we got results directly
    let items = await page.$$("li.list_item"); // use element handles to check count
    
    if (items.length === 0) {
        console.warn(`[Crawler] (Puppeteer) Direct navigation yielded 0 items. Attempting bypass logic via m.naver.com...`);
        // Bypass Logic
        await navigateWithBypass(page, keyword, cursor);
        // Re-query items after bypass navigation
        items = await page.$$("li.list_item");
    }

    // Use page.evaluate to parse the final page state
    const rank = await page.evaluate((url: string) => {
      const items = document.querySelectorAll("li.list_item");
      for (let i = 0; i < items.length; i++) {
        const titleEl = items[i].querySelector(".tit_area .tit");
        const urlEl = items[i].querySelector(".url_link");

        const title = titleEl?.textContent || "";
        const displayUrl = urlEl?.textContent || "";

        if (displayUrl.includes(url) || title.includes(url)) {
          return i + 1;
        }
      }
      return null;
    }, targetUrl);

    console.log(`[Crawler] (Puppeteer) Rank for "${keyword}": ${rank}`);

    // Calculate total network size and record metrics in bytes
    const totalNetworkSizeBytes = totalRequestSize + totalResponseSize;

    networkBytesHistogram.observe({ method: 'puppeteer', direction: 'request' }, totalRequestSize);
    networkBytesHistogram.observe({ method: 'puppeteer', direction: 'response' }, totalResponseSize);
    networkBytesHistogram.observe({ method: 'puppeteer', direction: 'total' }, totalNetworkSizeBytes);
    networkBytesCounter.inc({ method: 'puppeteer' }, totalNetworkSizeBytes);

    // Convert to KB for storage
    const requestKb = Math.round(totalRequestSize / 1024);
    const responseKb = Math.round(totalResponseSize / 1024);
    const totalKb = Math.round(totalNetworkSizeBytes / 1024);

    console.log(`[Crawler] (Puppeteer) Network stats - Request: ${requestKb}KB, Response: ${responseKb}KB, Total: ${totalKb}KB`);

    return {
      rank,
      networkStats: {
        requestSize: requestKb,
        responseSize: responseKb,
        totalSize: totalKb
      }
    };
  } catch (e) {
    console.error(`Error crawling keyword "${keyword}" with Puppeteer:`, e);

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

async function navigateWithBypass(page: any, keyword: string, cursor: any) {
    try {
        console.log(`[Crawler] (Bypass) Going to m.naver.com`);
        await page.goto("https://m.naver.com", { waitUntil: "networkidle2" });
        
        // Wait for search input
        const searchInputSelector = "#MM_SEARCH_FAKE"; // Mobile main often uses a fake input that triggers a layer or directly an input
        const realInputSelector = "#query"; // The real input in the search layer

        // Need to handle different mobile layouts, but standard m.naver.com usually has a search bar.
        // Try clicking the fake placeholder first if it exists, or the real input
        if (await page.$(searchInputSelector)) {
            await cursor.click(searchInputSelector);
        } else {
             // Fallback attempt to find any search input
             await cursor.click("input[type=search], input#query, .sch_inp");
        }
        
        await new Promise(r => setTimeout(r, 1000));

        // Type keyword slowly
        console.log(`[Crawler] (Bypass) Typing keyword...`);
        if (await page.$(realInputSelector)) {
            await page.type(realInputSelector, keyword, { delay: 100 + Math.random() * 50 });
        } else {
            // fallback generic typing
            await page.keyboard.type(keyword, { delay: 100 + Math.random() * 50 });
        }
        
        await new Promise(r => setTimeout(r, 500));
        await page.keyboard.press("Enter");
        
        // Wait for search results
        await page.waitForNavigation({ waitUntil: "networkidle2" });
        
        console.log(`[Crawler] (Bypass) Search results loaded. Looking for ad section...`);
        
        // Scroll down looking for "{{keyword}} 관련 광고"
        // This regex/text match is tricky in Puppeteer. 
        // We will scroll and check page content repeatedly.
        
        let foundSection = false;
        let attempts = 0;
        const maxAttempts = 10;
        
        while (!foundSection && attempts < maxAttempts) {
            // Scroll down
             await page.evaluate(async () => {
                window.scrollBy(0, window.innerHeight / 1.5);
            });
            await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));
            
            // Check for the section "관련 광고" or similar text
            // Note: Exact text varies. User said "{{keyword}} 관련 광고".
            // We search for an element containing text '관련 광고' and maybe the keyword.
            const successfulClick = await page.evaluate((k: string) => {
                 const xpath = `//*[contains(text(), '${k}') and contains(text(), '관련 광고')] | //*[contains(text(), '파워링크')]`; // Flexible match
                 // Often the section title is "파워링크" or "XX 관련 광고"
                 
                 // Let's try to find "파워링크" specifically as that's the canonical name, 
                 // or the user specific "{{keyword}} 관련 광고"
                 
                 // Strategy: Find header, then find "More" button in that container or sibling
                 // Simplified: Look for a link/button that says "더보기" inside a likely ad container
                 
                 // Let's try to identify the specific section header given by user.
                 const headers = Array.from(document.querySelectorAll("h2, h3, strong, span, div"));
                 let targetHeader: Element | null = null;
                 
                 for(const h of headers) {
                     if (h.textContent?.includes(`${k} 관련 광고`) || h.textContent?.includes("파워링크")) {
                         targetHeader = h;
                         break;
                     }
                 }
                 
                 if (targetHeader) {
                     // Look for "더보기" button near this header. 
                     // Often it's in the same container or just below.
                     // We can try to click the header itself if it's a link, or look for a sibling "more"
                     
                     // Common Naver structure: Section -> Header ... Check valid ad link
                     // Actually, if we find "파워링크", usually there is a "더보기" (More) link on the right.
                     // Class names like `btn_more` or texts `더보기`
                     
                     // Let's traverse up to finding a container, then search down for "더보기"
                     let container = targetHeader.parentElement;
                     let moreBtn: HTMLElement | null = null;
                     
                     // Try going up 3 levels
                     for(let i=0; i<3; i++) {
                         if (!container) break;
                         moreBtn = container.querySelector("a.btn_more, a.more, .more_btn") as HTMLElement;
                         if (moreBtn && moreBtn.textContent?.includes("더보기")) break;
                         
                         // Also check by text
                         const links = container.querySelectorAll("a, button");
                         for(const l of links) {
                             if(l.textContent?.trim() === "더보기" || l.textContent?.includes("광고 더보기")) {
                                 moreBtn = l as HTMLElement;
                                 break;
                             }
                         }
                         if (moreBtn) break;
                         
                         container = container.parentElement;
                     }
                     
                     if (moreBtn) {
                         moreBtn.click();
                         return true;
                     }
                 }
                 return false;
            }, keyword);
            
            if (successfulClick) {
                console.log(`[Crawler] (Bypass) Found section and clicked 'More'.`);
                foundSection = true;
                await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 }).catch(() => console.log("Navigation timeout or already handled"));
            } else {
                console.log(`[Crawler] (Bypass) Section not found yet, scrolling...`);
            }
            
            attempts++;
        }
        
        if (!foundSection) {
             console.warn(`[Crawler] (Bypass) Could not find ad section after scrolling.`);
        }
        
    } catch (e) {
        console.error(`[Crawler] (Bypass) Failed:`, e);
    }
}

export async function checkRanking(
  keyword: string,
  targetUrl: string,
): Promise<{ rank: number | null; method: "axios" | "puppeteer"; networkStats: NetworkStats }> {
  // 1. Try Axios (Fast)
  const axiosResult = await checkRankingViaAxios(keyword, targetUrl);
  if (axiosResult.rank !== null) {
    return {
      rank: axiosResult.rank,
      method: "axios",
      networkStats: axiosResult.networkStats
    };
  }

  // 2. Fallback to Puppeteer (Slow, stealth)
  console.log(
    `[Crawler] Axios failed or found nothing for "${keyword}". Falling back to Puppeteer...`,
  );
  const puppeteerResult = await checkRankingViaPuppeteer(keyword, targetUrl);
  return {
    rank: puppeteerResult.rank,
    method: "puppeteer",
    networkStats: puppeteerResult.networkStats
  };
}
