import { useEffect, useState } from 'react';
import { Clipboard } from 'lucide-react';

export function Copy({ value, label }: { value: string; label: string }) {
    const [result, setResult] = useState('');
    useEffect(() => {
        if (!result) return;
        const timer = setTimeout(() => setResult(''), 3000);
        return () => clearTimeout(timer);
    }, [result]);
    return (
        <>
            <button
                type="button"
                className="button compact"
                onClick={async () => {
                    try {
                        await navigator.clipboard.writeText(value);
                        setResult('コピーしました');
                    } catch {
                        setResult('コピーできませんでした。テキストを選択してコピーしてください。');
                    }
                }}
            >
                <Clipboard size={14} />
                {label}
            </button>
            <span className="copy-feedback" role="status">
                {result}
            </span>
        </>
    );
}
