/* ═══════════════════════════════════════════
   Federal Expenses Dashboard — App Logic
   ═══════════════════════════════════════════ */

var dataJson = null;
var mainChart = null;

// Dynamic State
var selectedMain = null;
var selectedCompare = new Set();
var selectedExpenses = new Set();
var isCombineOn = true;

// Predefined colors for charts
var PALETTE = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f43f5e', // rose
];

// DOM Nodes
var mainDropdownTrigger = document.getElementById('mainDropdownTrigger');
var mainSearch = document.getElementById('mainSearch');
var mainList = document.getElementById('mainList');

var compareDropdownTrigger = document.getElementById('compareDropdownTrigger');
var compareSearch = document.getElementById('compareSearch');
var compareList = document.getElementById('compareList');
var compareClearBtn = document.getElementById('compareClearBtn');

var expenseTypeSlicer = document.getElementById('expenseTypeSlicer');
var combineToggle = document.getElementById('combineToggle');
var emptyState = document.getElementById('emptyState');
var chartWrapper = document.querySelector('.chart-wrapper');
var chartTitle = document.getElementById('chartTitle');

// Init
async function init() {
    try {
        var res = await fetch('data.json');
        if (!res.ok) throw new Error('Could not load data.json');
        dataJson = await res.json();

        // initialize selections
        dataJson.expenseTypes.forEach(function (_, i) { selectedExpenses.add(i); });

        buildDropdown(dataJson.deptGroups, dataJson.ministries, dataJson.data, mainList, 'main');
        buildDropdown(dataJson.deptGroups, dataJson.ministries, dataJson.data, compareList, 'compare');
        buildSlicers();

        setupEvents();
        console.log('Dashboard initialized successfully with ' + dataJson.data.length + ' data points.');
    } catch (e) {
        console.error('Init error:', e);
        document.getElementById('dataStatus').textContent = 'Error Loading Data';
        document.getElementById('dataStatus').classList.remove('loaded');
        document.getElementById('dataStatus').style.color = '#f43f5e';
    }
}

// Dropdown Builders
function extractHierarchy() {
    var hierarchy = {};
    for (var i = 0; i < dataJson.data.length; i++) {
        var r = dataJson.data[i];
        var dIdx = r[1];
        var mIdx = r[2];
        if (!hierarchy[dIdx]) hierarchy[dIdx] = new Set();
        hierarchy[dIdx].add(mIdx);
    }
    return hierarchy;
}

function buildDropdown(deptGroups, ministries, data, listEl, type) {
    var hierarchy = extractHierarchy();

    var sortedDepts = Object.keys(hierarchy).map(function (k) { return Number(k); }).sort(function (a, b) {
        return deptGroups[a].localeCompare(deptGroups[b]);
    });

    var html = '';
    for (var d = 0; d < sortedDepts.length; d++) {
        var dIdx = sortedDepts[d];
        var deptName = deptGroups[dIdx];
        var mSet = Array.from(hierarchy[dIdx]).sort(function (a, b) {
            return ministries[a].localeCompare(ministries[b]);
        });

        // Parent item
        var checkbox = type === 'compare' ? '<div class="dd-checkbox"></div>' : '';
        html += '<div class="dd-item is-parent" data-type="deptGroup" data-id="' + dIdx + '">' +
            checkbox +
            '<span class="dd-icon">\u{1F3DB}\uFE0F</span>' +
            '<span class="dd-text">' + deptName + '</span>' +
            '</div>';

        // Children
        for (var m = 0; m < mSet.length; m++) {
            var mIdx = mSet[m];
            var minName = ministries[mIdx];
            html += '<div class="dd-item is-child" data-type="ministry" data-id="' + mIdx + '">' +
                checkbox +
                '<span class="dd-text">' + minName + '</span>' +
                '</div>';
        }
    }

    listEl.innerHTML = html;
}

function buildSlicers() {
    var html = '';
    dataJson.expenseTypes.forEach(function (ex, i) {
        var color = PALETTE[i % PALETTE.length];
        html += '<button class="slicer-btn active" data-id="' + i + '">' +
            '<span class="slicer-color-indicator" style="background-color: ' + color + '"></span>' +
            ex +
            '</button>';
    });
    expenseTypeSlicer.innerHTML = html;
}

// Events
function setupEvents() {
    // Dropdown toggles
    document.addEventListener('click', function (e) {
        if (!e.target.closest('#mainDropdown')) document.getElementById('mainDropdown').classList.remove('open');
        if (!e.target.closest('#compareDropdown')) document.getElementById('compareDropdown').classList.remove('open');
    });

    mainDropdownTrigger.addEventListener('click', function (e) {
        e.stopPropagation();
        document.getElementById('compareDropdown').classList.remove('open');
        document.getElementById('mainDropdown').classList.toggle('open');
    });

    compareDropdownTrigger.addEventListener('click', function (e) {
        e.stopPropagation();
        document.getElementById('mainDropdown').classList.remove('open');
        document.getElementById('compareDropdown').classList.toggle('open');
    });

    // Main Dropdown Selection
    mainList.addEventListener('click', function (e) {
        var item = e.target.closest('.dd-item');
        if (!item) return;

        mainList.querySelectorAll('.dd-item').forEach(function (el) { el.classList.remove('selected'); });
        item.classList.add('selected');

        var type = item.getAttribute('data-type');
        var id = Number(item.getAttribute('data-id'));
        selectedMain = { type: type, id: id };

        var text = item.querySelector('.dd-text').textContent;
        mainDropdownTrigger.querySelector('.dropdown-label').textContent = text;

        document.getElementById('mainDropdown').classList.remove('open');
        updateChart();
    });

    // Compare Selection
    compareList.addEventListener('click', function (e) {
        var item = e.target.closest('.dd-item');
        if (!item) return;

        var type = item.getAttribute('data-type');
        var id = Number(item.getAttribute('data-id'));
        var key = type + ':' + id;

        if (selectedCompare.has(key)) {
            selectedCompare.delete(key);
            item.classList.remove('selected');
        } else {
            selectedCompare.add(key);
            item.classList.add('selected');
        }

        var label = selectedCompare.size === 0 ? 'None selected' : selectedCompare.size + ' selected';
        compareDropdownTrigger.querySelector('.dropdown-label').textContent = label;

        updateChart();
    });

    compareClearBtn.addEventListener('click', function () {
        selectedCompare.clear();
        compareList.querySelectorAll('.dd-item').forEach(function (el) { el.classList.remove('selected'); });
        compareDropdownTrigger.querySelector('.dropdown-label').textContent = 'None selected';
        updateChart();
    });

    // Search filters
    mainSearch.addEventListener('input', function (e) { filterList(e.target.value.toLowerCase(), mainList); });
    compareSearch.addEventListener('input', function (e) { filterList(e.target.value.toLowerCase(), compareList); });

    // Slicers
    expenseTypeSlicer.addEventListener('click', function (e) {
        var btn = e.target.closest('.slicer-btn');
        if (!btn) return;

        var id = Number(btn.getAttribute('data-id'));
        if (selectedExpenses.has(id)) {
            if (selectedExpenses.size === 1) return;
            selectedExpenses.delete(id);
            btn.classList.remove('active');
        } else {
            selectedExpenses.add(id);
            btn.classList.add('active');
        }
        updateChart();
    });

    // Combine Toggle
    combineToggle.addEventListener('change', function (e) {
        isCombineOn = e.target.checked;
        updateChart();
    });
}

function filterList(term, listEl) {
    var items = listEl.querySelectorAll('.dd-item');
    items.forEach(function (item) {
        var text = item.querySelector('.dd-text').textContent.toLowerCase();
        item.style.display = text.includes(term) ? 'flex' : 'none';
    });
}

// Chart Logic
function formatValue(val) {
    if (val >= 1e9) return '$' + (val / 1e9).toFixed(1) + 'B';
    if (val >= 1e6) return '$' + (val / 1e6).toFixed(1) + 'M';
    if (val >= 1e3) return '$' + (val / 1e3).toFixed(1) + 'K';
    return '$' + val;
}

function getSeriesData(selection, expensesFilter, combine) {
    var type = selection.type;
    var id = selection.id;

    var result = {};

    for (var i = 0; i < dataJson.data.length; i++) {
        var r = dataJson.data[i];
        var yIdx = r[0], dIdx = r[1], mIdx = r[2], eIdx = r[3], amt = r[4];

        if (type === 'deptGroup' && dIdx !== id) continue;
        if (type === 'ministry' && mIdx !== id) continue;

        if (expensesFilter && !expensesFilter.has(eIdx)) continue;

        if (!result[yIdx]) result[yIdx] = { total: 0, byExpense: {} };
        result[yIdx].total += amt;

        if (!result[yIdx].byExpense[eIdx]) result[yIdx].byExpense[eIdx] = 0;
        result[yIdx].byExpense[eIdx] += amt;
    }

    var sortedYears = Object.keys(result).map(Number).sort(function (a, b) {
        return dataJson.years[a] - dataJson.years[b];
    });

    return sortedYears.map(function (yIdx) {
        return {
            year: dataJson.years[yIdx],
            total: result[yIdx].total,
            byExpense: result[yIdx].byExpense
        };
    });
}

function updateChart() {
    if (!selectedMain) {
        chartWrapper.classList.remove('active');
        emptyState.classList.remove('hidden');
        return;
    }

    chartWrapper.classList.add('active');
    emptyState.classList.add('hidden');

    var datasets = [];
    var labels = dataJson.years.slice().sort(function (a, b) { return a - b; });
    var scales = {};

    var mainSeries = getSeriesData(selectedMain, selectedExpenses, isCombineOn);

    var mainName = selectedMain.type === 'deptGroup'
        ? dataJson.deptGroups[selectedMain.id]
        : dataJson.ministries[selectedMain.id];

    chartTitle.textContent = mainName + ' — Expenses';

    // Summary Stats
    var totalAmt = 0;
    var peakAmt = 0;
    var peakYr = '—';
    var recentAmt = 0;
    var recentYr = '—';

    if (mainSeries.length > 0) {
        for (var i = 0; i < mainSeries.length; i++) {
            var pt = mainSeries[i];
            totalAmt += pt.total;
            if (pt.total > peakAmt) {
                peakAmt = pt.total;
                peakYr = pt.year;
            }
        }
        var last = mainSeries[mainSeries.length - 1];
        recentAmt = last.total;
        recentYr = last.year;
    }

    document.getElementById('valTotal').textContent = formatValue(totalAmt);
    document.getElementById('valPeakYear').textContent = peakYr;
    document.getElementById('valPeakAmount').textContent = formatValue(peakAmt);
    document.getElementById('valRecentYear').textContent = recentYr;
    document.getElementById('valRecentAmount').textContent = formatValue(recentAmt);
    document.getElementById('valAvg').textContent = mainSeries.length ? formatValue(totalAmt / mainSeries.length) : '—';

    // Build Chart Data
    if (!isCombineOn && selectedCompare.size === 0) {
        // Stacked Bar for main selection
        var expArray = Array.from(selectedExpenses);
        expArray.forEach(function (eIdx) {
            var expName = dataJson.expenseTypes[eIdx];
            var color = PALETTE[eIdx % PALETTE.length];

            var dataPoints = labels.map(function (yr) {
                var found = mainSeries.find(function (s) { return s.year === yr; });
                return found && found.byExpense[eIdx] ? found.byExpense[eIdx] : 0;
            });

            datasets.push({
                type: 'bar',
                label: mainName + ' — ' + expName,
                data: dataPoints,
                backgroundColor: color,
                borderColor: 'transparent',
                yAxisID: 'y',
                stack: 'main'
            });
        });
    } else {
        // Combined Bar
        var dataPoints = labels.map(function (yr) {
            var found = mainSeries.find(function (s) { return s.year === yr; });
            return found ? found.total : 0;
        });

        datasets.push({
            type: 'bar',
            label: mainName + ' (Total)',
            data: dataPoints,
            backgroundColor: 'rgba(59, 130, 246, 0.5)',
            borderColor: '#3b82f6',
            borderWidth: 1,
            yAxisID: 'y',
        });
    }

    // Add Comparisons
    if (selectedCompare.size > 0) {
        var colorIdx = 2;
        selectedCompare.forEach(function (compKey) {
            var parts = compKey.split(':');
            var cType = parts[0];
            var cId = Number(parts[1]);
            var cSer = getSeriesData({ type: cType, id: cId }, selectedExpenses, true);
            var cName = cType === 'deptGroup' ? dataJson.deptGroups[cId] : dataJson.ministries[cId];

            var cDataPoints = labels.map(function (yr) {
                var found = cSer.find(function (s) { return s.year === yr; });
                return found ? found.total : 0;
            });

            datasets.push({
                type: 'line',
                label: cName + ' (Compare)',
                data: cDataPoints,
                borderColor: PALETTE[colorIdx % PALETTE.length],
                backgroundColor: 'transparent',
                borderWidth: 3,
                tension: 0.3,
                pointRadius: 4,
                yAxisID: 'y1'
            });
            colorIdx++;
        });
    }

    scales.y = {
        type: 'linear',
        position: 'left',
        title: { display: true, text: 'Amount (Main)', color: '#8b95b0' },
        ticks: { color: '#8b95b0', callback: function (v) { return formatValue(v); } },
        grid: { color: 'rgba(255,255,255,0.04)' }
    };

    if (selectedCompare.size > 0) {
        scales.y1 = {
            type: 'linear',
            position: 'right',
            title: { display: true, text: 'Amount (Compare)', color: '#8b95b0' },
            ticks: { color: '#8b95b0', callback: function (v) { return formatValue(v); } },
            grid: { drawOnChartArea: false }
        };
    }

    if (mainChart) mainChart.destroy();
    var ctx = document.getElementById('mainChart').getContext('2d');

    mainChart = new Chart(ctx, {
        data: { labels: labels, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: '#f0f4fc' } },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return context.dataset.label + ': ' + formatValue(context.parsed.y);
                        }
                    }
                }
            },
            scales: scales
        }
    });
}

// Start
init();
