const [siteUrl, functionUrl] = process.argv.slice(2);
if (!siteUrl || !functionUrl) {
    console.error('Usage: node scripts/check-service.mjs <DevQuest URL> <quest function URL>');
    process.exit(2);
}

async function check(name, url, validate) {
    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        if (!(await validate(response))) throw new Error('unexpected response');
        console.log(name + ' OK');
    } catch (error) {
        console.error(name + ' NG: ' + error.message);
        process.exitCode = 1;
    }
}

await Promise.all([
    check('DevQuest', siteUrl, async (response) => /id=["']root["']/.test(await response.text())),
    check('Quest DB and Edge Function', functionUrl.replace(/\/$/, '') + '/health', async (response) => {
        return (await response.json()).status === 'ok';
    })
]);
