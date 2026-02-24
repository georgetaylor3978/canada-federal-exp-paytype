/**
 * update-data.js — Converts CanadaExpPay Raw Data.xlsx → data.json
 * 
 * Usage: node update-data.js
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const INPUT_FILE = 'CanadaExpPay Raw Data.xlsx';
const OUTPUT_FILE = 'data.json';

console.log(`\n📊 Federal Expenses Data Converter`);
console.log(`${'─'.repeat(40)}`);

const inputPath = path.join(__dirname, INPUT_FILE);
if (!fs.existsSync(inputPath)) {
    console.error(`\n❌ Error: "${INPUT_FILE}" not found!`);
    console.error(`   Make sure the file is in: ${__dirname}`);
    process.exit(1);
}

console.log(`📂 Reading: ${INPUT_FILE}`);
const wb = XLSX.readFile(inputPath);
const sheetName = wb.SheetNames[0];
console.log(`   Using sheet: ${sheetName}`);

const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null });

if (raw.length < 2) {
    console.error(`\n❌ Error: Not enough data in sheet.`);
    process.exit(1);
}

// Find column indices
const headers = raw[0].map(h => String(h || '').trim());
const colYear = headers.indexOf('YEAR');
const colDeptGroup = headers.indexOf('DeptGroup');
const colMinistry = headers.indexOf('Ministry');
const colExpenseType = headers.indexOf('ExpenseType');
const colAmount = headers.indexOf('Amount');

if ([colYear, colDeptGroup, colMinistry, colExpenseType, colAmount].includes(-1)) {
    console.error(`\n❌ Error: Missing required columns in header.`);
    console.error(`   Found: ${headers.join(', ')}`);
    process.exit(1);
}

// Dictionaries for indexing
const years = [];
const deptGroups = [];
const ministries = [];
const expenseTypes = [];
const data = [];

function getIndex(arr, val) {
    let idx = arr.indexOf(val);
    if (idx === -1) {
        idx = arr.length;
        arr.push(val);
    }
    return idx;
}

let totalRows = 0;

for (let i = 1; i < raw.length; i++) {
    const r = raw[i];
    if (!r[colYear] || typeof r[colYear] !== 'number') continue;

    const year = Number(r[colYear]);
    const deptGroup = String(r[colDeptGroup] || 'Unknown').trim();
    const ministry = String(r[colMinistry] || 'Unknown').trim();
    const expenseType = String(r[colExpenseType] || 'Unknown').trim();
    const amount = Number(r[colAmount]) || 0;

    const yearIdx = getIndex(years, year);
    const deptGroupIdx = getIndex(deptGroups, deptGroup);
    const ministryIdx = getIndex(ministries, ministry);
    const expenseTypeIdx = getIndex(expenseTypes, expenseType);

    data.push([yearIdx, deptGroupIdx, ministryIdx, expenseTypeIdx, amount]);
    totalRows++;
}

// Sort arrays (except we need to map the indices correctly if we sort, so let's just sort years and rebuild data, OR just leave as discovered and let frontend sort).
// Leaving as discovered is easiest, frontend can map and sort.

const output = {
    years,
    deptGroups,
    ministries,
    expenseTypes,
    data
};

const outputPath = path.join(__dirname, OUTPUT_FILE);
const json = JSON.stringify(output);
fs.writeFileSync(outputPath, json);

const sizeMB = (Buffer.byteLength(json) / 1024 / 1024).toFixed(2);
console.log(`\n✅ Generated: ${OUTPUT_FILE}`);
console.log(`   ${totalRows} data points extracted.`);
console.log(`   Unique Dimensions: ${years.length} Years, ${deptGroups.length} DeptGroups, ${ministries.length} Ministries, ${expenseTypes.length} ExpenseTypes.`);
console.log(`   File size: ${sizeMB} MB`);
console.log(`\n🚀 Data is ready! Run "update.bat" to push to GitHub.\n`);
