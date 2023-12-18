/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

/**
 *  Base class that sets up all axios interactions. It is from this class that all other Nemis classes are extended from.
 */
import axios, { AxiosInstance } from "axios";
import CustomError from "@libs/error_handler";
import { writeFileSync } from "fs";
import { parse as htmlParser } from "node-html-parser";
import qs from "qs";
import { gradeToNumber } from "@libs/converts";
import NemisApiService from "./api_handler";
import { Tabletojson as tableToJson } from "tabletojson";
import { Grade } from "../../../types/nemisApiTypes/institution";
import { z } from "zod";
import { utcToZonedTime } from "date-fns-tz";
import {
    Z_INST_ACCOMMODATION,
    Z_INST_CATEGORY,
    Z_INST_EDUCATION_LEVEL,
    Z_INST_EDUCATION_SYSTEM,
    Z_INST_GENDER,
    Z_INST_MOBILITY,
    Z_INST_OWNERSHIP,
    Z_INST_OWNERSHIP_DOCUMENT,
    Z_INST_REGISTRATION_STATUS,
    Z_INST_RESIDENCE,
    Z_INST_TYPE
} from "@libs/nemis/constants";
import { Z_GRADE, Z_STRING } from "@libs/constants";

type StateObject = {
    __VIEWSTATEGENERATOR: string;
    __EVENTARGUMENT?: string;
    __VIEWSTATE: string;
    __VIEWSTATEENCRYPTED?: string;
    __LASTFOCUS?: string;
    __EVENTTARGET?: string;
    __EVENTVALIDATION: string;
};

const homeDir = process.cwd();
const nemisBaseUrl = process.env.BASE_URL;

// noinspection SpellCheckingInspection

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
class NemisWebService {
    nemisDateSchema = z.date().pipe(
        z.string().transform(x => {
            let dob = x.split('-');
            return utcToZonedTime([dob[1], dob[0], dob[2]].join('-'), 'Africa/Nairobi');
        })
    );

    recordsPerPage: string = '10000';
    validations = {
        institutionSchema: z
            .object({
                //Institution Bio Data Tab
                name: Z_STRING,
                knecCode: Z_STRING,
                code: Z_STRING,
                gender: Z_INST_GENDER,
                supportedGrades: z.array(Z_GRADE),
                registrationNumber: Z_STRING,
                tscCode: Z_STRING,
                type: Z_INST_TYPE,
                registrationStatus: Z_INST_REGISTRATION_STATUS,
                accommodation: Z_INST_ACCOMMODATION,
                category: Z_INST_CATEGORY,
                educationLevel: Z_INST_EDUCATION_LEVEL,
                institutionMobility: Z_INST_MOBILITY,
                residence: Z_INST_RESIDENCE,
                educationSystem: Z_INST_EDUCATION_SYSTEM,
                constituency: Z_STRING,
                kraPin: Z_STRING,
                // plusCode:
                // document.querySelector("#PlusCode")?.attrs?.value?.toLowerCase()||''
                //,
                registrationDate: Z_STRING,
                ward: Z_STRING,
                zone: Z_STRING,
                county: Z_STRING,
                subCounty: Z_STRING,
                cluster: Z_STRING,
                // Ownership Details Tab
                ownership: Z_INST_OWNERSHIP,
                ownershipDocument: Z_INST_OWNERSHIP_DOCUMENT,
                owner: Z_STRING,
                incorporationCertificateNumber: Z_STRING,
                nearestPoliceStation: Z_STRING,
                nearestHealthFacility: Z_STRING,
                nearestTown: Z_STRING,
                //Institution Contacts Tab
                postalAddress: Z_STRING,
                telephoneNumber: Z_STRING,
                mobileNumber: Z_STRING,
                altTelephoneNumber: Z_STRING,
                altMobileNumber: Z_STRING,
                email: Z_STRING,
                website: Z_STRING,
                socialMediaHandles: Z_STRING
            })
            .partial()
            .required({
                name: true,
                knecCode: true,
                code: true,
                gender: true,
                supportedGrades: true,
                educationLevel: true,
                county: true,
                subCounty: true
            })
    };
    protected readonly axiosInstance: AxiosInstance;
    protected readonly SECURE_HEADERS = {
        DNT: '1',
        'Upgrade-Insecure-Requests': '1',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        host: 'nemis.education.go.ke'
    };
    //Axios instance
    protected stateObject;
    #cookie: string | undefined = undefined;

    constructor(cookie?: string, stateObject?: StateObject) {
        this.axiosInstance = axios.create({
            baseURL: nemisBaseUrl
        });
        this.#setupAxiosInterceptors();
        if (cookie) this.#cookie = cookie;
        if (stateObject) this.stateObject = stateObject;
    }

    getState(): StateObject | undefined {
        return this.stateObject;
    }

    /**
     * Logs in the user with the given username and password.
     */

    async login(username: string, password: string): Promise<string> {
        try {
            if (!username || !password) {
                throw new CustomError('Username or password not provided', 401);
            }
            //Get login pae and cookie
            await this.axiosInstance.get('/');
            //Login
            let response = await this.axiosInstance.post(
                '/',
                qs.stringify({
                    ...this.stateObject,
                    ctl00$ContentPlaceHolder1$Login1$LoginButton: 'Log In',
                    ctl00$ContentPlaceHolder1$Login1$UserName: username,
                    ctl00$ContentPlaceHolder1$Login1$Password: password
                })
            );
            //Login successful if redirected to default.aspx

            if (/pageRedirect.+Default.aspx/.test(response?.data)) {
                //if we got redirected to Default.aspx, then login was succeeded
                if (this.#cookie) return this.#cookie;
                else throw new CustomError('Failed to set cookie', 401);
            }
            throw new CustomError('Login failed, Failed to redirect to ./default.aspx', 401);
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
            let institutionHtml = (await this.axiosInstance.get('/Institution/Institution.aspx'))?.data;

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
    async changeResultsPerPage(url: string, gradeOrForm?: Grade) {
        try {
            let getResponse = await this.axiosInstance.get(url);

            // Check if we all getting the entire list
            let table = htmlParser(getResponse?.data)?.querySelector(
                '#ctl00_ContentPlaceHolder1_grdLearners'
            )?.outerHTML;
            if (!table)
                throw {
                    message: "Couldn't parse table element."
                };
            let firstTableElement = tableToJson.convert(table, { stripHtml: false })?.flat()?.shift();
            if (!firstTableElement) return getResponse;
            if (typeof firstTableElement !== 'object') return getResponse;
            let numberOfPages = Object.entries(firstTableElement)
                ?.map(x => {
                    if (typeof x[1] === 'string') {
                        return x[1].match(
                            /__doPostBack\('ctl00\$ContentPlaceHolder1\$grdLearners','Page\$\d+'\)/g
                        );
                    }
                })
                .filter(x => x);
            if (numberOfPages.length === 0) {
                // If page is list learner_router
                if (url === '/Learner/Listlearners.aspx') {
                    //Get the selected grade
                    let selected = htmlParser(getResponse?.data)
                        ?.querySelector('#SelectCat')
                        ?.innerHTML.toLowerCase()
                        .match(/(?<="selected" value="\d+">).*?(?=<)/g);
                    // If they are the same
                    if (
                        selected &&
                        selected.length === 1 &&
                        selected[0].toLowerCase().trim() === gradeOrForm
                    ) {
                        //Return the response we have
                        // Else fall through to POST and get new page
                        return getResponse;
                    }
                } else {
                    // For other pages return response
                    return getResponse;
                }
            }
            //writeFileSync("debug/html/debug.html", getResponse?.data);
            if (url === '/Learner/Listlearners.aspx') {
                await this.axiosInstance.post(
                    '/Learner/Listlearners.aspx',
                    qs.stringify({
                        ...this.stateObject,
                        __ASYNCPOST: 'true',
                        __EVENTTARGET: 'ctl00$ContentPlaceHolder1$SelectRecs',
                        ctl00$ContentPlaceHolder1$ScriptManager1:
                            'ctl00$ContentPlaceHolder1$UpdatePanel1|ctl00$ContentPlaceHolder1$SelectCat',
                        ctl00$ContentPlaceHolder1$SelectBC: '1',
                        ctl00$ContentPlaceHolder1$SelectCat: gradeToNumber(gradeOrForm ?? 'form 1'),
                        ctl00$ContentPlaceHolder1$SelectCat2: '9 ',
                        ctl00$ContentPlaceHolder1$SelectRecs: this.recordsPerPage
                    })
                );
            } else {
                let config = {
                    method: 'post',
                    maxBodyLength: Infinity,
                    url: url,
                    data: qs.stringify({
                        __EVENTARGUMENT: '',
                        __EVENTTARGET: 'ctl00$ContentPlaceHolder1$SelectRecs',
                        __LASTFOCUS: '',
                        __VIEWSTATE: this.stateObject?.__VIEWSTATE,
                        __VIEWSTATEGENERATOR: this.stateObject?.__VIEWSTATEGENERATOR,
                        ctl00$ContentPlaceHolder1$SelectRecs: '25000'
                    })
                };
                if (url === '/Admission/Listlearnersrep.aspx') {
                    Object.assign(config, {
                        headers: {
                            DNT: '1',
                            'Upgrade-Insecure-Requests': '1',
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'User-Agent':
                                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
                            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                            host: 'nemis.education.go.ke'
                        }
                    });
                }
                await this.axiosInstance(config);
            }
            return this.axiosInstance.get(url);
        } catch (err: any) {
            console.error(err);
            throw err;
        }
    }

    // Parse view-state data from web page
    #setViewState(data: string) {
        if (!data || data.length < 100) return;
        let root = htmlParser(data);
        if (root.querySelector('#__VIEWSTATE')?.attrs?.value) {
            let eventArgument = root.querySelector('#__EVENTARGUMENT')?.attrs?.value,
                lastFocus = root.querySelector('#__LASTFOCUS')?.attrs?.value,
                viewStateGenerator = root.querySelector('#__VIEWSTATEGENERATOR')?.attrs?.value,
                eventValidation = root.querySelector('#__EVENTVALIDATION')?.attrs?.value,
                viewState = root.querySelector('#__VIEWSTATE')?.attrs?.value,
                viewStateEncrypted = root.querySelector('#__VIEWSTATEENCRYPTED')?.attrs?.value;

            this.stateObject = {
                __EVENTARGUMENT: eventArgument ? eventArgument : undefined,
                __EVENTVALIDATION: eventValidation ? eventValidation : '',
                __LASTFOCUS: lastFocus ? lastFocus : undefined,
                __VIEWSTATE: viewState ? viewState : '',
                __VIEWSTATEENCRYPTED: viewStateEncrypted ? viewStateEncrypted : undefined,
                __VIEWSTATEGENERATOR: viewStateGenerator ? viewStateGenerator : ''
            };
            return;
        } else {
            let viewState = data?.match(/(?<=(__VIEWSTATE\|)).*?(?=\|)/gm)?.toString(),
                viewStateGenerator = data.match(/(?<=__VIEWSTATEGENERATOR\|).*?(?=\|)/gm)?.toString(),
                eventValidation = data.match(/(?<=__EVENTVALIDATION\|).*?(?=\|)/gm)?.toString();
            //now check if view state is set
            if (viewState || viewStateGenerator) {
                this.stateObject = {
                    __EVENTVALIDATION: eventValidation ? eventValidation : '',
                    __VIEWSTATE: viewState ? viewState : '',
                    __VIEWSTATEGENERATOR: viewStateGenerator ? viewStateGenerator : ''
                };
                return;
            }
            console.error('View sate not saved');
            writeFileSync(homeDir + '/debug/html/view_state_error.hmtl', data);
            throw new CustomError('View state data not found.', 500);
        }
    }

    #setupAxiosInterceptors() {
        this.axiosInstance.interceptors.request.use(
            async config => {
                if (!config.headers['Upgrade-Insecure-Requests'])
                    Object.assign(config.headers, {
                        'Cache-Control': 'no-cache',
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-MicrosoftAjax': 'Delta=true',
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        Accept: '*/*',
                        host: 'nemis.education.go.ke'
                    });
                if (this.#cookie) Object.assign(config.headers, { cookie: this.#cookie });
                return config;
            },
            err => {
                console.error(err);
                return Promise.reject(err);
            }
        );
        // Response interceptor for API calls
        this.axiosInstance.interceptors.response.use(
            response => {
                try {
                    // If we get a page redirect tot login with 200 OK
                    if (
                        (response.data?.length < 50 && /pageRedirect.+Login\.aspx/i.test(response.data)) ||
                        response?.request?.path === '/Login.aspx'
                    ) {
                        response.status = 401;
                        response.statusText = 'Unauthorized';

                        return Promise.reject(
                            new CustomError('Invalid cookie. Got redirected to login page.', 401)
                        );
                    }

                    if (response.data) this.#setViewState(response?.data); // Set view state
                    if (response.headers['set-cookie'])
                        this.#cookie = response.headers['set-cookie']?.toString();
                    // If redirect to ErrorPage.aspx
                    if (/1\|#\|\|4\|17\|pageRedirect\|\|%2fErrorPage.aspx\|/gi.test(response?.data)) {
                        response.status = 401;
                        response.statusText = 'Unauthorized';
                        return Promise.reject(new CustomError('Invalid username or password', 401));
                    }
                    return response;
                } catch (err: any) {
                    return Promise.reject(err);
                }
            },
            err => {
                err.statusCode = err.response?.status;
                if (!err?.response) {
                    switch (err.code) {
                        case 'ETIMEDOUT':
                            err.message = 'Request has timed out';
                            err.type = 'request_timeout';
                            break;
                        case 'ECONNRESET':
                            err.message =
                                'Connection has reset while trying to reach ' +
                                err?.config?.baseURL +
                                err?.config?.url;
                            err.type = 'connection_reset';
                            break;
                        case 'ECONNABORTED':
                            err.message =
                                'Connection was aborted while trying to reach ' +
                                err?.config?.baseURL +
                                err?.config?.url;
                            err.type = 'connection_aborted';
                            break;
                        case 'ENOTFOUND':
                            err.message = `The requested address ${
                                err?.config?.baseURL + err?.config?.url
                            } was not found.`;
                            err.type = 'address_not_found';
                            break;
                        default:
                            err.type = err.code;
                            break;
                    }
                    return err;
                }

                //handle no ENOTFOUND
                switch (err.response?.status) {
                    case 400:
                        if (err.response.statusText === 'Bad Request') {
                            if (err.response?.data?.startsWith('No Form One Admission for')) {
                                err.message = err.response?.data;
                                err.type = 'learner_not_found';
                            }
                        }
                        break;
                    case 500:
                        err.message = 'Internal server error';
                        err.type = 'internal_server_error';
                        break;
                    case 404:
                        err.message = 'Page not found';
                        err.type = 'page_not_found';
                        break;
                    case 403:
                        err.message = 'Forbidden';
                        err.type = 'forbidden';
                        break;
                    case 504:
                        err.message =
                            'Gateway timed out while try to reach ' + err.config?.baseURL + err.config?.url;
                        err.type = 'gateway_timeout';
                        break;
                    default:
                        err.message = err.response?.data || 'Unknown error';
                        err.type = err?.code?.toLowerCase() || 'unknown_error';
                        break;
                }
                return Promise.reject(err);
            }
        );
    }
}

export { NemisWebService };
