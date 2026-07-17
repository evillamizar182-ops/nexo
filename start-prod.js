const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
        const [key, ...value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.join('=').trim().replace(/^"|"$/g, '');
        }
    });
}
console.log('🛡️ APEX SECURITY: Variables cargadas.');
const child = spawn('npm', ['run', 'dev'], { stdio: 'inherit', shell: true, env: process.env });
