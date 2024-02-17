import { PuppeteerLaunchOptions} from "puppeteer";

export const puppeteerDefaults : PuppeteerLaunchOptions  = {
    headless: false,
    ignoreHTTPSErrors: true,
    args: ["--disable-features=AutoupgradeMixedContent", "--disable-web-security", " --allow-running-insecure-content"],
}
