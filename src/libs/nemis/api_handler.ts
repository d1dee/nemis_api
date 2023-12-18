/*
 * Copyright (c) 2023. MIT License. Maina Derrick.
 */

/**
 *  Class used to interact with NEMIS public api
 */
import CustomError from "@libs/error_handler";
import axios from "axios";
import { lowerCaseAllValues, medicalConditionDesc, nationalities } from "@libs/converts";
import { z } from "zod";
import { Z_GENDER, Z_NUMBER, Z_NUMBER_STRING, Z_STRING } from "@libs/constants";

const apiAuthorization = process.env.NEMIS_API_AUTH;
const apiBaseUrl = 'http://nemis.education.go.ke/generic2/api'; // https is not supported
// noinspection SpellCheckingInspection
export default class {
    apiValidation = {
        searchLearnerSchema: z
            .object({
                xCat: Z_STRING.nullish(),
                xCatDesc: Z_STRING.nullish(),
                upi: Z_STRING.nullish(),
                names: Z_STRING.transform(x => x.replaceAll(',', '')),
                surname: Z_STRING.nullish(),
                firstName: Z_STRING.nullish(),
                otherNames: Z_STRING.nullish(),
                institution_Name: Z_STRING.nullish(),
                phone_Number: Z_STRING.nullish(),
                email_Address: Z_STRING.nullish(),
                postal_Address: Z_STRING.nullish(),
                father_UPI: Z_STRING.nullish(),
                mother_UPI: Z_STRING.nullish(),
                guardian_UPI: Z_STRING.nullish(),
                father_Name: Z_STRING.nullish(),
                father_IDNo: Z_STRING.nullish(),
                father_Contacts: Z_STRING.nullish(),
                mother_Name: Z_STRING.nullish(),
                mother_IDNo: Z_STRING.nullish(),
                mother_Contacts: Z_STRING.nullish(),
                guardian_Contacts: Z_STRING.nullish(),
                guardian_IDNo: Z_STRING.nullish(),
                guardian_Name: Z_STRING.nullish(),
                special_Medical_Condition: Z_STRING.nullish(),
                any_Special_Medical_Condition: Z_STRING.nullish(),
                institution_Code: Z_STRING.nullish(),
                sub_County_Code: Z_STRING.nullish(),
                nationality: Z_STRING.nullish(),
                gender: Z_STRING.nullish(),
                lGender: Z_STRING.nullish(),
                dob: Z_STRING.nullish(),
                doB2: Z_STRING.nullish(),
                isDateDOB: Z_NUMBER_STRING.nullish(),
                birth_Cert_No: Z_STRING.nullish(),
                iD_No: Z_STRING.nullish(),
                disability_Code: Z_STRING.nullish(),
                class_Code: Z_STRING.nullish(),
                county_Code: Z_STRING.nullish(),
                county_Learner: Z_STRING.nullish(),
                sub_County_Learner: Z_STRING.nullish(),
                special_Needs_List: Z_STRING.nullish(),
                father_Email: Z_STRING.nullish(),
                mother_Email: Z_STRING.nullish(),
                guardian_Email: Z_STRING.nullish(),
                institution_Type: Z_STRING.nullish(),
                institution_Level_Code: Z_STRING.nullish(),
                nhiF_No: Z_STRING.nullish(),
                class_Name: Z_STRING.nullish(),
                level_Name: Z_STRING
            })
            .partial()
            .transform(res => ({
                name: res.names,
                dob: res.doB2,
                gender: res.gender || res.lGender,
                grade: res.class_Name,
                upi: res.upi,
                phoneNumber: res.phone_Number,
                email: res.email_Address,
                address: res.postal_Address,
                birthCertificateNo: res.birth_Cert_No,
                nhifNo: res.nhiF_No,
                learnerCategory: {
                    code: res.xCat,
                    description: res.xCatDesc
                },
                currentInstitution: {
                    name: res.institution_Name,
                    code: res.institution_Code,
                    type: res.institution_Type,
                    level: res.institution_Level_Code
                },
                father: {
                    upi: res.father_UPI,
                    name: res.father_Name,
                    email: res.father_Email,
                    tel: res.father_Contacts,
                    id: res.father_IDNo
                },
                mother: {
                    upi: res.mother_UPI,
                    name: res.mother_Name,
                    email: res.mother_Email,
                    tel: res.mother_Contacts,
                    id: res.mother_IDNo
                },
                guardian: {
                    upi: res.guardian_UPI,
                    name: res.guardian_Name,
                    email: res.guardian_Email,
                    tel: res.guardian_Contacts,
                    id: res.guardian_IDNo
                },
                medicalCondition: {
                    code: Number(res?.special_Medical_Condition || 0),
                    description: medicalConditionDesc(Number(res?.special_Medical_Condition || 0))
                },
                otherSpecialConditions: res.any_Special_Medical_Condition,
                countyCode: res.county_Code,
                subCountyCode: res.sub_County_Learner,
                nationality: nationalities(Number(res.nationality) || 0),
                disabilityCode: res.disability_Code,
                idNo: res.iD_No,
                specialNeeds: res.special_Needs_List
            })),
        resultsSchema: z
            .object({
                index_no: Z_STRING,
                ge: Z_GENDER,
                name: Z_STRING,
                school_name: Z_STRING,
                tot: Z_STRING,
                district_code: Z_STRING,
                district_name: Z_STRING,
                ns1: Z_STRING,
                ns2: Z_STRING,
                ns3: Z_STRING,
                ns4: Z_STRING,
                xs1: Z_STRING,
                xs2: Z_STRING,
                xs3: Z_STRING,
                cs1: Z_STRING,
                cs2: Z_STRING,
                ss1: Z_STRING,
                ss2: Z_STRING,
                disability_l: Z_STRING,
                disability_b: Z_STRING,
                disability_d: Z_STRING,
                disability_p: Z_STRING,
                yob: Z_STRING,
                citizenship: Z_STRING,
                school_code: Z_STRING,
                school_category: Z_STRING,
                selected_school: Z_STRING
            })
            .partial()
            .transform(res => ({
                name: res.name,
                gender: res.ge,
                yearOfBirth: res.yob,
                citizenship: res.citizenship,
                indexNo: res.index_no,
                marks: res.tot,
                primarySchool: {
                    name: res.school_name,
                    knecCode: res.school_code,
                    districtName: res.district_name,
                    districtCode: res.district_code
                },
                disability: {
                    l: res.disability_l,
                    b: res.disability_b,
                    d: res.disability_d,
                    p: res.disability_p
                },
                preferredSecondarySchools: {
                    nationals: {
                        ns1: res.ns1,
                        ns2: res.ns2,
                        ns3: res.ns3,
                        ns4: res.ns4
                    },
                    extraCounty: {
                        xc1: res.xs1,
                        xc2: res.xs2,
                        xc3: res.xs3
                    },
                    county: {
                        cs1: res.cs1,
                        cs2: res.cs2
                    },
                    secondary: {
                        ss1: res.ss1,
                        ss2: res.ss2
                    }
                },
                selectedSchool: {
                    category: res.school_category,
                    knecCode: res.selected_school
                }
            })),

        schoolAdmittedSchema: z
            .object({
                method: Z_STRING,
                schooladmitted: Z_STRING,
                category2: Z_STRING
            })
            .partial()
            .transform(res => ({
                method: res.method,
                originalString: res.schooladmitted,
                category: res.category2,
                ...(res.schooladmitted?.match(
                    /(?<code>\d+).+(?<name>(?<=\d )[a-zA-Z ].+)School Type:(?<type>[a-zA-Z]+).School Category:(?<category>[a-zA-Z].+)/
                )?.groups as {
                    code: string;
                    type: string;
                })
            })),

        reportedSchema: z
            .object({
                index_no: Z_STRING,
                institution_code: Z_STRING,
                upi: Z_STRING,
                birthcert: Z_STRING,
                datereported: z.union([z.coerce.date(), Z_STRING]),
                capturedby: Z_STRING,
                name: Z_STRING,
                institutionname: Z_STRING
            })
            .partial()
            .transform(res => ({
                name: res.name,
                indexNo: res.index_no,
                upi: res.upi,
                birthCertificateNo: res.birthcert,
                dateReported: res.datereported,
                capturedBy: res.capturedby,
                institution: {
                    name: res.institutionname,
                    code: res.institution_code
                }
            })),

        reportedCapturedSchema: z
            .object({
                reportedlabel: Z_STRING
            })
            .partial()
            .transform(res => ({
                originalString: res.reportedlabel,
                ...res?.reportedlabel?.match(
                    /(?<code>^\d+): (?<name>.+), type: (?<type>.*), category: (?<category>.*), upi: (?<upi>.*)/i
                )?.groups
            })),

        schoolDashboard: z.array(
            z
                .object({
                    institution_Code: Z_STRING,
                    class_Code: Z_NUMBER,
                    class_Name: Z_STRING,
                    bC_Boys: Z_NUMBER,
                    bC_Girls: Z_NUMBER,
                    bC_Unk: Z_NUMBER,
                    bC_Total: Z_NUMBER,
                    wbC_Boys: Z_NUMBER,
                    wbC_Girls: Z_NUMBER,
                    wbC_Unk: Z_NUMBER,
                    wbC_Total: Z_NUMBER,
                    boys: Z_NUMBER,
                    girls: Z_NUMBER,
                    unk: Z_NUMBER,
                    total: Z_NUMBER,
                    m: Z_NUMBER,
                    f: Z_NUMBER,
                    unknown: Z_NUMBER,
                    uN_KNOWN: Z_NUMBER
                })
                .partial()
                .transform(gradeData => ({
                    institutionCode: gradeData.institution_Code,
                    code: gradeData.class_Code,
                    name: gradeData.class_Name,
                    birthCertificateCapturedBoys: gradeData.bC_Boys,
                    birthCertificateCapturedGirls: gradeData.bC_Girls,
                    birthCertificateCapturedUnknown: gradeData.bC_Unk,
                    birthCertificateCapturedTotals: gradeData.bC_Total,
                    noBirthCertificateCapturedBoys: gradeData.wbC_Boys,
                    noBirthCertificateCapturedGirls: gradeData.wbC_Girls,
                    noBirthCertificateCapturedUnknown: gradeData.wbC_Unk,
                    noBirthCertificateCapturedTotals: gradeData.wbC_Total,
                    totalBoys: gradeData.boys,
                    totalGirls: gradeData.girls,
                    total: gradeData.total,
                    unknown: gradeData.unknown,
                    ukknown2: gradeData.uN_KNOWN,
                    unknownUnk: gradeData.unk
                }))
        )
    };
    private axiosInstance;
    private userAgent =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36';

    constructor() {
        this.axiosInstance = axios.create({
            baseURL: apiBaseUrl
        });

        this.axiosInstance.defaults.headers.common['User-Agent'] = this.userAgent;

        if (!apiAuthorization)
            throw new CustomError('NEMIS_API_AUTH key is not set in the environment variable', 500);

        this.axiosInstance.defaults.headers.common['Authorization'] = apiAuthorization;
    }

    async getDates() {
        return await this.axiosInstance.get('/generic/api/formone/admissiondates').catch(err => {
            Promise.reject(err);
        });
    }

    async homepageApi(code: string) {
        try {
            let schoolDashboard = (await this.axiosInstance.get('/SchDashboard/' + encodeURIComponent(code)))
                .data;
            return this.apiValidation.schoolDashboard.parse(schoolDashboard);
        } catch (err) {
            throw new CustomError('Failed to get homepage apis. Try again later.', 500);
        }
    }

    /* Search a learner using UPI or birth certificate number at http://nemis.education.go.ke/generic2/api/Learner/StudUpi/{upi_or_bitch_certificate}
     */
    async searchLearner(upiOrBirthCertificateNo: string) {
        try {
            if (!upiOrBirthCertificateNo)
                throw new CustomError('Invalid upi or  birth certificate number', 500);

            upiOrBirthCertificateNo = upiOrBirthCertificateNo.trim();

            const apiResponse = (
                await this.axiosInstance.get(
                    `/Learner/StudUpi/${encodeURIComponent(upiOrBirthCertificateNo)}`
                )
            )?.data;

            if (typeof apiResponse !== 'object' || Array.isArray(apiResponse)) {
                throw new CustomError('Nemis api did not return a valid learner object', 500);
            }

            return this.apiValidation.searchLearnerSchema.parse(apiResponse);
        } catch (err) {
            throw err;
        }
    }

    /*
    Gets results from http://nemis.education.go.ke/generic2/api/FormOne/Results/{Index_number}
     */
    async results(indexNumber: string) {
        try {
            if (!indexNumber || indexNumber.length !== 11) throw new CustomError('Invalid index number', 400);
            const rawResults = (
                await this.axiosInstance.get(`/FormOne/Results/${encodeURIComponent(indexNumber)}`)
            )?.data;

            // Valid and transform results
            return this.apiValidation.resultsSchema.parse(lowerCaseAllValues(rawResults));
        } catch (err) {
            throw err;
        }
    }

    // Gets where the learner is placed for admission by calling http://nemis.education.go.ke/generic2/api/FormOne/Admission/{index_number}
    async admission(indexNumber: string) {
        try {
            if (!indexNumber) throw new Error('Index number not supplied');
            let results = (
                await this.axiosInstance.get(`/FormOne/Admission/${encodeURIComponent(indexNumber)}`)
            )?.data;

            return this.apiValidation.schoolAdmittedSchema.parse(lowerCaseAllValues(results));
        } catch (err) {
            throw err;
        }
    }

    // Gets where the learner has reported to after admission by calling http://nemis.education.go.ke/generic2/api/FormOne/Reported/{school_coded}/{index_number}
    // This also checks if the learner is admitted to school with the matching school_code
    async reported(indexNumber: string, schoolCode: string) {
        try {
            if (!indexNumber) throw new Error('Index number is missing');
            if (!schoolCode) throw new Error('School code is missing');
            let results = (await this.axiosInstance.get(`/FormOne/Reported/${schoolCode}/${indexNumber}`))
                ?.data;

            return this.apiValidation.reportedSchema.parse(lowerCaseAllValues(results));
        } catch (err) {
            throw err;
        }
    }

    // Returns the current institution a form one leaner has reported to by calling  http://nemis.education.go.ke/generic2/api/FormOne/ReportedCaptured/{index_number}
    async reportedCaptured(indexNumber: string) {
        try {
            if (!indexNumber) throw new Error('Index number is undefined');
            let results = (
                await this.axiosInstance.get('/FormOne/reportedCaptured/' + encodeURIComponent(indexNumber))
            )?.data;

            return this.apiValidation.reportedCapturedSchema.parse(lowerCaseAllValues(results)) as Partial<{
                originalString: string;
                code: string;
                name: string;
                type: string;
                category: string;
                upi: string;
            }>;
        } catch (err) {
            throw err;
        }
    }
}
