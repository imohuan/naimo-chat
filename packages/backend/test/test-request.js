/**
 * Quick test script to call the local demo-router endpoint.
 * Usage:
 *   node test-request.js
 */
const fetch = (...args) =>
  import("node-fetch").then(({ default: f }) => f(...args));

function randomMessage() {
  const phrases = ["随机生成一个 数字， 只返回该数字"];
  const pick = phrases[Math.floor(Math.random() * phrases.length)];
  return `${pick} #${Math.floor(Math.random() * 1000)}`;
}

async function sendRequest(label) {
  const url = "http://127.0.0.1:3457/v1/messages";
  const body = {
    messages: [{ role: "user", content: randomMessage() }],
    model: "yunwu,glm-4.6",
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer sk-imohuan",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  console.log(`request ${label} status:`, res.status);
  console.log(`request ${label} response:`);
  console.log(text);
}

async function main() {
  const requests = Array.from({ length: 2 }, (_, idx) => sendRequest(idx + 1));
  await Promise.all(requests);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
