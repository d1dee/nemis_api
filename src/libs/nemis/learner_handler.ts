/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { NemisWebService } from "@libs/nemis";
import { parse as htmlParser } from "node-html-parser";
import { Tabletojson as tableToJson } from "tabletojson/dist/lib/Tabletojson";
import CustomError from "@libs/error_handler";
import qs from "qs";
import { writeFileSync } from "fs";
import { Admission, AdmittedLearners, Learner, ListLearners, Results } from "types/nemisApiTypes/learner";
import buffer from "buffer";
import { gradeToNumber, medicalConditionCode, nationalities, splitNames } from "@libs/converts";
import FormData from "form-data";
import { z } from "zod";
import { format } from "date-fns";
import { Z_NEMIS_DATE } from "@libs/nemis/constants";
import { Z_GENDER, Z_NUMBER, Z_STRING } from "@libs/constants";
import { Grade } from "../../../types/nemisApiTypes/institution";

type RequestedBy = {
    requestString: string;
    id: string;
    tel: string;
};
type SchoolSelected = {
    originalString?: string;
    code: string;
    name: string;
    type: string;
    category: string;
};

const homeDir = process.env.HOME_DIR;
const debugDir = homeDir + '/debug';

// noinspection SpellCheckingInspection
export default class extends NemisWebService {
    learnerValidations = {
        listLearnerSchema: z
            .object({
                'Learner UPI': Z_STRING,
                'Learner Name': Z_STRING,
                Gender: Z_GENDER,
                'Date of Birth': Z_NEMIS_DATE,
                AGE: Z_NUMBER,
                'Birth Cert No': Z_STRING,
                Disability: z.coerce.boolean(),
                'Medical Condition': Z_STRING,
                'Home Phone': Z_STRING,
                'NHIF No': Z_STRING
            })
            .transform(learner => ({
                upi: learner['Learner UPI'],
                name: learner['Learner Name'],
                gender: learner['Gender'],
                dob: learner['Date of Birth'],
                age: learner['AGE'],
                birthCertificateNo: learner['Birth Cert No'],
                isSpecial: learner['Disability'],
                medicalCondition: learner['Medical Condition'],
                homePhone: learner['Home Phone'],
                nhifNo: learner['NHIF No']
            })),
        listAdmittedLearnerSchema: z
            .object({
                Index: Z_STRING,
                Name: Z_STRING,
                Gender: Z_STRING,
                'Year of Birth': Z_STRING,
                Marks: Z_NUMBER,
                'Sub-County': Z_STRING,
                UPI: Z_STRING,
                no: Z_NUMBER,
                postback: Z_STRING,
                actions: z.object({
                    captureWithBirthCertificate: Z_STRING,
                    captureWithoutBirthCertificate: Z_STRING,
                    resetBiodataCapture: Z_STRING,
                    undoAdmission: Z_STRING
                })
            })
            .transform(learner => {
                return {
                    indexNo: learner['Index'],
                    name: learner['Name'],
                    gender: learner['Gender'],
                    yob: learner['Year of Birth'],
                    marks: learner['Marks'],
                    subCounty: learner['Sub-County'],
                    upi: learner['UPI'] === '&nbsp;' ? undefined : learner['UPI'],
                    no: learner.no,
                    postback: learner.postback,
                    actions: learner.actions
                };
            }),
        requestedLeanerSchema: z.array(
            z
                .object({
                    ['No.']: Z_NUMBER,
                    ['Index No']: Z_STRING,
                    ['Student Name']: Z_STRING,
                    ['Gender']: Z_GENDER,
                    ['Marks']: Z_NUMBER.min(0).max(500),
                    ['Current Selected To']: Z_STRING.transform(
                        label =>
                            <SchoolSelected>{
                                originalString: label,
                                ...[
                                    ...label?.matchAll(
                                        /(?<code>\d+).+(?<name>(?<=\d )[a-zA-Z ].+)School Type:(?<type>[a-zA-Z]+).School Category:(?<category>[a-zA-Z]+)/gi
                                    )
                                ][0]?.groups
                            }
                    ),
                    ['Request Description']: Z_STRING,
                    ["Parent's IDNo"]: Z_STRING,
                    ['Mobile No']: Z_STRING,
                    ['Date Captured']: Z_STRING,

                    ['Approved By']: Z_STRING,
                    ['Approved On']: Z_NEMIS_DATE,

                    ['Status']: Z_STRING,
                    [13]: Z_STRING.regex(/ctl.*?Del/g)
                })
                .partial()
                .transform(learner => ({
                    no: learner['No.'],
                    indexNo: learner['Index No'],
                    name: learner['Student Name']?.toLowerCase(),
                    gender: learner['Gender']?.toLowerCase(),
                    marks: learner['Marks'],
                    schoolSelected: learner['Current Selected To'],
                    requestedBy: learner['Request Description'],
                    parentId: learner["Parent's IDNo"],
                    parentTel: learner['Mobile No'],
                    dateCaptured: learner['Date Captured'],
                    approved: {
                        by: learner['Approved By'],
                        on: learner['Approved On']
                    },
                    status: learner['Status'],
                    deleteCallback: learner[13]
                }))
        ),
        selectedLaearnerSchema: z.array(
            z
                .object({
                    ['Index']: Z_STRING,
                    ['Name']: Z_STRING,
                    ['Gender']: Z_GENDER,
                    ['Year of Birth']: Z_NUMBER,
                    ['Marks']: Z_NUMBER.min(0).max(500),
                    ['Sub-County']: Z_STRING
                })
                .transform(learner => ({
                    indexNo: learner.Index,
                    name: learner.Name,
                    gender: learner.Gender,
                    yearOfBirth: learner['Year of Birth'],
                    marks: learner.Marks,
                    subCounty: learner['Sub-County']
                }))
        )
    };

    constructor() {
        super();
    }

    /**
     * Retrieves already admitted learners information by scraping the list learners page,
     * /Leaner/Listlearners.aspx, and parsing its html using node-html-parser.
     */
    async listLearners(gradeOrForm: Grade) {
        try {
            let listLearnersHtml = (
                await this.changeResultsPerPage('/Learner/Listlearners.aspx', gradeOrForm)
            )?.data;

            // Convert table to json
            const listLearnerTable = htmlParser(listLearnersHtml).querySelector(
                '#ctl00_ContentPlaceHolder1_grdLearners'
            );

            if (!listLearnerTable?.outerHTML) return null;

            // do_postback doesn't match indexNo of each element, so we find the difference and
            // use it to generate the correct postback
            let firstViewElement = listLearnerTable.querySelector('tr.GridRow > td:nth-child(13) > a')?.id;

            if (!firstViewElement)
                throw new CustomError('Failed to get first element from /Learner/Listlearners.aspx', 404);

            let listLearnerJson = tableToJson
                .convert(listLearnerTable?.outerHTML)
                .flat()
                .filter(e => !!e['No.']);

            if (listLearnerJson.length === 0) return null;

            let firstViewElementNumber = Number(firstViewElement?.match(/(?<=_ctl)[0-9]./)?.shift());

            return listLearnerJson.map(element => {
                let postback = `ctl00_ContentPlaceHolder1_grdLearners_ctl${
                    firstViewElementNumber < 10 ? `0${firstViewElementNumber}` : firstViewElementNumber
                }_BtnView`;
                firstViewElementNumber++;
                return {
                    ...this.learnerValidations.listLearnerSchema.parse(element),
                    postback: postback.replaceAll(/_/g, '$'),
                    grade: gradeOrForm
                };
            });
        } catch (err) {
            console.error(err);
            throw err;
        }
    }

    async admitJoiningLearner(learner: Learner, results: Results, admissionResults: Admission) {
        try {
            const studentIndexDocument = htmlParser(
                (await this.axiosInstance.get('/Learner/Studindex.aspx'))?.data
            );

            let canAdmit = studentIndexDocument.querySelector('#txtCanAdmt')?.attrs?.value !== '0';
            let canRequest = studentIndexDocument.querySelector('#txtCanReq')?.attrs?.value !== '0';

            if (!canAdmit)
                throw new CustomError('Admitting learners is currently disabled on the Nemis website.', 400);

            let postHtml = await this.axiosInstance({
                method: 'post',
                url: '/Learner/Studindex.aspx',
                headers: this.SECURE_HEADERS,
                data: qs.stringify({
                    ...this.stateObject,
                    ctl00$ContentPlaceHolder1$BtnAdmit: 'Admit Student',
                    ctl00$ContentPlaceHolder1$ScriptManager1:
                        'ctl00$ContentPlaceHolder1$UpdatePanel1|ctl00$ContentPlaceHolder1$BtnAdmit',
                    ctl00$ContentPlaceHolder1$txtAdmt: 1,
                    ctl00$ContentPlaceHolder1$txtCanAdmt: canAdmit ? 1 : 0,
                    ctl00$ContentPlaceHolder1$txtCanReq: canRequest ? 1 : 0,
                    ctl00$ContentPlaceHolder1$txtGender: learner.gender.toUpperCase(),
                    ctl00$ContentPlaceHolder1$txtIndex: learner.indexNo,
                    ctl00$ContentPlaceHolder1$txtMarks: learner.marks,
                    ctl00$ContentPlaceHolder1$txtName: learner.name,
                    ctl00$ContentPlaceHolder1$txtReq: 0,
                    ctl00$ContentPlaceHolder1$txtSName: admissionResults?.originalString,
                    ctl00$ContentPlaceHolder1$txtSName2: admissionResults?.originalString,
                    ctl00$ContentPlaceHolder1$txtSchool: results.selectedSchool?.knecCode,
                    ctl00$ContentPlaceHolder1$txtSearch: learner.indexNo,
                    ctl00$ContentPlaceHolder1$txtStatus: ''
                })
            });

            if (/^.+pageRedirect.+Learner.+fStudindexreq/gi.test(postHtml?.data))
                throw new CustomError('Admission failed, please request learner first', 400);

            if (postHtml.request?.path === '/Learner/Studindexchk.aspx') {
                const tel =
                    learner.contactDetails?.father?.tel ??
                    learner.contactDetails?.mother?.tel ??
                    learner.contactDetails?.guardian?.tel;

                if (!tel)
                    throw new CustomError("Ther is no phon enumber in the learner's contact details", 400);

                let postAdmHtml = await this.axiosInstance({
                    method: 'post',
                    url: '/Learner/Studindexchk.aspx',
                    headers: this.SECURE_HEADERS,
                    data: {
                        ...this.stateObject,
                        ctl00$ContentPlaceHolder1$BtnAdmit: 'Admit Student',
                        ctl00$ContentPlaceHolder1$txtBCert: tel,
                        ctl00$ContentPlaceHolder1$txtGender: learner.gender,
                        ctl00$ContentPlaceHolder1$txtIndex: learner.indexNo,
                        ctl00$ContentPlaceHolder1$txtMarks: learner.marks,
                        ctl00$ContentPlaceHolder1$txtName: learner.name,
                        ctl00$ContentPlaceHolder1$txtUPI: learner.adm
                    }
                });

                let message = htmlParser(postAdmHtml?.data)?.querySelector(
                    '#ctl00_ContentPlaceHolder1_ErrorMessage'
                )?.innerHTML;

                if (
                    !message ||
                    !/THE STUDENT HAS BEEN ADMITTED TO THE SCHOOL\. ENSURE YOU CAPTURE BIO-DATA/.test(message)
                ) {
                    writeFileSync(
                        `${debugDir}/debug/html/post_Learner_Studindexchk.aspx${learner.adm}.html`,
                        (await this.axiosInstance.get('/Learner/Studindexchk.aspx'))?.data
                    );
                    throw new CustomError(message || 'Failed to admit learner_router.', 500);
                }
            } else {
                writeFileSync(`${debugDir}/html/posting_admit_${learner.indexNo}.html`, postHtml?.data);

                throw new CustomError("Couldn't redirect to admit learner", 500);
            }
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
            let admittedLearnerHtml = (await this.changeResultsPerPage('/Admission/Listlearnersrep.aspx'))
                ?.data;

            if (!admittedLearnerHtml)
                throw new CustomError('Failed to get hmtl table of admitted learner', 500);

            let admittedLearnerTable = htmlParser(admittedLearnerHtml)?.querySelector(
                '#ctl00_ContentPlaceHolder1_grdLearners'
            )?.outerHTML;

            if (!admittedLearnerTable) return [];

            let admittedLearnerJson = tableToJson
                .convert(admittedLearnerTable, {
                    stripHtmlFromCells: false
                })
                .flat();

            if (!admittedLearnerJson || admittedLearnerJson.length === 0) return [];

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

    async captureJoiningBiodata(learner: Learner, admittedLearner: AdmittedLearners[number]) {
        try {
            if (learner.upi)
                return {
                    originalString: 'Learner has an UPI',
                    upi: learner.upi
                };

            let postResponse = await this.axiosInstance({
                method: 'post',
                url: '/Admission/Listlearnersrep.aspx',
                data: {
                    ...this.stateObject,
                    __EVENTTARGET: admittedLearner.postback,
                    __EVENTARGUMENT: admittedLearner.actions.captureWithBirthCertificate,
                    ctl00$ContentPlaceHolder1$SelectRecs: this.recordsPerPage
                },
                headers: this.SECURE_HEADERS
            });

            if (postResponse?.request?.path === '/Learner/alearner.aspx') return this.captureBioData(learner);

            if (postResponse?.request?.path === '/Admission/Listlearnersrep.aspx') {
                let errorMessage = htmlParser(postResponse?.data)?.querySelector(
                    '#ctl00_ContentPlaceHolder1_ErrorMessage'
                )?.innerText;

                if (
                    errorMessage &&
                    errorMessage.startsWith(
                        'You Can Not Capture Bio-Data Twice for this Student. Use the LEARNER'
                    )
                ) {
                    // Reset then capture biodata
                    await this.axiosInstance({
                        method: 'post',
                        url: '/Admission/Listlearnersrep.aspx',
                        data: {
                            ...this.stateObject,
                            __EVENTTARGET: admittedLearner.postback,
                            __EVENTARGUMENT: admittedLearner.actions.resetBiodataCapture,
                            ctl00$ContentPlaceHolder1$SelectRecs: this.recordsPerPage
                        },
                        headers: this.SECURE_HEADERS
                    });

                    await this.captureJoiningBiodata(learner, admittedLearner);
                }
            } else {
                writeFileSync(`${debugDir}/html/get_a_learner_${learner?.indexNo}.html`, postResponse?.data);
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

    async requestJoiningLearner(learner: Learner, admissionData: Admission, requestedBy: RequestedBy) {
        try {
            const studentIndexDocument = htmlParser(
                (await this.axiosInstance.get('/Learner/Studindex.aspx'))?.data
            );
            let canAdmit = studentIndexDocument.querySelector('#txtCanAdmt')?.attrs?.value !== '0';
            let canRequest = studentIndexDocument.querySelector('#txtCanReq')?.attrs?.value !== '0';
            if (!canRequest)
                throw {
                    message: 'Requesting learners is currently disabled on the Nemis website.'
                };
            let postHtml = (
                await this.axiosInstance({
                    method: 'post',
                    url: '/Learner/Studindex.aspx',
                    data: qs.stringify({
                        ...this.stateObject,
                        ctl00$ContentPlaceHolder1$BtnAdmit: 'Request Placement',
                        ctl00$ContentPlaceHolder1$ScriptManager1:
                            'ctl00$ContentPlaceHolder1$UpdatePanel1|ctl00$ContentPlaceHolder1$BtnAdmit',
                        ctl00$ContentPlaceHolder1$txtAdmt: 0,
                        ctl00$ContentPlaceHolder1$txtCanAdmt: canAdmit ? 1 : 0,
                        ctl00$ContentPlaceHolder1$txtCanReq: canRequest ? 1 : 0,
                        ctl00$ContentPlaceHolder1$txtGender: learner?.gender,
                        ctl00$ContentPlaceHolder1$txtIndex: learner?.indexNo,
                        ctl00$ContentPlaceHolder1$txtMarks: learner?.marks,
                        ctl00$ContentPlaceHolder1$txtName: learner?.name,
                        ctl00$ContentPlaceHolder1$txtReq: 1,
                        ctl00$ContentPlaceHolder1$txtSName: admissionData?.originalString,
                        ctl00$ContentPlaceHolder1$txtSName2: admissionData?.originalString,
                        ctl00$ContentPlaceHolder1$txtSchool: admissionData?.code,
                        ctl00$ContentPlaceHolder1$txtSearch: learner?.indexNo,
                        ctl00$ContentPlaceHolder1$txtStatus: ''
                    })
                })
            )?.data;
            writeFileSync(homeDir + '/debug/html/search.html', postHtml);
            if (!/^.+pageRedirect.+Learner.+fStudindexreq/gi.test(postHtml)) {
                let viewstateAtob = buffer.atob(this.stateObject?.__VIEWSTATE || '');
                if (viewstateAtob && /School Vacacies are exhausted!!/.test(viewstateAtob))
                    throw {
                        message:
                            'The School Vacancies are exhausted!!. Request for Extra' +
                            ' Slots from Director Secondary!!'
                    };
                else
                    throw {
                        message: "Failed to redirect to '/Learner/Studindexreq.aspx'.",
                        cause: learner
                    };
            }

            await this.axiosInstance.get('/Learner/Studindexreq.aspx');

            switch (true) {
                case !!requestedBy.id && !!requestedBy.tel:
                    break;
                case !!learner.contactDetails?.father?.id && !!learner.contactDetails?.father?.tel:
                    requestedBy = {
                        requestString: `Requested by father with id number ${learner.contactDetails?.father?.id}`,
                        id: learner.contactDetails?.father?.id!,
                        tel: learner.contactDetails?.father?.tel!
                    };
                    break;
                case !!learner.contactDetails?.mother?.id && !!learner.contactDetails?.mother?.tel:
                    requestedBy = {
                        requestString: `Requested by mother with id number ${learner.contactDetails?.mother?.id}`,
                        id: learner.contactDetails?.mother?.id!,
                        tel: learner.contactDetails?.mother?.tel!
                    };
                    break;
                case !!learner.contactDetails?.guardian?.id && !!learner.contactDetails?.guardian?.tel:
                    requestedBy = {
                        requestString: `Requested by guardian with id number ${learner.contactDetails?.guardian?.id}`,
                        id: learner.contactDetails?.guardian?.id!,
                        tel: learner.contactDetails?.guardian?.tel!
                    };
                    break;
                default:
                    throw new CustomError('requestedBy can not be undefined.');
            }

            postHtml = (
                await this.axiosInstance({
                    method: 'post',
                    url: '/Learner/Studindexreq.aspx',
                    data: qs.stringify({
                        ...this.stateObject,
                        ctl00$ContentPlaceHolder1$BtnAdmit: 'Apply',
                        ctl00$ContentPlaceHolder1$ScriptManager1:
                            'ctl00$ContentPlaceHolder1$UpdatePanel1|ctl00$ContentPlaceHolder1$BtnAdmit',
                        ctl00$ContentPlaceHolder1$txtFileNo: learner.adm,
                        ctl00$ContentPlaceHolder1$txtGender: learner?.gender.split('')[0],
                        ctl00$ContentPlaceHolder1$txtIndex: learner?.indexNo,
                        ctl00$ContentPlaceHolder1$txtMarks: learner?.marks,
                        ctl00$ContentPlaceHolder1$txtName: learner?.name,
                        ctl00$ContentPlaceHolder1$txtIDNo: requestedBy.id,
                        ctl00$ContentPlaceHolder1$txtPhone: requestedBy.tel,
                        ctl00$ContentPlaceHolder1$txtWReq: requestedBy.requestString
                    })
                })
            )?.data;

            if (
                htmlParser(postHtml).querySelector('#ctl00_ContentPlaceHolder1_ErrorMessage')?.innerText ===
                'Request Successfully Saved!!'
            )
                return true;

            let message = htmlParser(postHtml).querySelector(
                '#ctl00_ContentPlaceHolder1_ErrorMessage'
            )?.innerText;

            if (message) throw { message: `Requesting learner failed with error: ${message}` };
            else writeFileSync(`${debugDir}/html/posting_request_${learner.indexNo}.html`, postHtml);

            throw new CustomError("Couldn't parse any error message. Saved response file for debug", 500);
        } catch (err) {
            console.error(err);

            throw err;
        }
    }

    async transferIn(learner: Learner) {
        try {
            await this.axiosInstance.get('/Learner/StudReceive.aspx');

            await this.axiosInstance.post(
                '/Learner/StudReceive.aspx',
                qs.stringify({
                    ...this.stateObject,
                    ctl00$ContentPlaceHolder1$DrpReason: '1',
                    ctl00$ContentPlaceHolder1$SearchCmd: 'CHECK',
                    ctl00$ContentPlaceHolder1$txtRemark: '',
                    ctl00$ContentPlaceHolder1$txtSearch: learner.upi || learner.birthCertificateNo
                })
            );

            // Post save to confirm transfer
            let response = await this.axiosInstance.post(
                '/Learner/StudReceive.aspx',
                qs.stringify({
                    ...this.stateObject,
                    ctl00$ContentPlaceHolder1$BtnAdmit: '[ SAVE ]',
                    ctl00$ContentPlaceHolder1$DrpReason: '1',
                    ctl00$ContentPlaceHolder1$txtRemark: '',
                    ctl00$ContentPlaceHolder1$txtSearch: learner.upi || learner.birthCertificateNo
                })
            );

            // Base 64 decode returned view state
            if (!response?.data || !this.stateObject?.__VIEWSTATE) {
                throw new CustomError('Confirmation view state was not returned.', 500);
            }
            let decodeResponse = Buffer.from(this.stateObject?.__VIEWSTATE, 'base64').toString();

            if (decodeResponse.includes('The Transfer Request Saved')) {
                return 'The Transfer Request Saved. Learner Awaits Being Released From Current School Admitted';
            } else {
                writeFileSync(
                    `${debugDir}/view_state/trasnfer/${
                        learner.adm ?? learner.upi ?? learner.birthCertificateNo
                    }.txt`,
                    decodeResponse
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
            let requestedJoiningLearnerTable = htmlParser(
                (await this.changeResultsPerPage('/Learner/Liststudreq.aspx'))?.data
            )?.querySelector('#ctl00_ContentPlaceHolder1_grdLearners')?.outerHTML;

            if (!requestedJoiningLearnerTable) return [];

            let requestedLearnerJson = tableToJson.convert(requestedJoiningLearnerTable, {
                ignoreHiddenRows: true,
                stripHtmlFromCells: false
            });
            return this.learnerValidations.requestedLeanerSchema.parse(requestedLearnerJson);
        } catch (err) {
            console.error(err);
            throw err;
        }
    }

    async getApprovedJoiningLearners() {
        try {
            // Change page size
            let getAllHtml = (await this.changeResultsPerPage('/Learner/Liststudreqa.aspx'))?.data;

            let requestedJoiningLearnerTable = htmlParser(getAllHtml).querySelector(
                '#ctl00_ContentPlaceHolder1_grdLearners'
            )?.outerHTML;

            if (!requestedJoiningLearnerTable) return [];

            let requestedLearnerJson = tableToJson.convert(requestedJoiningLearnerTable)?.flat();

            return this.learnerValidations.requestedLeanerSchema.parse(requestedLearnerJson);
        } catch (err) {
            console.error(err);
            throw err;
        }
    }

    //capture Bio data
    async captureBioData(learner: Learner) {
        try {
            const locationDetails = learner.geoLocationDetails;
            const parentContacts = learner.contactDetails;
            const names = splitNames(learner.name);
            const medicalCode = medicalConditionCode(learner.medicalCondition);
            const nationality = nationalities(locationDetails?.nationality ?? 'kenya');

            if (!parentContacts) throw new CustomError('No parents contacts associated with the learner.');

            if (!learner?.birthCertificateNo)
                throw new CustomError(
                    'Learner birth certificate number was not provided. ' +
                        "Can not capture biodata without learners' birth certificate number",
                    400
                );
            if (!learner.dob) throw new CustomError('Date of birth was not submitted for the learner', 400);

            // Initial POST to set county
            await this.axiosInstance.get('/Learner/alearner.aspx');

            let postData = qs.stringify({
                __ASYNCPOST: 'true',
                __EVENTTARGET: 'ctl00$ContentPlaceHolder1$ddlcounty',
                __EVENTARGUMENT: '',
                __EVENTVALIDATION: this.stateObject?.__EVENTVALIDATION,
                __LASTFOCUS: '',
                __VIEWSTATE: this.stateObject?.__VIEWSTATE,
                __VIEWSTATEENCRYPTED: '',
                __VIEWSTATEGENERATOR: this.stateObject?.__VIEWSTATEGENERATOR,
                ctl00$ContentPlaceHolder1$DOB$ctl00: format(learner.dob.UTCTimestamp, 'MM/dd/yyyy'),
                ctl00$ContentPlaceHolder1$Nationality: nationality,
                ctl00$ContentPlaceHolder1$ScriptManager1:
                    'ctl00$ContentPlaceHolder1$UpdatePanel1|ctl00$ContentPlaceHolder1$ddlcounty',
                ctl00$ContentPlaceHolder1$ddlClass: gradeToNumber(learner.grade),
                ctl00$ContentPlaceHolder1$ddlcounty: locationDetails?.countyNo,
                ctl00$ContentPlaceHolder1$ddlmedicalcondition: medicalCode,
                ctl00$ContentPlaceHolder1$ddlsubcounty: '0'
            });

            let aLearnerHtml = (await this.axiosInstance.post('/Learner/alearner.aspx', postData))?.data;

            if (!/^.+updatePanel\|ctl00_ContentPlaceHolder1_UpdatePanel1/g.test(aLearnerHtml))
                throw new CustomError("Failed to submit learner's county.", 500);

            let formDataObject = {};

            Object.assign(formDataObject, {
                __EVENTARGUMENT: '',
                __EVENTTARGET: '',
                __EVENTVALIDATION: this.stateObject?.__EVENTVALIDATION,
                __VIEWSTATE: this.stateObject?.__VIEWSTATE,
                __VIEWSTATEGENERATOR: this.stateObject?.__VIEWSTATEGENERATOR,
                __LASTFOCUS: '',
                __VIEWSTATEENCRYPTED: '',
                ctl00$ContentPlaceHolder1$Birth_Cert_No: learner.birthCertificateNo,
                ctl00$ContentPlaceHolder1$DOB$ctl00: format(learner.dob.UTCTimestamp, 'MM/dd/yyyy'),
                ctl00$ContentPlaceHolder1$Gender: learner.gender.split('')[0].toUpperCase(),
                ctl00$ContentPlaceHolder1$FirstName: names.firstname,
                ctl00$ContentPlaceHolder1$Nationality: nationality,
                ctl00$ContentPlaceHolder1$OtherNames: names.otherName,
                ctl00$ContentPlaceHolder1$Surname: names.surname,
                ctl00$ContentPlaceHolder1$UPI: '',
                ctl00$ContentPlaceHolder1$ddlcounty: locationDetails?.countyNo,
                ctl00$ContentPlaceHolder1$ddlmedicalcondition: medicalCode,
                ctl00$ContentPlaceHolder1$ddlsubcounty: locationDetails?.subCountyNo,
                ctl00$ContentPlaceHolder1$mydob: '',
                ctl00$ContentPlaceHolder1$myimage: '',
                ctl00$ContentPlaceHolder1$txtPostalAddress: parentContacts?.address || '',
                ctl00$ContentPlaceHolder1$txtSearch: '',
                ctl00$ContentPlaceHolder1$txtmobile: '',
                ctl00$ContentPlaceHolder1$optspecialneed: learner.isSpecial ? 'optspecialneed' : 'optneedsno',
                ctl00$ContentPlaceHolder1$txtEmailAddress: ''
            });

            if (parentContacts.father) {
                Object.assign(formDataObject, {
                    ctl00$ContentPlaceHolder1$txtFatherContacts: parentContacts.father.tel,
                    ctl00$ContentPlaceHolder1$txtFatherIDNO: parentContacts.father.id,
                    ctl00$ContentPlaceHolder1$txtFatherName: parentContacts.father.name,
                    ctl00$ContentPlaceHolder1$txtFatherUPI: ''
                });
            }

            if (parentContacts.guardian) {
                Object.assign(formDataObject, {
                    ctl00$ContentPlaceHolder1$txtGuardianIDNO: parentContacts.guardian.id,
                    ctl00$ContentPlaceHolder1$txtGuardianname: parentContacts.guardian.name,
                    ctl00$ContentPlaceHolder1$txtGuardianUPI: '',
                    ctl00$ContentPlaceHolder1$txtGuardiancontacts: parentContacts.guardian.tel
                });
            }
            if (parentContacts.mother) {
                Object.assign(formDataObject, {
                    ctl00$ContentPlaceHolder1$txtMotherIDNo: parentContacts.mother.id,
                    ctl00$ContentPlaceHolder1$txtMotherName: parentContacts.mother.name,
                    ctl00$ContentPlaceHolder1$txtMotherUPI: '',
                    ctl00$ContentPlaceHolder1$txtMothersContacts: parentContacts.mother.tel
                });
            }

            Object.assign(formDataObject, {
                ctl00$ContentPlaceHolder1$btnUsers2: 'Save Basic Details'
            });

            let formData = new FormData();
            Object.entries(formDataObject).forEach(([key, value]) => formData.append(key, value));

            aLearnerHtml = await this.axiosInstance({
                method: 'post',
                url: '/Learner/alearner.aspx',
                headers: {
                    ...this.SECURE_HEADERS,
                    ...formData.getHeaders()
                },
                data: formData
            });

            // Check if we have "ignore this error" prompt
            let ignoreErrorPrompt = htmlParser(aLearnerHtml?.data).querySelector(
                '#ctl00_ContentPlaceHolder1_MyDiag'
            )?.innerText;

            if (
                ignoreErrorPrompt &&
                /do you want to ignore this error/.test(ignoreErrorPrompt?.toLowerCase())
            ) {
                Object.assign(formDataObject, {
                    __EVENTARGUMENT: '',
                    __EVENTTARGET: '',
                    __EVENTVALIDATION: this.stateObject?.__EVENTVALIDATION,
                    __VIEWSTATE: this.stateObject?.__VIEWSTATE,
                    __VIEWSTATEGENERATOR: this.stateObject?.__VIEWSTATEGENERATOR,
                    __LASTFOCUS: '',
                    __VIEWSTATEENCRYPTED: '',
                    ctl00$ContentPlaceHolder1$optignore: 'optignoreyes'
                });

                let formData = new FormData();
                Object.entries(formDataObject).forEach(([key, value]) => formData.append(key, value));

                // POST with ignore error flag set
                aLearnerHtml = await this.axiosInstance({
                    method: 'post',
                    url: '/Learner/alearner.aspx',
                    headers: {
                        ...this.SECURE_HEADERS,
                        ...formData.getHeaders()
                    },
                    data: formData
                });
            }

            let aLearnerDocument = htmlParser(aLearnerHtml?.data);

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

                writeFileSync(
                    `${debugDir}/debug/html/no_alert_message_${learner.indexNo}.html`,
                    aLearnerHtml
                );
                throw new CustomError(
                    'Alert message is missing. We were not able to parse' + ' message from then page.'
                );
            }

            // If learner_router got assigned UPI number
            if (/The Learner Basic Details have been Saved successfully/.test(message?.innerText)) {
                return {
                    upi: aLearnerDocument.querySelector('#UPI')?.attrs?.value,
                    message: message.innerText.replace('&times;  ', ''),
                    originalString: message.outerHTML
                };
            }
            if (/Failure!/g.test(message.innerText))
                throw new CustomError(message.innerText?.replace(/(^.)\n(Failure!)/, ''), 400);

            // We can't take this as an assurance everything went well, because if it did, we'd have already returned with the new UPI
            writeFileSync(homeDir + '/debug/html/unknown_error_' + learner.indexNo + '.html', aLearnerHtml);
            throw new CustomError(message.innerText?.replace(/(^.)\n(Failure!)/, ''), 400);
        } catch (err: any) {
            console.error(err);
            throw err;
        }
    }

    //submit to NHIF
    async submitToNhif(grade: Grade, learner: ListLearners[number]) {
        try {
            let submitNhifHtml = (
                await this.axiosInstance({
                    method: 'post',
                    url: 'Learner/Listlearners.aspx',
                    data: qs.stringify({
                        __ASYNCPOST: 'true',
                        __EVENTARGUMENT: '',
                        __EVENTTARGET: learner.postback,
                        __LASTFOCUS: '',
                        __VIEWSTATE: this.stateObject?.__VIEWSTATE,
                        __VIEWSTATEGENERATOR: this.stateObject?.__VIEWSTATEGENERATOR,
                        ctl00$ContentPlaceHolder1$ScriptManager1:
                            'ctl00$ContentPlaceHolder1$UpdatePanel1|ctl00$ContentPlaceHolder1$grdLearners$ctl162$BtnView',
                        ctl00$ContentPlaceHolder1$SelectBC: '1',
                        ctl00$ContentPlaceHolder1$SelectCat: gradeToNumber(grade),
                        ctl00$ContentPlaceHolder1$SelectCat2: '9 ',
                        ctl00$ContentPlaceHolder1$SelectRecs: this.recordsPerPage
                    })
                })
            )?.data;

            if (!/.+pageRedirect\|\|%2fLearner%2fAlearner.aspx/.test(submitNhifHtml))
                throw new Error('Redirection to alearner.aspx failed');

            submitNhifHtml = (await this.axiosInstance.get('Learner/Alearner.aspx'))?.data;

            const scrappedLearner = this.scrapAlearner(submitNhifHtml);

            const postData = new FormData();

            postData.append('__EVENTARGUMENT', '');
            postData.append('__EVENTTARGET', '');
            postData.append('__EVENTVALIDATION', this.stateObject?.__EVENTVALIDATION);
            postData.append('__VIEWSTATE', this.stateObject?.__VIEWSTATE);
            postData.append('__VIEWSTATEGENERATOR', this.stateObject?.__VIEWSTATEGENERATOR);
            postData.append('__LASTFOCUS', '');
            postData.append('__VIEWSTATEENCRYPTED', '');
            postData.append('ctl00$ContentPlaceHolder1$Birth_Cert_No', scrappedLearner.birthCertificateNo);
            postData.append('ctl00$ContentPlaceHolder1$BtnNHIF', 'SUBMIT TO NHIF');
            postData.append('ctl00$ContentPlaceHolder1$DOB$ctl00', scrappedLearner.dob);
            postData.append('ctl00$ContentPlaceHolder1$FirstName', scrappedLearner.names.firstname);
            postData.append('ctl00$ContentPlaceHolder1$Gender', scrappedLearner.gender);
            postData.append('ctl00$ContentPlaceHolder1$Nationality', scrappedLearner.nationality);
            postData.append('ctl00$ContentPlaceHolder1$OtherNames', scrappedLearner.names.lastname);
            postData.append('ctl00$ContentPlaceHolder1$Surname', scrappedLearner.names.surname);
            postData.append('ctl00$ContentPlaceHolder1$UPI', scrappedLearner.upi);
            postData.append('ctl00$ContentPlaceHolder1$ddlcounty', scrappedLearner.county.countyNo);
            postData.append('ctl00$ContentPlaceHolder1$ddlmedicalcondition', scrappedLearner.medical.code);
            postData.append('ctl00$ContentPlaceHolder1$ddlsubcounty', scrappedLearner.county.subCountyNo);
            postData.append('ctl00$ContentPlaceHolder1$mydob', '');
            postData.append('ctl00$ContentPlaceHolder1$myimage', '');
            postData.append('ctl00$ContentPlaceHolder1$optspecialneed', scrappedLearner.isSpecial);
            postData.append('ctl00$ContentPlaceHolder1$txtEmailAddress', scrappedLearner.emailAddress);
            postData.append('ctl00$ContentPlaceHolder1$txtFatherContacts', scrappedLearner.father.tel);
            postData.append('ctl00$ContentPlaceHolder1$txtFatherIDNO', scrappedLearner.father.id);
            postData.append('ctl00$ContentPlaceHolder1$txtFatherName', scrappedLearner.father.name);
            postData.append('ctl00$ContentPlaceHolder1$txtFatherUPI', scrappedLearner.father.upi);
            postData.append('ctl00$ContentPlaceHolder1$txtGuardianIDNO', scrappedLearner.guardian.id);
            postData.append('ctl00$ContentPlaceHolder1$txtGuardianUPI', scrappedLearner.guardian.upi);
            postData.append('ctl00$ContentPlaceHolder1$txtGuardiancontacts', scrappedLearner.guardian.tel);
            postData.append('ctl00$ContentPlaceHolder1$txtGuardianname', scrappedLearner.guardian.name);
            postData.append('ctl00$ContentPlaceHolder1$txtMotherIDNo', scrappedLearner.mother.id);
            postData.append('ctl00$ContentPlaceHolder1$txtMotherName', scrappedLearner.mother.name);
            postData.append('ctl00$ContentPlaceHolder1$txtMotherUPI', scrappedLearner.mother.upi);
            postData.append('ctl00$ContentPlaceHolder1$txtMothersContacts', scrappedLearner.mother.tel);
            postData.append('ctl00$ContentPlaceHolder1$txtPostalAddress', scrappedLearner.address);
            postData.append('ctl00$ContentPlaceHolder1$txtSearch', scrappedLearner.txtSearch);
            postData.append('ctl00$ContentPlaceHolder1$txtmobile', scrappedLearner.txtMobile);

            let postNhifHtml = (
                await this.axiosInstance({
                    method: 'post',
                    url: 'Learner/Alearner.aspx',
                    headers: {
                        ...this.SECURE_HEADERS,
                        ...postData.getHeaders()
                    },
                    data: postData
                })
            )?.data;

            let message = htmlParser(postNhifHtml).querySelector('#LblMsgContact')?.innerText;

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

    // Scrap ../Listlearners.aspx
    scrapAlearner(alearnerHtml: string) {
        if (!alearnerHtml) throw new Error('No data provided from Alearner.aspx');

        try {
            let alearnerDocument = htmlParser(alearnerHtml);
            return {
                birthCertificateNo: alearnerDocument.querySelector('#Birth_Cert_No')?.attrs?.value || '',
                dob: alearnerDocument.querySelector('#DOB')?.attrs?.value || '',
                names: {
                    firstname: alearnerDocument.querySelector('#FirstName')?.attrs?.value || '',
                    lastname: alearnerDocument.querySelector('#OtherNames')?.attrs?.value || '',
                    surname: alearnerDocument.querySelector('#Surname')?.attrs?.value || ''
                },
                gender:
                    alearnerDocument
                        .querySelector('#Gender')
                        ?.querySelectorAll('option')
                        .filter(x => x?.outerHTML.match(/selected/))
                        .map(x => x?.attrs?.value)[0] || '',
                nationality:
                    alearnerDocument
                        .querySelector('#Nationality')
                        ?.querySelectorAll('option')
                        .filter(x => x?.outerHTML.match(/selected/))
                        .map(x => x?.attrs?.value)[0] || '',
                upi: alearnerDocument.querySelector('#UPI')?.attrs?.value || '',
                county: {
                    countyNo:
                        alearnerDocument
                            .querySelector('#ddlcounty')
                            ?.querySelectorAll('option')
                            .filter(x => x?.outerHTML.match(/selected/))
                            .map(x => x?.attrs?.value)[0] || '',
                    subCountyNo:
                        alearnerDocument
                            .querySelector('#ddlsubcounty')
                            ?.querySelectorAll('option')
                            .filter(x => x?.outerHTML.match(/selected/))
                            .map(x => x?.attrs?.value)[0] || ''
                },
                medical: {
                    code:
                        alearnerDocument
                            .querySelector('#ddlmedicalcondition')
                            ?.querySelectorAll('option')
                            .filter(x => x?.outerHTML.match(/selected/))
                            .map(x => x?.attrs?.value)[0] || ''
                },
                isSpecial: alearnerDocument.querySelector('#ctl00_ContentPlaceHolder1_optneedsno')?.attrs
                    ?.checked
                    ? 'optneedsno'
                    : 'optspecialneed' || '',
                emailAddress: alearnerDocument.querySelector('#txtEmailAddress')?.attrs?.value || '',
                father: {
                    tel: alearnerDocument.querySelector('#txtFatherContacts')?.attrs?.value || '',
                    id: alearnerDocument.querySelector('#txtFatherIDNO')?.attrs?.value || '',
                    name: alearnerDocument.querySelector('#txtFatherName')?.attrs?.value || '',
                    upi: alearnerDocument.querySelector('#txtFatherUPI')?.attrs?.value || ''
                },
                guardian: {
                    id: alearnerDocument.querySelector('#txtGuardianIDNo')?.attrs?.value || '',
                    upi: alearnerDocument.querySelector('#txtGuardianUPI')?.attrs?.value || '',
                    tel: alearnerDocument.querySelector('#txtGuardiancontacts')?.attrs?.value || '',
                    name: alearnerDocument.querySelector('#txtGuardianname')?.attrs?.value || ''
                },
                mother: {
                    id: alearnerDocument.querySelector('#txtMotherIDNo')?.attrs?.value || '',
                    name: alearnerDocument.querySelector('#txtMotherName')?.attrs?.value || '',
                    tel: alearnerDocument.querySelector('#txtMothersContacts')?.attrs?.value || '',
                    upi: alearnerDocument.querySelector('#txtMotherUPI')?.attrs?.value || ''
                },
                address: alearnerDocument.querySelector('#txtPostalAddress')?.attrs?.value || '',
                txtSearch: alearnerDocument.querySelector('#txtSearch')?.attrs?.value || '',
                txtMobile: alearnerDocument.querySelector('#txtmobile')?.attrs?.value || ''
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
            await this.axiosInstance.get('/Admission/Listlearners.aspx');

            const selectedLearnerHtml = (
                await this.axiosInstance.post(
                    '/Admission/Listlearners.aspx',
                    qs.stringify({
                        __ASYNCPOST: 'true',
                        __EVENTTARGET: 'ctl00$ContentPlaceHolder1$SelectRecs',
                        ...this.stateObject,
                        ctl00$ContentPlaceHolder1$ScriptManager1:
                            'ctl00$ContentPlaceHolder1$UpdatePanel1|ctl00$ContentPlaceHolder1$SelectRecs',
                        ctl00$ContentPlaceHolder1$SelectCat: '2',
                        ctl00$ContentPlaceHolder1$SelectRecs: this.recordsPerPage
                    })
                )
            )?.data;

            let selectedLearnerHtmlTable = htmlParser(selectedLearnerHtml).querySelector(
                '#ctl00_ContentPlaceHolder1_grdLearners'
            )?.outerHTML;

            if (!selectedLearnerHtmlTable) return null;

            const selectedLearnersJson = tableToJson.convert(selectedLearnerHtmlTable);

            return this.learnerValidations.selectedLaearnerSchema.parse(selectedLearnersJson.flat());
        } catch (err) {
            console.error(err);
            throw err;
        }
    }

    async addContinuingLearner(learner: Learner) {
        try {
            await this.listLearners(learner.grade);

            let addLearnerBC = await this.axiosInstance.post(
                '/Learner/Listlearners.aspx',
                qs.stringify({
                    ...this.stateObject,
                    __ASYNCPOST: 'true',
                    __EVENTTARGET: 'ctl00$ContentPlaceHolder1$SelectRecs',
                    ctl00$ContentPlaceHolder1$ScriptManager1:
                        'ctl00$ContentPlaceHolder1$UpdatePanel1|ctl00$ContentPlaceHolder1$SelectCat',
                    ctl00$ContentPlaceHolder1$SelectBC: '1',
                    ctl00$ContentPlaceHolder1$SelectCat: gradeToNumber(learner.grade),
                    ctl00$ContentPlaceHolder1$SelectCat2: '9 ',
                    ctl00$ContentPlaceHolder1$SelectRecs: this.recordsPerPage,
                    ctl00$ContentPlaceHolder1$Button1: '[ ADD NEW STUDENT (WITH BC)]'
                })
            );
            writeFileSync('debug/getalearner.html', addLearnerBC?.data);

            if (addLearnerBC?.data === '1|#||4|26|pageRedirect||%2fLearner%2fAlearner.aspx|') {
                return this.captureBioData(learner);
            }
            throw new CustomError('Failed to redirect to alearner.aps```AAAAAAAAAAA', 400);
        } catch (err) {
            console.error(err);
            throw err;
        }
    }
}
