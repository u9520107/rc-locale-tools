import fs from 'fs-promise';
import path from 'path';
import config from './config';

const locales = [
    'en-us',
    'en-gb',
    'en-ca',
    'fr-ca',
];

const i18nPath = path.resolve(config.googlechrome.path, 'web/app/i18n');

async function readFiles () {
    let files = {};
    await Promise.all(locales.map(async locale => {
        let file = path.resolve(i18nPath, `${locale}/strings.js`);
        console.log(`reading ${file}...`);
        files[locale] = convertToObj(await fs.readFile(file, 'utf8'));
    }));

    return files;
}

function convertToObj(str) {
    str += 'JSON.stringify(localeStrings);';
    let res = eval(str);
    return JSON.parse(res);
}

function processFiles(files) {
    let result;
    locales.forEach(locale => {
        console.log(`processing ${locale}...`);
        console.time(`processing ${locale}`);
        result = processLocale(locale, files[locale], result);
        console.timeEnd(`processing ${locale}`);
    });
    return result;
}


function processLocale(locale, db, obj = {}) {
    for(let key in db) {
        if(!obj[key]) obj[key] = {};

        if(typeof db[key] === 'object') {
            processLocale(locale, db[key], obj[key]);
        } else {
            obj[key].$$isLocaleKey = true;
            obj[key][locale] = db[key];
        }
    }
    return obj;
}

function summarize(result, keyPath=[], summary = {
    missingEnUs: [],
    missingTranslations: {}
}) {

    for(let key in result) {
        if(result[key].$$isLocaleKey) {
            let thisPath = keyPath.concat(key).join('.');
            locales.forEach(locale => {
                if(!result[key].hasOwnProperty(locale)) {
                    if(!summary.missingTranslations[thisPath]) summary.missingTranslations[thisPath] = {};
                    if(locale === 'en-us') {
                        summary.missingEnUs.push(thisPath);
                    } else if(result[key].hasOwnProperty('en-us')) {
                        summary.missingTranslations[thisPath]['en-us'] = result[key]['en-us'];
                    }
                    summary.missingTranslations[thisPath][locale] = '';
                } else if(!/^en/.test(locale)){
                    if(result[key].hasOwnProperty('en-us') && result[key]['en-us'] === result[key][locale]) {
                        if(!summary.missingTranslations[thisPath]) summary.missingTranslations[thisPath] = {};

                        summary.missingTranslations[thisPath]['en-us'] = result[key]['en-us'];
                        summary.missingTranslations[thisPath][locale] = result[key][locale];
                    }
                }
            });

        } else {
            summarize(result[key], keyPath.concat(key), summary);
        }

    }
    return summary;
}




(async _ => {
    console.time('scan');
    let files = await readFiles();
    let result = processFiles(files);
    let summary = summarize(result);

    let resultName = 'result-googlechrome.json';
    let summaryName = 'summary-googlechrome.json';

    await fs.writeFile(resultName, JSON.stringify(result, null, 2));
    console.log(`Saved to ${resultName}`);
    await fs.writeFile(summaryName, JSON.stringify(summary, null, 2));
    console.log(`Saved to ${summaryName}`);
    console.timeEnd('scan');


})().catch(e => {
    console.log(e);
    console.log(e.stack);
});
