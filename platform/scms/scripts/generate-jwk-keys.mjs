#!/usr/bin/env node

/**
 * JWK Key Generation Script for JWT Integration
 * 
 * This script generates RSA key pairs in JWK format for the JWT integration feature.
 * It outputs properly formatted YAML that can be copied directly into the configuration files.
 * 
 * Usage:
 *   node scripts/generate-jwk-keys.mjs
 *   # or
 *   bun run generate:jwk-keys
 */

import { generateKeyPair, exportJWK } from 'jose';
import { webcrypto } from 'crypto';

// Polyfill for crypto in Node.js
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

async function generateJWKKeys() {
  try {
    console.log('Generating RSA key pair for JWT integration...\n');
    
    // Generate RSA key pair (2048-bit minimum for RS256)
    const { publicKey, privateKey } = await generateKeyPair('RS256', { extractable: true });
    
    // Convert to JWK format
    const publicJWK = await exportJWK(publicKey);
    const privateJWK = await exportJWK(privateKey);
    
    // Add required fields with date-based key ID
    const keyId = `integration-key-${new Date().toISOString().split('T')[0]}`;
    
    publicJWK.use = 'sig';
    publicJWK.alg = 'RS256';
    publicJWK.kid = keyId;
    
    privateJWK.use = 'sig';
    privateJWK.alg = 'RS256';
    privateJWK.kid = keyId;
    
    // Output formatted YAML for copy-paste
    console.log('🔐 JWT Integration Keys Generated Successfully!');
    console.log('═'.repeat(60));
    console.log();
    
    console.log('📄 PUBLIC KEY (add to .app-config.yml under api.integrations):');
    console.log('─'.repeat(60));
    console.log('publicKey:');
    console.log(`  kty: ${publicJWK.kty}`);
    console.log(`  n: ${publicJWK.n}`);
    console.log(`  e: ${publicJWK.e}`);
    console.log(`  use: ${publicJWK.use}`);
    console.log(`  alg: ${publicJWK.alg}`);
    console.log(`  kid: ${publicJWK.kid}`);
    console.log();
    
    console.log('🔑 PRIVATE KEY (add to .app-config.secrets.yml under api.integrations):');
    console.log('─'.repeat(60));
    console.log('privateKey:');
    console.log(`  kty: ${privateJWK.kty}`);
    console.log(`  n: ${privateJWK.n}`);
    console.log(`  e: ${privateJWK.e}`);
    console.log(`  d: ${privateJWK.d}`);
    console.log(`  p: ${privateJWK.p}`);
    console.log(`  q: ${privateJWK.q}`);
    console.log(`  dp: ${privateJWK.dp}`);
    console.log(`  dq: ${privateJWK.dq}`);
    console.log(`  qi: ${privateJWK.qi}`);
    console.log(`  use: ${privateJWK.use}`);
    console.log(`  alg: ${privateJWK.alg}`);
    console.log(`  kid: ${privateJWK.kid}`);
    console.log();
    
    console.log('⚠️  SECURITY REMINDERS:');
    console.log('─'.repeat(60));
    console.log('• Keep the private key secure and never commit it to version control');
    console.log('• Use different keys for different environments (dev/staging/production)');
    console.log('• Update the issuer URL in your config to match your domain');
    console.log('• Consider rotating keys every 90 days');
    console.log('• The kid field must match between public and private keys');
    console.log();
    
    console.log('✅ Ready to update your configuration files!');
    
  } catch (error) {
    console.error('❌ Error generating JWK keys:', error);
    process.exit(1);
  }
}

generateJWKKeys();