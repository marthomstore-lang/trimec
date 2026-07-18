async function test() {
  try {
    const res = await fetch('https://trimec.vercel.app/api/health');
    console.log('Status Code:', res.status);
    const body = await res.text();
    console.log('Body:', body);
  } catch (err) {
    console.error('ERROR:', err);
  }
}

test();
