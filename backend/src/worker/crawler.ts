import axios from "axios";
import * as cheerio from "cheerio";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { Browser } from "puppeteer";
import { createCursor } from "ghost-cursor";
import { ProxyManager } from "./proxy-manager";

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
): Promise<number | null> {
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

    return rank;
  } catch (error) {
    console.warn(`[Crawler] (Axios) Failed: ${error}`);
    return null; // Fallback to puppeteer
  }
}

async function checkRankingViaPuppeteer(
  keyword: string,
  targetUrl: string,
): Promise<number | null> {
  let context: any = null;
  let page: any = null;

  try {
    const browser = await getBrowser();

    // Create isolated context for this job
    context = await browser.createIncognitoBrowserContext();
    page = await context.newPage();

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
    
    // Go to Naver Main first (optional, for warmer cache/cookies if needed, but direct is often fine)
    // To be safer: go to search page directly but wait a bit
    await page.goto(
      `https://m.ad.search.naver.com/search.naver?where=m_expd&query=${encodeURIComponent(
        keyword,
      )}`,
      { waitUntil: "networkidle2", timeout: 30000 },
    );

    // Human-like: Scroll a bit
    await page.evaluate(async () => {
      window.scrollBy(0, window.innerHeight / 2);
    });
    await new Promise((r) => setTimeout(r, 500 + Math.random() * 1000));
    
    await page.evaluate(async () => {
      window.scrollBy(0, -window.innerHeight / 4);
    });
    await new Promise((r) => setTimeout(r, 500));

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
    return rank;
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

export async function checkRanking(
  keyword: string,
  targetUrl: string,
): Promise<number | null> {
  // 1. Try Axios (Fast)
  const axiosResult = await checkRankingViaAxios(keyword, targetUrl);
  if (axiosResult !== null) {
    return axiosResult;
  }

  // 2. Fallback to Puppeteer (Slow, stealth)
  console.log(
    `[Crawler] Axios failed or found nothing for "${keyword}". Falling back to Puppeteer...`,
  );
  return checkRankingViaPuppeteer(keyword, targetUrl);
}
