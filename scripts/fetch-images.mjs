import { mkdir, writeFile, access } from 'node:fs/promises';

const COUNT = 100;
await mkdir('assets', { recursive: true });

for (let i = 0; i < COUNT; i++) {
  const dest = `assets/img-${i}.jpg`;
  try {
    await access(dest);
    console.log(`skip ${dest}`);
    continue;
  } catch {}
  const url = `https://picsum.photos/seed/sphere-${i}/640/480.jpg`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    console.error(`FAILED ${url}: ${res.status}`);
    continue;
  }
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  console.log(`saved ${dest}`);
}
