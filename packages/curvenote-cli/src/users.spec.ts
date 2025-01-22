import { describe, expect, it } from 'vitest';
import { User, Session, Team } from '.';

describe('Models', () => {
  it.skip('unauthenticated requests work for users', async () => {
    const session = await Session.create();
    const user = await new User(session, '@rowanc1').get();
    expect(user.data.username).toBe('rowanc1');
  });
  it.skip('unauthenticated requests work for teams', async () => {
    const session = await Session.create();
    const user = await new Team(session, '@curvenote').get();
    expect(user.data.username).toBe('curvenote');
  });
});
