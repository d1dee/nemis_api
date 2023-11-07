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

const apiAuthorization = process.env.NEMIS_API_AUTH;
const apiBaseUrl = 'http://nemis.education.go.ke/generic2/api'; // https is not supported
// noinspection SpellCheckingInspection
export default class {
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

    async homepageApi(code: string) {
        try {
            let schoolDashboard = (
                await this.axiosInstance.get('/SchDashboard/' + encodeURIComponent(code))
            ).data;
            return { schoolDashboard: schoolDashboard };
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

            let searchLearnerSchema = z
                .object({
                    xcat: z.string(),
                    xcatdesc: z.string(),
                    upi: z.string(),
                    names: z.coerce.string().transform(x => x.replaceAll(',', '')),
                    surname: z.string(),
                    firstname: z.string(),
                    othernames: z.string(),
                    institution_name: z.string(),
                    phone_number: z.string(),
                    email_address: z.string(),
                    postal_address: z.string(),
                    father_upi: z.string(),
                    mother_upi: z.string(),
                    guardian_upi: z.string(),
                    father_name: z.string(),
                    father_idno: z.string(),
                    father_contacts: z.string(),
                    mother_name: z.string(),
                    mother_idno: z.string(),
                    mother_contacts: z.string(),
                    guardian_contacts: z.string(),
                    guardian_idno: z.string(),
                    guardian_name: z.string(),
                    special_medical_condition: z.string(),
                    any_special_medical_condition: z.string(),
                    institution_code: z.string(),
                    sub_county_code: z.string(),
                    nationality: z.string(),
                    gender: z.string(),
                    lgender: z.string(),
                    dob2: z.string(),
                    birth_cert_no: z.string(),
                    id_no: z.string(),
                    disability_code: z.string(),
                    class_code: z.string(),
                    county_code: z.string(),
                    county_learner: z.string(),
                    sub_county_learner: z.string(),
                    special_needs_list: z.string(),
                    father_email: z.string(),
                    mother_email: z.string(),
                    guardian_email: z.string(),
                    institution_type: z.string(),
                    institution_level_code: z.string(),
                    nhif_no: z.string(),
                    class_name: z.string(),
                    level_name: z.string()
                })
                .partial()
                .transform(res => ({
                    name: res.names,
                    dob: res.dob2,
                    gender: res.gender || res.lgender,
                    grade: res.class_name,
                    upi: res.upi,
                    phoneNumber: res.phone_number,
                    email: res.email_address,
                    address: res.postal_address,
                    birthCertificateNo: res.birth_cert_no,
                    nhifNo: res.nhif_no,
                    learnerCategory: {
                        code: res.xcat,
                        description: res.xcatdesc
                    },
                    currentInstitution: {
                        name: res.institution_name,
                        code: res.institution_code,
                        type: res.institution_type,
                        level: res.institution_level_code
                    },
                    father: {
                        upi: res.father_upi,
                        name: res.father_name,
                        email: res.father_email,
                        tel: res.father_contacts,
                        id: res.father_idno
                    },
                    mother: {
                        upi: res.mother_upi,
                        name: res.mother_name,
                        email: res.mother_email,
                        tel: res.mother_contacts,
                        id: res.mother_idno
                    },
                    guardian: {
                        upi: res.guardian_upi,
                        name: res.guardian_name,
                        email: res.guardian_email,
                        tel: res.guardian_contacts,
                        id: res.guardian_idno
                    },
                    medicalCondition: {
                        code: Number(res?.special_medical_condition || 0),
                        description: medicalConditionDesc(
                            Number(res?.special_medical_condition || 0)
                        )
                    },
                    otherSpecialConditions: res.any_special_medical_condition,
                    countyCode: res.county_code,
                    subCountyCode: res.sub_county_learner,
                    nationality: nationalities(Number(res.nationality) || 0),
                    disabilityCode: res.disability_code,
                    idNo: res.id_no,
                    specialNeeds: res.special_needs_list
                }));

            return searchLearnerSchema.parse(lowerCaseAllValues(apiResponse, { keys: true }));
        } catch (err) {
            throw err;
        }
    }

    /*
    Gets results from http://nemis.education.go.ke/generic2/api/FormOne/Results/{Index_number}
     */
    async results(indexNumber: string) {
        try {
            if (!indexNumber || indexNumber.length !== 11)
                throw new CustomError('Invalid index number', 400);
            const rawResults = (
                await this.axiosInstance.get(`/FormOne/Results/${encodeURIComponent(indexNumber)}`)
            )?.data;

            // Valid and transform results
            let resultsSchema = z
                .object({
                    index_no: z.string().trim(),
                    ge: z.string(z.enum(['m', 'f'])).trim(),
                    name: z.string().trim(),
                    school_name: z.string().trim(),
                    tot: z.string().trim(),
                    district_code: z.string().trim(),
                    district_name: z.string().trim(),
                    ns1: z.string().trim(),
                    ns2: z.string().trim(),
                    ns3: z.string().trim(),
                    ns4: z.string().trim(),
                    xs1: z.string().trim(),
                    xs2: z.string().trim(),
                    xs3: z.string().trim(),
                    cs1: z.string().trim(),
                    cs2: z.string().trim(),
                    ss1: z.string().trim(),
                    ss2: z.string().trim(),
                    disability_l: z.string().trim(),
                    disability_b: z.string().trim(),
                    disability_d: z.string().trim(),
                    disability_p: z.string().trim(),
                    yob: z.string().trim(),
                    citizenship: z.string().trim(),
                    school_code: z.string().trim(),
                    school_category: z.string().trim(),
                    selected_school: z.string().trim()
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
                }));

            return resultsSchema.parse(lowerCaseAllValues(rawResults));
        } catch (err) {
            throw err;
        }
    }

    // Gets where the learner is placed for admission by calling http://nemis.education.go.ke/generic2/api/FormOne/Admission/{index_number}
    async admission(indexNumber: string) {
        try {
            if (!indexNumber) throw new Error('Index number not supplied');
            let results = (
                await this.axiosInstance.get(
                    `/FormOne/Admission/${encodeURIComponent(indexNumber)}`
                )
            )?.data;

            let schoolAdmittedSchema = z
                .object({
                    method: z.string().trim().optional(),
                    schooladmitted: z.string().trim().optional(),
                    category2: z.string().trim().optional()
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
                }));
            return schoolAdmittedSchema.parse(lowerCaseAllValues(results));
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
            let results = (
                await this.axiosInstance.get(`/FormOne/Reported/${schoolCode}/${indexNumber}`)
            )?.data;
            const reportedSchema = z
                .object({
                    index_no: z.string().trim(),
                    institution_code: z.string().trim(),
                    upi: z.string().trim(),
                    birthcert: z.string().trim(),
                    datereported: z.union([z.coerce.date(), z.string().trim()]),
                    capturedby: z.string().trim(),
                    name: z.string().trim(),
                    institutionname: z.string().trim()
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
                }));

            return reportedSchema.parse(lowerCaseAllValues(results));
        } catch (err) {
            throw err;
        }
    }

    // Returns the current institution a form one leaner has reported to by calling  http://nemis.education.go.ke/generic2/api/FormOne/ReportedCaptured/{index_number}
    async reportedCaptured(indexNumber: string) {
        try {
            if (!indexNumber) throw new Error('Index number is undefined');
            let results = (
                await this.axiosInstance.get(
                    '/FormOne/reportedCaptured/' + encodeURIComponent(indexNumber)
                )
            )?.data;
            const reportedCapturedSchema = z
                .object({
                    reportedlabel: z.string().toLowerCase().trim().optional()
                })
                .partial()
                .transform(res => ({
                    originalString: res.reportedlabel,
                    ...res?.reportedlabel?.match(
                        /(?<code>^\d+): (?<name>.+), type: (?<type>.*), category: (?<category>.*), upi: (?<upi>.*)/i
                    )?.groups
                }));
            return reportedCapturedSchema.parse(lowerCaseAllValues(results)) as Partial<{
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
