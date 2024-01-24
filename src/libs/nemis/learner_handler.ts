/*
 * Copyright (c) 2023-2024. MIT License. Maina Derrick.
 */

import Nemis from '@libs//nemis';
import { parse as htmlParser } from 'node-html-parser';
import { Tabletojson as tableToJson } from 'tabletojson/dist/lib/Tabletojson';
import CustomError from '@libs/error_handler';
import { writeFileSync } from 'fs';
import { AdmittedLearners, Learner, RequestJoiningLearnerDetails } from 'types/nemisApiTypes/learner';
import {
    Z_LIST_ADMITTED_LEARNERS,
    Z_LIST_LEARNERS,
    Z_REQUESTED_LEARNERS,
    Z_SELECTED_LEARNER
} from '@libs/nemis/constants';
import { Grade } from '../../../types/nemisApiTypes/institution';
import * as process from 'process';
import { Browser, Page, PuppeteerLaunchOptions } from 'puppeteer';
import { Z_REQUEST_JOINING_lEARNER } from '@controller/constants';
import { countyToNo, medicalConditionCode, nationalities, splitNames } from '@libs/converts';
import ms from 'ms';

// noinspection SpellCheckingInspection
export default class extends Nemis {
    DATA_DIR = process.env.DATA_DIR;
    DEBUG_DIR = process.env.DEBUG_DIR;

    learnerValidations = {
        listLearnerSchema: Z_LIST_LEARNERS,
        listAdmittedLearnerSchema: Z_LIST_ADMITTED_LEARNERS,
        requestedLeanerSchema: Z_REQUESTED_LEARNERS,
        selectedLaearnerSchema: Z_SELECTED_LEARNER
    };

    constructor(opts?: PuppeteerLaunchOptions, browser?: Browser, page?: Page) {
        super(opts);
        if (browser) this.browser = browser;
        if (page) this.page = page;
    }

    /**
     * Retrieves already admitted learners information by scraping the list learners page,
     * /Leaner/Listlearners.aspx, and parsing its html using node-html-parser.
     */
    async listLearners(gradeOrForm: Grade) {
        try {
            await this.page.goto('http://nemis.education.go.ke/Learner/Listlearners.aspx');

            await this.changeResultsPerPage(undefined, gradeOrForm);

            let parsedPage = htmlParser(await this.page.content());

            let selectedGrade = parsedPage.querySelector('#SelectCat > option:checked')?.innerText;

            // Convert table to json
            const listLearnerTable = parsedPage.querySelector('#ctl00_ContentPlaceHolder1_grdLearners');

            if (!listLearnerTable?.outerHTML) return [];

            // do_postback doesn't match indexNo of each element, so we find the difference and
            // use it to generate the correct postback
            let firstViewElement = listLearnerTable.querySelector('tr.GridRow > td:nth-child(13) > a')?.id;

            if (!firstViewElement)
                throw new CustomError('Failed to get first element from /Learner/Listlearners.aspx', 404);

            let listLearnerJson = tableToJson
                .convert(listLearnerTable?.outerHTML)
                .flat()
                .filter(e => !!e['No.']);

            if (listLearnerJson?.length === 0) return null;

            let firstViewElementNumber = Number(firstViewElement?.match(/(?<=_ctl)[0-9]./)?.shift());

            return listLearnerJson.map(element => {
                let postback = `ctl00_ContentPlaceHolder1_grdLearners_ctl${
                    firstViewElementNumber < 10 ? `0${firstViewElementNumber}` : firstViewElementNumber
                }_BtnView`;
                firstViewElementNumber++;
                return {
                    ...this.learnerValidations.listLearnerSchema.parse(element),
                    postback: postback.replaceAll(/_/g, '$'),
                    grade: selectedGrade
                };
            });
        } catch (err) {
            console.error(err);
            throw err;
        }
    }

    async admitJoiningLearner(learner: Learner) {
        try {
            // await this.page.locator("#Menu1 > li:nth-of-type(2) > a").click();
            // await this.page.locator("li:nth-of-type(2) li:nth-of-type(1) > a").click();

            await this.page.goto('http://nemis.education.go.ke/Learner/Studindex.aspx', {
                waitUntil: 'load'
            });

            let doc = htmlParser(await this.page.content());

            let [canAdmit, canRequest] = [
                doc.querySelector('#txtCanAdmt')?.attrs.value === '1',
                doc.querySelector('#txtCanReq')?.attrs.value === '1'
            ];

            if (!canAdmit) return 'Admitting learners is currently disabled on the Nemis website.';

            this.page.locator('#txtSearch').setEnsureElementIsInTheViewport(true);

            await this.page.type('#txtSearch', String(learner.indexNo));

            let admitButton = await this.page.$('#SearchCmd');

            // Check if admit button is on page
            if (!admitButton) throw new Error("Failed to admit, couldn't find admit button on the page");

            await this.page.locator('#SearchCmd').click();

            await this.page.waitForResponse(
                response =>
                    response
                        .url()
                        .startsWith(`http://nemis.education.go.ke/generic2/api/FormOne/Admission/`) &&
                    response.status() === 200
            );

            // Wait for Request Placement button
            let btnValue = await this.page.$eval('#BtnAdmit', val => (val as HTMLButtonElement).value);
            let contacts = learner.contactDetails;

            await new Promise(resolve => setTimeout(resolve, 1000));

            if (btnValue === 'Request Placement' || btnValue === 'Apply for Downgrade') {
                if (btnValue === 'Apply for Downgrade') await this.page.locator('#BtnAdmit').click();
                let requestData = {
                    name: learner.name,
                    id: contacts?.father?.id || contacts?.mother?.id || contacts?.guardian?.id,
                    requestedBy: `requested by parent/guardian with id number ${
                        contacts?.father?.id || contacts?.mother?.id || contacts?.guardian?.id
                    }`,
                    indexNo: learner.indexNo,
                    tel: contacts?.father?.tel || contacts?.mother?.tel || contacts?.guardian?.tel,
                    adm: learner.adm
                };
                return await this.requestJoiningLearner(Z_REQUEST_JOINING_lEARNER.parse(requestData));
            }

            await this.page.locator('#BtnAdmit').click();

            await this.page.waitForNavigation();

            await this.page.locator('#ctl00_ContentPlaceHolder1_txtUPI').fill(String(learner.adm));
            await this.page
                .locator('#ctl00_ContentPlaceHolder1_txtBCert')
                .fill(String(contacts?.father?.tel || contacts?.mother?.tel || contacts?.guardian?.tel));

            await this.page.locator('#ctl00_ContentPlaceHolder1_BtnAdmit').click();

            await this.page.waitForNavigation({ waitUntil: 'load' });
            await new Promise(resolve => setTimeout(resolve, 1000));

            let message =
                (await this.page.$eval(
                    '#ctl00_ContentPlaceHolder1_ErrorMessage',
                    val => (val as HTMLLabelElement).textContent
                )) || '';

            if (!/ENSURE YOU CAPTURE BIO-DATA/i.test(message))
                throw new CustomError(message || 'Failed to admit learner_router.', 500);
        } catch (err) {
            console.error(err);
            throw err;
        }
    }

    /**
     * This function gets form one learner_router who has been successfully admitted but are awaiting
     * biodata capture
     */
    async listAdmittedJoiningLearners() {
        try {
            await this.page.goto('http://nemis.education.go.ke/Admission/Listlearnersrep.aspx', {
                waitUntil: 'domcontentloaded'
            });
            await this.changeResultsPerPage();

            let tableHtml = htmlParser(await this.page.content())?.querySelector(
                '#ctl00_ContentPlaceHolder1_grdLearners'
            )?.outerHTML;

            if (!tableHtml) return [];

            let admittedLearnerJson = tableToJson.convert(tableHtml, { stripHtmlFromCells: false }).flat();

            if (!admittedLearnerJson || admittedLearnerJson?.length === 0) return [];

            return admittedLearnerJson.map((x, i) => {
                return this.learnerValidations.listAdmittedLearnerSchema.parse({
                    ...x,
                    no: i + 1,
                    postback: 'ctl00$ContentPlaceHolder1$grdLearners',
                    actions: {
                        captureWithBirthCertificate: 'ActionFOS$' + i,
                        captureWithoutBirthCertificate: 'ActionFOSWBC$' + i,
                        resetBiodataCapture: 'ActionReset$' + i,
                        undoAdmission: 'ActionUNDO$' + i
                    }
                });
            });
        } catch (err) {
            console.error(err);
            throw err;
        }
    }

    async captureJoiningBiodata(learner: Learner, listLearner: AdmittedLearners[number]) {
        try {
            await this.page.goto('http://nemis.education.go.ke/Admission/Listlearnersrep.aspx');
            await this.changeResultsPerPage();

            await this.page.locator(`tr:nth-of-type(${listLearner.no - 1}) > td:nth-of-type(9) > a`).click();
            await this.page.waitForNavigation({ waitUntil: 'load' });

            if (this.page.url() === 'http://nemis.education.go.ke/Learner/alearner.aspx')
                return await this.captureBioData(learner);

            // Nemis sometimes assigns a learner UPI here whilst the lerarner has no upi at list learners.
            // If learner has upi, we will not be able to recapture ,delete current upi then try to capture again
            if (this.page.url() === 'http://nemis.education.go.ke/Admission/Listlearnersrep.aspx') {
                let errorMessageElement = await this.page.$('#ctl00_ContentPlaceHolder1_ErrorMessage');

                if (!errorMessageElement) throw new Error('Error message was not painted on the screen');

                if (
                    await errorMessageElement.evaluate(val =>
                        val.outerHTML.startsWith('You Can Not Capture Bio-Data Twice')
                    )
                )
                    await this.captureJoiningBiodata(learner, listLearner);
            } else {
                throw new CustomError('Failed to get learner/alearner.aspx', 500);
            }
        } catch (err) {
            console.error(err);
            throw err;
        }
    }

    async admitDefferedLearner(defferedLearner: Learner) {
        try {
            throw new Error('This feature is not yet implimented');
        } catch (err) {
            console.error(err);
            throw err;
        }
    }

    async requestJoiningLearner(requestDetails: RequestJoiningLearnerDetails[number]) {
        try {
            await this.page.goto('http://nemis.education.go.ke/Learner/Studindex.aspx', {
                waitUntil: 'domcontentloaded'
            });

            let doc = htmlParser(await this.page.content());

            let [canAdmit, canRequest] = [
                doc.querySelector('#txtCanAdmt')?.attrs.value === '1',
                doc.querySelector('#txtCanReq')?.attrs.value === '1'
            ];

            if (!canRequest) return 'Requesting learners is currently disabled on the Nemis website.';

            await this.page.locator('#txtSearch').fill(String(requestDetails.indexNo));

            await this.page.locator('#SearchCmd').click();

            await this.page.waitForResponse(
                response =>
                    response
                        .url()
                        .startsWith(`http://nemis.education.go.ke/generic2/api/FormOne/Admission/`) &&
                    response.status() === 200
            );

            // Wait for Request Placement button
            let requestBtn = await this.page.$eval('#BtnAdmit', val => (val as HTMLButtonElement).value);

            if (requestBtn === 'Admit Student')
                throw new Error('Learner is already selected, awaiting admission.');

            await this.page.locator('#BtnAdmit').click();

            await this.page.locator('#ctl00_ContentPlaceHolder1_txtPhone').fill(requestDetails.tel);
            await this.page.locator('#ctl00_ContentPlaceHolder1_txtIDNo').fill(String(requestDetails.id));
            await this.page
                .locator('#ctl00_ContentPlaceHolder1_txtWReq')
                .fill(String(requestDetails.requestedBy));
            await this.page.locator('#ctl00_ContentPlaceHolder1_txtFileNo').fill(String(requestDetails.adm));

            await this.page.locator('#ctl00_ContentPlaceHolder1_BtnAdmit').click();

            await this.page.waitForNetworkIdle({ timeout: ms('60s') });

            let doc2 = htmlParser(await this.page.content());

            let [message, slotsLeft] = [
                doc2.querySelector('#ctl00_ContentPlaceHolder1_ErrorMessage')?.innerText,
                doc2.querySelector('#ctl00_ContentPlaceHolder1_LblCap')?.innerText
            ];

            console.debug(message);
            console.warn(slotsLeft);

            if (message?.includes('Successfully Saved!!')) return 'Request Successfully Saved!!';
            else throw new Error(message);
        } catch (e) {
            throw e;
        }
    }

    async transferIn(learner: Learner) {
        try {
            await this.page.goto('http://nemis.education.go.ke/Learner/StudReceive.aspx');
            // todo: follow check learner steps

            let message = ''; // read message from page
            if (message.includes('The Transfer Request Saved')) {
                return 'The Transfer Request Saved. Learner Awaits Being Released From Current School Admitted';
            } else {
                writeFileSync(
                    `${this.DEBUG_DIR}/view_state_trasnfer_${
                        learner.adm ?? learner.upi ?? learner.birthCertificateNo
                    }.txt`,
                    message
                );
                throw new CustomError('Failed to save transfer request.', 500);
            }
        } catch (err) {
            console.error(err);
            throw err;
        }
    }

    async getRequestedJoiningLearners() {
        try {
            await this.page.goto('http://nemis.education.go.ke/Learner/Liststudreq.aspx');
            await this.changeResultsPerPage();

            let requestedTable = await this.page.$('#ctl00_ContentPlaceHolder1_grdLearners');

            if (!requestedTable) return [];

            let requestedLearnerJson = tableToJson
                .convert(await requestedTable.evaluate(val => val.outerHTML), { stripHtmlFromCells: false })
                ?.flat()
                .toSpliced(-1, 1);
            return this.learnerValidations.requestedLeanerSchema.parse(requestedLearnerJson);
        } catch (err) {
            console.error(err);
            throw err;
        }
    }

    async getApprovedJoiningLearners() {
        try {
            // Change page size
            await this.page.goto('http://nemis.education.go.ke/Learner/Liststudreqa.aspx');
            await this.changeResultsPerPage();

            if (!(await this.page.$('#ctl00_ContentPlaceHolder1_grdLearners')))
                throw new Error('No Approved learners table found in page.');

            let requestedLearnerJson = tableToJson
                .convert(
                    await this.page.$eval(
                        '#ctl00_ContentPlaceHolder1_grdLearners',
                        val => (val as HTMLTableElement).outerHTML
                    )
                )
                ?.flat()
                .toSpliced(-1, 1); // Last value is alway undefined

            return this.learnerValidations.requestedLeanerSchema.parse(requestedLearnerJson);
        } catch (err) {
            console.error(err);
            throw err;
        }
    }

    async captureBioData(learner: Learner) {
        try {
            const locationDetails = learner.geoLocationDetails;
            const parentContacts = learner.contactDetails;
            let { surname, firstname, otherName } = splitNames(learner.name);
            const medicalCode = medicalConditionCode(learner.medicalCondition);
            const nationality = nationalities(locationDetails?.nationality ?? 'kenya');
            const [county, subCounty] = countyToNo(locationDetails?.county, locationDetails?.subCounty);

            if (!parentContacts) throw new CustomError('No parent contacts found.', 400);

            // Drop incomplete parent contact info
            let { father, mother, guardian } = parentContacts;
            if (!father?.id || !father?.tel || !father?.name) {
                father = undefined;
            }
            if (!mother?.id || !mother?.tel || !mother?.name) {
                mother = undefined;
            }
            if (!guardian?.id || !guardian?.tel || !guardian?.name) {
                guardian = undefined;
            }

            // Validate parameters
            switch (true) {
                case !father && !mother && !guardian:
                    throw new CustomError('No complete parent contacts found.', 400);
                case !learner.gender as boolean:
                    throw new CustomError('Learner gender was not provided.', 400);
                case !learner.birthCertificateNo:
                    throw new CustomError(
                        'Learner birth certificate number was not provided. ' +
                            "Can not capture biodata without learners' birth certificate number",
                        400
                    );
                case !learner.dob?.UTCTimestamp as boolean:
                    throw new CustomError('Date of birth was not submitted for the learner', 400);
                case !surname:
                    let names = father?.name || mother?.name || guardian?.name;
                    if (names) surname = names.split(' ')[1];
                    else surname = '_';
            }

            if (!surname || !firstname || !otherName) throw new Error('Learner names are incomplete');

            let date = [
                learner.dob.UTCTimestamp.getMonth() + 1,
                learner.dob.UTCTimestamp.getDate(),
                learner.dob.UTCTimestamp.getFullYear()
            ];

            // Initial post to set county and get subcounties
            await this.page.locator('#Surname').fill(surname || '_');
            await this.page.locator('#FirstName').fill(firstname);
            await this.page.locator('#OtherNames').fill(otherName);
            await this.page.locator('#Birth_Cert_No').fill(learner.birthCertificateNo);
            await this.page.locator('#DOB').fill(date.join('/'));
            await this.page.locator('#Gender').fill(learner.gender.charAt(0).toUpperCase());
            await this.page.locator('#Nationality').fill(String(nationality));

            await this.page.locator('#ddlmedicalcondition').fill(String(medicalCode));

            if (learner.isSpecial)
                await this.page.locator('#ctl00_ContentPlaceHolder1_optspecialneed').click();
            else await this.page.locator('#ctl00_ContentPlaceHolder1_optneedsno').click();

            // fill countyu and await navigation
            await this.page.locator('#ddlcounty').fill(String(county));
            await this.page.waitForNavigation();

            // fill in subcounty and other contact information
            await this.page.locator('#ddlsubcounty').fill(String(subCounty));

            await this.page.locator('#txtPostalAddress').fill(learner.contactDetails?.address || '');
            // await this.page.locator('#txtEmailAddress')
            // await this.page.locator('#txtmobile')
            if (mother) {
                await this.page.locator('#txtMotherIDNo').fill(mother?.id ?? '');
                await this.page.locator('#txtMotherName').fill(mother?.name ?? '');
                // await this.page.locator('#txtMotherUPI')
                await this.page.locator('#txtMothersContacts').fill(mother?.tel ?? '');
            }
            if (father) {
                await this.page.locator('#txtFatherIDNO').fill(father?.id ?? '');
                await this.page.locator('#txtFatherName').fill(father?.name ?? '');
                // await this.page.locator('#txtFatherUPI')
                await this.page.locator('#txtFatherContacts').fill(father?.tel ?? '');
            }

            if (guardian) {
                await this.page.locator('#txtGuardianIDNO').fill(guardian?.id ?? '');
                await this.page.locator('#txtGuardianname').fill(guardian?.name ?? '');
                // await this.page.locator('#txtGuardianUPI')
                await this.page.locator('#txtGuardiancontacts').fill(guardian?.tel ?? '');
            }

            // submit
            await this.page.locator('#btnUsers2').click();
            await this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 });

            const parseLabels = async () => {
                let aLearnerDocument = htmlParser(await this.page.content());

                let message = aLearnerDocument.querySelector('.alert');

                if (!message?.innerText) {
                    let newUpi = aLearnerDocument.querySelector(
                        '#ctl00_ContentPlaceHolder1_instmessage'
                    )?.innerText;

                    if (typeof newUpi === 'string' && newUpi.startsWith('New UPI:'))
                        return {
                            upi: newUpi.replace('New UPI: ', ''),
                            originalString: newUpi,
                            message: newUpi
                        };

                    throw new Error(
                        'Alert message is missing. We were not able to parse message from the page.'
                    );
                }

                // If learner got assigned UPI number
                if (/The Learner Basic Details have been Saved successfully/.test(message?.innerText)) {
                    await this.page.goBack();
                    return {
                        upi: aLearnerDocument.querySelector('#UPI')?.attrs?.value,
                        message: message.innerText.replace('&times;  ', ''),
                        originalString: message.outerHTML
                    };
                }

                if (/Failure!/g.test(message?.innerText))
                    if (
                        message.innerText.includes('Birth Certificate Number is in use by another Learner:')
                    ) {
                        // Ignore birth certificate in use error
                        await this.page.locator('#ctl00_ContentPlaceHolder1_optignoreyes').click();

                        await this.page.locator('#btnUsers2').click();
                        await this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 });

                        await parseLabels();
                    } else throw new Error(message?.innerText);

                // We can't take this as an assurance everything went well, because if it did, we'd have already returned with the new UPI
                throw new Error(`Unknown Error: ${message.innerText}`);
            };

            await parseLabels();
        } catch (err: any) {
            console.error(err);
            throw err;
        }
    }

    /*

    //submit to NHIF
    async submitToNhif(grade: Grade, learner: ListLearners[number]) {
        try {
            // todo: lazy mode, thi is waay easier

            if (!(await this.page.$('#LblMsgContact'))) throw new Error('No Message returned.');
            let message = await this.page.$eval('#LblMsgContact', val => (val as HTMLLabelElement).innerText);

            if (!message) throw new Error('Failed to get NHIF number');

            if (message.startsWith('The remote server returned an error:'))
                throw new CustomError(message, 500);
            return {
                nhifNo: message.match(/\d.+/g)?.shift()?.trim(),
                originalMessage: message.replace(/&times;\W|\d+/g, '')?.trim()
            };
        } catch (err) {
            console.error(err);
            throw err;
        }
    }

    /**
     * Retrieves selection list information by scraping the selected learners page,
     * /Admission/Listlearners.aspx, and parsing its html using node-html-parser.
     */
    async getSelectedLearners() {
        try {
            await this.page.goto('http://nemis.education.go.ke/Admission/Listlearners.aspx');
            await this.changeResultsPerPage();

            const selectedLearners = this.page.$('#ctl00_ContentPlaceHolder1_grdLearners');

            if (!selectedLearners) throw new Error('No selected learenrs table was found on the page.');

            let selectedLearnerHtmlTable = await this.page.$eval(
                '#ctl00_ContentPlaceHolder1_grdLearners',
                val => (val as HTMLTableElement).outerHTML
            );

            const selectedLearnersJson = tableToJson.convert(selectedLearnerHtmlTable);

            return this.learnerValidations.selectedLaearnerSchema.parse(selectedLearnersJson.flat());
        } catch (err) {
            console.error(err);
            throw err;
        }
    }

    /*  async captureContinuing(learner: Learner) {
          try {
              await this.listLearners(learner.grade);
              
              let addLearnerBC = await this.axiosInstance.post(
                  "/Learner/Listlearners.aspx",
                  qs.stringify({
                      ...this.stateObject,
                      __ASYNCPOST: "true",
                      __EVENTTARGET: "ctl00$ContentPlaceHolder1$SelectRecs",
                      ctl00$ContentPlaceHolder1$ScriptManager1:
                          "ctl00$ContentPlaceHolder1$UpdatePanel1|ctl00$ContentPlaceHolder1$SelectCat",
                      ctl00$ContentPlaceHolder1$SelectBC: "1",
                      ctl00$ContentPlaceHolder1$SelectCat: gradeToNumber(learner.grade),
                      ctl00$ContentPlaceHolder1$SelectCat2: "9 ",
                      ctl00$ContentPlaceHolder1$SelectRecs: this.recordsPerPage,
                      ctl00$ContentPlaceHolder1$Button1: "[ ADD NEW STUDENT (WITH BC)]"
                  })
              );
              //writeFileSync('debug/getalearner.html', addLearnerBC?.data);
              
              if (addLearnerBC?.data === "1|#||4|26|pageRedirect||%2fLearner%2fAlearner.aspx|") {
                  return this.captureBioData(learner);
              }
              throw new CustomError("Failed to redirect to alearner.apsx", 400);
          } catch (err) {
              throw err;
          }
      }*/
}
