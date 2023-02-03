/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

function nameMatch(arrayOfNames: Array<string>, name: string) {
	// Basic dat checks
	if (!Array.isArray(arrayOfNames)) throw new Error('arrayOfNames is not an Array.');
	if (arrayOfNames.length === 0) throw new Error('arrayOfNames has no values.' +
		' arrayOfNames.length is zero.');
	if (typeof name !== 'string') throw new Error('name is not a string.');

	let resultsArray = [];
	// Go through all names supplied checking for a perfect match
	arrayOfNames.forEach((arrayName, indexNo) => {
		// Perfect match
		// name to match separated by a space
		const matchNameArray = name.toLowerCase().trim().split(' ');
		// If we have less than two names return
		if (matchNameArray.length < 2) {
			resultsArray.push({
				confidence: 0,
				indexNo: undefined,
				reasons: 'Less than two names were found.'
			});
		}
		// Possible match to test against nameMatch broken down to separate names
		let arrayOfName = arrayName.toLowerCase().trim().split(' ');
		// Check if every name is there but in a shuffled manner
		let diff = [];
		if (arrayOfName.every((x, i) => x.trim() === matchNameArray[i].trim())) {
			return resultsArray.push({
				confidence: arrayOfName.length + 1,
				indexNo: indexNo,
				reasons: []
			});
		}
		arrayOfName.forEach((name) => {
			if (!name) return;
			// Loop through match name checking for minor spelling errors
			let failed = matchNameArray.map(matchName => {
				if (!matchName) return;
				let nArray = matchName?.split('');
				let xArray = name?.split('');
				// If length between two are vast we better fail
				let j = nArray.length - xArray.length;
				j = j < 0 ? j * -1 : j;
				let diffObject: {name: string, deference: string[]};
				if (j > 2)
					diffObject = {name: matchName, deference: xArray};
				else if (!xArray || xArray.length === 0) diffObject = {
					name: matchName,
					deference: nArray
				};
				else diffObject = {
						name: matchName,
						deference: nArray.map((n, indexNo) => {
							if (xArray[indexNo] === n) return;
							// if we add one does it match still?
							else if (xArray[indexNo + 1] === n) return;
							// cover added letters
							else if (xArray[indexNo - 1 < 0 ? 0 : indexNo - 1] === n) return;
							else return n;
						}).filter(x => !!x)
					};
				return diffObject;
			}).sort((a, b) => a.deference.length - b.deference.length).filter(x => !!x);
			//console.log(failed)
			diff.push({[name]: failed});
		});
		let deference = diff.map(x => {
			let xName = Object.getOwnPropertyNames(x);
			// confidence is calculated by:
			// first divide 1 by total number of names to know each names weight
			// then divide that weight with the deference
			let weight = 1 / x[xName[0]].length;
			let resArray = x[xName[0]] as {name: string, deference: string[]}[];
			let confidence = resArray.reduce((acc, cur) => {
				if (cur.deference.length === 0) return acc + weight + 1;
				else return acc + weight / cur.deference.length;
			}, 0);
			return {
				name: xName[0],
				confidence: confidence
			};

		});
		resultsArray.push({
			confidence: deference.reduce((acc, cur) => {
				return acc + Number.parseInt(String(cur.confidence));
			}, 0),
			indexNo: indexNo,
			reasons: deference
		});
	});
	return resultsArray.sort((a, b) => b.confidence - a.confidence);
}

try {
	let k = nameMatch(['ABDIRAHIM MOHAMEDWELI ADAN', 'MOHAMEDWELI ABDIRAHIM ADAN'], 'ABDIRAHIM' +
		' MOHAMEDWELI ADAN');
	console.log(k);
} catch (e) {
	console.log(e.message);
}
