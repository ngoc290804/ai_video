// Real Tauri IPC and filesystem. No mock. Requires tauri-driver on localhost:4444.
import fs from "node:fs/promises";
const host = "http://127.0.0.1:4444";
async function request(path, data, method = "POST") {
  const response = await fetch(host + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await response.json();
  if (result.value?.error) throw Error(JSON.stringify(result.value));
  return result.value;
}
const session = await request("/session", {
  capabilities: {
    alwaysMatch: {
      "tauri:options": {
        application:
          process.env.STUDIO_BINARY ||
          process.cwd() + "/target/debug/ai-video-studio",
      },
    },
  },
});
const sid = session.sessionId;
console.log("Native session:", sid);
const js = (script, args = []) =>
  request(`/session/${sid}/execute/sync`, { script, args });
const asyncJs = (script, args = []) =>
  request(`/session/${sid}/execute/async`, { script, args });
try {
  await new Promise((r) => setTimeout(r, 3000));
  console.log(
    await js(
      "return {title:document.title,body:document.body.innerText.slice(0,1600),tauri:!!window.__TAURI_INTERNALS__}",
    ),
  );
  const result = await asyncJs(
    `const done=arguments[arguments.length-1];(async()=>{const inv=window.__TAURI_INTERNALS__.invoke;const call=async(command,payload={},project)=>{const r=await inv('studio_command',{command,request:{apiVersion:1,requestId:crypto.randomUUID(),projectId:project?.id,expectedRevision:project?.revision,payload}});if(!r.ok)throw Error(JSON.stringify(r.error));return r.data;};let p=await call('project_create',{title:'Desktop smoke — tiếng Việt'});const id=p.id; p=await call('project_update',{story:{...p.story,idea:'Chuyến tàu từ Hà Nội đến Đà Nẵng'}},p);await call('project_close');p=await call('project_open',{id});if(p.story.idea!=='Chuyến tàu từ Hà Nội đến Đà Nẵng')throw Error('Persistence failed');const revisions=await call('revision_list',{},p);if(!revisions.length)throw Error('Missing revision');await call('project_delete',{confirmation:p.title},p);return {passed:true,revision:p.revision,revisions:revisions.length};})().then(done,e=>done({error:e.message}));`,
  );
  console.log("Native IPC/storage:", result);
  if (result.error) throw Error(result.error);
  const clickText = async (text) => {
    const el = await request(`/session/${sid}/element`, {
      using: "xpath",
      value: `//button[normalize-space(.)='${text}']`,
    });
    await request(
      `/session/${sid}/element/${el["element-6066-11e4-a52e-4f735466cecf"]}/click`,
      {},
    );
  };
  const inputText = async (selector, text) => {
    await js(
      `const el=document.querySelector(arguments[0]);if(!el)throw Error('Missing input');el.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,arguments[1]);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));`,
      [selector, text],
    );
    await new Promise((r) => setTimeout(r, 150));
  };
  await clickText("Tạo dự án mới");
  await inputText('dialog input[name="title"]', "UI smoke — Biên tập thật");
  await clickText("Tạo dự án");
  await new Promise((r) => setTimeout(r, 1500));
  await js("document.querySelector('a[href=\"#/characters\"]').click()");
  await new Promise((r) => setTimeout(r, 300));
  for (const name of ["An", "Bình", "Chi"]) {
    await clickText("Thêm nhân vật");
    await new Promise((r) => setTimeout(r, 200));
    await inputText(".editor-panel input", name);
    await new Promise((r) => setTimeout(r, 1100));
  }
  const clickTitle = async (title) => {
    await js(
      "document.querySelector('button[title=\"'+arguments[0]+'\"]').click()",
      [title],
    );
    await new Promise((r) => setTimeout(r, 200));
  };
  await js("document.querySelector('a[href=\"#/settings\"]').click()");
  await new Promise((r) => setTimeout(r, 400));
  await clickText("Thêm OpenAI");
  await new Promise((r) => setTimeout(r, 500));
  await js("document.querySelector('a[href=\"#/characters\"]').click()");
  await new Promise((r) => setTimeout(r, 400));
  await js(
    `const el=[...document.querySelectorAll('label')].find(l=>l.innerText.includes('Kết nối giọng')).querySelector('select');el.value=el.options[1].value;el.dispatchEvent(new Event('change',{bubbles:true}));`,
  );
  await new Promise((r) => setTimeout(r, 200));
  await js(
    `const el=[...document.querySelectorAll('label')].find(l=>l.innerText.includes('Giọng mặc định')).querySelector('select');el.value='cedar';el.dispatchEvent(new Event('change',{bubbles:true}));`,
  );
  await new Promise((r) => setTimeout(r, 1100));
  await js("document.querySelector('a[href=\"#/scenes\"]').click()");
  await new Promise((r) => setTimeout(r, 300));
  await clickText("Thêm chương");
  await clickText("Thêm cảnh");
  await clickTitle("Nhân bản shot");
  await clickTitle("Đưa shot xuống");
  await clickText("Nhân bản cảnh");
  await clickTitle("Đưa cảnh lên");
  await clickTitle("Nhân bản chương");
  await clickTitle("Đưa chương xuống");
  await new Promise((r) => setTimeout(r, 1500));
  const ui = await asyncJs(
    `const done=arguments[arguments.length-1];window.__TAURI_INTERNALS__.invoke('studio_command',{command:'project_get',request:{apiVersion:1,requestId:crypto.randomUUID(),payload:{}}}).then(done);`,
  );
  if (
    !ui.ok ||
    ui.data.characters.map((c) => c.name).join(",") !== "An,Bình,Chi"
  )
    throw Error("Native UI autosave failed: " + JSON.stringify(ui));
  console.log("Native UI create/3 characters/autosave: passed");
  if (
    ui.data.chapters.length !== 2 ||
    ui.data.scenes.length !== 4 ||
    ui.data.scenes.some((s) => s.shots.length !== 2) ||
    !ui.data.characters.some((c) => c.voice?.voiceId === "cedar")
  )
    throw Error(
      "Authoring or voice mapping persistence failed: " + JSON.stringify(ui),
    );
  console.log(
    "Native chapter/scene/shot duplication and reorder + character voice mapping: passed",
  );
  const shot = await request(`/session/${sid}/screenshot`, undefined, "GET");
  await fs.writeFile(
    "tests/fixtures/native-desktop.png",
    Buffer.from(shot, "base64"),
  );
  await fs.writeFile(
    "tests/fixtures/desktop-smoke-result.json",
    JSON.stringify(
      {
        date: new Date().toISOString(),
        platform: process.platform,
        result,
        ui: {
          passed: true,
          characters: ui.data.characters.length,
          revision: ui.data.revision,
          structureAndVoice: true,
        },
      },
      null,
      2,
    ),
  );
  await asyncJs(
    `const done=arguments[arguments.length-1];window.__TAURI_INTERNALS__.invoke('studio_command',{command:'project_delete',request:{apiVersion:1,requestId:crypto.randomUUID(),projectId:arguments[0].id,expectedRevision:arguments[0].revision,payload:{confirmation:arguments[0].title}}}).then(done);`,
    [ui.data],
  );
} finally {
  await request(`/session/${sid}`, undefined, "DELETE");
}
