import fs from 'fs';
const lines = fs.readFileSync('C:/Users/ADMIN/.gemini/antigravity-ide/brain/645949f8-3852-4a66-8e9c-bd9d96a1c9ab/.system_generated/logs/transcript.jsonl', 'utf8').split('\n');
for (const l of lines) {
  try {
    const j = JSON.parse(l);
    if (j.step_index === 118) {
      console.log(j.tool_calls[0].args.CodeContent.slice(0, 500));
    }
  } catch(e) {}
}
