export const puppeteerDefaults = {
    headless: true,
    ignoreHTTPSErrors: true,
    args: ["--disable-features=AutoupgradeMixedContent", "--disable-web-security", " --allow-running-insecure-content"],
}
