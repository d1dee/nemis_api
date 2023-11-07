/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

import { NemisWebService } from "@libs/nemis/web_handler";
import { parse as htmlParser } from "node-html-parser";
import { Tabletojson as tableToJson } from "tabletojson/dist/lib/Tabletojson";
import { Learner } from "types/nemisApiTypes/learner";
import qs from "qs";
import { gradeToNumber, splitNames } from "@libs/converts";
import { AxiosError } from "axios";
import CustomError from "@libs/error_handler";
import learnerHandler from "./learner_handler";
import { z } from "zod";

// noinspection SpellCheckingInspection
export default class ContinuingLearner extends NemisWebService {
    validations = {
        continuingLearnerSchema: z.array(
            z
                .object({
                    'No.': z.coerce.number(),
                    'Adm No': z.string().trim(),
                    Othername: z.string().trim(),
                    Firstname: z.string().trim(),
                    Surname: z.string().trim(),
                    Gender: z.string().trim(),
                    'KCPE Year': z.string().trim(),
                    Index: z.string().trim(),
                    'Birth Certificate': z.string().trim(),
                    Grade: z.string().trim(),
                    Remark: z.string().trim(),
                    ['UPI']: z.custom(val => (val === '&nbsp;' ? '' : val)),
                    ['11']: z
                        .string()
                        .transform(val => htmlParser(val).querySelector('input')?.attrs?.name)
                })
                .partial()
                .transform(learner => ({
                    no: learner['No.'],
                    adm: learner['Adm No'],
                    othername: learner.Othername,
                    firstname: learner.Firstname,
                    surname: learner.Surname,
                    gender: learner.Gender,
                    kcpeYear: learner['KCPE Year'],
                    index: learner.Index,
                    birthCertificate: learner['Birth Certificate'],
                    grade: learner.Grade,
                    remarks: learner.Remark,
                    upi: learner.UPI,
                    postback: learner['11']
                }))
        )
    };

    constructor() {
        super();
    }

    //Get requested learners from "http://nemis.education.go.ke/Learner/Listadmrequestsskul.aspx"
    async getRequestedContinuingLearners() {
        try {
            let learnersHtml = (
                await this.changeResultsPerPage('/Learner/Listadmrequestsskul.aspx')
            )?.data;

            let continuingLearner = htmlParser(learnersHtml)?.querySelector(
                '#ctl00_ContentPlaceHolder1_grdLearners'
            )?.outerHTML;

            if (!continuingLearner) return null;

            let learnerArray = tableToJson.convert(continuingLearner);

            return this.validations.continuingLearnerSchema.parse(learnerArray);
        } catch (err) {
            throw new CustomError('Error while fetching list of requested continuing learners');
        }
    }

    // Add the requesting learner to the list of requested learners before NEMIS approval and migration to
    // the approved learners' list, enabling subsequent bio-data capture.
    async requestContinuingLearners(requestingLearner: Learner, remarks: String) {
        try {
            await this.axiosInstance.get('/Learner/Listadmrequestsskul.aspx');

            // Let middleware handle most of the data validations
            await this.axiosInstance({
                method: 'post',
                url: '/Learner/Listadmrequestsskul.aspx',
                headers: this.SECURE_HEADERS,
                data: qs.stringify({
                    __EVENTARGUMENT: '',
                    __VIEWSTATEENCRYPTED: '',
                    __LASTFOCUS: '',
                    __EVENTVALIDATION: this.stateObject?.__EVENTVALIDATION,
                    __VIEWSTATE: this.stateObject?.__VIEWSTATE,
                    __VIEWSTATEGENERATOR: this.stateObject?.__VIEWSTATEGENERATOR,
                    ctl00$ContentPlaceHolder1$Button1: '[ ADD NEW STUDENT ]'
                    //ctl00$ContentPlaceHolder1$SelectRecs: this.recordsPerPage
                })
            });

            let names = splitNames(requestingLearner.name);

            let requestingLearnerHtml = await this.axiosInstance({
                method: 'post',
                url: '/Learner/Listadmrequestsskul.aspx',
                headers: this.SECURE_HEADERS,
                data: qs.stringify({
                    __EVENTARGUMENT: '',
                    __VIEWSTATEENCRYPTED: '',
                    __LASTFOCUS: '',
                    __EVENTVALIDATION: this.stateObject?.__EVENTVALIDATION,
                    __VIEWSTATE: this.stateObject?.__VIEWSTATE,
                    __VIEWSTATEGENERATOR: this.stateObject?.__VIEWSTATEGENERATOR,
                    ctl00$ContentPlaceHolder1$Button2: '[  SAVE  ]',
                    ctl00$ContentPlaceHolder1$SelectGender: requestingLearner.gender
                        .charAt(0)
                        .toUpperCase(),
                    ctl00$ContentPlaceHolder1$SelectGrade: gradeToNumber(requestingLearner.grade),
                    ctl00$ContentPlaceHolder1$SelectRecs: this.recordsPerPage,
                    ctl00$ContentPlaceHolder1$txtAdmNo: requestingLearner.adm,
                    ctl00$ContentPlaceHolder1$txtBCert: requestingLearner.birthCertificateNo,
                    ctl00$ContentPlaceHolder1$txtFirstname: names.firstname,
                    ctl00$ContentPlaceHolder1$txtIndex: requestingLearner.indexNo,
                    ctl00$ContentPlaceHolder1$txtOthername: names.otherName,
                    ctl00$ContentPlaceHolder1$txtRemark: remarks || 'Failed admission.',
                    ctl00$ContentPlaceHolder1$txtSurname: names.surname,
                    ctl00$ContentPlaceHolder1$txtYear: requestingLearner.kcpeYear
                })
            });

            let requestedLearnerTable = htmlParser(requestingLearnerHtml?.data).querySelector(
                '#ctl00_ContentPlaceHolder1_grdLearners'
            )?.outerHTML;

            if (!requestedLearnerTable)
                throw new CustomError(
                    'Failed to add continuing learner request, check you data and try again later',
                    500
                );
            let requestedLearner = tableToJson.convert(requestedLearnerTable);
            return this.validations.continuingLearnerSchema
                .parse(requestedLearner)
                .find(
                    learner =>
                        learner.adm === requestingLearner.adm &&
                        learner.birthCertificate === requestingLearner.birthCertificateNo
                );
        } catch (err) {
            console.error(err);
            if (err instanceof Error || err instanceof AxiosError)
                throw new CustomError(
                    err.message || 'Failed to capture continuing learner_router',
                    500
                );
            throw err;
        }
    }

    // Get continuing students pending bio-data capture-
    async getPendingContinuingLearners() {
        try {
            // Get an entire list
            let pendingLearners = (
                await this.changeResultsPerPage('/Learner/Listadmrequestsskulapp.aspx')
            )?.data;

            let pendingLearnerTable =
                htmlParser(pendingLearners).querySelector('#ctl00_ContentPlaceHolder1_grdLearners')
                    ?.outerHTML || ' '; // Set empty string if querySelector doesn't return a value

            let pendingLearner = tableToJson
                .convert(pendingLearnerTable, { stripHtmlFromCells: false })
                .flat();

            return this.validations.continuingLearnerSchema.parse(pendingLearner);
        } catch (err) {
            console.error(err);

            if (err instanceof Error || err instanceof AxiosError) {
                throw err.message || 'Failed to get pending continuing learners';
            }
            throw err;
        }
    }

    //Capture Bio-data for continuing learners
    async captureContinuingLearners(learner: Learner, postback: string) {
        try {
            // Post to get capture page
            const pendingLearnerResponse = await this.axiosInstance({
                method: 'post',
                url: '/Learner/Listadmrequestsskulapp.aspx',
                data: qs.stringify({
                    __EVENTARGUMENT: '',
                    __EVENTTARGET: '',
                    __LASTFOCUS: '',
                    __VIEWSTATEENCRYPTED: '',
                    __VIEWSTATEGENERATOR: this.stateObject?.__VIEWSTATEGENERATOR,
                    __VIEWSTATE: this.stateObject?.__VIEWSTATE,
                    __EVENTVALIDATION: this.stateObject?.__EVENTVALIDATION,
                    ctl00$ContentPlaceHolder1$SelectRecs: this.recordsPerPage,
                    [postback]: 'BIO-BC'
                }),
                headers: this.SECURE_HEADERS
            });

            if (
                pendingLearnerResponse?.request?.path !== '/Learner/alearner.aspx' ||
                !pendingLearnerResponse?.data
            ) {
                console.error('Failed to get alearner.aspx');

                throw new CustomError('Failed to capture bio-data');
            }
            return new learnerHandler().captureBioData(learner);
        } catch (err) {
            console.error(err);
            if (err instanceof Error || err instanceof AxiosError)
                throw new CustomError(
                    err.message || 'Failed to capture continuing learner_router',
                    400
                );
            throw err;
        }
    }
}
