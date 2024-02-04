/*
 * Copyright (c) 2023-2024. MIT License. Maina Derrick.
 */

/**
 *  Base class that sets up all axios interactions. It is from this class that all other Nemis classes are extended from.
 */
import CustomError from '@libs/error_handler';
import {parse as htmlParser} from 'node-html-parser';
import {gradeToNumber} from '@libs/converts';
import NemisApiService from './api_handler';
import {Grade, RecordsPerPage} from '../../../types/nemisApiTypes/institution';
import {Z_INSTITUTION} from '@libs/nemis/constants';
import puppeteer, {Browser, Page, Protocol, PuppeteerLaunchOptions} from 'puppeteer';
import {puppeteerDefaults} from "../../../configs";

/**
 * A class to handle all interactions with the NEMIS (National Education Management Information System) website
 * located at nemis.education.go.ke. This class provides methods to log in to the
 * website and handle all interactions available on the website. It uses the axios to
 * automate browser interaction and perform tasks on the website. The class encapsulates all the logic
 * and handles all the details of interacting with the website, making it easier to use and maintain in
 * other parts of the application. It also provides error handling and logging functionality to help
 * diagnose and troubleshoot issues. Overall, this class provides a convenient and reliable way to interact
 * with the NEMIS website and automate tasks related to managing education data.
 */
export default class Nemis {
    recordsPerPage: RecordsPerPage = '1000';

    validations = {
        institutionSchema: Z_INSTITUTION
    };

    //@ts-expect-error
    browser: Browser;
    //@ts-expect-error
    page: Page;

    constructor(opts?: PuppeteerLaunchOptions) {
    }

    /**
     * Logs in the user with the given username and password.
     */

    async login(username: string, password: string): Promise<Protocol.Network.Cookie[]> {
        try {
            if (!username || !password) {
                throw new CustomError('Username or password not provided', 401);
            }
            await this.page.goto('http://nemis.education.go.ke/')

            await this.page.locator('#ctl00_ContentPlaceHolder1_Login1_UserName').fill(username);
            await this.page.locator('#ctl00_ContentPlaceHolder1_Login1_Password').fill(password);

            await this.page.click('#ctl00_ContentPlaceHolder1_Login1_LoginButton');
            await this.page.waitForNetworkIdle();

            return this.page.cookies();
        } catch (err: any) {
            console.error(err);
            throw err;
        }
    }

    /**
     * Retrieves institution information by scraping the institution page,
     * /Institution/Institution.aspx, and parsing its html using node-html-parser.

     */
    async getInstitution(institutionCode: string) {
        try {
            await this.page.goto('http://nemis.education.go.ke/Institution/Institution.aspx', {
                waitUntil: 'domcontentloaded'
            });
            await this.page.waitForNetworkIdle();

            let institutionHtml = await this.page.content();
            let supportedGrades = await new NemisApiService().homepageApi(institutionCode);

            if (!Array.isArray(supportedGrades))
                throw new Error('Failed to get  supported grades from nemis api');

            let document = htmlParser(institutionHtml);
            let instData = {
                //Institution Bio Data Tab
                name: document.querySelector('#ctl00_ContentPlaceHolder1_Institution_Name')?.attrs?.value,
                knecCode: document.querySelector('#ctl00_ContentPlaceHolder1_Knec_Code')?.attrs?.value,
                code: document.querySelector('#ctl00_ContentPlaceHolder1_Institution_Code')?.attrs?.value,
                gender: document
                    .querySelector('#ctl00_ContentPlaceHolder1_Classification_by_Gender')
                    ?.outerHTML?.match(/(?<=selected" value="\d">)\w.*?(?=<)/)
                    ?.toString(),
                supportedGrades: supportedGrades.map(grade => grade.name),
                registrationNumber: document.querySelector(
                    '#ctl00_ContentPlaceHolder1_Institution_Current_Code'
                )?.attrs?.value,
                type: document
                    .querySelector('#ctl00_ContentPlaceHolder1_Institution_Type')
                    ?.outerHTML?.match(/(?<=selected" value="\w+">)\w.*?(?=<)/)
                    ?.toString(),
                registrationStatus: document
                    .querySelector('#ctl00_ContentPlaceHolder1_Institution_Status')
                    ?.outerHTML?.match(/(?<=selected" value="\d">)\w.*?(?=<)/)
                    ?.toString(),
                accommodation: document
                    .querySelector('#ctl00_ContentPlaceHolder1_Accommodation_Code')
                    ?.outerHTML?.match(/(?<=selected" value="\d">)\w.*?(?=<)/)
                    ?.toString(),
                tscCode: document.querySelector('#ctl00_ContentPlaceHolder1_Tsc_Code')?.attrs?.value,
                category: document
                    .querySelector('#ctl00_ContentPlaceHolder1_Institution_Category_Code')
                    ?.outerHTML?.match(/(?<=selected" value="\d">)\w.*?(?=<)/)
                    ?.toString(),
                educationLevel: document
                    .querySelector('#ctl00_ContentPlaceHolder1_Institution_Level_Code')
                    ?.outerHTML?.match(/(?<=selected" value="\d">)\w.*?(?=<)/)
                    ?.toString(),
                institutionMobility: document
                    .querySelector('#ctl00_ContentPlaceHolder1_Mobile_Institution')
                    ?.outerHTML?.match(/(?<=selected" value="\d">)\w.*?(?=<)/)
                    ?.toString(),
                residence: document
                    .querySelector('#ctl00_ContentPlaceHolder1_Institution_Residence')
                    ?.outerHTML?.match(/(?<=selected" value="\d">)\w.*?(?=<)/)
                    ?.toString(),
                educationSystem: document
                    .querySelector('#ctl00_ContentPlaceHolder1_Education_System_Code')
                    ?.outerHTML?.match(/(?<=selected" value="\d">)\w.*?(?=<)/)
                    ?.toString(),
                constituency: document
                    .querySelector('#ctl00_ContentPlaceHolder1_Constituency_Code')
                    ?.outerHTML?.match(/(?<=selected" value="\d+">)\w.*?(?=<)/)
                    ?.toString(),
                kraPin: document.querySelector('#ctl00_ContentPlaceHolder1_Employer_pin')?.attrs?.value,
                // plusCode:
                // document.querySelector("#PlusCode")?.attrs?.value?.toLowerCase()||''
                //,
                registrationDate: document.querySelector('#ctl00_ContentPlaceHolder1_Registration_Date')
                    ?.attrs?.value,
                ward: document
                    .querySelector('#ctl00_ContentPlaceHolder1_Ward_Code')
                    ?.outerHTML?.match(/(?<=selected" value="\d+">)\w.*?(?=<)/)
                    ?.toString(),
                zone: document
                    .querySelector('#ctl00_ContentPlaceHolder1_Zone_Code')
                    ?.outerHTML?.match(/(?<=selected" value="\d+">)\w.*?(?=<)/)
                    ?.toString(),
                county: document
                    .querySelector('#ctl00_ContentPlaceHolder1_County_Code')
                    ?.outerHTML?.match(/(?<=selected" value="\d+">)\w.*?(?=<)/)
                    ?.toString(),
                subCounty: document
                    .querySelector('#ctl00_ContentPlaceHolder1_Sub_County_Code')
                    ?.outerHTML?.match(/(?<=selected" value="\d+">)\w.*?(?=<)/)
                    ?.toString(),
                cluster: document
                    .querySelector('#ctl00_ContentPlaceHolder1_Institution_Cluster ')
                    ?.outerHTML?.match(/(?<=selected" value="\d">)\w.*?(?=<)/)
                    ?.toString(),
                // Ownership Details Tab
                ownership: document
                    .querySelector('#ctl00_ContentPlaceHolder1_Premise_Ownership')
                    ?.outerHTML?.match(/(?<=selected" value="\d">)\w.*?(?=<)/)
                    ?.toString(),
                ownershipDocument: document
                    .querySelector('#ctl00_ContentPlaceHolder1_Ownership_Document')
                    ?.outerHTML?.match(/(?<=selected" value="\d">)\w.*?(?=<)/)
                    ?.toString(),
                owner: document.querySelector('#ctl00_ContentPlaceHolder1_Proprietor_Code')?.attrs?.value,
                incorporationCertificateNumber: document.querySelector(
                    '#ctl00_ContentPlaceHolder1_Registration_Certificate'
                )?.attrs?.value,
                nearestPoliceStation: document.querySelector(
                    '#ctl00_ContentPlaceHolder1_Nearest_Police_Station'
                )?.attrs?.value,
                nearestHealthFacility: document.querySelector(
                    '#ctl00_ContentPlaceHolder1_Nearest_Health_Facility'
                )?.attrs?.value,
                nearestTown: document.querySelector('#ctl00_ContentPlaceHolder1_Nearest_Town')?.attrs?.value,
                //Institution Contacts Tab
                postalAddress: document.querySelector('#ctl00_ContentPlaceHolder1_Postal_Address')?.attrs
                    ?.value,
                telephoneNumber: document.querySelector('#ctl00_ContentPlaceHolder1_Tel_Number')?.attrs
                    ?.value,
                mobileNumber: document.querySelector('#ctl00_ContentPlaceHolder1_Mobile_Number1')?.attrs
                    ?.value,
                altTelephoneNumber: document.querySelector('#ctl00_ContentPlaceHolder1_Tel_Number2')?.attrs
                    ?.value,
                altMobileNumber: document.querySelector('#ctl00_ContentPlaceHolder1_Mobile_Number2')?.attrs
                    ?.value,
                email: document.querySelector('#ctl00_ContentPlaceHolder1_Email_Address')?.attrs?.value,
                website: document.querySelector('#ctl00_ContentPlaceHolder1_Website')?.attrs?.value,
                socialMediaHandles: document
                    .querySelector('#ctl00_ContentPlaceHolder1_Social_Media')
                    ?.attrs?.value?.toLowerCase()
            };
            return this.validations.institutionSchema.strip().parse(instData);
        } catch (err) {
            console.error(err);
            throw err;
        }
    }

    /**
     *  since the number of results per page persists over request if over multiple pages, we use
     *  this method to check if we really need to change the number of results per page
     */
    async changeResultsPerPage(selector?: string, grade?: Grade) {
        try {
            selector = selector ?? '#ctl00_ContentPlaceHolder1_SelectRecs';

            let element = await this.page.$(selector);
            if (!element) return;

            if (
                (await element.evaluate(val => (val as HTMLSelectElement).selectedIndex)) < 6 &&
                (await element.evaluate(val => (val as HTMLSelectElement).value)) !== this.recordsPerPage
            ) {
                await this.page.select(selector, this.recordsPerPage);
                await this.page.waitForNavigation();
            }
            if (
                (await this.page.$eval(selector, val => (val as HTMLSelectElement).value)) !==
                this.recordsPerPage
            )
                throw new Error('Failed to set new page records.');

            if (!grade) return;

            let gradeElement = await this.page.$('#SelectCat');

            if (!gradeElement) throw new Error('Grade element was not found on page');

            let gradeNumber = gradeToNumber(grade);
            let curValue = await gradeElement.evaluate(val => (val as HTMLSelectElement).value);

            if (curValue !== String(gradeNumber)) {
                await gradeElement.select(String(gradeNumber));
                await this.page.waitForNavigation();
            }
            curValue = await this.page.$eval('#SelectCat', val => (val as HTMLSelectElement).value);

            if (curValue !== String(gradeNumber)) throw new CustomError('Failed to set grade', 500);

            return;
        } catch (err: any) {
            console.error(err);
            throw err;
        }
    }

    async init(opts?: PuppeteerLaunchOptions) {
        try {
            let browser = await puppeteer.launch({
                ...puppeteerDefaults,
               ...opts
            });

            let page = await browser.newPage();

            // Set viewport if we are not using headless modenpx puppeteer browsers install firefox
            if (!opts?.headless)
                await page.setViewport({
                    width: 640,
                    height: 1080
                });

            [this.browser, this.page] = [browser, page] as const;
            return;
        } catch (err: any) {
            throw new Error(err.message || 'Error while initializing puppeteer.');
        }
    }

    async close() {
        if (this.browser) await this.browser.close();
    }
}
