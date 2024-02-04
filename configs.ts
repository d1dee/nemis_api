import { PuppeteerLaunchOptions} from "puppeteer";

export const puppeteerDefaults : PuppeteerLaunchOptions  = {
    headless: 'new',
    ignoreHTTPSErrors: true,
    args: ["--disable-features=AutoupgradeMixedContent", "--disable-web-security", " --allow-running-insecure-content"],
}
