/**
 * Workbenchの固定Document・CSS・公開Asset参照を所有する。
 * @packageDocumentation
 * @responsibility 既存の固定配信内容とPathだけを保持し、任意Filesystemやhealthを所有しない。
 * @trace ARCH-000012
 * @boundary Serverの固定配信内容とHTTP表示処理。
 * @effect N/A: 固定値とメモリ内のAsset選択だけで、module初期化のI/Oを行わない。
 * @security 固定三Path以外はnullを返し、URL入力からFile Pathを構成しない。
 */
export const LOGO_PATH = "/assets/crdd-brand-icon.jpg";
export const CLIENT_ASSET_PATH = "/assets/workbench-client.js";

/**
 * CSR Rootと固定Asset参照だけを持つDocumentを構築する。
 * @responsibility Server Renderingを追加せず、既存HTMLを同一内容で返す。
 * @trace ARCH-000012
 * @input N/A: 固定Asset参照だけを使用する。
 * @returns 既存CSR起動用HTML文字列。
 * @precondition 配信側が要求・接続形態を検査済みである。
 * @postcondition Model・資格・通知をHTMLへ埋め込まない。
 * @effect N/A: 固定文字列の構築だけ。
 * @failure N/A: 外部入力・I/Oなし。
 * @invariant Documentの取得をDomain状態観測の代替としない。
 * @boundary Server配信とCSR起動。
 * @security 任意Script Path・HTML・資格を受け取らない。
 * @concurrency N/A: 共有状態を変更しない。
 */
export function renderClientDocument(): string {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>CROS Workbench</title><link rel="stylesheet" href="/workbench.css"></head><body><div data-workbench-react-root="true" aria-live="polite"><p class="empty-state">Workbenchを読み込んでいます。</p></div><script type="module" src="${CLIENT_ASSET_PATH}"></script></body></html>`;
}

const shellCss = `:root{font-family:"Noto Sans CJK JP","Noto Sans JP","Yu Gothic UI",sans-serif;color:#18232d;background:#f2f3ef;font-synthesis:none;--ink:#18232d;--muted:#667078;--line:#d7dad3;--paper:#fbfbf8;--accent:#255c50;--accent-soft:#dfe9e4}*{box-sizing:border-box}body{margin:0;min-width:320px;background:linear-gradient(135deg,#f6f7f3,#ecefe9);font-size:15px}.app-shell{min-height:100vh;display:grid;grid-template-columns:220px minmax(0,1fr);grid-template-rows:68px minmax(0,1fr)}.topbar{grid-column:1/-1;display:flex;align-items:center;gap:28px;padding:0 24px;background:#fcfcf9;border-bottom:1px solid var(--line)}.brand{display:flex;align-items:center;gap:10px;min-width:196px;color:var(--ink);text-decoration:none}.brand img{border-radius:9px;object-fit:cover}.brand span{display:grid;line-height:1.05}.brand small{color:var(--muted);font-size:12px;letter-spacing:.08em;text-transform:uppercase}.project-switcher{display:grid;gap:2px;padding-left:20px;border-left:1px solid var(--line)}.project-switcher span{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}.connection{margin-left:auto;color:var(--muted);display:flex;align-items:center;gap:8px}.status-dot{width:9px;height:9px;border-radius:50%;background:#5a8e72}.sidebar{padding:22px 14px;border-right:1px solid var(--line);background:#f7f8f4}.sidebar nav{display:grid;gap:6px}.sidebar a{padding:11px 14px;border-radius:8px;color:#4f5960;text-decoration:none;font-weight:600}.sidebar a.active{background:var(--accent-soft);color:var(--accent)}main{min-width:0;padding:36px;overflow:auto}.page-heading{display:flex;justify-content:space-between;gap:24px;align-items:flex-start}.page-heading h1{font-size:clamp(28px,3vw,40px);line-height:1.15;margin:3px 0 8px}.page-heading p{margin:0;color:var(--muted);max-width:720px;line-height:1.7}.eyebrow{font-size:12px!important;text-transform:uppercase;letter-spacing:.1em;color:var(--accent)!important;font-weight:700}.page-heading button,.panel button{min-height:40px;padding:0 16px;border:1px solid var(--line);border-radius:8px;background:var(--accent);color:#fff;font-weight:700}.panel button:disabled{background:#b9bfba;color:#f4f5f2}.page-heading button{background:#e8eae5;color:#7c8485}.summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:30px 0}.summary-grid article,.panel{background:var(--paper);border:1px solid var(--line);border-radius:12px;box-shadow:0 6px 22px rgba(24,35,45,.045)}.summary-grid article{display:grid;gap:7px;padding:18px}.summary-grid span,.summary-grid small{color:var(--muted)}.summary-grid strong{font-size:22px}.workspace-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.panel{padding:22px}.panel.wide,.context-scene{grid-column:1/-1}.panel header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;border-bottom:1px solid var(--line);padding-bottom:14px}.panel h2{margin:2px 0;font-size:20px}.panel header>span{color:var(--muted);font-size:13px}.scene-summary{line-height:1.75;color:#38444c}.table-scroll{overflow:auto;margin-top:16px;border:1px solid var(--line);border-radius:9px}table{width:100%;border-collapse:collapse;min-width:680px;background:#fff}th,td{text-align:left;vertical-align:top;padding:12px 14px;border-bottom:1px solid var(--line);line-height:1.55}th{font-size:12px;letter-spacing:.04em;color:var(--muted);background:#f4f6f1}tbody tr:last-child td{border-bottom:0}.panel ul{list-style:none;padding:0;margin:0}.panel li{padding:16px 0;border-bottom:1px solid var(--line)}.panel li:last-child{border-bottom:0}.panel li p{margin:5px 0 0;color:var(--muted);line-height:1.6}.repository-group li{display:flex;justify-content:space-between;align-items:center;gap:16px}.repository-actions{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:20px}.repository-actions form,.credential-issue,.remote-connection-form{display:grid;gap:10px;padding:16px;border:1px solid var(--line);border-radius:9px}.repository-actions label,.credential-issue label,.remote-connection-form label,#credential-administration td form label{display:grid;gap:5px;font-weight:600}.repository-actions input,.credential-issue select,.remote-connection-form input,#credential-administration td input{min-height:40px;padding:8px 10px;border:1px solid var(--line);border-radius:7px;font:inherit}.repository-actions .confirm,#credential-administration .confirm{grid-template-columns:auto 1fr;align-items:center}.repository-actions .confirm input,#credential-administration .confirm input{min-height:0}.operation-result{padding:12px;border-radius:8px;background:var(--accent-soft)}.credential-issue,.remote-connection-form{grid-template-columns:minmax(180px,1fr) minmax(180px,1fr) minmax(180px,2fr) auto;align-items:end;margin-top:18px}.credential-issue p,.remote-connection-form p{margin:0;color:var(--muted);line-height:1.55}.one-time-token{display:grid;gap:8px;margin-top:12px}.one-time-token code{display:block;overflow-wrap:anywhere;padding:12px;background:#fff;border:1px solid var(--line);border-radius:7px;user-select:all}#credential-administration td form{display:grid;gap:7px;min-width:220px}.connection-actions{display:flex;gap:10px;margin-top:16px}.panel dl{margin:0}.panel dl div{display:flex;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid var(--line)}.panel dd{margin:0;font-weight:700}.empty-state{margin:18px 0 0;padding:22px;border:1px dashed #bfc5bc;border-radius:9px;color:var(--muted);line-height:1.7;background:#f7f8f4}.record-editor{margin-top:14px;border:1px solid var(--line);border-radius:9px;padding:12px}.record-editor summary{cursor:pointer;font-weight:700}.record-editor form{display:grid;gap:10px;margin-top:12px}.record-editor label{display:grid;gap:6px}.record-editor textarea{width:100%;padding:10px;border:1px solid var(--line);border-radius:7px;font:13px/1.5 ui-monospace,monospace}.record-editor .confirm{grid-template-columns:auto 1fr;align-items:start}.collection-controls{display:grid;grid-template-columns:repeat(3,minmax(150px,1fr));gap:10px;margin:16px 0;padding:14px;border:1px solid var(--line);border-radius:9px}.collection-controls label{display:grid;gap:5px;font-weight:600}.collection-controls input,.collection-controls select{min-height:40px;padding:8px 10px;border:1px solid var(--line);border-radius:7px;font:inherit}.collection-controls .confirm{grid-template-columns:auto 1fr;align-items:center}.collection-controls .confirm input{min-height:0}.page-link{display:inline-block;margin-top:14px;color:var(--accent);font-weight:700}@media(max-width:900px){.app-shell{grid-template-columns:1fr;grid-template-rows:68px auto 1fr}.sidebar{border-right:0;border-bottom:1px solid var(--line);padding:10px 18px}.sidebar nav{grid-template-columns:repeat(8,minmax(108px,1fr));overflow:auto}.summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}main{padding:28px 22px}.credential-issue,.remote-connection-form,.collection-controls{grid-template-columns:1fr}}@media(max-width:600px){.topbar{padding:0 14px;gap:12px}.brand{min-width:0}.brand small,.project-switcher span{display:none}.project-switcher{padding-left:12px}.connection{font-size:0}.sidebar{padding:8px 12px}.sidebar nav{grid-template-columns:repeat(3,minmax(0,1fr));overflow:visible}.sidebar a{text-align:center;padding:10px 5px;font-size:13px}.summary-grid,.workspace-grid,.repository-actions{grid-template-columns:1fr}.panel.wide,.context-scene{grid-column:auto}.page-heading{display:grid}.page-heading button{width:100%}main{padding:24px 16px}.summary-grid{margin:22px 0}}`;

const recordDetailCss = `.record-detail{max-width:1040px;margin:0 auto}.record-detail>.page-link{margin:0 0 18px}.record-detail .panel{padding:clamp(18px,4vw,34px)}.record-detail h1{margin:2px 0;font-size:clamp(24px,4vw,36px)}.detail-metadata{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 24px;margin:16px 0!important}.canonical-markdown{max-height:52vh;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;padding:18px;border:1px solid var(--line);border-radius:9px;background:#f7f8f4;font:13px/1.65 ui-monospace,monospace}@media(max-width:600px){.detail-metadata{grid-template-columns:1fr}}`;

const repositoryBrowserCss = `.repository-browser{margin:18px 0;padding:16px;border:1px solid var(--line);border-radius:9px;background:#fff}.repository-browser h3{margin:0 0 12px}.repository-breadcrumb{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:8px}.repository-tree li{display:flex;justify-content:space-between;gap:16px;padding:10px 0}.repository-tree a{display:flex;gap:8px;min-width:0;color:var(--accent);text-decoration:none}.repository-tree small{color:var(--muted)}.repository-diff{margin-top:18px}.repository-diff h4,.repository-diff h5{margin:12px 0 6px}.repository-diff pre{max-height:42vh;overflow:auto;margin:0;padding:14px;border:1px solid var(--line);border-radius:8px;background:#f7f8f4;font:12px/1.55 ui-monospace,monospace;white-space:pre;tab-size:2}`;

const aiRequestCss = `.ai-request-form{display:grid;grid-template-columns:minmax(190px,1fr) minmax(180px,1fr) minmax(320px,3fr) auto;gap:12px;align-items:end;margin-top:18px}.ai-request-form label{display:grid;gap:6px;font-weight:600}.ai-request-form select,.ai-request-form textarea{width:100%;padding:10px;border:1px solid var(--line);border-radius:7px;font:inherit}.ai-request-result{display:grid;gap:14px;margin-top:18px}.ai-request-result section{padding:14px;border:1px solid var(--line);border-radius:9px}.ai-request-result h3{margin:0 0 8px;font-size:15px}.candidate-metadata{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:14px 0}.candidate-metadata div{display:grid;gap:4px;padding:10px;border:1px solid var(--line);border-radius:7px}.candidate-metadata dd{overflow-wrap:anywhere}.candidate-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px}.candidate-actions form{display:grid;gap:8px;padding:12px;border:1px solid var(--line);border-radius:8px}.candidate-actions .confirm{display:grid;grid-template-columns:auto 1fr;gap:7px;align-items:start}.ai-profile-administration-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:18px}.ai-profile-administration-form>label{display:grid;gap:6px;font-weight:600}.ai-profile-administration-form input,.ai-profile-administration-form select{min-height:40px;padding:8px 10px;border:1px solid var(--line);border-radius:7px;font:inherit}.ai-profile-administration-form fieldset{display:grid;gap:6px;border:1px solid var(--line);border-radius:7px}.ai-profile-administration-form .confirm{display:flex;gap:7px;align-items:center}.ai-profile-administration-form button{align-self:end}@media(max-width:1100px){.ai-request-form{grid-template-columns:repeat(2,minmax(0,1fr))}.ai-request-form label:nth-of-type(3){grid-column:1/-1}.candidate-actions{grid-template-columns:1fr}}@media(max-width:900px){.ai-profile-administration-form{grid-template-columns:1fr}}@media(max-width:650px){.ai-request-form,.candidate-metadata{grid-template-columns:1fr}.ai-request-form label:nth-of-type(3){grid-column:auto}}`;

const ownerArtifactCss = `.owner-artifact-link>a,.owner-artifact-list a{display:grid;gap:6px;color:var(--accent);text-decoration:none}.owner-artifact-link,.owner-artifact-list li{padding:14px;border:1px solid var(--line);border-radius:9px;background:#fff}.owner-artifact-link small,.owner-artifact-list small{color:var(--muted);overflow-wrap:anywhere}.project-plan-panel h3{margin:22px 0 8px}.plan-facts,.quality-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:16px}.plan-facts div,.quality-facts div{display:grid;gap:6px;padding:14px;border:1px solid var(--line);border-radius:9px;background:#fff}.plan-facts span,.quality-facts span{color:var(--muted);font-size:12px}.plan-links{display:flex;flex-wrap:wrap;gap:18px}.document-search{display:grid;grid-template-columns:minmax(220px,1fr) auto;gap:10px;align-items:end;margin:16px 0}.document-search label{display:grid;gap:6px;font-weight:600}.document-search input{min-height:40px;padding:8px 10px;border:1px solid var(--line);border-radius:7px;font:inherit}@media(max-width:600px){.plan-facts,.quality-facts,.document-search{grid-template-columns:1fr}}`;

const visualAccessibilityCss = `body,.app-shell,.topbar,.sidebar,.sidebar nav{min-width:0}.project-switcher span{font-size:12px}button,input,select,textarea{max-width:100%;min-width:0}label:has(input[type="checkbox"]),label:has(input[type="radio"]){min-height:32px}.panel a,.record-detail a{display:inline-flex;align-items:center;min-width:32px;min-height:32px}@media(max-width:900px){.sidebar nav{min-width:0;max-width:100%}}@media(max-width:600px){.connection{font-size:inherit;max-width:9px;overflow:hidden}.connection-label{display:none}}@media(max-width:320px){.topbar{height:auto;min-height:68px;flex-wrap:wrap;padding:8px}.project-switcher{display:none}.brand{max-width:calc(100% - 24px)}.brand strong{font-size:12px}.sidebar{padding:6px}.sidebar nav{grid-template-columns:1fr}.sidebar a{overflow-wrap:anywhere}.page-heading h1{font-size:24px}main{padding:16px 8px}.panel,.summary-grid article{padding:12px}.panel header,.panel dl div{display:grid}.collection-controls,.credential-issue,.remote-connection-form,.ai-request-form,.ai-profile-administration-form,.candidate-metadata,.candidate-actions{grid-template-columns:1fr}}`;

const visualControlCss = `button,input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]),select,textarea{min-height:40px}label.confirm,#access-management label:has(input[type="checkbox"]){display:flex;align-items:center;gap:7px;min-height:40px}`;

/**
 * 固定PathのCSS・Logo・Client Scriptをメモリから選択する。
 * @responsibility 既存allowlistとContent-Typeを維持し、healthと動的Modelを分離する。
 * @trace ARCH-000012
 * @input 当該URLのpathname、起動時読取り済みのLogoとClient Script。
 * @returns 固定配信内容とContent-Type、対象外ならnull。
 * @precondition Assetは既存起動順で読み終えている。
 * @postcondition 元のBuffer参照または同一CSSを返し、File読取りを追加しない。
 * @effect N/A: 同期の固定Path選択だけ。
 * @failure N/A: 未知Pathはnullで呼出し側の既存拒否へ渡す。
 * @invariant Query・URL・任意PathをFilesystemへ渡さない。
 * @boundary HTTP表示処理と固定Asset内容。
 * @security Directory listing・任意静的Rootを追加しない。
 * @concurrency N/A: 共有状態を変更しない。
 */
export function readWorkbenchStaticAsset(
  requestPath: string,
  logo: Buffer,
  clientAsset: Buffer,
): Readonly<{ body: string | Buffer; contentType: string }> | null {
  if (requestPath === "/workbench.css")
    return {
      body:
        shellCss +
        recordDetailCss +
        repositoryBrowserCss +
        aiRequestCss +
        ownerArtifactCss +
        visualAccessibilityCss +
        visualControlCss,
      contentType: "text/css; charset=utf-8",
    };
  if (requestPath === LOGO_PATH)
    return { body: logo, contentType: "image/jpeg" };
  if (requestPath === CLIENT_ASSET_PATH)
    return { body: clientAsset, contentType: "text/javascript; charset=utf-8" };
  return null;
}
