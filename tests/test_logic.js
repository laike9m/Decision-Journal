const { calculateStats, calculateChartData } = require('../src/renderer.js');

function testCalculateStats() {
    console.log('Running testCalculateStats...');
    
    // Test Case 1: Empty data
    let result = calculateStats([]);
    console.assert(result.yes === 0, 'TC1 Fail: yes should be 0');
    console.assert(result.no === 0, 'TC1 Fail: no should be 0');
    console.assert(result.rate === 0, 'TC1 Fail: rate should be 0');

    // Test Case 2: Data with empty actions
    result = calculateStats([
        { Action: '', 'Rules Followed': 'Yes' },
        { Action: '  ', 'Rules Followed': 'No' }
    ]);
    console.assert(result.yes === 0, 'TC2 Fail: yes should be 0');
    console.assert(result.no === 0, 'TC2 Fail: no should be 0');

    // Test Case 3: Normal data
    result = calculateStats([
        { Action: 'Trade 1', 'Rules Followed': 'Yes' },
        { Action: 'Trade 2', 'Rules Followed': 'No' },
        { Action: 'Trade 3', 'Rules Followed': 'Yes' }
    ]);
    console.assert(result.yes === 2, 'TC3 Fail: yes should be 2');
    console.assert(result.no === 1, 'TC3 Fail: no should be 1');
    console.assert(result.rate === 67, `TC3 Fail: rate should be 67, got ${result.rate}`);
    
    console.log('testCalculateStats passed!');
}

function testCalculateChartData() {
    console.log('Running testCalculateChartData...');
    
    // Test Case 1: Empty data
    let result = calculateChartData([]);
    console.assert(result.labels.length === 0, 'TC1 Fail: labels should be empty');
    console.assert(result.data.length === 0, 'TC1 Fail: data should be empty');

    // Test Case 2: Sorting and cumulative rate
    result = calculateChartData([
        { Date: '2026-04-12', Action: 'Late', 'Rules Followed': 'Yes' },
        { Date: '2026-04-10', Action: 'Early', 'Rules Followed': 'No' },
        { Date: '2026-04-11', Action: 'Mid', 'Rules Followed': 'Yes' }
    ]);
    
    // Should be sorted by date: 10, 11, 12
    console.assert(result.labels[0] === '2026-04-10', 'TC2 Fail: label 0 should be 2026-04-10');
    console.assert(result.labels[1] === '2026-04-11', 'TC2 Fail: label 1 should be 2026-04-11');
    console.assert(result.labels[2] === '2026-04-12', 'TC2 Fail: label 2 should be 2026-04-12');
    
    // Cumulative rates:
    // 10: 0/1 = 0%
    // 11: 1/2 = 50%
    // 12: 2/3 = 66.666...%
    console.assert(result.data[0] === 0, `TC2 Fail: data 0 should be 0, got ${result.data[0]}`);
    console.assert(result.data[1] === 50, `TC2 Fail: data 1 should be 50, got ${result.data[1]}`);
    console.assert(Math.round(result.data[2]) === 67, `TC2 Fail: data 2 should be ~67, got ${result.data[2]}`);
    
    console.log('testCalculateChartData passed!');
}

try {
    testCalculateStats();
    testCalculateChartData();
    console.log('All tests passed successfully!');
} catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
}
