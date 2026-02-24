/* ═══════════════════════════════════════════
   Federal Expenses Dashboard — App Logic
   ═══════════════════════════════════════════ */

let dataJson = null;
let mainChart = null;

// Dynamic State
let selectedMain = null;      // { type: 'deptGroup'|'ministry', id: index }
let selectedCompare = new Set(); // set of '{type}:{id}' strings
let selectedExpenses = new Set(); // set of expense type indices
let isCombineOn = true;

// Predefined colors for charts (especially stacked)
const PALETTE = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f43f5e', // rose
];

// ── DOM Nodes
const mainDropdownTrigger = document.getElementById('mainDropdownTrigger');
const mainDropdownMenu = document.getElementById('mainDropdownMenu');
const mainSearch = document.getElementById('mainSearch');
const mainList = document.getElementById('mainList');

const compareDropdownTrigger = document.getElementById('compareDropdownTrigger');
const compareDropdownMenu = document.getElementById('compareDropdownMenu');
const compareSearch = document.getElementById('compareSearch');
const compareList = document.getElementById('compareList');
const compareClearBtn = document.getElementById('compareClearBtn');

const expenseTypeSlicer = document.getElementById('expenseTypeSlicer');
const combineToggle = document.getElementById('combineToggle');
const emptyState = document.getElementById('emptyState');
const chartWrapper = document.querySelector('.chart-wrapper');
const chartTitle = document.getElementById('chartTitle');

// ── Init
async function init() {
    try {
        const res = await fetch('data.json');
        if (!res.ok) throw new Error('Could not load data.json');
        dataJson = await res.json();

        // initialize selections
        dataJson.expenseTypes.forEach((_, i) => selectedExpenses.add(i));

        buildDropdown(dataJson.deptGroups, dataJson.ministries, dataJson.data, mainList, 'main');
        buildDropdown(dataJson.deptGroups, dataJson.ministries, dataJson.data, compareList, 'compare');
        buildSlicers();

        setupEvents();
    } catch (e) {
        console.error(e);
        document.getElementById('dataStatus').textContent = 'Error Loading Data';
        document.getElementById('dataStatus').classList.remove('loaded');
        document.getElementById('dataStatus').style.color = '#f43f5e';
    }
}

// ── Dropdown Builders
// We group ministries by DeptGroup based on the data rows
function extractHierarchy() {
    const hierarchy = {}; // { deptGroupIdx: Set(ministryIdx) }
    for (const r of dataJson.data) {
        const dIdx = r[1];
        const mIdx = r[2];
        if (!hierarchy[dIdx]) hierarchy[dIdx] = new Set();
        hierarchy[dIdx].add(mIdx);
    }
    return hierarchy;
}

function buildDropdown(deptGroups, ministries, data, listEl, type) {
    const hierarchy = extractHierarchy();

    // Sort dept groups alphabetically
    const sortedDepts = Object.keys(hierarchy).map(k => Number(k)).sort((a, b) => deptGroups[a].localeCompare(deptGroups[b]));

    let html = '';
    for (const dIdx of sortedDepts) {
        const deptName = deptGroups[dIdx];
        const mSet = Array.from(hierarchy[dIdx]).sort((a, b) => ministries[a].localeCompare(ministries[b]));

        // Parent item
        html += `<div class="dd-item is-parent" data-type="deptGroup" data-id="${dIdx}">
            ${type === 'compare' ? '<div class="dd-checkbox"></div>' : ''}
            <span class="dd-icon">🏛️</span>
            <span class="dd-text">${deptName}</span>
        </div>`;

        // Children
        for (const mIdx of mSet) {
            const minName = ministries[mIdx];
            // Don't show ministry if name is exactly same as deptGroup (redundant)
            // Actually, we should show it in case they want strictly that ministry, but we'll indent it
            html += `<div class="dd-item is-child" data-type="ministry" data-id="${mIdx}">
                ${type === 'compare' ? '<div class="dd-checkbox"></div>' : ''}
                <span class="dd-text">${minName}</span>
            </div>`;
        }
    }

    listEl.innerHTML = html;
}

function buildSlicers() {
    let html = '';
    dataJson.expenseTypes.forEach((ex, i) => {
        const color = PALETTE[i % PALETTE.length];
        html += `<button class="slicer-btn active" data-id="${i}">
            <span class="slicer-color-indicator" style="background-color: ${color}"></span>
            ${ex}
        </button>`;
    });
    expenseTypeSlicer.innerHTML = html;
}

// ── Events
function setupEvents() {
    // Dropdown toggles
    document.addEventListener('click', (e) => {
        // close dropdowns if click outside
        if (!e.target.closest('#mainDropdown')) document.getElementById('mainDropdown').classList.remove('open');
        if (!e.target.closest('#compareDropdown')) document.getElementById('compareDropdown').classList.remove('open');
    });

    mainDropdownTrigger.addEventListener('click', () => {
        document.getElementById('compareDropdown').classList.remove('open');
        document.getElementById('mainDropdown').classList.toggle('open');
    });

    compareDropdownTrigger.addEventListener('click', () => {
        document.getElementById('mainDropdown').classList.remove('open');
        document.getElementById('compareDropdown').classList.toggle('open');
    });

    // Main Dropdown Selection
    mainList.addEventListener('click', (e) => {
        const item = e.target.closest('.dd-item');
        if (!item) return;

        // remove old selection
        mainList.querySelectorAll('.dd-item').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');

        const type = item.getAttribute('data-type');
        const id = Number(item.getAttribute('data-id'));
        selectedMain = { type, id };

        const text = item.querySelector('.dd-text').textContent;
        mainDropdownTrigger.querySelector('.dropdown-label').textContent = text;

        document.getElementById('mainDropdown').classList.remove('open');
        updateChart();
    });

    // Compare Selection
    compareList.addEventListener('click', (e) => {
        const item = e.target.closest('.dd-item');
        if (!item) return;

        const type = item.getAttribute('data-type');
        const id = Number(item.getAttribute('data-id'));
        const key = \`\${type}:\${id}\`;
        
        if(selectedCompare.has(key)) {
            selectedCompare.delete(key);
            item.classList.remove('selected');
        } else {
            selectedCompare.add(key);
            item.classList.add('selected');
        }
        
        const label = selectedCompare.size === 0 ? 'None selected' : \`\${selectedCompare.size} selected\`;
        compareDropdownTrigger.querySelector('.dropdown-label').textContent = label;
        
        updateChart();
    });

    compareClearBtn.addEventListener('click', () => {
        selectedCompare.clear();
        compareList.querySelectorAll('.dd-item').forEach(el => el.classList.remove('selected'));
        compareDropdownTrigger.querySelector('.dropdown-label').textContent = 'None selected';
        updateChart();
    });

    // Search filters
    mainSearch.addEventListener('input', (e) => filterList(e.target.value.toLowerCase(), mainList));
    compareSearch.addEventListener('input', (e) => filterList(e.target.value.toLowerCase(), compareList));

    // Slicers
    expenseTypeSlicer.addEventListener('click', (e) => {
        const btn = e.target.closest('.slicer-btn');
        if(!btn) return;
        
        const id = Number(btn.getAttribute('data-id'));
        if(selectedExpenses.has(id)) {
            if(selectedExpenses.size === 1) return; // don't allow unselecting last one
            selectedExpenses.delete(id);
            btn.classList.remove('active');
        } else {
            selectedExpenses.add(id);
            btn.classList.add('active');
        }
        updateChart();
    });

    // Combine Toggle
    combineToggle.addEventListener('change', (e) => {
        isCombineOn = e.target.checked;
        updateChart();
    });
}

function filterList(term, listEl) {
    const items = listEl.querySelectorAll('.dd-item');
    items.forEach(item => {
        const text = item.querySelector('.dd-text').textContent.toLowerCase();
        if(text.includes(term)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// ── Chart Logic
function formatValue(val) {
    if(val >= 1e9) return '$' + (val / 1e9).toFixed(1) + 'B';
    if(val >= 1e6) return '$' + (val / 1e6).toFixed(1) + 'M';
    if(val >= 1e3) return '$' + (val / 1e3).toFixed(1) + 'K';
    return '$' + val;
}

function getSeriesData(selection, expensesFilter, combine) {
    const { type, id } = selection;
    // We want data over time (years)
    
    // Group by year, then by expense type if combine is false
    const result = {}; // { yearIdx: { total: X, byExpense: { exIdx: Y } } }
    
    for(const r of dataJson.data) {
        const [yIdx, dIdx, mIdx, eIdx, amt] = r;
        
        // Filter by Ministry or DeptGroup
        if(type === 'deptGroup' && dIdx !== id) continue;
        if(type === 'ministry' && mIdx !== id) continue;
        
        // Filter by Expense Types
        if(expensesFilter && !expensesFilter.has(eIdx)) continue;
        
        if(!result[yIdx]) result[yIdx] = { total: 0, byExpense: {} };
        result[yIdx].total += amt;
        
        if(!result[yIdx].byExpense[eIdx]) result[yIdx].byExpense[eIdx] = 0;
        result[yIdx].byExpense[eIdx] += amt;
    }
    
    // Convert to sorted array
    const sortedYears = Object.keys(result).map(Number).sort((a,b) => dataJson.years[a] - dataJson.years[b]);
    
    return sortedYears.map(yIdx => ({
        year: dataJson.years[yIdx],
        total: result[yIdx].total,
        byExpense: result[yIdx].byExpense
    }));
}

function updateChart() {
    if(!selectedMain) {
        chartWrapper.classList.remove('active');
        emptyState.classList.remove('hidden');
        return;
    }

    chartWrapper.classList.add('active');
    emptyState.classList.add('hidden');

    const datasets = [];
    const labels = dataJson.years.slice().sort((a,b) => a-b);
    const scales = {};

    let mainSeries = getSeriesData(selectedMain, selectedExpenses, isCombineOn);

    const mainName = selectedMain.type === 'deptGroup' 
        ? dataJson.deptGroups[selectedMain.id] 
        : dataJson.ministries[selectedMain.id];

    chartTitle.textContent = \`\${mainName} Expenses\`;

    // Calculate Summary Stats
    let totalAmt = 0;
    let peakAmt = 0;
    let peakYr = '-';
    let recentAmt = 0;
    let recentYr = '-';
    
    if(mainSeries.length > 0) {
        for(const pt of mainSeries) {
            totalAmt += pt.total;
            if(pt.total > peakAmt) {
                peakAmt = pt.total;
                peakYr = pt.year;
            }
        }
        const last = mainSeries[mainSeries.length - 1];
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
    if (isCombineOn || selectedCompare.size > 0) {
        // If "Compare With" is active, we force combine mode for the main dataset to avoid visual clutter
        // Actually, user spec: "When unselected, the stacked bar chart will list the ExpenseType in the chart legend". 
        // Doesn't strictly forbid "Compare With", but usually you can't compare a stacked bar chart with another line nicely on two axes.
        // I will make the main series a stacked bar if !isCombineOn and NO comparisons. 
        // If there ARE comparisons, maybe we just draw the main series as a bar (total) and comparisons as lines.
        
        if (!isCombineOn) {
            // Stacked Bar for main selection
            const expArray = Array.from(selectedExpenses);
            expArray.forEach(eIdx => {
                const expName = dataJson.expenseTypes[eIdx];
                const color = PALETTE[eIdx % PALETTE.length];
                
                const dataPoints = labels.map(yr => {
                    const found = mainSeries.find(s => s.year === yr);
                    return found && found.byExpense[eIdx] ? found.byExpense[eIdx] : 0;
                });
                
                datasets.push({
                    type: 'bar',
                    label: \`\${mainName} - \${expName}\`,
                    data: dataPoints,
                    backgroundColor: color,
                    borderColor: 'transparent',
                    yAxisID: 'y',
                    stack: 'main'
                });
            });
        } else {
            // Combined Line/Bar
            const dataPoints = labels.map(yr => {
                const found = mainSeries.find(s => s.year === yr);
                return found ? found.total : 0;
            });
            
            datasets.push({
                type: 'bar',
                label: \`\${mainName} (Total)\`,
                data: dataPoints,
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                borderColor: '#3b82f6',
                borderWidth: 1,
                yAxisID: 'y',
            });
        }
        
        // Add Comparisons
        if (selectedCompare.size > 0) {
            let colorIdx = 2; // start with amber/emerald etc
            for(const compKey of selectedCompare) {
                const [cType, cIdStr] = compKey.split(':');
                const cId = Number(cIdStr);
                const cSer = getSeriesData({ type: cType, id: cId }, selectedExpenses, true); // ALWAYS combined
                const cName = cType === 'deptGroup' ? dataJson.deptGroups[cId] : dataJson.ministries[cId];
                
                const cDataPoints = labels.map(yr => {
                    const found = cSer.find(s => s.year === yr);
                    return found ? found.total : 0;
                });
                
                datasets.push({
                    type: 'line',
                    label: \`\${cName} (Compare)\`,
                    data: cDataPoints,
                    borderColor: PALETTE[colorIdx % PALETTE.length],
                    backgroundColor: 'transparent',
                    borderWidth: 3,
                    tension: 0.3,
                    pointRadius: 4,
                    yAxisID: 'y1'
                });
                colorIdx++;
            }
        }
        
        scales.y = {
            type: 'linear',
            position: 'left',
            title: { display: true, text: 'Amount (Main)', color: '#8b95b0' },
            ticks: { color: '#8b95b0', callback: v => formatValue(v) },
            grid: { color: 'rgba(255,255,255,0.04)' }
        };
        
        if (selectedCompare.size > 0) {
            scales.y1 = {
                type: 'linear',
                position: 'right',
                title: { display: true, text: 'Amount (Compare)', color: '#8b95b0' },
                ticks: { color: '#8b95b0', callback: v => formatValue(v) },
                grid: { drawOnChartArea: false }
            };
        }
    }

    if(mainChart) mainChart.destroy();
    const ctx = document.getElementById('mainChart').getContext('2d');
    
    mainChart = new Chart(ctx, {
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: '#f0f4fc' } },
                tooltip: {
                    callbacks: {
                        label: function(ctx) {
                            return \`\${ctx.dataset.label}: \${formatValue(ctx.parsed.y)}\`;
                        }
                    }
                }
            },
            scales
        }
    });
}

// Start
init();
