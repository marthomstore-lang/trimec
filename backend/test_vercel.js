async function test() {
  try {
    const res = await fetch('https://trimec.vercel.app/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'angelo@trimec.cl', password: 'trimec123' })
    });
    console.log('Status Code:', res.status);
    console.log('Headers:', Object.fromEntries(res.headers.entries()));
    const body = await res.text();
    console.log('Body:', body);
  } catch (err) {
    console.error('ERROR:', err);
  }
}

test();
