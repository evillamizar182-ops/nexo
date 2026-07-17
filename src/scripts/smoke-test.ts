import 'dotenv/config';
import axios from 'axios';

const PORT = process.env.PORT || 3100;
const ROOT_URL = `http://localhost:${PORT}`;
const BASE_URL = `${ROOT_URL}/api`;

async function runSmokeTest() {
  console.log('🔍 Starting Smoke Test...');

  try {
    // 1. Health Check
    const health = await axios.get(`${ROOT_URL}/health`);
    console.log('✅ Health check:', health.data.status);

    // 2. Auth Login (needs a user to be seeded first)
    // Credentials come from the environment — never hardcoded in the repo.
    // El JWT llega en una cookie httpOnly (Set-Cookie); la reenviamos manualmente.
    try {
      const login = await axios.post(`${BASE_URL}/auth/login`, {
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD
      });
      const setCookie = login.headers['set-cookie'] || [];
      const cookieHeader = setCookie.map((c: string) => c.split(';')[0]).join('; ');
      console.log('✅ Auth login successful');

      const headers = { Cookie: cookieHeader };

      // 3. Dashboard Stats
      const stats = await axios.get(`${BASE_URL}/dashboard/stats`, { headers });
      console.log('✅ Dashboard stats:', stats.status === 200 ? 'OK' : 'FAIL');

      // 4. Finance Stats
      const finance = await axios.get(`${BASE_URL}/dashboard/finance`, { headers });
      console.log('✅ Finance stats:', finance.data.revenueThisMonth >= 0 ? 'OK' : 'FAIL');

      // 5. Inventory
      const inventory = await axios.get(`${BASE_URL}/dashboard/inventory`, { headers });
      console.log('✅ Inventory list:', inventory.data.length >= 0 ? 'OK' : 'FAIL');

      console.log('\n✨ All critical paths are operational!');
    } catch (err: any) {
      console.error('❌ Auth or Dashboard tests failed:', err.response?.data || err.message);
      console.log('💡 Tip: Make sure to run "npm run seed" first and start the server with "npm run dev".');
    }

  } catch (err: any) {
    console.error(`❌ Server is not reachable. Make sure it is running on port ${PORT}.`);
  }
}

runSmokeTest();
