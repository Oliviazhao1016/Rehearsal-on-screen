const { chromium } = require('playwright-core');
const { pathToFileURL } = require('url');
const path = require('path');

const videoPath = path.resolve('ui/opening animation/幕布拉开定格动画.mp4');
const outputDir = path.resolve('ui/animation');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--allow-file-access-from-files'],
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const videoUrl = pathToFileURL(videoPath).href;
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#000"><video id="video" preload="auto" muted playsinline src="${videoUrl}"></video></body></html>`);

  const info = await page.evaluate(() => new Promise((resolve, reject) => {
    const video = document.getElementById('video');
    video.onloadedmetadata = () => resolve({ duration: video.duration, width: video.videoWidth, height: video.videoHeight });
    video.onerror = () => reject(new Error('video load error'));
    setTimeout(() => reject(new Error('metadata timeout')), 15000);
  }));

  const fs = require('fs');
  fs.mkdirSync(outputDir, { recursive: true });
  const points = Array.from({ length: 25 }, (_, i) => i * 0.2);
  const rows = [];

  for (let i = 0; i < points.length; i++) {
    const target = points[i];
    const actual = await page.evaluate((time) => new Promise((resolve, reject) => {
      const video = document.getElementById('video');
      const done = () => resolve(video.currentTime);
      video.addEventListener('seeked', done, { once: true });
      video.currentTime = time;
      if (Math.abs(video.currentTime - time) < 0.0001) done();
      setTimeout(() => reject(new Error(`seek timeout at ${time}s`)), 15000);
    }), target);

    await page.evaluate(() => new Promise((resolve) => {
      const video = document.getElementById('video');
      if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(() => resolve());
      else requestAnimationFrame(() => resolve());
    }));

    const filename = `幕布拉开定格动画_${String(i + 1).padStart(2, '0')}_${target.toFixed(1)}s.png`;
    await page.locator('#video').screenshot({ path: path.join(outputDir, filename) });
    rows.push({ index: i + 1, requestedSeconds: target, actualSeconds: actual, filename });
  }

  console.log(JSON.stringify({ info, outputDir, count: rows.length, rows }, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
