let s = '';
process.stdin.on('data', (d) => (s += d));
process.stdin.on('end', () => {
  const d = JSON.parse(s);
  console.log('passed:', d.numPassedTests, 'failed:', d.numFailedTests);
  for (const tr of d.testResults)
    for (const a of tr.assertionResults)
      if (a.status !== 'passed') {
        console.log('FAILED:', a.fullName);
        console.log((a.failureMessages[0] || '').slice(0, 500));
      }
});
