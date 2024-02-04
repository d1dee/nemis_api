export const puppeteerDefaults = {
    headless: 'new',
    ignoreHTTPSErrors: true,
    args: ["--disable-features=AutoupgradeMixedContent", "--disable-web-security", " --allow-running-insecure-content"],
}
