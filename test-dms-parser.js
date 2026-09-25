/**
 * Test script for DMS parser
 * Tests the coordinate parsing and normalization logic
 */

function normalizeDMS(degrees, minutes, seconds) {
  if (seconds >= 60) {
    const extraMinutes = Math.floor(seconds / 60);
    minutes += extraMinutes;
    seconds = seconds % 60;
  }

  if (minutes >= 60) {
    const extraDegrees = Math.floor(minutes / 60);
    degrees += extraDegrees;
    minutes = minutes % 60;
  }

  return { degrees, minutes, seconds };
}

function dmsToDecimal(degrees, minutes, seconds, direction) {
  const normalized = normalizeDMS(degrees, minutes, seconds);
  let decimal =
    normalized.degrees + normalized.minutes / 60 + normalized.seconds / 3600;

  const dir = direction.toUpperCase();
  if (dir === 'S' || dir === 'W') {
    decimal = -decimal;
  }

  return decimal;
}

function parseDMS(coordinatesStr) {
  try {
    const normalized = coordinatesStr.trim().replace(/\s+/g, ' ');
    const dmsRegex =
      /(-?\d+(?:\.\d+)?)\s*[°º]\s*(\d+(?:\.\d+)?)\s*[''′]\s*(\d+(?:\.\d+)?)\s*[""″]\s*([NSEWnsew])/g;

    const matches = [...normalized.matchAll(dmsRegex)];

    if (matches.length < 2) {
      return {
        success: false,
        error: 'Invalid DMS format',
      };
    }

    const [, lat_deg, lat_min, lat_sec, lat_dir] = matches[0];
    const latDirection = lat_dir.toUpperCase();

    if (latDirection !== 'N' && latDirection !== 'S') {
      return {
        success: false,
        error: 'First coordinate must be latitude (N or S)',
      };
    }

    const [, lng_deg, lng_min, lng_sec, lng_dir] = matches[1];
    const lngDirection = lng_dir.toUpperCase();

    if (lngDirection !== 'E' && lngDirection !== 'W') {
      return {
        success: false,
        error: 'Second coordinate must be longitude (E or W)',
      };
    }

    const latitude = dmsToDecimal(
      parseFloat(lat_deg),
      parseFloat(lat_min),
      parseFloat(lat_sec),
      latDirection
    );

    const longitude = dmsToDecimal(
      parseFloat(lng_deg),
      parseFloat(lng_min),
      parseFloat(lng_sec),
      lngDirection
    );

    if (latitude < -90 || latitude > 90) {
      return {
        success: false,
        error: `Latitude out of range: ${latitude.toFixed(6)}`,
      };
    }

    if (longitude < -180 || longitude > 180) {
      return {
        success: false,
        error: `Longitude out of range: ${longitude.toFixed(6)}`,
      };
    }

    return {
      success: true,
      latitude,
      longitude,
    };
  } catch (error) {
    return {
      success: false,
      error: 'Error parsing DMS',
    };
  }
}

// Test cases
const tests = [
  {
    name: 'Standard DMS',
    input: '19°01\'13.4"N 101°06\'59.0"W',
    expectedLat: 19.020389,
    expectedLng: -101.116389,
  },
  {
    name: 'DMS with spaces',
    input: '19° 01\' 13.4" N, 101° 06\' 59.0" W',
    expectedLat: 19.020389,
    expectedLng: -101.116389,
  },
  {
    name: 'DMS with 60 seconds normalization',
    input: '19°01\'13.4"N 101°06\'60.0"W',
    expectedLat: 19.020389,
    expectedLng: -101.116667,
  },
  {
    name: 'Lowercase directions',
    input: '19°01\'13.4"n 101°06\'59.0"w',
    expectedLat: 19.020389,
    expectedLng: -101.116389,
  },
  {
    name: 'South coordinate',
    input: '19°01\'13.4"S 101°06\'59.0"W',
    expectedLat: -19.020389,
    expectedLng: -101.116389,
  },
  {
    name: 'East coordinate',
    input: '19°01\'13.4"N 101°06\'59.0"E',
    expectedLat: 19.020389,
    expectedLng: 101.116389,
  },
];

console.log('='.repeat(70));
console.log('DMS PARSER TEST RESULTS');
console.log('='.repeat(70));
console.log();

let passed = 0;
let failed = 0;

tests.forEach((test, index) => {
  console.log(`Test ${index + 1}: ${test.name}`);
  console.log(`Input: ${test.input}`);

  const result = parseDMS(test.input);

  if (result.success) {
    const latMatch = Math.abs(result.latitude - test.expectedLat) < 0.000001;
    const lngMatch = Math.abs(result.longitude - test.expectedLng) < 0.000001;

    if (latMatch && lngMatch) {
      console.log(`✅ PASS`);
      console.log(`   Latitude:  ${result.latitude.toFixed(6)} (expected: ${test.expectedLat.toFixed(6)})`);
      console.log(`   Longitude: ${result.longitude.toFixed(6)} (expected: ${test.expectedLng.toFixed(6)})`);
      passed++;
    } else {
      console.log(`❌ FAIL - Coordinates don't match`);
      console.log(`   Latitude:  ${result.latitude.toFixed(6)} (expected: ${test.expectedLat.toFixed(6)})`);
      console.log(`   Longitude: ${result.longitude.toFixed(6)} (expected: ${test.expectedLng.toFixed(6)})`);
      failed++;
    }
  } else {
    console.log(`❌ FAIL - ${result.error}`);
    failed++;
  }

  console.log();
});

console.log('='.repeat(70));
console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
console.log('='.repeat(70));

// Test normalization separately
console.log();
console.log('NORMALIZATION TESTS:');
console.log('-'.repeat(70));

const normTests = [
  {
    input: { degrees: 101, minutes: 6, seconds: 60 },
    expected: { degrees: 101, minutes: 7, seconds: 0 },
  },
  {
    input: { degrees: 100, minutes: 60, seconds: 30 },
    expected: { degrees: 101, minutes: 0, seconds: 30 },
  },
  {
    input: { degrees: 100, minutes: 59, seconds: 120 },
    expected: { degrees: 101, minutes: 1, seconds: 0 },
  },
];

normTests.forEach((test, index) => {
  const result = normalizeDMS(test.input.degrees, test.input.minutes, test.input.seconds);
  const match =
    result.degrees === test.expected.degrees &&
    result.minutes === test.expected.minutes &&
    result.seconds === test.expected.seconds;

  console.log(`Norm Test ${index + 1}: ${match ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Input:    ${test.input.degrees}° ${test.input.minutes}' ${test.input.seconds}"`);
  console.log(`  Expected: ${test.expected.degrees}° ${test.expected.minutes}' ${test.expected.seconds}"`);
  console.log(`  Got:      ${result.degrees}° ${result.minutes}' ${result.seconds}"`);
  console.log();
});
