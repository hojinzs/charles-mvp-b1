import puppeteer from "puppeteer";

export async function checkRanking(
  keyword: string,
  targetUrl: string,
): Promise<number | null> {
  const browser = await puppeteer.launch({
    headless: true, // Use "new" or true
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  });

  try {
    const page = await browser.newPage();

    // Set user agent to a mobile device to match the target logic in requirements
    await page.setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1",
    );

    await page.goto(
      `https://m.ad.search.naver.com/search.naver?where=m_expd&query=${encodeURIComponent(keyword)}`,
      { waitUntil: "networkidle0", timeout: 30000 },
    );

    // Wait for results to load
    await new Promise((r) => setTimeout(r, 2000));

    const rank = await page.evaluate((url) => {
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

    return rank;
  } catch (e) {
    console.error(`Error crawling keyword "${keyword}":`, e);
    throw e;
  } finally {
    await browser.close();
  }
}
