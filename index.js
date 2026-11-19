// Model Mirror (Vertex → AI Studio)
// Vertex AI 모델 목록에 있는 모델(다른 확장이 넣은 모델 포함)을 Google AI Studio 모델 목록에도 똑같이 넣는다.
// 미국 중계(AI Studio 리버스 프록시)로 Vertex 모델을 쓸 때 필요하다. 어떤 확장이 모델을 넣었는지는 상관없다.

import { oai_settings } from '../../../openai.js';
import { extension_settings } from '../../../extensions.js';
import { eventSource, event_types, saveSettingsDebounced } from '../../../../script.js';

const ID = 'model_mirror';
const SRC = 'model_vertexai_select';
const DST = 'model_google_select';

function cfg() {
    if (!extension_settings[ID]) extension_settings[ID] = {};
    if (typeof extension_settings[ID].chosen !== 'string') extension_settings[ID].chosen = '';
    return extension_settings[ID];
}

function has(select, value) {
    return [...select.options].some(o => o.value === value);
}

function mirrorGroup(dst) {
    return dst.querySelector('optgroup[data-mirror]');
}

function sync() {
    const src = document.getElementById(SRC);
    const dst = document.getElementById(DST);
    if (!(src instanceof HTMLSelectElement) || !(dst instanceof HTMLSelectElement)) return;

    let group = mirrorGroup(dst);
    const already = new Set([...dst.options].filter(o => !group || o.parentElement !== group).map(o => o.value));
    const names = [...new Set([...src.options].map(o => o.value).filter(v => v && !already.has(v)))];

    if (!group) {
        group = document.createElement('optgroup');
        group.label = 'Vertex 목록에서 가져온 모델';
        group.dataset.mirror = '1';
        dst.prepend(group);
    }
    if ([...group.children].map(o => o.value).join('\n') !== names.join('\n')) {
        const keep = dst.value;
        group.replaceChildren(...names.map(n => new Option(n, n)));
        if (keep) dst.value = keep;
    }
    if (group.hidden !== (names.length === 0)) group.hidden = names.length === 0;

    // 저장된 모델이 이제야 목록에 생겼으면 다시 골라 둔다.
    const want = oai_settings.google_model;
    if (want && dst.value !== want && has(dst, want)) dst.value = want;

    // 목록이 늦게 채워져서 실리태번이 다른 모델로 바꿔 버렸으면, 기억해 둔 모델로 되돌린다.
    const chosen = cfg().chosen;
    if (chosen && dst.value !== chosen && has(dst, chosen)) {
        dst.value = chosen;
        $(dst).trigger('change');
    }
}

function onChange() {
    const dst = document.getElementById(DST);
    const c = cfg();
    const group = mirrorGroup(dst);
    const value = dst.value;
    if (!value) return;
    // 기억한 모델이 아직 목록에 없을 때 바뀐 것은 실리태번의 자동 변경이다: 기억을 그대로 둔다.
    if (c.chosen && !has(dst, c.chosen)) return;
    // 가져온 모델을 고르면 기억하고, 다른 모델을 고르면 잊는다.
    const next = group && [...group.children].some(o => o.value === value) ? value : '';
    if (next !== c.chosen) {
        c.chosen = next;
        saveSettingsDebounced();
    }
}

function start() {
    const src = document.getElementById(SRC);
    const dst = document.getElementById(DST);
    if (!src || !dst || dst.dataset.mirrorOn) return;
    dst.dataset.mirrorOn = '1';
    $(dst).on('change', onChange);
    const watch = new MutationObserver(() => sync());
    watch.observe(src, { childList: true, subtree: true });
    watch.observe(dst, { childList: true, subtree: true });
    sync();
}

jQuery(() => {
    cfg();
    start();
    eventSource.once(event_types.APP_READY, () => { start(); sync(); });
});
