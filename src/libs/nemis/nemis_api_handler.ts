/**
 *  Class used to interact with NEMIS public api
 */
import CustomError from '@libs/error_handler';
import axios, { AxiosError } from 'axios';
import { lowerCaseAllValues } from '@libs/converts';
import { admissionApiResponseSchema, searchLearnerSchema } from './validations';

export default class  {
    private axiosInstance;
    private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36';

    constructor() {
        this.axiosInstance = axios.create({
            baseURL: 'http://nemis.education.go.ke/generic2' // https is not supported
        });

        this.axiosInstance.defaults.headers.common['User-Agent'] = this.userAgent;

        if (process.env.NEMIS_API_AUTH) {
            this.axiosInstance.defaults.headers.common['Authorization'] = process.env.NEMIS_API_AUTH;
        } else {
            throw new CustomError('NEMIS_API_AUTH key is not set in the environment variable', 500);
        }
    }

    async homepageApi(code: string) {
        try {
            let schoolDashboard = (await this.axiosInstance.get('/api/SchDashboard/' + encodeURIComponent(code))).data;
            return { schoolDashboard: schoolDashboard };
        } catch (err) {
            throw new CustomError('Failed to get homepage apis. Try again later.', 500);
        }
    }

    /**Asynchronously searches for a learner using either their UPI (Unique Personal Identifier) or
     *  birth certificate number.
     */
    async searchLearner(upiOrBirthCertificateNo: string) {
        try {
            if (!upiOrBirthCertificateNo) throw new CustomError('Invalid upi or  birth certificate number', 500);

            upiOrBirthCertificateNo = upiOrBirthCertificateNo.trim();

            const apiResponse = (await this.axiosInstance.get(`/api/Learner/StudUpi/${encodeURIComponent(upiOrBirthCertificateNo)}`))?.data;

            if (typeof apiResponse !== 'object' || Array.isArray(apiResponse)) {
                throw new CustomError('Nemis api did not return a valid learner object', 500);
            }

            return searchLearnerSchema.parse(lowerCaseAllValues(apiResponse, { keys: true }));
        } catch (err) {
            if (err instanceof AxiosError) {
                if (err.response) {
                    throw new CustomError(
                        'Learner not found with a ' + err.response.status + ' HTTP error.',
                        err.response.status,

                        err
                    );
                }
            }
            throw err;
        }
    }

    /**
     * Makes an asynchronous API call using the provided axiosInstance and returns a parsed admission data object.
     */
    async admitApiCalls(indexNo: string) {
        /**
         * http://nemis.education.go.ke/generic2/api/FormOne/Results/F5FFFX
         * http://nemis.education.go.ke/generic2/api/FormOne/Reported/XS5M/F5FFFX
         * http://nemis.education.go.ke/generic2/api/FormOne/Admission/F5FFFX
         * http://nemis.education.go.ke/generic2/api/FormOne/ReportedCaptured/F5FFFX
         */
        try {
            if (!indexNo || indexNo.length !== 11) {
                throw new CustomError('index number is invalid. Valid index number must be 11 characters long.', 400);
            }

            let apiResponses = await Promise.allSettled([
                this.axiosInstance.get('/api/FormOne/Results/' + encodeURIComponent(indexNo)),
                this.axiosInstance.get('/api/FormOne/admission/' + encodeURIComponent(indexNo)),
                this.axiosInstance.get('/api/FormOne/reported/xxx/' + encodeURIComponent(indexNo)),
                this.axiosInstance.get('/api/FormOne/reportedCaptured/' + encodeURIComponent(indexNo))
            ]);

            // Check if at least one endpoint responded, if not throw an error to reject promise
            if (apiResponses.filter(x => x.status === 'fulfilled').length === 0) {
                throw new CustomError(
                    'No response was received from nemis servers',
                    400,
                    apiResponses.map(apiResponse => ('reason' in apiResponse ? apiResponse.reason?.message : 'Unknown error message was received'))
                );
            }

            // Tidy up responses
            const mappedResponses = {};
            apiResponses.map((apiResponse, i) => {
                if (apiResponse.status === 'fulfilled') {
                    Object.assign(mappedResponses, {
                        [['results', 'admission', 'reported', 'captured'][i]]: lowerCaseAllValues(apiResponse.value.data, { keys: true })
                    });
                    return;
                } else {
                    Object.assign(mappedResponses, {
                        [['results', 'admission', 'reported', 'captured'][i]]: new CustomError(
                            apiResponse.reason instanceof AxiosError ? apiResponse.reason?.response?.data : apiResponse.reason.message,
                            apiResponse.reason?.response?.status || 500,

                            apiResponse.reason
                        )
                    });
                }
            });

            // Use zod schemas to validate all returned values and transform them to usable object before returning to the calling function
            return admissionApiResponseSchema.parse(lowerCaseAllValues(mappedResponses, { keys: true }));
        } catch (err) {
            throw err;
        }
    }
}

