if ('Bun' in globalThis) {
  throw new Error('❌ Use Node.js to run this test!');
}

const { jwt } = require('@huyooo/elysia-jwt');

if (typeof jwt !== 'function') {
  throw new Error('❌ CommonJS Node.js failed');
}

console.log('✅ CommonJS Node.js works!');
