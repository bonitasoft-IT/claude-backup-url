import { strToU8 } from 'fflate';

export function entry(path, value, source = 'fixture.zip') {
  const data = value instanceof Uint8Array ? value : strToU8(typeof value === 'string' ? value : JSON.stringify(value));
  return { path, data, source };
}

export function sampleProject(overrides = {}) {
  return {
    uuid: '01a0ae9d-7eeb-7161-9ec0-42442af82411',
    name: 'Migration domaine',
    description: 'Migration a.com vers b.com',
    is_private: true,
    is_starter_project: false,
    prompt_template: 'Réponds en français.',
    created_at: '2026-09-17T09:05:52.387728+00:00',
    updated_at: '2026-09-17T09:05:52.387728+00:00',
    creator: { uuid: 'u-1', full_name: 'Test User' },
    docs: [],
    ...overrides,
  };
}

export function sampleConversation(overrides = {}) {
  return {
    uuid: '155a6a46-bf11-46eb-9f53-3e59f071ee6a',
    name: 'Supprimer l’historique',
    summary: '',
    created_at: '2026-09-13T11:08:52.748765Z',
    updated_at: '2026-09-13T11:09:01.576624Z',
    account: { uuid: 'u-1' },
    project_uuid: null,
    chat_messages: [
      { uuid: 'm-1', sender: 'human', created_at: '2026-09-13T11:08:53Z', text: 'question', content: [{ type: 'text', text: 'question' }] },
      { uuid: 'm-2', sender: 'assistant', created_at: '2026-09-13T11:09:00Z', text: 'réponse', content: [{ type: 'text', text: 'réponse' }] },
    ],
    ...overrides,
  };
}
