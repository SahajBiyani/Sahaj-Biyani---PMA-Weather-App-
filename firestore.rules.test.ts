// @ts-nocheck
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';

const PROJECT_ID = 'firestore-emulator-project';
let testEnv: any;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('DRAFT_firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe('Firestore Rules - The Dirty Dozen', () => {
  const aliceContext = () => testEnv.authenticatedContext('alice', { email_verified: true });
  const bobContext = () => testEnv.authenticatedContext('bob', { email_verified: true });
  const unverifiedContext = () => testEnv.authenticatedContext('charlie', { email_verified: false });
  const unauthContext = () => testEnv.unauthenticatedContext();

  it('1. Create with different userId', async () => {
    const db = aliceContext().firestore();
    await assertFails(db.collection('weather_searches').add({
      locationName: 'Test', query: 'test', lat: 0, lon: 0, startDate: '2023-01-01', endDate: '2023-01-02',
      temperature: 20, details: {}, userId: 'bob', // belongs to bob but created by alice
      createdAt: testEnv.firestore.FieldValue.serverTimestamp(), updatedAt: testEnv.firestore.FieldValue.serverTimestamp()
    }));
  });

  // Additional tests...
});
