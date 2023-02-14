/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import axios, {AxiosError, AxiosInstance} from 'axios';
import FormData from 'form-data';
import {writeFileSync} from 'fs';
import moment from 'moment';
import {parse as htmlParser} from 'node-html-parser';
import {Tabletojson as tableToJson} from 'tabletojson';

import {Grades, Institution, NemisLearner, NemisLearnerFromDb} from '../interfaces';
import {RequestingLearner} from '../middleware/interfaces';
import {countyToNo, form, nationalities, setMedicalCondition, splitNames} from './converts';
import {
	AdmitApiCall,
	AdmittedJoiningLearners,
	ApprovedLearner,
	CaptureRequestingLearner,
	ErrorResponse,
	ListLearner,
	ParsedLabel,
	RequestedJoiningLearner,
	SchoolSelected,
	SearchLearner,
	SelectedLearner,
	StateObject
} from './interface';
import logger from './logger';
import qs = require('qs');

/**
 * Class used to interact with the NEMIS website.
 */
export class Nemis {
	recordsPerPage: number = 10000;
	//axiosRequestInterceptor;
	//axiosResponseInterceptor;
	canRequest: boolean;
	canAdmit: boolean;
	#SECURE_HEADERS = {
		'Upgrade-Insecure-Requests': '1',
		'Content-Type': 'application/x-www-form-urlencoded',
		'User-Agent':
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.67 Safari/537.36',
		Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
		host: 'nemis.education.go.ke'
	};
	//Axios instance
	#stateObject: StateObject;
	#cookie: string;
	#institutionCode: string;
	private readonly axiosInstance: AxiosInstance;

	constructor() {
		axios.defaults.headers.common['Authorization'] = 'Basic bmVtaXNhZG1pbjo5ODc2JFRldGE=';
		this.axiosInstance = axios.create({
			baseURL: 'http://nemis.education.go.ke'
		});
		this.#setupAxiosInterceptors();
	}

	// Cookie setter
	async setCookie(cookie: string) {
		try {
			this.#cookie = cookie;
			await this.axiosInstance.get('/Default.aspx');
			return true;
		} catch (e) {
			this.#cookie = undefined;
			return false;
		}
	}

	//login to NEMIS and return a cookie
	async login(username: string, password: string): Promise<string> {
		try {
			if (!username || !password) {
				return Promise.reject({
					message: 'Username or password not provided',
					type: 'invalid_credentials',
					time: Date.now()
				});
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
			if (/1\|#\|\|4\|15\|pageRedirect\|\|%2fDefault.aspx\|/gi.test(response?.data)) {
				//if we got redirected to Default.aspx, then login was succeeded
				return this.#cookie;
			}
		} catch (err) {
			throw err;
		}
	}

	// Gets institution's info from NEMIS website at /Institution/Institution.aspx
	async getInstitution(): Promise<Institution> {
		try {
			let institutionHtml = (await this.axiosInstance.get('/Institution/Institution.aspx'))
				?.data;
			if (!institutionHtml) {
				return Promise.reject({
					message: 'Institution page not found',
					type: 'page_not_found',
					time: Date.now()
				});
			}
			let document = htmlParser(institutionHtml);
			let institution: Institution = {
				//Institution Bio Data Tab
				name: document
					.querySelector('#ctl00_ContentPlaceHolder1_Institution_Name')
					?.attrs?.value?.toLowerCase(),
				knecCode: document
					.querySelector('#ctl00_ContentPlaceHolder1_Knec_Code')
					?.attrs?.value?.toLowerCase(),
				code: document
					.querySelector('#ctl00_ContentPlaceHolder1_Institution_Code')
					?.attrs?.value?.toLowerCase(),
				gender: document
					.querySelector('#ctl00_ContentPlaceHolder1_Classification_by_Gender')
					.outerHTML?.match(/(?<=selected" value="\d.*">)\D+?(?=(?=\W+<)|<)/)
					?.toString()
					?.toLowerCase(),
				registrationNumber: document
					.querySelector('#ctl00_ContentPlaceHolder1_Institution_Current_Code')
					.attrs?.value?.toLowerCase(),
				type: document
					.querySelector('#ctl00_ContentPlaceHolder1_Institution_Type')
					.outerHTML?.match(/(?<=selected" value="\w.*">)\D+?(?=(?=\W+<)|<)/)
					?.toString()
					?.toLowerCase(),
				registrationStatus: document
					.querySelector('#ctl00_ContentPlaceHolder1_Institution_Status')
					.outerHTML?.match(/(?<=selected" value="\w.*">)\D+?(?=(?=\W+<)|<)/)
					?.toString()
					?.toLowerCase(),
				accommodation: document
					.querySelector('#ctl00_ContentPlaceHolder1_Accommodation_Code')
					.outerHTML?.match(/(?<=selected" value="\d.*">)\D+?(?=(?=\W+<)|<)/)
					?.toString()
					?.toLowerCase(),
				tscCode: document
					.querySelector('#ctl00_ContentPlaceHolder1_Tsc_Code')
					?.attrs?.value?.toLowerCase(),
				category: document
					.querySelector('#ctl00_ContentPlaceHolder1_Institution_Category_Code')
					.outerHTML?.match(/(?<=selected" value="\d.*">)\D+?(?=(?=\W+<)|<)/)
					?.toString()
					?.toLowerCase(),
				educationLevel: document
					.querySelector('#ctl00_ContentPlaceHolder1_Institution_Level_Code')
					.outerHTML?.match(/(?<=selected" value="\d.*">)\D+?(?=(?=\W+<)|<)/)
					?.toString()
					?.toLowerCase(),
				institutionMobility: document
					.querySelector('#ctl00_ContentPlaceHolder1_Mobile_Institution')
					.outerHTML?.match(/(?<=selected" value="\d.*">)\D+?(?=(?=\W+<)|<)/)
					?.toString()
					?.toLowerCase(),
				residence: document
					.querySelector('#ctl00_ContentPlaceHolder1_Institution_Residence')
					.outerHTML?.match(/(?<=selected" value="\d.*">)\D+?(?=(?=\W+<)|<)/)
					?.toString()
					?.toLowerCase(),
				educationSystem: document
					.querySelector('#ctl00_ContentPlaceHolder1_Education_System_Code')
					.outerHTML?.match(
						/(?<=selected" value="\d.*">)(?:(?:\D+?)(?=(?=\W+)<)|(?:(?:\d\.){2}\d)(?!=<))/
					)
					?.toString()
					?.toLowerCase(),
				constituency: document
					.querySelector('#ctl00_ContentPlaceHolder1_Constituency_Code')
					.outerHTML?.match(/(?<=selected" value="\d.*">)\D+?(?=(?=\W+<)|<)/)
					?.toString()
					?.toLowerCase(),
				kraPin: document
					.querySelector('#ctl00_ContentPlaceHolder1_Employer_pin')
					.attrs?.value?.toLowerCase(),
				//plusCode: document.querySelector("#PlusCode").attrs?.value?.toLowerCase(),
				registrationDate: document
					.querySelector('#ctl00_ContentPlaceHolder1_Registration_Date')
					.attrs?.value?.toLowerCase(),
				ward: document
					.querySelector('#ctl00_ContentPlaceHolder1_Ward_Code')
					.outerHTML?.match(/(?<=selected" value="\d.*">)\D+?(?=(?=\W+<)|<)/)
					?.toString()
					?.toLowerCase(),
				zone: document
					.querySelector('#ctl00_ContentPlaceHolder1_Zone_Code')
					.outerHTML?.match(/(?<=selected" value="\d.*">)\D+?(?=(?=\W+<)|<)/)
					?.toString()
					?.toLowerCase(),
				county: document
					.querySelector('#ctl00_ContentPlaceHolder1_County_Code')
					.outerHTML?.match(/(?<=selected" value="\d.*">)\D+?(?=(?=\W+<)|<)/)
					?.toString()
					?.toLowerCase(),
				subCounty: document
					.querySelector('#ctl00_ContentPlaceHolder1_Sub_County_Code')
					.outerHTML?.match(/(?<=selected" value="\d.*">)\D+?(?=(?=\W+<)|<)/)
					?.toString()
					?.toLowerCase(),
				cluster: document
					.querySelector('#ctl00_ContentPlaceHolder1_Institution_Cluster ')
					.outerHTML?.match(/(?<=selected" value="\d.*">)\D+?(?=(?=\W+<)|<)/)
					?.toString()
					?.toLowerCase(),
				//Ownrship Details Tab
				ownership: document
					.querySelector('#ctl00_ContentPlaceHolder1_Premise_Ownership')
					.outerHTML?.match(/(?<=selected" value="\d.*">)\D+?(?=(?=\W+<)|<)/)
					?.toString()
					?.toLowerCase(),
				ownershipDocument: document
					.querySelector('#ctl00_ContentPlaceHolder1_Ownership_Document')
					.outerHTML?.match(/(?<=selected" value="\d.*">)\D+?(?=(?=\W+<)|<)/)
					?.toString()
					?.toLowerCase(),
				owner:
					document
						.querySelector('#ctl00_ContentPlaceHolder1_Proprietor_Code')
						.attrs?.value?.toLowerCase() || '',
				incorporationCertificateNumber: document
					.querySelector('#ctl00_ContentPlaceHolder1_Registration_Certificate')
					.attrs?.value?.toLowerCase(),
				nearestPoliceStation: document
					.querySelector('#ctl00_ContentPlaceHolder1_Nearest_Police_Station')
					.attrs?.value?.toLowerCase(),
				nearestHealthFacility: document
					.querySelector('#ctl00_ContentPlaceHolder1_Nearest_Health_Facility')
					.attrs?.value?.toLowerCase(),
				nearestTown: document
					.querySelector('#ctl00_ContentPlaceHolder1_Nearest_Town')
					.attrs?.value?.toLowerCase(),
				//Institution Contacts Tab
				postalAddress: document
					.querySelector('#ctl00_ContentPlaceHolder1_Postal_Address')
					.attrs?.value?.toLowerCase(),
				telephoneNumber: document
					.querySelector('#ctl00_ContentPlaceHolder1_Tel_Number')
					.attrs?.value?.toLowerCase(),
				mobileNumber: document
					.querySelector('#ctl00_ContentPlaceHolder1_Mobile_Number1')
					.attrs?.value?.toLowerCase(),
				altTelephoneNumber: document
					.querySelector('#ctl00_ContentPlaceHolder1_Tel_Number2')
					.attrs?.value?.toLowerCase(),
				altMobileNumber: document
					.querySelector('#ctl00_ContentPlaceHolder1_Mobile_Number2')
					.attrs?.value?.toLowerCase(),
				email: document
					.querySelector('#ctl00_ContentPlaceHolder1_Email_Address')
					.attrs?.value?.toLowerCase(),
				website: document
					.querySelector('#ctl00_ContentPlaceHolder1_Website')
					.attrs?.value?.toLowerCase(),
				socialMediaHandles: document
					.querySelector('#ctl00_ContentPlaceHolder1_Social_Media')
					.attrs?.value?.toLowerCase()
			};
			return institution;
		} catch (err) {
			logger.error(err);
			throw err;
		}
	}

	// Get selected learners list from /Admission/Listlearners.aspx
	async getSelectedLearners(): Promise<SelectedLearner[]> {
		try {
			await this.axiosInstance.get('/Admission/Listlearners.aspx');
			const selectedLearnerHtml = (
				await this.axiosInstance.post(
					'/Admission/Listlearners.aspx',
					qs.stringify({
						__ASYN3CPOST: 'true',
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

			//return selectedLearners;
		} catch (err) {
			throw err;
		}
	}

	// List learners
	async listLearners(gradeOrForm: Grades): Promise<ListLearner[]> {
		try {
			await this.axiosInstance.get('/Learner/Listlearners.aspx');
			let listLearnersHtml = (
				await this.axiosInstance.post(
					'/Learner/Listlearners.aspx',
					qs.stringify({
						...this.#stateObject,
						__ASYNCPOST: 'true',
						__EVENTTARGET: 'ctl00$ContentPlaceHolder1$SelectRecs',
						ctl00$ContentPlaceHolder1$ScriptManager1:
							'ctl00$ContentPlaceHolder1$UpdatePanel1|ctl00$ContentPlaceHolder1$SelectCat',
						ctl00$ContentPlaceHolder1$SelectBC: '1',
						ctl00$ContentPlaceHolder1$SelectCat: form(gradeOrForm),
						ctl00$ContentPlaceHolder1$SelectCat2: '9 ',
						ctl00$ContentPlaceHolder1$SelectRecs: this.recordsPerPage
					})
				)
			)?.data;
			//convert table to json
			const listLearnerTable = htmlParser(listLearnersHtml).querySelector(
				'#ctl00_ContentPlaceHolder1_grdLearners'
			);
			if (!listLearnerTable) return [];
			let listLearnerJson = tableToJson
				.convert(listLearnerTable?.outerHTML)
				.flat()
				.filter(e => !!e['No.']);
			// do_postback doesn't match indexNo of each element, so we find the difference and
			// use it
			// to generate correct post_backs
			let firstViewElement = listLearnerTable.querySelector(
				'tr.GridRow > td:nth-child(13) > a'
			)?.id;
			let firstViewElementNumber = Number(firstViewElement.match(/(?<=_ctl)[0-9]./)[0]);
			const parsedLearnerJson = listLearnerJson.map(element => {
				let postback = `ctl00_ContentPlaceHolder1_grdLearners_ctl${
					firstViewElementNumber < 10
						? `0${firstViewElementNumber}`
						: firstViewElementNumber
				}_BtnView`;
				firstViewElementNumber++;
				return {
					upi: String(element['Learner UPI']),
					name: String(element['Learner Name'])?.toLowerCase().replace(',', ' '),
					gender: String(element['Gender'])?.toLowerCase(),
					dob: moment(element['Date of Birth'], 'DD/MM/YYYY').format('MM/DD/YYYY'),
					age: Number(element['AGE']),
					isSpecial: !!element['Disability']?.toLowerCase(),
					birthCertificateNo: String(element['Birth Cert No'])?.toLowerCase(),
					medicalCondition: String(element['Medical Condition'])?.toLowerCase(),
					nhifNo: Number(element['NHIF No']),
					doPostback: postback.replaceAll(/_/g, '$'),
					grade: gradeOrForm
				};
			});
			return parsedLearnerJson;
		} catch (err) {
			if (err instanceof Error || err instanceof AxiosError)
				throw {message: err.message || 'Failed while try to list learners.', cause: err};
			throw err;
		}
	}

	async searchLearner(upiOrBirthCertificateNo: string): Promise<SearchLearner> {
		try {
			if (!upiOrBirthCertificateNo)
				throw new Error('Invalid upi or  birthcertificate number');
			upiOrBirthCertificateNo = upiOrBirthCertificateNo.trim();
			const genericApiResponse = (
				await this.axiosInstance.get(
					`/generic/api/Learner/StudUpi/${upiOrBirthCertificateNo}`
				)
			)?.data;
			if (typeof genericApiResponse !== 'object') {
				return;
			}
			let apiResponseMap = new Map();
			Object.entries(genericApiResponse).forEach(x => {
				apiResponseMap.set(x[0].toLowerCase(), x[1]);
			});
			let parsedApiResponse = {
				name: apiResponseMap.get('names')?.toLowerCase()?.replace(',', ''),
				dob: apiResponseMap.get('dob2'),
				upi: apiResponseMap.get('upi'),
				gender: apiResponseMap.get('gender'),
				birthCertificateNo: String(apiResponseMap.get('birth_cert_no'))?.toLowerCase(),
				classCode: Number(apiResponseMap.get('class_code')),
				grade: String(apiResponseMap.get('class_name'))?.toLowerCase()?.trim(),
				isSpecial: !!Number(apiResponseMap.get('special_medical_condition')),
				nhifNo: isNaN(apiResponseMap.get('nhif_no'))
					? undefined
					: Number(apiResponseMap.get('nhif_no')),
				isLearner: /Current Learner/g?.test(apiResponseMap.get('xcatdesc')?.toString()),
				currentInstitution: {
					name: apiResponseMap.get('institution_name')?.toLowerCase(),
					code: apiResponseMap.get('institution_code'),
					type: apiResponseMap.get('institution_type'),
					level: apiResponseMap.get('level_name')
				},
				nationality: nationalities(Number(apiResponseMap.get('nationality'))),
				countyNo: isNaN(apiResponseMap.get('county_code'))
					? undefined
					: Number(apiResponseMap.get('county_code')),
				subCountyNo: isNaN(apiResponseMap.get('sub_county_learner'))
					? undefined
					: Number(apiResponseMap.get('sub_county_learner')),
				father: {
					name: apiResponseMap.get('father_name')?.toLowerCase(),
					id: apiResponseMap.get('father_idno'),
					phone: apiResponseMap.get('father_contacts'),
					upi: apiResponseMap.get('father_upi')
				},
				mother: {
					name: apiResponseMap.get('mother_name')?.toLowerCase(),
					id: apiResponseMap.get('mother_idno'),
					phone: apiResponseMap.get('mother_contacts'),
					upi: apiResponseMap.get('mother_upi')
				},
				guardian: {
					name: apiResponseMap.get('guardian_name')?.toLowerCase(),
					id: apiResponseMap.get('guardian_idno'),
					phone: apiResponseMap.get('guardian_contacts'),
					upi: apiResponseMap.get('guardian_upi')
				},
				postalAddress: apiResponseMap.get('postal_address')
			};
			return parsedApiResponse;
		} catch (err) {
			throw err;
		}
	}

	async admitApiCalls(
		indexNo: string,
		instituiton: {code: string; knecCode: string}
	): Promise<AdmitApiCall> {
		try {
			if (!indexNo || !instituiton?.code || !instituiton?.knecCode)
				throw {
					message: 'Some params are missing'
				};
			let apiCallResults = (
				await this.axiosInstance.get(`/generic/api/FormOne/Admission/${indexNo}`)
			)?.data;
			if (typeof apiCallResults != 'object')
				throw {
					code: 500,
					message:
						'Api failed to respond with the correct admission data.' +
						' Nemis api responded with ' +
						typeof apiCallResults +
						' instead of an object',
					cause: apiCallResults
				};
			let resolveResults = {};
			Object.keys(apiCallResults).map(key => {
				switch (key.toLowerCase()) {
					case 'ge':
						if (!apiCallResults[key]) break;
						Object.assign(resolveResults, {gender: apiCallResults[key]});
						break;
					case 'tot':
						if (!apiCallResults[key]) break;
						Object.assign(resolveResults, {totalMarks: Number(apiCallResults[key])});
						break;
					case 'yob':
						if (!apiCallResults[key]) break;
						Object.assign(resolveResults, Number({yearOfBirth: apiCallResults[key]}));
						break;
					default:
						if (!apiCallResults[key]) break;
						if (key.match(/_/)) {
							const camelCaseKey = key
								.split('_')
								.map((x, i) => {
									return i === 0
										? x.toLowerCase()
										: x.charAt(0).toUpperCase() +
										x.replace(/^./, '').toLowerCase();
								})
								.join('');
							Object.assign(resolveResults, {[camelCaseKey]: apiCallResults[key]});
							break;
						}
						let newKey;
						if (key.match(/^.(?:[a-z]+?[A-Z]+?)+\w+/)) {
							Object.assign(resolveResults, {
								[key.charAt(0).toLowerCase() + key.replace(/^./, '')]:
									apiCallResults[key]
							});
						} else {
							Object.assign(resolveResults, {
								[key.toLowerCase()]: apiCallResults[key]
							});
						}
						break;
				}
			});
			return {
				name: resolveResults['name']?.toLowerCase(),
				gender: resolveResults['gender']?.toLowerCase(),
				citizenship: resolveResults['citizenship'],
				indexNo: resolveResults['indexNo' + ''],
				marks: resolveResults['totalMarks'],
				disability: (_ => {
					if (
						resolveResults['disabilityB'] ||
						resolveResults['disabilityD'] ||
						resolveResults['disabilityL'] ||
						resolveResults['disabilityP']
					)
						return {
							b: resolveResults['disabilityB'],
							d: resolveResults['disabilityD'],
							l: resolveResults['disabilityL'],
							p: resolveResults['disabilityP']
						};
					return undefined;
				})(),
				schoolAdmitted: ((): ParsedLabel => {
					if (typeof resolveResults['schoolAdmitted'] !== 'string') return;
					return {
						originalString: resolveResults['schoolAdmitted'],
						...[
							...resolveResults['schoolAdmitted']?.matchAll(
								/(?<code>\d+).+(?<name>(?<=\d )[a-zA-Z ].+)School Type:(?<type>[a-zA-Z]+).School Category:(?<category>[a-zA-Z].+)/gi
							)
						][0]?.groups
					} as ParsedLabel;
				})(),
				schoolSelected: {
					level: resolveResults['category2'],
					code: resolveResults['selectedSchool'],
					name: resolveResults['selectedSchoolName']
				},
				selectionMethod: resolveResults['method'],
				previousSchool: {
					name: resolveResults['schoolName']?.trim()?.toLowerCase(),
					code: resolveResults['schoolCode']
				},
				preferredSchools: {
					national: {
						first: resolveResults['ns1'],
						second: resolveResults['ns2'],
						third: resolveResults['ns3'],
						fourth: resolveResults['ns4']
					},
					extraCounty: {
						first: resolveResults['xs1'],
						second: resolveResults['xs2'],
						third: resolveResults['xs3']
					},
					county: {
						first: resolveResults['cs1'],
						second: resolveResults['cs2']
					},
					secondary: {
						first: resolveResults['ss1'],
						second: resolveResults['ss2']
					}
				}
			};
		} catch (err) {
			throw err;
		}
	}

	async admitJoiningLearner(
		learnerWithApiCallResults: NemisLearner & {apiResponse: AdmitApiCall}
	): Promise<boolean> {
		try {
			if (!learnerWithApiCallResults) throw {message: 'Learner info not recieved'};
			//get page
			const studentIndexDocument = htmlParser(
				(await this.axiosInstance.get('/Learner/Studindex.aspx'))?.data
			);
			let canAdmit = studentIndexDocument.querySelector('#txtCanAdmt')?.attrs?.value !== '0';
			let canRequest = studentIndexDocument.querySelector('#txtCanReq')?.attrs?.value !== '0';
			if (!canAdmit)
				throw {message: 'Admitting learners is currently disabled on the Nemis website.'};
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
					ctl00$ContentPlaceHolder1$txtGender: learnerWithApiCallResults?.gender
						?.split('')[0]
						?.toUpperCase(),
					ctl00$ContentPlaceHolder1$txtIndex: learnerWithApiCallResults?.indexNo,
					ctl00$ContentPlaceHolder1$txtMarks:
					learnerWithApiCallResults.apiResponse?.marks,
					ctl00$ContentPlaceHolder1$txtName: learnerWithApiCallResults.apiResponse?.name,
					ctl00$ContentPlaceHolder1$txtReq: 0,
					ctl00$ContentPlaceHolder1$txtSName:
					learnerWithApiCallResults.apiResponse?.schoolAdmitted?.originalString,
					ctl00$ContentPlaceHolder1$txtSName2:
					learnerWithApiCallResults.apiResponse?.schoolAdmitted?.originalString,
					ctl00$ContentPlaceHolder1$txtSchool:
					learnerWithApiCallResults.apiResponse?.schoolSelected?.code,
					ctl00$ContentPlaceHolder1$txtSearch:
					learnerWithApiCallResults.apiResponse?.indexNo,
					ctl00$ContentPlaceHolder1$txtStatus: ''
				})
			});

			if (/^.+pageRedirect.+Learner.+fStudindexreq/gi.test(postHtml?.data))
				throw {
					message: 'Admission failed, please request learner first',
					cause: 'We got redirected to request page for the learner'
				};
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
							learnerWithApiCallResults?.father?.tel ||
							learnerWithApiCallResults?.mother?.tel ||
							learnerWithApiCallResults?.guardian?.tel,
						ctl00$ContentPlaceHolder1$txtGender:
						learnerWithApiCallResults.apiResponse?.gender,
						ctl00$ContentPlaceHolder1$txtIndex:
						learnerWithApiCallResults.apiResponse?.indexNo,
						ctl00$ContentPlaceHolder1$txtMarks:
						learnerWithApiCallResults.apiResponse?.marks,
						ctl00$ContentPlaceHolder1$txtName:
						learnerWithApiCallResults.apiResponse?.name,
						ctl00$ContentPlaceHolder1$txtUPI: learnerWithApiCallResults?.adm
					}
				});
				let message = htmlParser(postAdmHtml?.data).querySelector(
					'#ctl00_ContentPlaceHolder1_ErrorMessage'
				).innerHTML;
				if (!message?.toLowerCase()?.startsWith('the student has been admitted')) {
					writeFileSync(
						process.cwd() +
						'/debug/html/post_posting_responce_adm_' +
						learnerWithApiCallResults.indexNo +
						'.html',
						(await this.axiosInstance.get('/Learner/Studindexchk.aspx'))?.data
					);
					throw {message: message || 'Failed to admit learner.'};
				}
				return true;
			}
			await writeFileSync(
				process.cwd() +
				'/debug/html/posting_admit_' +
				learnerWithApiCallResults.indexNo +
				'.html',
				postHtml?.data
			);
			throw {message: 'Could\'t redirect to admit learner'};
		} catch (err) {
			throw err;
		}
	}

	/**
	 * this function gets form one learners who have been successfully admitted but are awaiting
	 * biodata cpture
	 */
	async getAdmittedJoiningLearners(): Promise<AdmittedJoiningLearners[]> {
		try {
			await this.axiosInstance.get('/Admission/Listlearnersrep.aspx');
			await this.axiosInstance({
				method: 'post',
				url: '/Admission/Listlearnersrep.aspx',
				data: {
					...this.#stateObject,
					ctl00$ContentPlaceHolder1$SelectRecs: this.recordsPerPage
				}
			});
			let admittedLearnerTable = htmlParser(
				(await this.axiosInstance.get('/Admission/Listlearnersrep.aspx'))?.data
			)?.querySelector('#ctl00_ContentPlaceHolder1_grdLearners')?.outerHTML;
			if (!admittedLearnerTable) return <AdmittedJoiningLearners[]>[];
			let admittedLearnerJson = tableToJson
				.convert(admittedLearnerTable, {
					stripHtmlFromCells: false
				})
				.flat();
			if (!admittedLearnerJson || admittedLearnerJson.length === 0)
				return <AdmittedJoiningLearners[]>[];
			return admittedLearnerJson.map((x, i) => {
				return {
					no: i + 1,
					indexNo: x['Index'],
					name: x['Name'],
					gender: x['Gender'],
					yob: Number(x['Year of Birth']),
					marks: Number(x['Marks']),
					subCounty: x['Sub-County'],
					upi: x['UPI'] === '&nbsp;' ? undefined : x['UPI'],
					postback: 'ctl00$ContentPlaceHolder1$grdLearners',
					actions: {
						captureWithBirthCertificate: 'ActionFOS$' + i,
						captureWithoutBirthCertificate: 'ActionFOSWBC$' + i,
						resetBiodataCapture: 'ActionReset$' + i,
						undoAdmission: 'ActionUNDO$' + i
					}
				};
			});
		} catch (err) {
			if (err instanceof Error || err instanceof AxiosError)
				throw {
					message:
						err.message ||
						'Errored while getting list of joining learners' +
						' awaiting biodata capture.',
					cause: err
				};
			throw err;
		}
	}

	async captureJoiningBiodata(
		learner: NemisLearner & {
			postback: string;
			actions: {
				captureWithBirthCertificate: string;
				captureWithoutBirthCertificate: string;
				resetBiodataCapture: string;
				undoAdmission: string;
			};
		}
	): Promise<{upi: string; message: string; alertMessage: string}> {
		try {
			let postResponse = await this.axiosInstance({
				method: 'post',
				url: '/Admission/Listlearnersrep.aspx',
				data: {
					...this.#stateObject,
					__EVENTTARGET: learner.postback,
					__EVENTARGUMENT: learner.actions.captureWithBirthCertificate,
					ctl00$ContentPlaceHolder1$SelectRecs: this.recordsPerPage
				},
				headers: this.#SECURE_HEADERS
			});
			if (postResponse?.request?.path === '/Learner/alearner.aspx')
				return this.captureBioData(learner);
			if (postResponse?.request?.path === '/Admission/Listlearnersrep.aspx') {
				postResponse = await this.axiosInstance({
					method: 'post',
					url: '/Admission/Listlearnersrep.aspx',
					data: {
						...this.#stateObject,
						__EVENTTARGET: learner.postback,
						__EVENTARGUMENT: learner.actions.resetBiodataCapture,
						ctl00$ContentPlaceHolder1$SelectRecs: this.recordsPerPage
					},
					headers: this.#SECURE_HEADERS
				});
				throw {
					message: htmlParser(postResponse?.data)?.querySelector(
						'#ctl00_ContentPlaceHolder1_ErrorMessage'
					).innerText
				};
			}
			throw {message: 'failed to get learner/alearner.aspx'};
		} catch (err) {
			throw err;
		}
	}

	/*async admitOrCaptureRequestApiCalls(
		//todo: code clean up
		indexNo: string,
		institutionCode: string
	): Promise<AdmitOrCaptureRequestApiCalls> {
		//http://nemis.education.go.ke/generic/api/FormOne/Admission/02110125028
		//http://nemis.education.go.ke/generic/api/FormOne/Results/02110125028
		//http://nemis.education.go.ke/generic/api/FormOne/Reported/XS5M/02110125028
		//http://nemis.education.go.ke/generic/api/FormOne/SelectionStatus/11207102/11207102
		try {
			const apiCallPromises = [
				this.axiosInstance.get(`/generic/api/FormOne/Admission/${indexNo}`), // Index 1
				this.axiosInstance.get(`/generic/api/FormOne/Results/${indexNo}`), // Index 2
				this.axiosInstance.get(
					`/generic/api/FormOne/Reported/${institutionCode}/${indexNo}` // Index 3
				),
				this.axiosInstance.get(`/generic/api/FormOne/ReportedCaptured/${indexNo}`) // Index 4
			];
			const apiCallResults = await Promise.allSettled(apiCallPromises);
			let parsedApiObject = {};
			apiCallResults.forEach((callResult, indexNo) => {
				if (callResult.status === 'rejected') {
					return Object.assign(parsedApiObject, {
						error: {
							message:
								callResult.reason?.error?.message || callResult.reason?.message,
							cause: callResult.reason?.error
						}
					});
				}
				const data = callResult.value?.data;
				if (!data) return;
				let x = {};
				Object.keys(data).forEach(key => {
					switch (key.toLowerCase()) {
						case 'ge':
							if (!data[key]) break;
							Object.assign(x, {gender: data[key]});
							break;
						case 'natrank':
							if (!data[key]) break;
							Object.assign(x, {nationalRank: data[key]});
							break;
						case 'distrank':
							if (!data[key]) break;
							Object.assign(x, {districtRank: data[key]});
							break;
						case 'tot':
							if (!data[key]) break;
							Object.assign(x, {totalMarks: Number(data[key])});
							break;
						case 'yob':
							if (!data[key]) break;
							Object.assign(x, Number({yearOfBirth: data[key]}));
							break;
						case 'birthcert':
							if (!data[key] || data[key] === '-') break;
							Object.assign(x, {birthCertificateNo: data[key]});
							break;
						default:
							if (!data[key]) break;
							if (key.match(/_/)) {
								const camelCaseKey = key
									.split('_')
									.map((x, i) => {
										return i === 0
											? x.toLowerCase()
											: x.charAt(0).toUpperCase() +
													x.replace(/^./, '').toLowerCase();
									})
									.join('');
								Object.assign(x, {[camelCaseKey]: data[key]});
								break;
							}
							let newKey;
							if (key.match(/^.(?:[a-z]+?[A-Z]+?)+\w+/)) {
								Object.assign(x, {
									[key.charAt(0).toLowerCase() + key.replace(/^./, '')]: data[key]
								});
							} else {
								Object.assign(x, {[key.toLowerCase()]: data[key]});
							}
							break;
					}
				});
				return Object.assign(parsedApiObject, x);
			});
			//return parsedApiObject;
			let schoolReported = ((): ParsedLabel => {
				let label = parsedApiObject['reportedLabel'];
				if (typeof label !== 'string') return;
				return {
					originalString: parsedApiObject['reportedLabel']
						? parsedApiObject['reportedLabel']
						: '',
					...[
						...label?.matchAll(
							/(?<code>\d+)\W+(?<name>[a-zA-Z ]+)\W+Type\W+(?<type>[a-zA-Z ]+)\W+Category\W+(?<category>[a-zA-Z ]+)/gi
						)
					][0]?.groups
				} as unknown as ParsedLabel;
			})();
			let schoolAdmitted = ((): ParsedLabel => {
				if (typeof parsedApiObject['schoolAdmitted'] !== 'string') return;
				return {
					originalString: parsedApiObject['schoolAdmitted'],
					...[
						...parsedApiObject['schoolAdmitted']?.matchAll(
							/(?<code>\d+).+(?<name>(?<=\d )[a-zA-Z ].+)School Type:(?<type>[a-zA-Z]+).School Category:(?<category>[a-zA-Z]+)/gi
						)
					][0]?.groups
				} as ParsedLabel;
			})();
			return {
				name: parsedApiObject['name']?.toLowerCase(),
				gender: parsedApiObject['gender'],
				upi: parsedApiObject['upi'],
				birthCertificateNo: parsedApiObject['birthCertificateNo'],
				citizenship: parsedApiObject['citizenship'],
				indexNo: parsedApiObject['indexNoNo'],
				marks: parsedApiObject['totalMarks'],
				placementHistory: parsedApiObject['placementHistory'],
				religionCode: parsedApiObject['religionCode'],
				// @ts-ignore
				reported: {
					date: parsedApiObject['datereported']
						? Temporal.PlainDate.from(parsedApiObject['datereported']).toString()
						: undefined,
					institutionName: parsedApiObject['institutionName']?.toLowerCase(),
					institutionCode: parsedApiObject['institutionCode']
				},
				disability: (_ => {
					if (
						parsedApiObject['disabilityB'] ||
						parsedApiObject['disabilityD'] ||
						parsedApiObject['disabilityL'] ||
						parsedApiObject['disabilityP']
					)
						return {
							b: parsedApiObject['disabilityB'],
							d: parsedApiObject['disabilityD'],
							l: parsedApiObject['disabilityL'],
							p: parsedApiObject['disabilityP']
						};
					return undefined;
				})(),
				schoolReported: schoolReported,
				schoolAdmitted: schoolAdmitted,
				schoolSelected: {
					level: parsedApiObject['category2'],
					code: parsedApiObject['selectedSchool'],
					name: parsedApiObject['selectedSchoolName']
				},
				selectionMethod: parsedApiObject['method'],
				previousSchool: {
					name: parsedApiObject['schoolName']?.trim(),
					code: parsedApiObject['schoolCode']
				},
				preferredSchools: {
					national: {
						first: parsedApiObject['ns1'],
						second: parsedApiObject['ns2'],
						third: parsedApiObject['ns3'],
						fourth: parsedApiObject['ns3']
					},
					extraCounty: {
						first: parsedApiObject['xs1'],
						second: parsedApiObject['xs2'],
						third: parsedApiObject['xs3']
					},
					county: {
						first: parsedApiObject['cs1'],
						second: parsedApiObject['cs2']
					},
					secondary: {
						first: parsedApiObject['ss1'],
						second: parsedApiObject['ss2']
					}
				},
				choiceNo: parsedApiObject['choiceNo'],
				districtRank: parsedApiObject['districtRank'],
				nationalRank: parsedApiObject['nationalRank']
			};
		} catch (err) {
			throw {message: 'Failed to fetch learner from Nemis api', cause: err?.message || err};
		}
	}
	*/
	async requestJoiningLearner(
		indexNo: string,
		requestingLearner: CaptureRequestingLearner & AdmitApiCall,
		instituion: {code: string; knecCode: string}
	) {
		try {
			const studentIndexDocument = htmlParser(
				(await this.axiosInstance.get('/Learner/Studindex.aspx'))?.data
			);
			let canAdmit = studentIndexDocument.querySelector('#txtCanAdmt')?.attrs?.value !== '0';
			let canRequest = studentIndexDocument.querySelector('#txtCanReq')?.attrs?.value !== '0';
			if (!canRequest)
				throw {message: 'Requesting learners is currently disabled on the Nemis website.'};
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
			//await writeFileSync(process.cwd() + '/debug/html/search.html', k.data);
			if (!/^.+pageRedirect.+Learner.+fStudindexreq/gi.test(postHtml))
				throw {message: 'failed to post api results.', cause: requestingLearner};
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
			if (message) throw {message: 'Requesting learner failed with error: ' + message};
			else
				await writeFileSync(
					process.cwd() +
					'/debug/html/posting_request_' +
					requestingLearner.indexNo +
					'.html',
					postHtml
				);
		} catch (err) {
			throw err;
		}
	}

	async getRequestedJoiningLearners(): Promise<
		(RequestedJoiningLearner & {deleteCallback: string})[]
	> {
		try {
			await this.axiosInstance.get('/Learner/Liststudreq.aspx').catch(err => {
				throw {message: 'Error while getting list of requested learners.' + err?.message ? err.message : ''};
			});
			let requestedJoiningLearnerTable = htmlParser(
				(
					await this.axiosInstance({
						method: 'post',
						url: '/Learner/Liststudreq.aspx',
						data: qs.stringify({
							...this.#stateObject,
							ctl00$ContentPlaceHolder1$SelectRecs: this.recordsPerPage
						})
					})
				)?.data
			)?.querySelector('#ctl00_ContentPlaceHolder1_grdLearners')?.outerHTML;
			return tableToJson
				.convert(requestedJoiningLearnerTable, {
					ignoreHiddenRows: true,
					stripHtmlFromCells: false
				})
				?.flat()
				?.map(x => {
					if (x['Index No'] === '&nbsp;') return;
					return {
						no: x['No.'],
						indexNo: x['Index No'],
						name: x['Student Name'],
						gender: x['Gender'],
						marks: x['Marks'],
						schoolSelected: ((): SchoolSelected => {
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
							on: x['Approved On'] === '&nbsp;' ? undefined : x['Approved On'],
							by: x['Approved By'] === '&nbsp;' ? undefined : x['Approved By']
						},
						status: x['Status'] === '&nbsp;' ? undefined : x['Status'],
						deleteCallback: x[13]?.match(/ctl.*?Del/)
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
			await this.axiosInstance.get('/Learner/Liststudreqa.aspx');
			let getAllHtml = (
				await this.axiosInstance({
					method: 'post',
					url: '/Learner/Liststudreqa.aspx',
					data: qs.stringify({
						...this.#stateObject,
						ctl00$ContentPlaceHolder1$SelectRecs: this.recordsPerPage
					})
				})
			)?.data;
			//await writeFileSync(process.cwd() + '/debug/html/list_approved.html', getAllHtml);
			let requestedJoiningLearnerTable = htmlParser(getAllHtml).querySelector(
				'#ctl00_ContentPlaceHolder1_grdLearners'
			)?.outerHTML;
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
						schoolSelected: ((): SchoolSelected => {
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

	// todo: use this to check if we can admit or request
	async getDates() {
		return await this.axiosInstance.get('/generic/api/formone/admissiondates').catch(err => {
			Promise.reject(err);
		});
	}

	//Get requested learners from "http://nemis.education.go.ke/Learner/Listadmrequestsskul.aspx"
	async getRequestedContinuingLearners(): Promise<RequestingLearner[]> {
		try {
			let requestedContinuingLearnersHtml = (
				await this.axiosInstance.get('/Learner/Listadmrequestsskul.aspx')
			)?.data;
			let requestedContinuingLearners = htmlParser(
				requestedContinuingLearnersHtml
			)?.querySelector('#ctl00_ContentPlaceHolder1_grdLearners')?.outerHTML;
			if (!requestedContinuingLearners) {
				return [];
			}
			let requestedContinuingLearnersJson = tableToJson
				.convert(requestedContinuingLearners)
				.flat()
				.map(element => {
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
				});
			return requestedContinuingLearnersJson;
		} catch (err) {
			throw new Error('Error while fetching list of requested continuing learners', {
				cause: err
			});
		}
	}

	async requestContinuingLearners(
		requestingLearner: RequestingLearner
	): Promise<RequestingLearner | Error> {
		try {
			await this.axiosInstance.get('/Learner/Listadmrequestsskul.aspx');
			// Let midddleware handle most of the data validations

			await this.axiosInstance({
				method: 'post',
				url: '/Learner/Listadmrequestsskul.aspx',
				headers: this.#SECURE_HEADERS,
				data: qs.stringify({
					__EVENTARGUMENT: '',
					__VIEWSTATEENCRYPTED: '',
					__LASTFOCUS: '',
					__EVENTVALIDATION: this.#stateObject.__EVENTVALIDATION,
					__VIEWSTATE: this.#stateObject.__VIEWSTATE,
					__VIEWSTATEGENERATOR: this.#stateObject.__VIEWSTATEGENERATOR,
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
						__EVENTVALIDATION: this.#stateObject.__EVENTVALIDATION,
						__VIEWSTATE: this.#stateObject.__VIEWSTATE,
						__VIEWSTATEGENERATOR: this.#stateObject.__VIEWSTATEGENERATOR,
						ctl00$ContentPlaceHolder1$Button2: '[  SAVE  ]',
						ctl00$ContentPlaceHolder1$SelectGender: requestingLearner.gender
							.split('')[0]
							.toUpperCase(),
						ctl00$ContentPlaceHolder1$SelectGrade: form(requestingLearner.grade),
						ctl00$ContentPlaceHolder1$SelectRecs: this.recordsPerPage,
						ctl00$ContentPlaceHolder1$txtAdmNo: requestingLearner.adm,
						ctl00$ContentPlaceHolder1$txtBCert: requestingLearner.birthCertificateNo,
						ctl00$ContentPlaceHolder1$txtFirstname:
							requestingLearner?.firstname || names?.firstname,
						ctl00$ContentPlaceHolder1$txtIndex: requestingLearner.indexNo,
						ctl00$ContentPlaceHolder1$txtOthername:
							requestingLearner?.otherName || names?.otherName,
						ctl00$ContentPlaceHolder1$txtRemark: requestingLearner.remarks,
						ctl00$ContentPlaceHolder1$txtSurname:
							requestingLearner?.surname || names?.surname,
						ctl00$ContentPlaceHolder1$txtYear: requestingLearner.kcpeYear
					})
				})
			)?.data;
			let requestedLearner = tableToJson
				.convert(
					htmlParser(requestingLearnerHtml).querySelector(
						'#ctl00_ContentPlaceHolder1_grdLearners'
					).outerHTML
				)
				.flat()
				.map(element => {
					return {
						no: Number(element['No.']),
						adm: String(element['Adm No']),
						surname: String(element['Surname']?.toLowerCase()),
						otherName: String(element['Othername']?.toLowerCase()),
						firstname: String(element['Firstname']?.toLowerCase()),
						gender: String(element['Gender']?.toLowerCase()),
						kcpeYear: Number(element['KCPE Year']),
						indexNo: String(element['Index']),
						birthCertificateNo: String(element['Birth Certificate'])?.toLowerCase(),
						grade: Number(element['Grade']),
						remarks: String(element['Remark'])?.toLowerCase()
					};
				})
				.filter(
					x =>
						x.adm === requestingLearner.adm &&
						x.birthCertificateNo === requestingLearner.birthCertificateNo
				);
			if (requestedLearner.length !== 1) {
				throw {
					message: 'Error requesting learner',
					cause: requestingLearner
				};
			}
			return requestingLearner;
		} catch (err) {
			if (err instanceof Error || err instanceof AxiosError)
				throw {message: err.message || 'Failed to capture continuing learner', cause: err};
			throw err;
		}
	}

	// Get continuing students pending bio-data capture-
	async getPendingContinuingLearners(): Promise<RequestingLearner[]> {
		try {
			// Get entire list
			await this.axiosInstance.get('/Learner/Listadmrequestsskulapp.aspx');
			let pendingLearners = (
				await this.axiosInstance({
					method: 'post',
					url: '/Learner/Listadmrequestsskulapp.aspx',
					data: qs.stringify({
						__EVENTARGUMENT: '',
						__VIEWSTATEENCRYPTED: '',
						__LASTFOCUS: '',
						__EVENTVALIDATION: this.#stateObject.__EVENTVALIDATION,
						__VIEWSTATE: this.#stateObject.__VIEWSTATE,
						__VIEWSTATEGENERATOR: this.#stateObject.__VIEWSTATEGENERATOR,
						__EVENTTARGET: 'ctl00$ContentPlaceHolder1$SelectRecs',
						ctl00$ContentPlaceHolder1$SelectRecs: this.recordsPerPage
					}),
					headers: this.#SECURE_HEADERS
				})
			)?.data;
			const pendingContinuingLearner = tableToJson
				.convert(
					htmlParser(pendingLearners).querySelector(
						'#ctl00_ContentPlaceHolder1_grdLearners'
					).outerHTML,
					{stripHtmlFromCells: false}
				)
				.flat()
				.map(element => {
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
						remarks: String(element['Remark'])?.toLowerCase(),
						upi: element['UPI'] === '&nbsp;' ? '' : element['UPI'],
						postback: htmlParser(element['11']).querySelector('input').attrs?.name
					};
				});
			return pendingContinuingLearner;
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
		continuingLearner: NemisLearnerFromDb,
		pendingContinuingLearner: RequestingLearner
	): Promise<{upi: string; message: string; alertMessage: string}> {
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
					__VIEWSTATEGENERATOR: this.#stateObject.__VIEWSTATEGENERATOR,
					__VIEWSTATE: this.#stateObject.__VIEWSTATE,
					__EVENTVALIDATION: this.#stateObject.__EVENTVALIDATION,
					ctl00$ContentPlaceHolder1$SelectRecs: this.recordsPerPage,
					[pendingContinuingLearner.postback]: 'BIO-BC'
				}),
				headers: this.#SECURE_HEADERS
			});

			if (
				pendingLearnerResponse?.request?.path !== '/Learner/alearner.aspx' ||
				!pendingLearnerResponse?.data
			) {
				logger.error('Failed to get alearner.aspx');
				throw {message: 'Couldn\' get "/Learner/alearner.aspx'};
			}
			return this.captureBioData(continuingLearner);
		} catch (err) {
			if (err instanceof Error || err instanceof AxiosError)
				throw {message: err.message || 'Failed to capture continuing learner', cause: err};
			throw err;
		}
	}

	//capture Bio data
	async captureBioData(learner: NemisLearner) {
		try {
			const names = splitNames(learner.name);
			const medicalConditionCode = setMedicalCondition(learner.medicalCondition);
			const county = countyToNo(learner.county, learner.subCounty);
			const nationality = nationalities(learner.nationality);
			// Initial POST to set county
			await this.axiosInstance.get('/Learner/alearner.aspx');
			let postData = qs.stringify({
				__ASYNCPOST: 'true',
				__EVENTTARGET: 'ctl00$ContentPlaceHolder1$ddlcounty',
				__EVENTARGUMENT: '',
				__EVENTVALIDATION: this.#stateObject.__EVENTVALIDATION,
				__LASTFOCUS: '',
				__VIEWSTATE: this.#stateObject.__VIEWSTATE,
				__VIEWSTATEENCRYPTED: '',
				__VIEWSTATEGENERATOR: this.#stateObject.__VIEWSTATEGENERATOR,
				ctl00$ContentPlaceHolder1$DOB$ctl00: `${
					learner.dob?.getMonth() + 1
				}/${learner.dob.getDate()}/${learner.dob.getFullYear()}`,
				ctl00$ContentPlaceHolder1$Nationality: nationality,
				ctl00$ContentPlaceHolder1$ScriptManager1:
					'ctl00$ContentPlaceHolder1$UpdatePanel1|ctl00$ContentPlaceHolder1$ddlcounty',
				ctl00$ContentPlaceHolder1$ddlClass: form(learner.grade),
				ctl00$ContentPlaceHolder1$ddlcounty: county.countyNo,
				ctl00$ContentPlaceHolder1$ddlmedicalcondition: medicalConditionCode,
				ctl00$ContentPlaceHolder1$ddlsubcounty: '0'
			});

			let aLearnerHtml = (await this.axiosInstance.post('/Learner/alearner.aspx', postData))
				?.data;
			//writeFileSync(process.cwd() + '/debug/html/posted_alearner_subc.html', aLearnerHtml);
			if (!/^.+updatePanel\|ctl00_ContentPlaceHolder1_UpdatePanel1/g.test(aLearnerHtml)) {
				throw {message: 'Failed to post county.'};
			}
			//let scrappedAlearner = this.scrapAlearner(aLearnerHtml);

			let formData = new FormData();
			formData.append('__EVENTARGUMENT', '');
			formData.append('__EVENTTARGET', '');
			formData.append('__EVENTVALIDATION', this.#stateObject.__EVENTVALIDATION);
			formData.append('__VIEWSTATE', this.#stateObject.__VIEWSTATE);
			formData.append('__VIEWSTATEGENERATOR', this.#stateObject.__VIEWSTATEGENERATOR);
			formData.append('__LASTFOCUS', '');
			formData.append('__VIEWSTATEENCRYPTED', '');
			//data input
			formData.append('ctl00$ContentPlaceHolder1$Birth_Cert_No', learner.birthCertificateNo);
			formData.append(
				'ctl00$ContentPlaceHolder1$DOB$ctl00',
				`${
					learner.dob?.getMonth() + 1
				}/${learner.dob.getDate()}/${learner.dob.getFullYear()}`
			);
			formData.append(
				'ctl00$ContentPlaceHolder1$Gender',
				learner.gender.split('')[0].toUpperCase()
			);
			formData.append('ctl00$ContentPlaceHolder1$FirstName', names.firstname);
			formData.append('ctl00$ContentPlaceHolder1$Nationality', nationality);
			formData.append('ctl00$ContentPlaceHolder1$OtherNames', names.otherName);
			formData.append('ctl00$ContentPlaceHolder1$Surname', names.surname);
			formData.append('ctl00$ContentPlaceHolder1$UPI', '');
			formData.append('ctl00$ContentPlaceHolder1$ddlcounty', county.countyNo);
			formData.append(
				'ctl00$ContentPlaceHolder1$ddlmedicalcondition',
				String(medicalConditionCode)
			);
			formData.append('ctl00$ContentPlaceHolder1$ddlsubcounty', String(county.subCountyNo));
			formData.append('ctl00$ContentPlaceHolder1$mydob', '');
			formData.append('ctl00$ContentPlaceHolder1$myimage', '');

			formData.append('ctl00$ContentPlaceHolder1$txtPostalAddress', learner.address || '');
			formData.append('ctl00$ContentPlaceHolder1$txtSearch', '');
			formData.append('ctl00$ContentPlaceHolder1$txtmobile', '');

			//special need: yes => optspecialneed, no => optneedsno
			formData.append(
				'ctl00$ContentPlaceHolder1$optspecialneed',
				learner.isSpecial ? 'optspecialneed' : 'optneedsno'
			);
			formData.append('ctl00$ContentPlaceHolder1$txtEmailAddress', '');

			if (learner?.father?.name && learner?.father?.id && learner?.father?.tel) {
				formData.append('ctl00$ContentPlaceHolder1$txtFatherContacts', learner.father.tel);
				formData.append('ctl00$ContentPlaceHolder1$txtFatherIDNO', learner.father.id);
				formData.append('ctl00$ContentPlaceHolder1$txtFatherName', learner.father.name);
				formData.append('ctl00$ContentPlaceHolder1$txtFatherUPI', '');
			}

			if (learner?.guardian?.name && learner?.guardian?.id && learner?.guardian?.tel) {
				formData.append('ctl00$ContentPlaceHolder1$txtGuardianIDNO', learner.guardian.id);
				formData.append('ctl00$ContentPlaceHolder1$txtGuardianname', learner.guardian.name);
				formData.append('ctl00$ContentPlaceHolder1$txtGuardianUPI', '');
				formData.append(
					'ctl00$ContentPlaceHolder1$txtGuardiancontacts',
					learner.guardian.tel
				);
			}
			if (learner?.mother?.name && learner?.mother?.id && learner?.mother?.tel) {
				formData.append('ctl00$ContentPlaceHolder1$txtMotherIDNo', learner.mother.id);
				formData.append('ctl00$ContentPlaceHolder1$txtMotherName', learner.mother.name);
				formData.append('ctl00$ContentPlaceHolder1$txtMotherUPI', '');
				formData.append('ctl00$ContentPlaceHolder1$txtMothersContacts', learner.mother.tel);
			}
			formData.append('ctl00$ContentPlaceHolder1$btnUsers2', 'Save Basic Details');

			aLearnerHtml = (
				await this.axiosInstance({
					method: 'post',
					url: 'http://nemis.education.go.ke/Learner/alearner.aspx',
					headers: {
						...this.#SECURE_HEADERS,
						...formData.getHeaders()
					},
					data: formData
				})
			)?.data;

			let aLearnerDocument = htmlParser(aLearnerHtml);
			let message = aLearnerDocument.querySelector('.alert');
			//let message = messageElement?.innerText;
			if (!message?.innerText) {
				let newUpi = aLearnerDocument.querySelector(
					'#ctl00_ContentPlaceHolder1_instmessage'
				)?.innerText;
				if (typeof newUpi === 'string' && newUpi.startsWith('New UPI:')) {
					return {
						upi: newUpi.replace('New UPI: ', ''),
						message: 'Recieved a new UPI',
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
			// If learner got assigned UPI number
			if (
				aLearnerDocument.querySelector('#UPI').attrs?.value ||
				/The Learner Basic Details have been Saved successfully/.test(message?.innerText)
			) {
				return {
					upi: aLearnerDocument.querySelector('#UPI').attrs?.value,
					message: message.innerText.replace('&times;  ', ''),
					alertMessage: message.outerHTML
				};
			}
			if (
				/The Learner Basic Details have been Saved successfully/i.test(message?.innerText)
			) {
				return {
					upi: aLearnerDocument.querySelector('#UPI').attrs?.value,
					message: message.innerText.replace('&times;  ', ''),
					alertMessage: message.outerHTML
				};
			}
			if (/Failure!/g.test(message.innerText))
				throw {
					alertMessage: message.outerHTML,
					message: message.innerText?.replace(/(^.)\n(Failure!)/, '')
				};

			// We can't take this as an assurerance everything went well, becouse if it did we'd
			// have already returned with the neew UPI
			writeFileSync(
				process.cwd() + '/debug/html/unknown_error_' + learner.indexNo + '.html',
				aLearnerHtml
			);
			throw {
				alertMessage: message.outerHTML,
				message: message.innerText?.replace(/(^.)\n(Failure!)/, '')
			};
		} catch (err) {
			if (err instanceof Error || err instanceof AxiosError)
				throw {message: err.message || 'Failed to capture learner\'s biodata ', cause: err};
			throw err;
		}
	}

	//submit to NHIF
	async submitToNhif(grade: Grades, learnersWithoutNhif?: ListLearner[]) {
		try {
			if (!learnersWithoutNhif)
				//submit for the entire form
				learnersWithoutNhif = (await this.listLearners(grade)).filter(
					learner => !learner.nhifNo
				);
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
							__VIEWSTATE: this.#stateObject.__VIEWSTATE,
							__VIEWSTATEGENERATOR: this.#stateObject.__VIEWSTATEGENERATOR,
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
				postData.append('__EVENTVALIDATION', this.#stateObject.__EVENTVALIDATION);
				postData.append('__VIEWSTATE', this.#stateObject.__VIEWSTATE);
				postData.append('__VIEWSTATEGENERATOR', this.#stateObject.__VIEWSTATEGENERATOR);
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
				let succcessMessageElement =
					htmlParser(postNhifHtml).querySelector('#LblMsgContact');
				let succcessMessage = succcessMessageElement?.innerText;
				if (!succcessMessage)
					return Promise.reject(
						'Failed to get nhif number since succcessMessageElement is' + ' empty'
					);

				if (succcessMessage.startsWith('The remote server returned an error:'))
					return Promise.reject(succcessMessage);
				let parsedReturnObject = {
					nhifNo: succcessMessage.match(/\d.+/)[0].trim(),
					message: succcessMessage.replace(/&times;\W|\d+/g, '')?.trim(),
					alertHtml: succcessMessageElement.outerHTML
				};
				if (!parsedReturnObject.nhifNo)
					throw {
						message:
							'Failed to get nhif number since succcessMessage doesn\'t contain a' +
							' number',
						cause: 'Couldn\'t find nhif number on the returned page'
					};
				return Promise.resolve(parsedReturnObject);
			};
			//await postNhif(learnersWithoutNhif[10]);
			let submitNhifPromise = await Promise.allSettled(
				learnersWithoutNhif.map(x => postNhif(x))
			);
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
	scrapAlearner(alearnerHtml) {
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
					.attrs?.checked
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

	// Parse viewstate data from web page
	#setViewState(data) {
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
				__EVENTVALIDATION: eventValidation ? eventValidation : undefined,
				__LASTFOCUS: lastFocus ? lastFocus : undefined,
				__VIEWSTATE: viewState ? viewState : undefined,
				__VIEWSTATEENCRYPTED: viewStateEncrypted ? viewStateEncrypted : undefined,
				__VIEWSTATEGENERATOR: viewStateGenerator ? viewStateGenerator : undefined
			};
		} else {
			let viewState = data?.match(/(?<=(__VIEWSTATE\|)).*?(?=\|)/gm)?.toString(),
				viewStateGenerator = data
					.match(/(?<=__VIEWSTATEGENERATOR\|).*?(?=\|)/gm)
					?.toString(),
				eventValidation = data.match(/(?<=__EVENTVALIDATION\|).*?(?=\|)/gm)?.toString();
			//now check if view state is set
			if (!viewState || !viewStateGenerator) {
				logger.error('View sate not saved');
				throw {
					message: 'Couldn\'t find any view state data.',
					cause: 'Possibly an invalid viewstate was used'
				};
			} else {
				this.#stateObject = {
					__EVENTVALIDATION: eventValidation ? eventValidation : '',
					__VIEWSTATE: viewState ? viewState : '',
					__VIEWSTATEGENERATOR: viewStateGenerator ? viewStateGenerator : ''
				};
			}
		}
	}

	// Inteceptor to handle all axios requests
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
				if (this.#cookie) Object.assign(config.headers, {cookie: this.#cookie});
				return config;
			},
			error => {
				logger.error(error);
				return Promise.reject({
					message: 'Error while making request',
					type: 'request_error',
					time: Date.now(),
					error: error
				});
			}
		);
		// Response interceptor for API calls
		this.axiosInstance.interceptors.response.use(
			response => {
				try {
					// If part of /generic/api, return
					if (response.config.url.match(/^\/generic/)) return response; // We are using the api direct so return
					// If we we get a page redirect tot login with 200 OK
					if (
						response.data?.length < 50 &&
						/pageRedirect.+Login\.aspx/i.test(response.data)
					) {
						response.status = 401;
						response.statusText = 'Unauthorized';
						return Promise.reject({
							message: 'Invalid cookie',
							type: 'invalid_cookie',
							time: Date.now()
						});
					}
					if (response.data) this.#setViewState(response?.data); // Set view satate
					if (response.headers['set-cookie'])
						this.#cookie = response.headers['set-cookie']?.toString();
					// If redirectd to ErrorPage.aspx
					if (
						/1\|#\|\|4\|17\|pageRedirect\|\|%2fErrorPage.aspx\|/gi.test(response?.data)
					) {
						response.status = 401;
						response.statusText = 'Unauthorized';
						return Promise.reject({
							message: 'Invalid username or password',
							type: 'invalid_credentials',
							time: Date.now()
						});
					}
					if (response?.request?.path === '/Login.aspx') {
						response.status = 401;
						response.statusText = 'Unauthorized';

						return Promise.reject({
							message: 'Invalid cookie',
							type: 'invalid_cookie',
							time: Date.now()
						});
					}
					return response;
				} catch (err) {
					return Promise.reject(err.message || err);
				}
			},
			error => {
				//logger.warn(error);
				let response: ErrorResponse = {
					time: new Date(Date.now()).toLocaleTimeString(),
					error: error
				};
				if (error?.code === 'ETIMEDOUT') {
					response.message = 'Request has timed out';
					response.type = 'request_timeout';
				}
				if (error?.code === 'ECONNRESET') {
					response.message = 'Connection has reset';
					response.type = 'connection_reset';
				}
				//handle no ENOTFOUND
				if (!error.response?.data || !error.response?.status) {
					delete response.data;
					if (error.code === 'ENOTFOUND') {
						response.message = `The requested address ${error.hostname} was not found.`;
						response.type = 'address_not_found';
					} else if (error.code === 'ECONNRESET') {
						response.message = error.message || `Connection has reset`;
						response.type = 'connection_reset';
					} else {
						response.message = error.message;
						response.type = error.code;
					}
				} else {
					switch (error.response?.status) {
						case 400:
							if (error.response.statusText === 'Bad Request') {
								if (error.response?.data?.startsWith('No Form One Admission for')) {
									response.message = error.response?.data;
									response.type = 'learner_not_found';
								}
							}
							break;
						case 500:
							response.message = 'Internal server error';
							response.type = 'internal_server_error';
							break;
						case 404:
							response.message = 'Page not found';
							response.type = 'page_not_found';
							break;
						case 403:
							response.message = 'Forbidden';
							response.type = 'forbidden';
							break;
						case 504:
							response.message = 'Gateway timeout';
							response.type = 'gateway_timeout';
							break;
						default:
							response.message = error.response?.data || 'Unknown error';
							response.type = error?.code?.toLowerCase() || 'unknown_error';
							break;
					}
				}
				return Promise.reject(response);
			}
		);
	}
}
