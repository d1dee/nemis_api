/**
 *  Base class that sets up all axios interactions. It is from this class that all other Nemis classes are extended from.
 */
import axios, { AxiosError, AxiosInstance } from 'axios';
import {
	AdmissionApiResults,
	AdmitApiCall,
	ApprovedLearner,
	CaptureBiodataResponse,
	CompleteLearner,
	ContinuingLearnerApiResponse,
	ContinuingLearnerType,
	Grades,
	Institution,
	ListAdmittedLearner,
	ListLearner,
	NemisLearnerFromDb,
	RequestedJoiningLearner,
	RequestingJoiningLearner,
	RequestingLearner,
	SchoolSelected,
	SelectedLearner,
	StateObject
} from '../../../types/nemisApiTypes';
import logger from '../logger';
import CustomError from '../error_handler';
import { writeFileSync } from 'fs';
import { parse as htmlParser } from 'node-html-parser';
import { Tabletojson as tableToJson } from 'tabletojson';
import qs from 'qs';
import { institutionSchema, listAdmittedLearnerSchema, listLearnerSchema } from './validations';
import { countyToNo, form, medicalConditionCode, nationalities, splitNames } from '../converts';
import { Error } from 'mongoose';
import buffer from 'buffer';
import FormData from 'form-data';
import { NemisApiService } from './nemis_api_handler';

type ParentContact = {
	name?: string;
	tel?: string;
	id?: string;
};

interface AdmitJoiningLearner extends AdmissionApiResults {
	mother?: ParentContact;
	father?: ParentContact;
	guardian?: ParentContact;
	adm: string;
}

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
	recordsPerPage: string = '10000';
	#SECURE_HEADERS = {
		DNT: '1',
		'Upgrade-Insecure-Requests': '1',
		'Content-Type': 'application/x-www-form-urlencoded',
		'User-Agent':
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
		Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
		host: 'nemis.education.go.ke'
	};
	//Axios instance
	#stateObject: StateObject | undefined = undefined;
	#cookie: string | undefined = undefined;
	private readonly axiosInstance: AxiosInstance;

	constructor(cookie?: string, stateObject?: StateObject) {
		this.axiosInstance = axios.create({
			baseURL: 'http://nemis.education.go.ke' // https is not supported
		});
		this.#setupAxiosInterceptors();
		if (cookie) this.#cookie = cookie;
		if (stateObject) this.#stateObject = stateObject;
	}

	getState(): StateObject | undefined {
		return this.#stateObject;
	}

	/**
	 * Logs in the user with the given username and password.
	 * @param string username - The user's username.
	 * @param string password - The user's password.
	 * @returns {Promise<string>} - A promise that resolves with the user's session cookie if the login is successful.
	 * @throws {object} - An object with properties `message` and `cause` if the login fails.
	 */

	async login(username: string, password: string): Promise<string> {
		try {
			if (!username || !password) {
				throw new CustomError('Username or password not provided', 403);
			}
			//Get login pae and cookie
			await this.axiosInstance.get('/');
			//Login
			let response = await this.axiosInstance.post(
				'/',
				qs.stringify({
					...this.#stateObject,
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
		} catch (err) {
			throw err;
		}
	}

	/**
	 * Retrieves institution information by scraping the institution page,
	 * /Institution/Institution.aspx, and parsing its html using node-html-parser.
	 * @returns {Promise<Institution>} An object containing institution information.
	 * @throws Error object if the institution page is not found.
	 */
	async getInstitution(institutionCode: string): Promise<Institution> {
		try {
			let institutionHtml = (await this.axiosInstance.get('/Institution/Institution.aspx'))
				?.data;

			let supportedGrades = (await new NemisApiService().homepageApi(institutionCode))
				.schoolDashboard;

			let document = htmlParser(institutionHtml);
			return institutionSchema.strip().parse({
				//Institution Bio Data Tab
				name: document.querySelector('#ctl00_ContentPlaceHolder1_Institution_Name')?.attrs
					?.value,
				knecCode: document.querySelector('#ctl00_ContentPlaceHolder1_Knec_Code')?.attrs
					?.value,
				code: document.querySelector('#ctl00_ContentPlaceHolder1_Institution_Code')?.attrs
					?.value,
				gender: document
					.querySelector('#ctl00_ContentPlaceHolder1_Classification_by_Gender')
					?.outerHTML?.match(/(?<=selected" value="\d">)\w.*?(?=<)/)
					?.toString(),
				supportedGrades: supportedGrades,
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
				tscCode: document.querySelector('#ctl00_ContentPlaceHolder1_Tsc_Code')?.attrs
					?.value,
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
				kraPin: document.querySelector('#ctl00_ContentPlaceHolder1_Employer_pin')?.attrs
					?.value,
				// plusCode:
				// document.querySelector("#PlusCode")?.attrs?.value?.toLowerCase()||''
				//,
				registrationDate: document.querySelector(
					'#ctl00_ContentPlaceHolder1_Registration_Date'
				)?.attrs?.value,
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
				owner: document.querySelector('#ctl00_ContentPlaceHolder1_Proprietor_Code')?.attrs
					?.value,
				incorporationCertificateNumber: document.querySelector(
					'#ctl00_ContentPlaceHolder1_Registration_Certificate'
				)?.attrs?.value,
				nearestPoliceStation: document.querySelector(
					'#ctl00_ContentPlaceHolder1_Nearest_Police_Station'
				)?.attrs?.value,
				nearestHealthFacility: document.querySelector(
					'#ctl00_ContentPlaceHolder1_Nearest_Health_Facility'
				)?.attrs?.value,
				nearestTown: document.querySelector('#ctl00_ContentPlaceHolder1_Nearest_Town')
					?.attrs?.value,
				//Institution Contacts Tab
				postalAddress: document.querySelector('#ctl00_ContentPlaceHolder1_Postal_Address')
					?.attrs?.value,
				telephoneNumber: document.querySelector('#ctl00_ContentPlaceHolder1_Tel_Number')
					?.attrs?.value,
				mobileNumber: document.querySelector('#ctl00_ContentPlaceHolder1_Mobile_Number1')
					?.attrs?.value,
				altTelephoneNumber: document.querySelector('#ctl00_ContentPlaceHolder1_Tel_Number2')
					?.attrs?.value,
				altMobileNumber: document.querySelector('#ctl00_ContentPlaceHolder1_Mobile_Number2')
					?.attrs?.value,
				email: document.querySelector('#ctl00_ContentPlaceHolder1_Email_Address')?.attrs
					?.value,
				website: document.querySelector('#ctl00_ContentPlaceHolder1_Website')?.attrs?.value,
				socialMediaHandles: document
					.querySelector('#ctl00_ContentPlaceHolder1_Social_Media')
					?.attrs?.value?.toLowerCase()
			});
		} catch (err) {
			throw err;
		}
	}

	/**
	 * Retrieves already admitted learners information by scraping the list learners page,
	 * /Leaner/Listlearners.aspx, and parsing its html using node-html-parser.
	 * @returns {Array<ListLearner>|undefined} An object containing learner_router information or
	 * undefined if no learner_router information is available.
	 * @throws An Error object if the institution page is not found.
	 */
	async listLearners(gradeOrForm: Grades): Promise<ListLearner[]> {
		try {
			let listLearnersHtml = (
				await this.changeResultsPerPage('/Learner/Listlearners.aspx', gradeOrForm)
			)?.data;
			//convert table to json
			const listLearnerTable = htmlParser(listLearnersHtml).querySelector(
				'#ctl00_ContentPlaceHolder1_grdLearners'
			);
			if (!listLearnerTable) return [];
			let listLearnerJson = tableToJson
				.convert(listLearnerTable?.outerHTML || '')
				.flat()
				.filter(e => !!e['No.']);
			// do_postback doesn't match indexNo of each element, so we find the difference and
			// use it
			// to generate the correct post_backs
			let firstViewElement = listLearnerTable.querySelector(
				'tr.GridRow > td:nth-child(13) > a'
			)?.id;
			if (!firstViewElement)
				throw new CustomError(
					'Failed to get first element from /Learner/Listlearners.aspx',
					404
				);
			let firstViewElementNumber = Number(
				firstViewElement?.match(/(?<=_ctl)[0-9]./)?.shift()
			);
			return listLearnerJson.map(element => {
				let postback = `ctl00_ContentPlaceHolder1_grdLearners_ctl${
					firstViewElementNumber < 10
						? `0${firstViewElementNumber}`
						: firstViewElementNumber
				}_BtnView`;
				firstViewElementNumber++;
				return {
					...listLearnerSchema.parse(element),
					doPostback: postback.replaceAll(/_/g, '$'),
					grade: gradeOrForm
				};
			});
		} catch (err) {
			throw err;
		}
	}

	async admitJoiningLearner(learner: AdmitJoiningLearner): Promise<boolean> {
		try {
			const studentIndexDocument = htmlParser(
				(await this.axiosInstance.get('/Learner/Studindex.aspx'))?.data
			);

			let canAdmit = studentIndexDocument.querySelector('#txtCanAdmt')?.attrs?.value !== '0';
			let canRequest = studentIndexDocument.querySelector('#txtCanReq')?.attrs?.value !== '0';

			if (!canAdmit)
				throw new CustomError(
					'Admitting learners is currently disabled on the Nemis website.',
					400
				);

			let postHtml = await this.axiosInstance({
				method: 'post',
				url: '/Learner/Studindex.aspx',
				headers: this.#SECURE_HEADERS,
				data: qs.stringify({
					...this.#stateObject,
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
					ctl00$ContentPlaceHolder1$txtSName: learner.schoolAdmitted.originalString,
					ctl00$ContentPlaceHolder1$txtSName2: learner.schoolAdmitted?.originalString,
					ctl00$ContentPlaceHolder1$txtSchool: learner.selectedSchool?.knecCode,
					ctl00$ContentPlaceHolder1$txtSearch: learner.indexNo,
					ctl00$ContentPlaceHolder1$txtStatus: ''
				})
			});

			if (/^.+pageRedirect.+Learner.+fStudindexreq/gi.test(postHtml?.data))
				throw new CustomError('Admission failed, please request learner first', 400);

			if (postHtml.request?.path === '/Learner/Studindexchk.aspx') {
				//await this.axiosInstance.get()
				let postAdmHtml = await this.axiosInstance({
					method: 'post',
					url: '/Learner/Studindexchk.aspx',
					headers: this.#SECURE_HEADERS,
					data: {
						...this.#stateObject,
						ctl00$ContentPlaceHolder1$BtnAdmit: 'Admit Student',
						ctl00$ContentPlaceHolder1$txtBCert:
							learner.father?.tel || learner.mother?.tel || learner.guardian?.tel,
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
					!/THE STUDENT HAS BEEN ADMITTED TO THE SCHOOL\. ENSURE YOU CAPTURE BIO-DATAmessage/.test(
						message
					)
				) {
					writeFileSync(
						process.cwd() +
						'/debug/html/post_Learner_Studindexchk.aspx' +
						learner.adm +
						'.html',
						(await this.axiosInstance.get('/Learner/Studindexchk.aspx'))?.data
					);
					throw { message: message || 'Failed to admit learner_router.' };
				}
				return true;
			}

			await writeFileSync(
				process.cwd() + '/debug/html/posting_admit_' + learner.indexNo + '.html',
				postHtml?.data
			);

			throw new CustomError('Couldn\'t redirect to admit learner', 500);
		} catch (err) {
			throw err;
		}
	}

	/**
	 * This function gets form one learner_router who has been successfully admitted but are awaiting
	 * biodata capture
	 */
	async listAdmittedJoiningLearners(): Promise<ListAdmittedLearner[]> {
		try {
			let admittedLearnerHtml = (
				await this.changeResultsPerPage('/Admission/Listlearnersrep.aspx')
			)?.data;
			if (!admittedLearnerHtml) {
				throw new CustomError('Failed to get hmtl table of admitted learner', 500);
			}

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
				return listAdmittedLearnerSchema.parse({
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
			throw err;
		}
	}

	async captureJoiningBiodata(
		learner: CompleteLearner,
		listLearner: ListAdmittedLearner
	): Promise<CaptureBiodataResponse> {
		try {
			let postResponse = await this.axiosInstance({
				method: 'post',
				url: '/Admission/Listlearnersrep.aspx',
				data: {
					...this.#stateObject,
					__EVENTTARGET: listLearner.postback,
					__EVENTARGUMENT: listLearner.actions.captureWithBirthCertificate,
					ctl00$ContentPlaceHolder1$SelectRecs: this.recordsPerPage
				},
				headers: this.#SECURE_HEADERS
			});
			if (postResponse?.request?.path === '/Learner/alearner.aspx')
				return this.captureBioData(learner);
			if (postResponse?.request?.path === '/Admission/Listlearnersrep.aspx') {
				let errorMessage = htmlParser(postResponse?.data)?.querySelector(
					'#ctl00_ContentPlaceHolder1_ErrorMessage'
				)?.innerText;
				if (
					errorMessage &&
					learner?.upi &&
					errorMessage.startsWith(
						'You Can Not Capture' + ' Bio-Data Twice for this Student. Use the LEARNER'
					)
				) {
					// Reset then capture biodata
					await this.axiosInstance({
						method: 'post',
						url: '/Admission/Listlearnersrep.aspx',
						data: {
							...this.#stateObject,
							__EVENTTARGET: listLearner.postback,
							__EVENTARGUMENT: listLearner.actions.resetBiodataCapture,
							ctl00$ContentPlaceHolder1$SelectRecs: this.recordsPerPage
						},
						headers: this.#SECURE_HEADERS
					});
					return this.captureJoiningBiodata(learner, listLearner);
				}
			}
			writeFileSync(
				// @ts-ignore
				process.cwd() + '/debug/html/get_alearner_' + learner?.indexNo + '.html',
				postResponse?.data
			);
			throw { message: 'failed to get learner_router/alearner.aspx' };
		} catch (err) {
			throw err;
		}
	}

	async admitDefferedLearner(defferedLearner: NemisLearnerFromDb) {
		try {
			let differedTableHtml = htmlParser.parse(
				await this.axiosInstance.get('/Learner/differedadmissions.aspx')
			)?.outerHTML;
			if (!defferedLearner)
				throw {
					message: 'Couldn\'t parse defffered learner_router table.',
					cause: 'defferedLearnerHtml is undefined'
				};
			let differedJson = tableToJson.convert(differedTableHtml).map(x => {
				console.log(x);
			});
		} catch (err) {
			throw err;
		}
	}

	async requestJoiningLearner(
		indexNo: string,
		requestingLearner: RequestingJoiningLearner & AdmitApiCall
	) {
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
						...this.#stateObject,
						ctl00$ContentPlaceHolder1$BtnAdmit: 'Request Placement',
						ctl00$ContentPlaceHolder1$ScriptManager1:
							'ctl00$ContentPlaceHolder1$UpdatePanel1|ctl00$ContentPlaceHolder1$BtnAdmit',
						ctl00$ContentPlaceHolder1$txtAdmt: 0,
						ctl00$ContentPlaceHolder1$txtCanAdmt: canAdmit ? 1 : 0,
						ctl00$ContentPlaceHolder1$txtCanReq: canRequest ? 1 : 0,
						ctl00$ContentPlaceHolder1$txtGender: requestingLearner?.gender,
						ctl00$ContentPlaceHolder1$txtIndex: requestingLearner?.indexNo,
						ctl00$ContentPlaceHolder1$txtMarks: requestingLearner?.marks,
						ctl00$ContentPlaceHolder1$txtName: requestingLearner?.name,
						ctl00$ContentPlaceHolder1$txtReq: 1,
						ctl00$ContentPlaceHolder1$txtSName:
						requestingLearner?.schoolAdmitted?.originalString,
						ctl00$ContentPlaceHolder1$txtSName2:
						requestingLearner?.schoolAdmitted?.originalString,
						ctl00$ContentPlaceHolder1$txtSchool:
						requestingLearner?.schoolSelected?.code,
						ctl00$ContentPlaceHolder1$txtSearch: requestingLearner?.indexNo,
						ctl00$ContentPlaceHolder1$txtStatus: ''
					})
				})
			)?.data;
			await writeFileSync(process.cwd() + '/debug/html/search.html', postHtml);
			if (!/^.+pageRedirect.+Learner.+fStudindexreq/gi.test(postHtml)) {
				let viewstateAtob = buffer.atob(this.#stateObject?.__VIEWSTATE || '');
				if (viewstateAtob && /School Vacacies are exhausted!!/.test(viewstateAtob))
					throw {
						message:
							'The School Vacancies are exhausted!!. Request for Extra' +
							' Slots from Director Secondary!!'
					};
				else
					throw {
						message: 'Failed to redirect to \'/Learner/Studindexreq.aspx\'.',
						cause: requestingLearner
					};
			}

			await this.axiosInstance.get('/Learner/Studindexreq.aspx');
			postHtml = (
				await this.axiosInstance({
					method: 'post',
					url: '/Learner/Studindexreq.aspx',
					data: qs.stringify({
						...this.#stateObject,
						ctl00$ContentPlaceHolder1$BtnAdmit: 'Apply',
						ctl00$ContentPlaceHolder1$ScriptManager1:
							'ctl00$ContentPlaceHolder1$UpdatePanel1|ctl00$ContentPlaceHolder1$BtnAdmit',
						ctl00$ContentPlaceHolder1$txtFileNo: requestingLearner.adm,
						ctl00$ContentPlaceHolder1$txtGender: requestingLearner?.gender.split('')[0],
						ctl00$ContentPlaceHolder1$txtIndex: requestingLearner?.indexNo,
						ctl00$ContentPlaceHolder1$txtMarks: requestingLearner?.marks,
						ctl00$ContentPlaceHolder1$txtName: requestingLearner?.name,
						ctl00$ContentPlaceHolder1$txtIDNo: requestingLearner?.parent?.id,
						ctl00$ContentPlaceHolder1$txtPhone: requestingLearner?.parent?.tel,
						ctl00$ContentPlaceHolder1$txtWReq:
							requestingLearner.requestedBy ||
							'requested by parent with id number ' + requestingLearner?.parent?.id
					})
				})
			)?.data;
			if (
				htmlParser(postHtml).querySelector('#ctl00_ContentPlaceHolder1_ErrorMessage')
					?.innerText === 'Request Successfully Saved!!'
			) {
				return true;
			}
			let message = htmlParser(postHtml).querySelector(
				'#ctl00_ContentPlaceHolder1_ErrorMessage'
			)?.innerText;
			if (message)
				throw { message: 'Requesting learner_router failed with error: ' + message };
			else
				await writeFileSync(
					process.cwd() +
					'/debug/html/posting_request_' +
					requestingLearner.indexNo +
					'.html',
					postHtml
				);
			throw new CustomError(
				"Couldn't parse any error message. Saved response file for debug"
			);
		} catch (err) {
			throw err;
		}
	}

	async transferIn(learner: CompleteDatabaseLearner): Promise<boolean> {
		try {
			await this.axiosInstance.get('/Learner/StudReceive.aspx');
			// Send check to receive results that will allow use to capture transfer
			await this.axiosInstance.post(
				'/Learner/StudReceive.aspx',
				qs.stringify({
					...this.#stateObject,
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
					...this.#stateObject,
					ctl00$ContentPlaceHolder1$BtnAdmit: '[ SAVE ]',
					ctl00$ContentPlaceHolder1$DrpReason: '1',
					ctl00$ContentPlaceHolder1$txtRemark: '',
					ctl00$ContentPlaceHolder1$txtSearch: learner.upi || learner.birthCertificateNo
				})
			);

			// Base 64 decode returned view state
			if (!response?.data || !this.#stateObject?.__VIEWSTATE) {
				throw new CustomError('Confirmation view state was not returned.', 500);
			}
			let decodeResponse = Buffer.from(this.#stateObject?.__VIEWSTATE, 'base64').toString();

			return decodeResponse.includes(
				'The Transfer Request Saved. Learner Awaits Being Released From Current School Admitted'
			);
		} catch (err) {
			throw err;
		}
	}

	async getRequestedJoiningLearners() {
		try {
			let requestedJoiningLearnerTable = htmlParser(
				(await this.changeResultsPerPage('/Learner/Liststudreq.aspx'))?.data
			)?.querySelector('#ctl00_ContentPlaceHolder1_grdLearners')?.outerHTML;
			if (!requestedJoiningLearnerTable) return [];
			return <(RequestedJoiningLearner & { deleteCallback: string })[]>tableToJson
				.convert(requestedJoiningLearnerTable, {
					ignoreHiddenRows: true,
					stripHtmlFromCells: false
				})
				?.flat()
				?.map(x => {
					if (x['Index No'] === '&nbsp;') return;
					return {
						no: <string>x['No.'],
						indexNo: <string>x['Index No'],
						name: <string>x['Student Name'],
						gender: <string>x['Gender'],
						marks: <string>x['Marks'],
						schoolSelected: (() => {
							if (typeof x['Current Selected To'] !== 'string') return;
							return <SchoolSelected>{
								originalString: x['Current Selected To'],
								...[
									...x['Current Selected To']?.matchAll(
										/(?<code>\d+).+(?<name>(?<=\d )[a-zA-Z ].+)School Type:(?<type>[a-zA-Z]+).School Category:(?<category>[a-zA-Z]+)/gi
									)
								][0]?.groups
							};
						})(),
						requestedBy: <string>x['Request Description'],
						parentId: <string>x['Parent\'s IDNo'],
						parentTel: <string>x['Mobile No'],
						dateCaptured: <string>x['Date Captured'],
						approved: {
							on:
								<string>x['Approved On'] === '&nbsp;'
									? undefined
									: x['Approved' + ' On'],
							by: <string>x['Approved By'] === '&nbsp;' ? undefined : x['Approved By']
						},
						status: <string>x['Status'] === '&nbsp;' ? undefined : x['Status'],
						deleteCallback:
							<string>x['Approved On'] === '&nbsp;'
								? x[13]?.match(/ctl.*?Del/g)[0]
								: undefined
					};
				})
				?.filter(x => x);
		} catch (err) {
			throw err;
		}
	}

	async getApprovedJoiningLearners(): Promise<ApprovedLearner[]> {
		try {
			// chang page size
			let getAllHtml = (await this.changeResultsPerPage('/Learner/Liststudreqa.aspx'))?.data;
			//await writeFileSync(process.cwd() + '/debug/html/list_approved.html', getAllHtml);
			let requestedJoiningLearnerTable = htmlParser(getAllHtml).querySelector(
				'#ctl00_ContentPlaceHolder1_grdLearners'
			)?.outerHTML;
			if (!requestedJoiningLearnerTable) return [];
			return tableToJson
				.convert(requestedJoiningLearnerTable)
				?.flat()
				.map(x => {
					return {
						no: x['No.'],
						indexNo: x['Index No'],
						name: x['Student Name']?.toLowerCase(),
						gender: x['Gender']?.toLowerCase(),
						marks: x['Marks'],
						schoolSelected: (() => {
							if (typeof x['Current Selected To'] !== 'string') return;
							return <SchoolSelected>{
								originalString: x['Current Selected To'],
								...[
									...x['Current Selected To']?.matchAll(
										/(?<code>\d+).+(?<name>(?<=\d )[a-zA-Z ].+)School Type:(?<type>[a-zA-Z]+).School Category:(?<category>[a-zA-Z]+)/gi
									)
								][0]?.groups
							};
						})(),
						requestedBy: x['Request Description'],
						parentId: x['Parent\'s IDNo'],
						parentTel: x['Mobile No'],
						dateCaptured: x['Date Captured'],
						approved: {
							by: x['Approved By'],
							on: x['Approved On']
						},
						status: x['Status']
					};
				})
				.filter(x => x.indexNo);
		} catch (err) {
			throw err;
		}
	}

	async getDates() {
		return await this.axiosInstance.get('/generic/api/formone/admissiondates').catch(err => {
			Promise.reject(err);
		});
	}

	//Get requested learners from "http://nemis.education.go.ke/Learner/Listadmrequestsskul.aspx"
	async getRequestedContinuingLearners() {
		try {
			let requestedContinuingLearnersHtml = (
				await this.changeResultsPerPage('/Learner/Listadmrequestsskul.aspx')
			)?.data;
			let requestedContinuingLearners = htmlParser(
				requestedContinuingLearnersHtml
			)?.querySelector('#ctl00_ContentPlaceHolder1_grdLearners')?.outerHTML;
			if (!requestedContinuingLearners) return [];
			return <RequestingLearner[]>tableToJson
				.convert(requestedContinuingLearners)
				.flat()
				.map(element => {
					if (
						element['Gender'] &&
						element['KCPE Year'] &&
						element['Index'] &&
						element['Birth Certificate'] &&
						element['Grade']
					)
						return {
							no: Number(element['No.']),
							adm: String(element['Adm No']),
							surname: String(element['Surname']?.toLowerCase()),
							otherName: String(element['Othername']?.toLowerCase()),
							firstname: String(element['Firstname']?.toLowerCase()),
							name: [
								String(element['Surname']?.toLowerCase()),
								String(element['Firstname']?.toLowerCase()),
								String(element['Othername']?.toLowerCase())
							].join(' '),
							gender: String(element['Gender']?.toLowerCase()),
							kcpeYear: Number(element['KCPE Year']),
							indexNo: String(element['Index']),
							birthCertificateNo: String(element['Birth Certificate'])?.toLowerCase(),
							grade: element['Grade'],
							remarks: String(element['Remark'])?.toLowerCase()
						};
				})
				.filter(x => x);
		} catch (err) {
			throw {
				message: 'Error while fetching list of requested continuing learners',
				cause: err
			};
		}
	}

	async requestContinuingLearners(
		requestingLearner: ContinuingLearnerType & { apiResults?: ContinuingLearnerApiResponse }
	) {
		try {
			await this.axiosInstance.get('/Learner/Listadmrequestsskul.aspx');
			// Let middleware handle most of the data validations
			await this.axiosInstance({
				method: 'post',
				url: '/Learner/Listadmrequestsskul.aspx',
				headers: this.#SECURE_HEADERS,
				data: qs.stringify({
					__EVENTARGUMENT: '',
					__VIEWSTATEENCRYPTED: '',
					__LASTFOCUS: '',
					__EVENTVALIDATION: this.#stateObject?.__EVENTVALIDATION,
					__VIEWSTATE: this.#stateObject?.__VIEWSTATE,
					__VIEWSTATEGENERATOR: this.#stateObject?.__VIEWSTATEGENERATOR,
					ctl00$ContentPlaceHolder1$Button1: '[ ADD NEW STUDENT ]'
					//ctl00$ContentPlaceHolder1$SelectRecs: this.recordsPerPage
				})
			});
			let names = splitNames(requestingLearner.name);
			let requestingLearnerHtml = (
				await this.axiosInstance({
					method: 'post',
					url: '/Learner/Listadmrequestsskul.aspx',
					headers: this.#SECURE_HEADERS,
					data: qs.stringify({
						__EVENTARGUMENT: '',
						__VIEWSTATEENCRYPTED: '',
						__LASTFOCUS: '',
						__EVENTVALIDATION: this.#stateObject?.__EVENTVALIDATION,
						__VIEWSTATE: this.#stateObject?.__VIEWSTATE,
						__VIEWSTATEGENERATOR: this.#stateObject?.__VIEWSTATEGENERATOR,
						ctl00$ContentPlaceHolder1$Button2: '[  SAVE  ]',
						ctl00$ContentPlaceHolder1$SelectGender: requestingLearner.gender
							.charAt(0)
							.toUpperCase(),
						ctl00$ContentPlaceHolder1$SelectGrade: form(requestingLearner.grade),
						ctl00$ContentPlaceHolder1$SelectRecs: this.recordsPerPage,
						ctl00$ContentPlaceHolder1$txtAdmNo: requestingLearner.adm,
						ctl00$ContentPlaceHolder1$txtBCert: requestingLearner.birthCertificateNo,
						ctl00$ContentPlaceHolder1$txtFirstname: names?.firstname,
						ctl00$ContentPlaceHolder1$txtIndex: requestingLearner.indexNo,
						ctl00$ContentPlaceHolder1$txtOthername: names?.otherName,
						ctl00$ContentPlaceHolder1$txtRemark:
							requestingLearner.remarks || 'Failed' + ' admission ',
						ctl00$ContentPlaceHolder1$txtSurname: names?.surname,
						ctl00$ContentPlaceHolder1$txtYear: requestingLearner.kcpeYear
					})
				})
			)?.data;
			let requestedLearnersTable =
				htmlParser(requestingLearnerHtml).querySelector(
					'#ctl00_ContentPlaceHolder1_grdLearners'
				)?.outerHTML || ' '; // set an empty string if querySelector returns undefined
			let requestedLearner = tableToJson
				.convert(requestedLearnersTable)
				.flat()
				.map(x => {
					return {
						no: Number(x['No.']),
						adm: String(x['Adm No']),
						surname: String(x['Surname']?.toLowerCase()),
						otherName: String(x['Othername']?.toLowerCase()),
						firstname: String(x['Firstname']?.toLowerCase()),
						gender: String(x['Gender']?.toLowerCase()),
						kcpeYear: Number(x['KCPE Year']),
						indexNo: String(x['Index']),
						birthCertificateNo: String(x['Birth Certificate'])?.toLowerCase(),
						grade: Number(x['Grade']),
						remarks: String(x['Remark'])?.toLowerCase()
					};
				})
				.filter(
					x =>
						x.adm === requestingLearner.adm &&
						x.birthCertificateNo === requestingLearner.birthCertificateNo
				);
			if (requestedLearner.length !== 1) {
				throw {
					message: 'Error requesting learner_router',
					cause: requestingLearner
				};
			}
			return true;
		} catch (err) {
			if (err instanceof Error || err instanceof AxiosError)
				throw {
					message: err.message || 'Failed to capture continuing learner_router',
					cause: err
				};
			throw err;
		}
	}

	// Get continuing students pending bio-data capture-
	async getPendingContinuingLearners(): Promise<RequestingLearner[]> {
		try {
			// Get an entire list
			let pendingLearners = (
				await this.changeResultsPerPage('/Learner/Listadmrequestsskulapp.aspx')
			)?.data;
			let pendingLearnerTable =
				htmlParser(pendingLearners).querySelector('#ctl00_ContentPlaceHolder1_grdLearners')
					?.outerHTML || ' '; // Set empty string if querySelector doesn't return a value
			return tableToJson
				.convert(pendingLearnerTable, { stripHtmlFromCells: false })
				.flat()
				.map(x => {
					return {
						no: Number(x['No.']),
						adm: String(x['Adm No']),
						surname: String(x['Surname']?.toLowerCase()),
						otherName: String(x['Othername']?.toLowerCase()),
						firstname: String(x['Firstname']?.toLowerCase()),
						name: [
							String(x['Surname']?.toLowerCase()),
							String(x['Firstname']?.toLowerCase()),
							String(x['Othername']?.toLowerCase())
						].join(' '),
						gender: String(x['Gender']?.toLowerCase()),
						kcpeYear: Number(x['KCPE Year']),
						indexNo: String(x['Index']),
						birthCertificateNo: String(x['Birth Certificate'])?.toLowerCase(),
						grade: x['Grade'],
						remarks: String(x['Remark'])?.toLowerCase(),
						upi: x['UPI'] === '&nbsp;' ? '' : x['UPI'],
						postback: htmlParser(x['11']).querySelector('input')?.attrs?.name
					};
				});
		} catch (err) {
			if (err instanceof Error || err instanceof AxiosError)
				throw {
					message: err.message || 'Failed to get pending continuing learners',
					cause: err
				};
			throw err;
		}
	}

	//Capture Bio-data for continuing learners
	async captureContinuingLearners(
		continuingLearner: CompleteLearner,
		pendingContinuingLearner: RequestingLearner
	): Promise<CaptureBiodataResponse> {
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
					__VIEWSTATEGENERATOR: this.#stateObject?.__VIEWSTATEGENERATOR,
					__VIEWSTATE: this.#stateObject?.__VIEWSTATE,
					__EVENTVALIDATION: this.#stateObject?.__EVENTVALIDATION,
					ctl00$ContentPlaceHolder1$SelectRecs: this.recordsPerPage,
					[String(pendingContinuingLearner.postback)]: 'BIO-BC'
				}),
				headers: this.#SECURE_HEADERS
			});

			if (
				pendingLearnerResponse?.request?.path !== '/Learner/alearner.aspx' ||
				!pendingLearnerResponse?.data
			) {
				logger.error('Failed to get alearner.aspx');
				throw { message: 'Couldn\'t get "/Learner/alearner.aspx' };
			}
			return this.captureBioData(continuingLearner);
		} catch (err) {
			if (err instanceof Error || err instanceof AxiosError)
				throw {
					message: err.message || 'Failed to capture continuing learner_router',
					cause: err
				};
			throw err;
		}
	}

	//capture Bio data
	async captureBioData(learner: CompleteLearner): Promise<CaptureBiodataResponse> {
		try {
			const names = splitNames(learner.name);
			const medicalCode = medicalConditionCode(learner.medicalCondition);
			const county = countyToNo(learner.county, learner.subCounty);
			const nationality = nationalities(learner?.nationality || 'kenya');

			if (!learner?.birthCertificateNo)
				throw new CustomError(
					'Learner birth certificate number was not provided. ' +
					'Can not capture biodata without learners birth certificate number',
					400
				);
			if (!learner.dob) {
				throw new CustomError('Date of birth was not submitted for the learner', 400);
			}

			// Initial POST to set county
			await this.axiosInstance.get('/Learner/alearner.aspx');

			let postData = qs.stringify({
				__ASYNCPOST: 'true',
				__EVENTTARGET: 'ctl00$ContentPlaceHolder1$ddlcounty',
				__EVENTARGUMENT: '',
				__EVENTVALIDATION: this.#stateObject?.__EVENTVALIDATION,
				__LASTFOCUS: '',
				__VIEWSTATE: this.#stateObject?.__VIEWSTATE,
				__VIEWSTATEENCRYPTED: '',
				__VIEWSTATEGENERATOR: this.#stateObject?.__VIEWSTATEGENERATOR,
				ctl00$ContentPlaceHolder1$DOB$ctl00: `${
					learner.dob?.getMonth() + 1
				}/${learner.dob.getDate()}/${learner.dob.getFullYear()}`,
				ctl00$ContentPlaceHolder1$Nationality: nationality,
				ctl00$ContentPlaceHolder1$ScriptManager1:
					'ctl00$ContentPlaceHolder1$UpdatePanel1|ctl00$ContentPlaceHolder1$ddlcounty',
				ctl00$ContentPlaceHolder1$ddlClass: form(learner.grade),
				ctl00$ContentPlaceHolder1$ddlcounty: county?.countyNo,
				ctl00$ContentPlaceHolder1$ddlmedicalcondition: medicalCode,
				ctl00$ContentPlaceHolder1$ddlsubcounty: '0'
			});

			let aLearnerHtml = (await this.axiosInstance.post('/Learner/alearner.aspx', postData))
				?.data;

			if (!/^.+updatePanel\|ctl00_ContentPlaceHolder1_UpdatePanel1/g.test(aLearnerHtml)) {
				throw new CustomError('Failed to submit learner\'s county.', 500);
			}

			let formDataObject = {};

			Object.assign(formDataObject, {
				__EVENTARGUMENT: '',
				__EVENTTARGET: '',
				__EVENTVALIDATION: this.#stateObject?.__EVENTVALIDATION,
				__VIEWSTATE: this.#stateObject?.__VIEWSTATE,
				__VIEWSTATEGENERATOR: this.#stateObject?.__VIEWSTATEGENERATOR,
				__LASTFOCUS: '',
				__VIEWSTATEENCRYPTED: '',
				ctl00$ContentPlaceHolder1$Birth_Cert_No: learner.birthCertificateNo,
				ctl00$ContentPlaceHolder1$DOB$ctl00: `${
					learner.dob.getMonth() + 1
				}/${learner.dob.getDate()}/${learner.dob.getFullYear()}`,
				ctl00$ContentPlaceHolder1$Gender: learner.gender.split('')[0].toUpperCase(),
				ctl00$ContentPlaceHolder1$FirstName: names.firstname,
				ctl00$ContentPlaceHolder1$Nationality: nationality,
				ctl00$ContentPlaceHolder1$OtherNames: names.otherName,
				ctl00$ContentPlaceHolder1$Surname: names.surname,
				ctl00$ContentPlaceHolder1$UPI: '',
				ctl00$ContentPlaceHolder1$ddlcounty: county?.countyNo,
				ctl00$ContentPlaceHolder1$ddlmedicalcondition: medicalCode,
				ctl00$ContentPlaceHolder1$ddlsubcounty: county?.subCountyNo,
				ctl00$ContentPlaceHolder1$mydob: '',
				ctl00$ContentPlaceHolder1$myimage: '',
				ctl00$ContentPlaceHolder1$txtPostalAddress: learner.address || '',
				ctl00$ContentPlaceHolder1$txtSearch: '',
				ctl00$ContentPlaceHolder1$txtmobile: '',
				ctl00$ContentPlaceHolder1$optspecialneed: learner.isSpecial
					? 'optspecialneed'
					: 'optneedsno',
				ctl00$ContentPlaceHolder1$txtEmailAddress: ''
			});

			if (learner?.father?.name && learner?.father?.id && learner?.father?.tel) {
				Object.assign(formDataObject, {
					ctl00$ContentPlaceHolder1$txtFatherContacts: learner.father.tel,
					ctl00$ContentPlaceHolder1$txtFatherIDNO: learner.father.id,
					ctl00$ContentPlaceHolder1$txtFatherName: learner.father.name,
					ctl00$ContentPlaceHolder1$txtFatherUPI: ''
				});
			}

			if (learner?.guardian?.name && learner?.guardian?.id && learner?.guardian?.tel) {
				Object.assign(formDataObject, {
					ctl00$ContentPlaceHolder1$txtGuardianIDNO: learner.guardian.id,
					ctl00$ContentPlaceHolder1$txtGuardianname: learner.guardian.name,
					ctl00$ContentPlaceHolder1$txtGuardianUPI: '',
					ctl00$ContentPlaceHolder1$txtGuardiancontacts: learner.guardian.tel
				});
			}
			if (learner?.mother?.name && learner?.mother?.id && learner?.mother?.tel) {
				Object.assign(formDataObject, {
					ctl00$ContentPlaceHolder1$txtMotherIDNo: learner.mother.id,
					ctl00$ContentPlaceHolder1$txtMotherName: learner.mother.name,
					ctl00$ContentPlaceHolder1$txtMotherUPI: '',
					ctl00$ContentPlaceHolder1$txtMothersContacts: learner.mother.tel
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
					...this.#SECURE_HEADERS,
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
					__EVENTVALIDATION: this.#stateObject?.__EVENTVALIDATION,
					__VIEWSTATE: this.#stateObject?.__VIEWSTATE,
					__VIEWSTATEGENERATOR: this.#stateObject?.__VIEWSTATEGENERATOR,
					__LASTFOCUS: '',
					__VIEWSTATEENCRYPTED: '',
					ctl00$ContentPlaceHolder1$optignore: 'optignoreyes'
				});

				let formData = new FormData();
				Object.entries(formDataObject).forEach(([key, value]) =>
					formData.append(key, value)
				);

				// POST with ignore error flag set
				let postIgnoreHtml = await this.axiosInstance({
					method: 'post',
					url: '/Learner/alearner.aspx',
					headers: {
						...this.#SECURE_HEADERS,
						...formData.getHeaders()
					},
					data: formData
				});
				//writeFileSync("debug/html/ignoretrue.html", postIgnoreHtml?.data);
				aLearnerHtml = postIgnoreHtml;
			}

			let aLearnerDocument = htmlParser(aLearnerHtml?.data);

			let message = aLearnerDocument.querySelector('.alert');

			if (!message?.innerText) {
				let newUpi = aLearnerDocument.querySelector(
					'#ctl00_ContentPlaceHolder1_instmessage'
				)?.innerText;
				if (typeof newUpi === 'string' && newUpi.startsWith('New UPI:')) {
					return {
						upi: newUpi.replace('New UPI: ', ''),
						message: 'Received a new UPI',
						alertMessage: undefined
					};
				}
				writeFileSync(
					process.cwd() + '/debug/html/no_alert_message_' + learner.indexNo + '.html',
					aLearnerHtml
				);
				throw {
					message:
						'Alert message is missing. We were not able to parse' +
						' message from then page.'
				};
			}
			// If learner_router got assigned UPI number
			if (/The Learner Basic Details have been Saved successfully/.test(message?.innerText)) {
				return {
					upi: aLearnerDocument.querySelector('#UPI')?.attrs?.value,
					message: message.innerText.replace('&times;  ', ''),
					alertMessage: message.outerHTML
				};
			}
			if (/Failure!/g.test(message.innerText)) {
				throw {
					alertMessage: message.outerHTML,
					message: message.innerText?.replace(/(^.)\n(Failure!)/, '')
				};
			}
			// We can't take this as an assurance everything went well, because if it did, we'd
			// have already returned with the new UPI
			writeFileSync(
				process.cwd() + '/debug/html/unknown_error_' + learner.indexNo + '.html',
				aLearnerHtml
			);
			throw {
				alertMessage: message.outerHTML,
				message: message.innerText?.replace(/(^.)\n(Failure!)/, '')
			};
		} catch (err: any) {
			throw err;
		}
	}

	//submit to NHIF
	async submitToNhif(grade: Grades, learnersWithoutNhif: ListLearner[]) {
		try {
			if (!learnersWithoutNhif) {
				throw {
					message: 'learnersWithoutNhif array is empty'
				};
			}
			const postNhif = async (learnerWithoutNhif: ListLearner) => {
				let submitNhifHtml = (
					await this.axiosInstance({
						method: 'post',
						url: 'Learner/Listlearners.aspx',
						data: qs.stringify({
							__ASYNCPOST: 'true',
							__EVENTARGUMENT: '',
							__EVENTTARGET: learnerWithoutNhif.doPostback,
							__LASTFOCUS: '',
							__VIEWSTATE: this.#stateObject?.__VIEWSTATE,
							__VIEWSTATEGENERATOR: this.#stateObject?.__VIEWSTATEGENERATOR,
							ctl00$ContentPlaceHolder1$ScriptManager1:
								'ctl00$ContentPlaceHolder1$UpdatePanel1|ctl00$ContentPlaceHolder1$grdLearners$ctl162$BtnView',
							ctl00$ContentPlaceHolder1$SelectBC: '1',
							ctl00$ContentPlaceHolder1$SelectCat: form(grade),
							ctl00$ContentPlaceHolder1$SelectCat2: '9 ',
							ctl00$ContentPlaceHolder1$SelectRecs: this.recordsPerPage
						})
					})
				)?.data;

				if (!/.+pageRedirect\|\|%2fLearner%2fAlearner.aspx/.test(submitNhifHtml))
					return Promise.reject('Failed to get redirect');

				submitNhifHtml = (await this.axiosInstance.get('Learner/Alearner.aspx'))?.data;
				const scrappedLearner = this.scrapAlearner(submitNhifHtml);
				const postData = new FormData();
				postData.append('__EVENTARGUMENT', '');
				postData.append('__EVENTTARGET', '');
				postData.append('__EVENTVALIDATION', this.#stateObject?.__EVENTVALIDATION);
				postData.append('__VIEWSTATE', this.#stateObject?.__VIEWSTATE);
				postData.append('__VIEWSTATEGENERATOR', this.#stateObject?.__VIEWSTATEGENERATOR);
				postData.append('__LASTFOCUS', '');
				postData.append('__VIEWSTATEENCRYPTED', '');
				postData.append(
					'ctl00$ContentPlaceHolder1$Birth_Cert_No',
					scrappedLearner.birthCertificateNo
				);
				postData.append('ctl00$ContentPlaceHolder1$BtnNHIF', 'SUBMIT TO NHIF');
				postData.append('ctl00$ContentPlaceHolder1$DOB$ctl00', scrappedLearner.dob);
				postData.append(
					'ctl00$ContentPlaceHolder1$FirstName',
					scrappedLearner.names.firstname
				);
				postData.append('ctl00$ContentPlaceHolder1$Gender', scrappedLearner.gender);
				postData.append(
					'ctl00$ContentPlaceHolder1$Nationality',
					scrappedLearner.nationality
				);
				postData.append(
					'ctl00$ContentPlaceHolder1$OtherNames',
					scrappedLearner.names.lastname
				);
				postData.append('ctl00$ContentPlaceHolder1$Surname', scrappedLearner.names.surname);
				postData.append('ctl00$ContentPlaceHolder1$UPI', scrappedLearner.upi);
				postData.append(
					'ctl00$ContentPlaceHolder1$ddlcounty',
					scrappedLearner.county.countyNo
				);
				postData.append(
					'ctl00$ContentPlaceHolder1$ddlmedicalcondition',
					scrappedLearner.medical.code
				);
				postData.append(
					'ctl00$ContentPlaceHolder1$ddlsubcounty',
					scrappedLearner.county.subCountyNo
				);
				postData.append('ctl00$ContentPlaceHolder1$mydob', '');
				postData.append('ctl00$ContentPlaceHolder1$myimage', '');
				postData.append(
					'ctl00$ContentPlaceHolder1$optspecialneed',
					scrappedLearner.isSpecial
				);
				postData.append(
					'ctl00$ContentPlaceHolder1$txtEmailAddress',
					scrappedLearner.emailAddress
				);
				postData.append(
					'ctl00$ContentPlaceHolder1$txtFatherContacts',
					scrappedLearner.father.tel
				);
				postData.append(
					'ctl00$ContentPlaceHolder1$txtFatherIDNO',
					scrappedLearner.father.id
				);
				postData.append(
					'ctl00$ContentPlaceHolder1$txtFatherName',
					scrappedLearner.father.name
				);
				postData.append(
					'ctl00$ContentPlaceHolder1$txtFatherUPI',
					scrappedLearner.father.upi
				);
				postData.append(
					'ctl00$ContentPlaceHolder1$txtGuardianIDNO',
					scrappedLearner.guardian.id
				);
				postData.append(
					'ctl00$ContentPlaceHolder1$txtGuardianUPI',
					scrappedLearner.guardian.upi
				);
				postData.append(
					'ctl00$ContentPlaceHolder1$txtGuardiancontacts',
					scrappedLearner.guardian.tel
				);
				postData.append(
					'ctl00$ContentPlaceHolder1$txtGuardianname',
					scrappedLearner.guardian.name
				);
				postData.append(
					'ctl00$ContentPlaceHolder1$txtMotherIDNo',
					scrappedLearner.mother.id
				);
				postData.append(
					'ctl00$ContentPlaceHolder1$txtMotherName',
					scrappedLearner.mother.name
				);
				postData.append(
					'ctl00$ContentPlaceHolder1$txtMotherUPI',
					scrappedLearner.mother.upi
				);
				postData.append(
					'ctl00$ContentPlaceHolder1$txtMothersContacts',
					scrappedLearner.mother.tel
				);
				postData.append(
					'ctl00$ContentPlaceHolder1$txtPostalAddress',
					scrappedLearner.address
				);
				postData.append('ctl00$ContentPlaceHolder1$txtSearch', scrappedLearner.txtSearch);
				postData.append('ctl00$ContentPlaceHolder1$txtmobile', scrappedLearner.txtMobile);

				let postNhifHtml = (
					await this.axiosInstance({
						method: 'post',
						url: 'Learner/Alearner.aspx',
						headers: {
							...this.#SECURE_HEADERS,
							...postData.getHeaders()
						},
						data: postData
					})
				)?.data;
				let successMessageElement =
					htmlParser(postNhifHtml).querySelector('#LblMsgContact');
				let successMessage = successMessageElement?.innerText;
				if (!successMessage)
					return Promise.reject(
						'Failed to get nhif number since successMessageElement is' + ' empty'
					);

				if (successMessage.startsWith('The remote server returned an error:'))
					return Promise.reject(successMessage);
				let parsedReturnObject = {
					nhifNo: successMessage.match(/\d.+/g)?.shift()?.trim(),
					message: successMessage.replace(/&times;\W|\d+/g, '')?.trim(),
					alertHtml: successMessageElement?.outerHTML
				};
				if (!parsedReturnObject.nhifNo)
					throw {
						message:
							'Failed to get nhif number since successMessage doesn\'t contain a' +
							' number',
						cause: 'Couldn\'t find nhif number on the returned page'
					};
				return parsedReturnObject;
			};
			//await postNhif(learnersWithoutNhif[10]);
			let submitNhifPromise = <
				PromiseSettledResult<{
					nhifNo: string;
					alertHtml: string | undefined;
					message: string;
				}>[]
				>await Promise.allSettled(learnersWithoutNhif.map(x => postNhif(x)));
			return submitNhifPromise
				.map((x, i) => {
					if (x.status === 'fulfilled') {
						return {
							...learnersWithoutNhif[i],
							nhifNo: x.value?.nhifNo,
							message: x.value?.message
						};
					}
				})
				.filter(x => x);
		} catch (err) {
			throw err;
		}
	}

	// Scrap ../Listlearners.aspx
	scrapAlearner(alearnerHtml: string) {
		if (!alearnerHtml) throw new Error('No data provided from Alearner.aspx');
		try {
			let alearnerDocument = htmlParser(alearnerHtml);
			return {
				birthCertificateNo:
					alearnerDocument.querySelector('#Birth_Cert_No')?.attrs?.value || '',
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
				isSpecial: alearnerDocument.querySelector('#ctl00_ContentPlaceHolder1_optneedsno')
					?.attrs?.checked
					? 'optneedsno'
					: 'optspecialneed' || '',
				emailAddress:
					alearnerDocument.querySelector('#txtEmailAddress')?.attrs?.value || '',
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
			throw err;
		}
	}

	/**
	 * Retrieves selection list information by scraping the selected learners page,
	 * /Admission/Listlearners.aspx, and parsing its html using node-html-parser.
	 * @returns {Array<SelectedLearner>} An object containing institution information.
	 * @throws Error object if the institution page is not found.
	 */
	async getSelectedLearners(): Promise<SelectedLearner[]> {
		try {
			await this.axiosInstance.get('/Admission/Listlearners.aspx');
			const selectedLearnerHtml = (
				await this.axiosInstance.post(
					'/Admission/Listlearners.aspx',
					qs.stringify({
						__ASYNCPOST: 'true',
						__EVENTTARGET: 'ctl00$ContentPlaceHolder1$SelectRecs',
						...this.#stateObject,
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
			if (!selectedLearnerHtmlTable) return [];
			const selectedLearnersJson = tableToJson.convert(selectedLearnerHtmlTable);
			return selectedLearnersJson.flat().map(selectedLearner => {
				return {
					indexNo: selectedLearner['Index']?.toLowerCase(),
					name: selectedLearner['Name']?.toLowerCase(),
					gender: selectedLearner['Gender']?.toLowerCase(),
					yearOfBirth: selectedLearner['Year of Birth']?.toLowerCase(),
					marks: selectedLearner['Marks']?.toLowerCase(),
					subCounty: selectedLearner['Sub-County']?.toLowerCase()
				};
			});
		} catch (err) {
			throw err;
		}
	}

	async addContinuingLearner(learner: CompleteLearner): Promise<CaptureBiodataResponse> {
		try {
			await this.listLearners(learner.grade);
			let addLearnerBC = await this.axiosInstance.post(
				'/Learner/Listlearners.aspx',
				qs.stringify({
					...this.#stateObject,
					__ASYNCPOST: 'true',
					__EVENTTARGET: 'ctl00$ContentPlaceHolder1$SelectRecs',
					ctl00$ContentPlaceHolder1$ScriptManager1:
						'ctl00$ContentPlaceHolder1$UpdatePanel1|ctl00$ContentPlaceHolder1$SelectCat',
					ctl00$ContentPlaceHolder1$SelectBC: '1',
					ctl00$ContentPlaceHolder1$SelectCat: form(learner.grade),
					ctl00$ContentPlaceHolder1$SelectCat2: '9 ',
					ctl00$ContentPlaceHolder1$SelectRecs: this.recordsPerPage,
					ctl00$ContentPlaceHolder1$Button1: '[ ADD NEW STUDENT (WITH BC)]'
				})
			);
			writeFileSync('debug/getalearner.html', addLearnerBC?.data);

			if (addLearnerBC?.data === '1|#||4|26|pageRedirect||%2fLearner%2fAlearner.aspx|') {
				return this.captureBioData(learner);
			}
			throw new CustomError(
				'Server failed to sed a redirect to biodata capture page',
				400,
				'failed_redirect'
			);
		} catch (err) {
			throw err;
		}
	}

	/**
	 *  since the number of results per page persists over request if over multiple pages, we use
	 *  this method to check if we really need to change the number of results per page
	 */
	async changeResultsPerPage(url: string, gradeOrForm?: Grades): Promise<any> {
		try {
			let getResponse = await this.axiosInstance.get(url);
			// Check if we all getting the entire list
			let table = htmlParser(getResponse?.data)?.querySelector(
				'#ctl00_ContentPlaceHolder1_grdLearners'
			)?.outerHTML;
			if (!table)
				throw {
					message: 'Couldn\'t parse table element.'
				};
			let firstTableElement = tableToJson
				.convert(table, { stripHtml: false })
				?.flat()
				?.shift();
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
						...this.#stateObject,
						__ASYNCPOST: 'true',
						__EVENTTARGET: 'ctl00$ContentPlaceHolder1$SelectRecs',
						ctl00$ContentPlaceHolder1$ScriptManager1:
							'ctl00$ContentPlaceHolder1$UpdatePanel1|ctl00$ContentPlaceHolder1$SelectCat',
						ctl00$ContentPlaceHolder1$SelectBC: '1',
						ctl00$ContentPlaceHolder1$SelectCat: form(gradeOrForm as Grades),
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
						__VIEWSTATE: this.#stateObject?.__VIEWSTATE,
						__VIEWSTATEGENERATOR: this.#stateObject?.__VIEWSTATEGENERATOR,
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
		} catch (err) {
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

			this.#stateObject = {
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
				viewStateGenerator = data
					.match(/(?<=__VIEWSTATEGENERATOR\|).*?(?=\|)/gm)
					?.toString(),
				eventValidation = data.match(/(?<=__EVENTVALIDATION\|).*?(?=\|)/gm)?.toString();
			//now check if view state is set
			if (viewState || viewStateGenerator) {
				this.#stateObject = {
					__EVENTVALIDATION: eventValidation ? eventValidation : '',
					__VIEWSTATE: viewState ? viewState : '',
					__VIEWSTATEGENERATOR: viewStateGenerator ? viewStateGenerator : ''
				};
				return;
			}
			logger.error('View sate not saved');
			writeFileSync(process.cwd() + '/debug/html/view_state_error.hmtl', data);
			throw new CustomError('Couldn\'t find any view state data.', 500);
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
				logger.error(err);
				return Promise.reject(err);
			}
		);
		// Response interceptor for API calls
		this.axiosInstance.interceptors.response.use(
			response => {
				try {
					// If we get a page redirect tot login with 200 OK
					if (
						(response.data?.length < 50 &&
							/pageRedirect.+Login\.aspx/i.test(response.data)) ||
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
					if (
						/1\|#\|\|4\|17\|pageRedirect\|\|%2fErrorPage.aspx\|/gi.test(response?.data)
					) {
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
					return new CustomError(err.message, err.code || 500);
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
							'Gateway timed out while try to reach ' +
							err.config?.baseURL +
							err.config?.url;
						err.type = 'gateway_timeout';
						break;
					default:
						err.message = err.response?.data || 'Unknown error';
						err.type = err?.code?.toLowerCase() || 'unknown_error';
						break;
				}
				return Promise.reject(new CustomError(err.message, err.code || 500, '', err));
			}
		);
	}
}

export { NemisWebService };
