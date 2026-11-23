import { useState } from 'react';
import { signIn } from './client';

export function App() {
  const [error, setError] = useState('');
  return <main><h1>DevQuest</h1><p>開発チームに参加して、既存システムの改修を体験する。</p>
    <button onClick={() => void signIn().catch((cause: Error) => setError(cause.message))}>GitHub でログイン</button>
    {error && <p role="alert">{error}</p>}</main>;
}
